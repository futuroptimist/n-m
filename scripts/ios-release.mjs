import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateFile = '.expo/ios-release-state.json';

export function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      CI: '1',
      EXPO_NO_TELEMETRY: '1',
      GIT_OPTIONAL_LOCKS: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed (${result.status ?? result.error?.code}).\n${result.stderr || result.stdout || result.error?.message}`,
    );
  }
  return result.stdout.trim();
}

export function selectDevice(data, requested) {
  const devices = Object.entries(data.devices).flatMap(([runtime, entries]) =>
    runtime.includes('.iOS-') ? entries.filter((d) => d.isAvailable) : [],
  );
  const matches = requested
    ? devices.filter((d) => d.udid === requested)
    : devices;
  if (matches.length !== 1) {
    throw new Error(
      `Select exactly one available iOS simulator with --device <UDID>. Available:\n${devices.map((d) => `${d.name}: ${d.udid}`).join('\n') || 'None; install an iOS runtime in Xcode Settings > Components.'}`,
    );
  }
  return matches[0].udid;
}

export function prerequisites(exec, { platform, version, device }) {
  if (platform !== 'darwin')
    throw new Error(
      'iOS Release requires macOS and full Xcode. Windows/Linux can run npm run test:ios-workflow only.',
    );
  const [major, minor, patch] = version
    .replace(/^v/, '')
    .split('.')
    .map(Number);
  if (major !== 24 || minor < 22 || (minor === 22 && patch < 1)) {
    throw new Error(
      'Use patched Node 24.22.1 or newer Node 24: nvm install && nvm use.',
    );
  }
  exec('git', ['--version']);
  exec('npm', ['--version']);
  const developer = exec('xcode-select', ['-p']);
  if (!developer.endsWith('/Contents/Developer'))
    throw new Error(
      'Select full Xcode in Xcode Settings > Locations > Command Line Tools.',
    );
  exec('xcodebuild', ['-version']);
  try {
    exec('xcodebuild', ['-checkFirstLaunchStatus']);
  } catch (error) {
    throw new Error(
      `Open Xcode and complete its license/component setup yourself, then retry. ${error.message}`,
    );
  }
  exec('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-path']);
  try {
    exec('pod', ['--version']);
  } catch (error) {
    throw new Error(
      `Install or repair CocoaPods using your preferred Ruby/package manager, then retry. ${error.message}`,
    );
  }
  return selectDevice(
    JSON.parse(
      exec('xcrun', ['simctl', 'list', 'devices', 'available', '--json']),
    ),
    device,
  );
}

export function snapshot(directory, relative = '') {
  const items = [];
  for (const entry of fs
    .readdirSync(path.join(directory, relative), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const name = path.posix.join(relative, entry.name);
    // Only known build products are excluded; native source and lockfiles count.
    if (
      name === 'Pods' ||
      name === 'build' ||
      entry.name === 'xcuserdata' ||
      entry.name === '.DS_Store'
    )
      continue;
    if (entry.isSymbolicLink())
      throw new Error(`Refusing native symlink: ${name}`);
    if (entry.isDirectory()) items.push(...snapshot(directory, name));
    else
      items.push([
        name,
        createHash('sha256')
          .update(fs.readFileSync(path.join(directory, name)))
          .digest('hex'),
      ]);
  }
  return items;
}

export function inspect(cwd, exec) {
  for (const name of ['ios', '.expo', stateFile]) {
    const target = path.join(cwd, name);
    if (fs.lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink())
      throw new Error(`Refusing workflow symlink: ${name}`);
  }
  const tracked = exec('git', [
    'status',
    '--porcelain',
    '--untracked-files=no',
  ]);
  if (tracked)
    throw new Error(
      'Tracked files are dirty. Commit or preserve your changes yourself before running this workflow.',
    );
  const untracked = exec('git', ['ls-files', '--others', '--exclude-standard'])
    .split('\n')
    .filter((name) => name && !name.startsWith('ios/'));
  if (untracked.length)
    throw new Error(
      'Untracked files outside ios/ may affect generation. Preserve them and use a clean checkout.',
    );
  if (exec('git', ['ls-files', 'ios', 'android']))
    throw new Error(
      'Tracked native files require a separately reviewed native workflow.',
    );
  if (fs.existsSync(path.join(cwd, 'android')))
    throw new Error(
      'Existing android/ is outside this iOS workflow. Use a separate clean checkout.',
    );
  const inputs = exec('git', ['rev-parse', 'HEAD']);
  for (const name of fs.readdirSync(cwd)) {
    if (name === '.env' || name.startsWith('.env.'))
      throw new Error(
        'Local environment files may alter Expo config. Use a clean checkout without .env files.',
      );
  }
  const ios = path.join(cwd, 'ios');
  if (!fs.existsSync(ios)) return { inputs, fresh: true };
  if (fs.lstatSync(ios).isSymbolicLink())
    throw new Error('Refusing an ios/ symlink.');
  let state;
  try {
    state = JSON.parse(fs.readFileSync(path.join(cwd, stateFile), 'utf8'));
  } catch {
    /* Fail closed below. */
  }
  if (
    state?.inputs !== inputs ||
    JSON.stringify(state?.native) !== JSON.stringify(snapshot(ios))
  ) {
    throw new Error(
      'Existing native files are unowned, changed, or from another commit. Preserve/inspect them yourself; use a fresh checkout for regeneration. Nothing was deleted.',
    );
  }
  return { inputs, fresh: false };
}

export function buildSteps(fresh, device) {
  return [
    ['npm', ['ci']],
    ...(fresh
      ? [
          [
            'node',
            [
              'node_modules/expo/bin/cli',
              'prebuild',
              '--platform',
              'ios',
              '--no-install',
            ],
          ],
          ['pod', ['install'], 'ios'],
        ]
      : []),
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
  ];
}

export function workflow({
  cwd = root,
  exec = run,
  platform = process.platform,
  version = process.version,
  args = process.argv.slice(2),
  log = console.log,
} = {}) {
  const [mode, ...options] = args;
  if (
    !['doctor', 'launch'].includes(mode) ||
    (options.length &&
      (options.length !== 2 || options[0] !== '--device' || !options[1]))
  ) {
    throw new Error(
      'Usage: npm run ios:doctor|ios:release -- [--device <simulator-UDID>]',
    );
  }
  const invoke = (command, argv, relative) =>
    exec(command, argv, relative ? path.join(cwd, relative) : cwd);
  const device = prerequisites(invoke, {
    platform,
    version,
    device: options[1],
  });
  const before = inspect(cwd, invoke);
  log(
    `Ready: iOS simulator ${device}; ${before.fresh ? 'native generation required' : 'verified native rerun'}.`,
  );
  if (mode === 'doctor') return;
  for (const [command, argv, relative] of buildSteps(before.fresh, device)) {
    log(`Running ${command} ${argv.join(' ')}`);
    const output = invoke(command, argv, relative);
    if (output) log(output);
    // Prebuild must not silently rewrite package metadata or any tracked file.
    if (invoke('git', ['status', '--porcelain', '--untracked-files=no'])) {
      throw new Error(
        'A setup step changed tracked files. Stopped; inspect git diff. No changes were reverted.',
      );
    }
  }
  fs.mkdirSync(path.join(cwd, '.expo'), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, stateFile),
    JSON.stringify(
      { inputs: before.inputs, native: snapshot(path.join(cwd, 'ios')) },
      null,
      2,
    ) + '\n',
  );
  log(
    'Release simulator launch completed. Relaunch in Simulator without a running Metro server to verify the embedded bundle.',
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    workflow();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
