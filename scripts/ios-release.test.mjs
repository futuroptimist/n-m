import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildSteps,
  inspect,
  prerequisites,
  run,
  selectDevice,
  snapshot,
  workflow,
} from './ios-release.mjs';

const device = '00000000-0000-0000-0000-000000000001';
const devices = {
  devices: {
    'com.apple.CoreSimulator.SimRuntime.iOS-26-0': [
      { name: 'iPhone', udid: device, isAvailable: true },
    ],
  },
};
function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-workflow-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const calls = [];
  const exec = (command, args) => {
    calls.push([command, args]);
    if (command === 'xcode-select')
      return '/Applications/Xcode.app/Contents/Developer';
    if (command === 'xcrun' && args[0] === 'simctl')
      return JSON.stringify(devices);
    if (command === 'git' && args[0] === 'rev-parse') return 'head';
    if (command === 'node') {
      fs.mkdirSync(path.join(cwd, 'ios'));
      fs.writeFileSync(path.join(cwd, 'ios', 'Podfile'), 'source');
    }
    return '';
  };
  return {
    cwd,
    calls,
    exec,
    platform: 'darwin',
    version: 'v24.22.1',
    log: () => {},
  };
}

test('explicit simulator selection rejects missing, unavailable, ambiguous and physical IDs', () => {
  assert.equal(selectDevice(devices), device);
  assert.throws(
    () => selectDevice(devices, 'physical-device'),
    /Select exactly one/,
  );
  assert.throws(() => selectDevice({ devices: {} }), /None/);
  const multiple = structuredClone(devices);
  multiple.devices[Object.keys(multiple.devices)[0]].push({
    name: 'Other',
    udid: 'other',
    isAvailable: true,
  });
  assert.throws(() => selectDevice(multiple), /Select exactly one/);
  assert.equal(selectDevice(multiple, device), device);
});

test('prerequisites fail closed for OS, Node, Xcode, license, SDK, pods and runtimes', (t) => {
  const f = fixture(t);
  for (const version of ['v22.22.0', 'v24.22.0', 'v25.0.0'])
    assert.throws(
      () => prerequisites(f.exec, { ...f, version }),
      /patched Node/,
    );
  assert.throws(
    () => prerequisites(f.exec, { ...f, platform: 'win32' }),
    /macOS/,
  );
  for (const target of [
    'git',
    'npm',
    'xcode-select',
    'xcodebuild',
    'xcrun',
    'pod',
  ]) {
    assert.throws(
      () =>
        prerequisites((command, args) => {
          if (command === target) throw new Error('blocked');
          return f.exec(command, args);
        }, f),
      /blocked/,
    );
  }
  assert.throws(
    () =>
      prerequisites(
        (command, args) =>
          command === 'xcode-select'
            ? '/Library/Developer/CommandLineTools'
            : f.exec(command, args),
        f,
      ),
    /full Xcode/,
  );
  assert.equal(prerequisites(f.exec, f), device);
});

test('doctor is read-only and invalid arguments never run commands', (t) => {
  const f = fixture(t);
  workflow({ ...f, args: ['doctor'] });
  assert.deepEqual(fs.readdirSync(f.cwd), []);
  assert.ok(
    f.calls.every(
      ([c, a]) =>
        !['node', 'open'].includes(c) &&
        !(c === 'npm' && a[0] !== '--version') &&
        !(c === 'pod' && a[0] !== '--version'),
    ),
  );
  const count = f.calls.length;
  assert.throws(() => workflow({ ...f, args: ['launch', '--clean'] }), /Usage/);
  assert.equal(f.calls.length, count);
});

test('tracked, untracked, native and local environment changes stop before mutation', (t) => {
  const f = fixture(t);
  assert.throws(() => inspect(f.cwd, () => 'dirty'), /Tracked files are dirty/);
  assert.throws(
    () =>
      inspect(f.cwd, (c, a) => (a.includes('--others') ? 'app.config.js' : '')),
    /Untracked files/,
  );
  assert.throws(
    () => inspect(f.cwd, (c, a) => (a[1] === 'ios' ? 'ios/Podfile' : '')),
    /Tracked native/,
  );
  fs.mkdirSync(path.join(f.cwd, 'ios'));
  assert.throws(() => inspect(f.cwd, f.exec), /unowned/);
  fs.writeFileSync(path.join(f.cwd, '.env.local'), 'VALUE=1');
  assert.throws(() => inspect(f.cwd, f.exec), /environment files/);
});

