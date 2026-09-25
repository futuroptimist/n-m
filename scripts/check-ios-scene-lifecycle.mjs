import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import plistPackage from '@expo/plist';

const plist = plistPackage.default;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'nm-ios-scenes-'));

function assertSpawnSucceeded(result, command) {
  assert.equal(
    result.error,
    undefined,
    `${command} could not start: ${result.error?.message}`,
  );
  assert.equal(
    result.status,
    0,
    `${command} failed (status: ${result.status ?? 'null'}, signal: ${result.signal ?? 'none'}):\n${result.stdout}\n${result.stderr}`,
  );
}

function validateSceneManifest(infoPlist) {
  const manifest = infoPlist.UIApplicationSceneManifest;
  assert.ok(
    manifest,
    'generated Info.plist must contain UIApplicationSceneManifest',
  );
  assert.equal(manifest.UIApplicationSupportsMultipleScenes, false);
  const configurations =
    manifest.UISceneConfigurations?.UIWindowSceneSessionRoleApplication;
  assert.equal(
    configurations?.length,
    1,
    'expected one application scene configuration',
  );
  assert.equal(
    configurations[0].UISceneConfigurationName,
    'Default Configuration',
  );
  assert.equal(
    configurations[0].UISceneDelegateClassName,
    'EXExpoAppSceneDelegate',
  );
}

function validateAppDelegate(contents) {
  assert.match(
    contents,
    /class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider \{/,
    'AppDelegate must expose its React Native factory to ExpoAppSceneDelegate',
  );
  assert.match(contents, /reactNativeFactory = factory/);
  assert.doesNotMatch(
    contents,
    /factory\.startReactNative\(/,
    'AppDelegate must leave window creation and React Native startup to ExpoAppSceneDelegate',
  );
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
    {
      cwd: temporaryRoot,
      encoding: 'utf8',
      env: { ...process.env, CI: '1' },
    },
  );
  assertSpawnSucceeded(result, 'Expo iOS prebuild');

  const infoPlistPath = path.join(temporaryRoot, 'ios', 'nm', 'Info.plist');
  const infoPlist = plist.parse(await readFile(infoPlistPath, 'utf8'));
  validateSceneManifest(infoPlist);

  const appDelegatePath = path.join(
    temporaryRoot,
    'ios',
    'nm',
    'AppDelegate.swift',
  );
  const appDelegate = await readFile(appDelegatePath, 'utf8');
  validateAppDelegate(appDelegate);

  const withoutManifest = { ...infoPlist };
  delete withoutManifest.UIApplicationSceneManifest;
  assert.throws(
    () => validateSceneManifest(withoutManifest),
    assert.AssertionError,
  );
  assert.throws(
    () =>
      validateAppDelegate(
        appDelegate.replace(', ExpoReactNativeFactoryProvider', ''),
      ),
    assert.AssertionError,
  );

  console.log(
    'Generated iOS app uses ExpoAppSceneDelegate for UIScene-owned React Native startup.',
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
