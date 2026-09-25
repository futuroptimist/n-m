import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'nm-ios-signing-'));

try {
  for (const entry of ['app.json', 'package.json', 'plugins']) {
    await cp(path.join(root, entry), path.join(temporaryRoot, entry), {
      recursive: true,
    });
  }
  await symlink(
    path.join(root, 'node_modules'),
    path.join(temporaryRoot, 'node_modules'),
  );

  const expo = path.join(root, 'node_modules', '.bin', 'expo');
  const result = spawnSync(
    expo,
    ['prebuild', '--platform', 'ios', '--no-install'],
    { cwd: temporaryRoot, encoding: 'utf8' },
  );
  assert.equal(
    result.status,
    0,
    `Expo prebuild failed:\n${result.stdout}\n${result.stderr}`,
  );

  const project = await readFile(
    path.join(temporaryRoot, 'ios', 'nm.xcodeproj', 'project.pbxproj'),
    'utf8',
  );
  const podfile = await readFile(
    path.join(temporaryRoot, 'ios', 'Podfile'),
    'utf8',
  );

  assert.match(project, /\[n-m\] Sign Embedded Frameworks/);
  assert.match(project, /EXPANDED_CODE_SIGN_IDENTITY/);
  assert.ok(project.includes("name '*.framework'"));
  assert.match(project, /alwaysOutOfDate = 1/);
  assert.match(
    podfile,
    /n-m: keep framework signing after CocoaPods embedding/,
  );
  assert.match(podfile, /\[CP\] Embed Pods Frameworks/);

  console.log(
    'Generated iOS project signs embedded frameworks after CocoaPods embedding.',
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
