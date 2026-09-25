import assert from 'node:assert/strict';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = mkdtempSync(join(tmpdir(), 'nm-ios-signing-'));

try {
  for (const path of ['app.json', 'package.json', 'plugins']) {
    cpSync(join(projectRoot, path), join(temporaryRoot, path), {
      recursive: true,
    });
  }

  symlinkSync(
    join(projectRoot, 'node_modules'),
    join(temporaryRoot, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );

  const expoCli = join(projectRoot, 'node_modules', 'expo', 'bin', 'cli');
  const prebuild = spawnSync(
    process.execPath,
    [expoCli, 'prebuild', '--platform', 'ios', '--no-install'],
    { cwd: temporaryRoot, encoding: 'utf8' },
  );

  assert.equal(
    prebuild.status,
    0,
    `Expo prebuild failed:\n${prebuild.stdout}\n${prebuild.stderr}`,
  );

  const project = readFileSync(
    join(temporaryRoot, 'ios', 'nm.xcodeproj', 'project.pbxproj'),
    'utf8',
  );

  for (const requiredConfiguration of [
    '[n^m] Sign Embedded Frameworks',
    'PLATFORM_NAME:-',
    'iphoneos',
    'CODE_SIGNING_ALLOWED:-NO',
    'FRAMEWORKS_FOLDER_PATH',
    'EXPANDED_CODE_SIGN_IDENTITY',
    '*.framework',
    '/usr/bin/codesign --force --sign',
  ]) {
    assert.match(
      project,
      new RegExp(requiredConfiguration.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `Generated Xcode project is missing ${requiredConfiguration}`,
    );
  }

  console.log(
    'Generated iOS project signs embedded frameworks for iPhoneOS builds.',
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
