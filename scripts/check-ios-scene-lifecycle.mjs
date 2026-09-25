import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import plistModule from '@expo/plist';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'nm-ios-scenes-'));
const plist = plistModule.default ?? plistModule;

function assertSpawnSucceeded(result, command) {
  assert.equal(
    result.error,
    undefined,
    `${command} could not be started: ${result.error?.message}`,
  );
  assert.equal(
    result.status,
    0,
    `${command} failed (status: ${result.status ?? 'null'}, signal: ${result.signal ?? 'none'}):\n${result.stdout}\n${result.stderr}`,
  );
}

function validateSceneManifest(infoPlist) {
  const manifest = JSON.parse(
    JSON.stringify(infoPlist.UIApplicationSceneManifest),
  );
  assert.deepEqual(manifest, {
    UIApplicationSupportsMultipleScenes: false,
    UISceneConfigurations: {
      UIWindowSceneSessionRoleApplication: [
        {
          UISceneConfigurationName: 'Default Configuration',
          UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
        },
      ],
    },
  });
}

function validateAppDelegate(contents) {
  assert.match(
    contents,
    /class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider \{/,
  );
  assert.match(contents, /reactNativeFactory = factory/);
  assert.doesNotMatch(contents, /factory\.startReactNative\(/);
  assert.doesNotMatch(contents, /UIWindow\(frame: UIScreen\.main\.bounds\)/);
}

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
    { cwd: temporaryRoot, encoding: 'utf8', env: { ...process.env, CI: '1' } },
  );
  assertSpawnSucceeded(result, 'Expo prebuild');

  const infoPlistPath = path.join(temporaryRoot, 'ios', 'nm', 'Info.plist');
  const infoPlist = plist.parse(await readFile(infoPlistPath, 'utf8'));
  validateSceneManifest(infoPlist);

  const appDelegate = await readFile(
    path.join(temporaryRoot, 'ios', 'nm', 'AppDelegate.swift'),
    'utf8',
  );
  validateAppDelegate(appDelegate);

  const manifestWithoutDelegate = structuredClone(infoPlist);
  delete manifestWithoutDelegate.UIApplicationSceneManifest
    .UISceneConfigurations.UIWindowSceneSessionRoleApplication[0]
    .UISceneDelegateClassName;
  assert.throws(
    () => validateSceneManifest(manifestWithoutDelegate),
    (error) => error instanceof assert.AssertionError,
    'a scene manifest without the Expo delegate must fail validation',
  );

  const appDelegateWithoutProvider = appDelegate.replace(
    ', ExpoReactNativeFactoryProvider',
    '',
  );
  assert.throws(
    () => validateAppDelegate(appDelegateWithoutProvider),
    (error) => error instanceof assert.AssertionError,
    'an AppDelegate that does not expose the factory must fail validation',
  );

  console.log(
    'Generated iOS application uses ExpoAppSceneDelegate to start React Native.',
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