test('successful rerun skips generation; edits and changed HEAD cannot be overwritten', (t) => {
  const f = fixture(t);
  workflow({ ...f, args: ['launch'] });
  f.calls.length = 0;
  workflow({ ...f, args: ['launch', '--device', device] });
  assert.ok(!f.calls.some(([c]) => c === 'node'));
  assert.throws(
    () =>
      inspect(f.cwd, (c, a) =>
        a[0] === 'rev-parse' ? 'new-head' : f.exec(c, a),
      ),
    /another commit/,
  );
  fs.appendFileSync(path.join(f.cwd, 'ios', 'Podfile'), 'user edit');
  assert.throws(() => workflow({ ...f, args: ['launch'] }), /changed/);
  assert.match(
    fs.readFileSync(path.join(f.cwd, 'ios', 'Podfile'), 'utf8'),
    /user edit/,
  );
});

test('each mutation failure stops subsequent steps without recording ownership', (t) => {
  for (let index = 0; index < 4; index++) {
    const f = fixture(t);
    let mutations = 0;
    const exec = (c, a) => {
      if (
        (c === 'npm' && a[0] !== '--version') ||
        c === 'node' ||
        (c === 'pod' && a[0] === 'install')
      ) {
        if (mutations++ === index) throw new Error('step failed');
      }
      return f.exec(c, a);
    };
    assert.throws(
      () => workflow({ ...f, exec, args: ['launch'] }),
      /step failed/,
    );
    assert.equal(mutations, index + 1);
    assert.equal(
      fs.existsSync(path.join(f.cwd, '.expo', 'ios-release-state.json')),
      false,
    );
  }
});

test('commands use locked setup and Release simulator only; no destructive/signing/upload defaults', () => {
  assert.deepEqual(buildSteps(false, device), [
    ['npm', ['ci']],
    [
      'npm',
      [
        'run',
        'ios',
        '--',
        '--configuration',
        'Release',
        '--device',
        device,
        '--no-bundler',
        '--no-install',
      ],
    ],
  ]);
  const commands = JSON.stringify(buildSteps(true, device));
  assert.doesNotMatch(
    commands,
    /--clean|reset|stash|sudo|signing|upload|submit|"eas"|license/,
  );
  assert.match(commands, /--no-install/);
});

test('native fingerprint includes lockfiles and ignores build output', (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.cwd, 'Podfile.lock'), 'locked');
  const before = snapshot(f.cwd);
  fs.mkdirSync(path.join(f.cwd, 'build'));
  fs.writeFileSync(path.join(f.cwd, 'build', 'output'), 'output');
  assert.deepEqual(snapshot(f.cwd), before);
  fs.appendFileSync(path.join(f.cwd, 'Podfile.lock'), 'modified');
  assert.notDeepEqual(snapshot(f.cwd), before);
});

test('process errors propagate', () => {
  assert.throws(
    () => run(process.execPath, ['-e', 'process.exit(7)']),
    /failed \(7\)/,
  );
});

test('a successful setup command that dirties tracked files stops the pipeline', (t) => {
  const f = fixture(t);
  let installed = false;
  const exec = (c, a) => {
    if (c === 'npm' && a[0] === 'ci') installed = true;
    if (installed && c === 'git' && a[0] === 'status') return ' M package.json';
    return f.exec(c, a);
  };
  assert.throws(
    () => workflow({ ...f, exec, args: ['launch'] }),
    /changed tracked files/,
  );
  assert.ok(!f.calls.some(([c]) => c === 'node'));
});

test('corrupt ownership state and an Android directory fail closed', (t) => {
  const f = fixture(t);
  workflow({ ...f, args: ['launch'] });
  fs.writeFileSync(
    path.join(f.cwd, '.expo', 'ios-release-state.json'),
    '{broken',
  );
  assert.throws(() => inspect(f.cwd, f.exec), /unowned/);
  fs.mkdirSync(path.join(f.cwd, 'android'));
  assert.throws(() => inspect(f.cwd, f.exec), /Existing android/);
});
