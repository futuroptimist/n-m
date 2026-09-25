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

function validateAppDelegate(contents) {
  assert.match(
    contents,
    /class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider \{/,
    'AppDelegate must expose its React Native factory to the Expo scene delegate',
  );
  assert.match(
    contents,
    /let factory = ExpoReactNativeFactory\(delegate: delegate\)/,
    'AppDelegate must construct the Expo React Native factory',
  );
  assert.match(
    contents,
    /delegate\.dependencyProvider = RCTAppDependencyProvider\(\)/,
    'AppDelegate must configure the React Native dependency provider',
  );
  assert.match(contents, /reactNativeDelegate = delegate/);
  assert.match(contents, /reactNativeFactory = factory/);
  assert.match(
    contents,
    /return super\.application\(application, didFinishLaunchingWithOptions: launchOptions\)/,
    'AppDelegate must forward application startup to ExpoAppDelegate',
  );
  assert.doesNotMatch(
    contents,
    /UIWindow\s*\(/,
    'AppDelegate must leave window creation to the scene delegate',
  );
  assert.doesNotMatch(
    contents,
    /factory\.startReactNative\(/,
    'AppDelegate must leave React Native startup to the scene delegate',
  );
}

function validateSceneManifest(infoPlist) {
  const manifest = infoPlist.UIApplicationSceneManifest;
  assert.equal(manifest?.UIApplicationSupportsMultipleScenes, false);
  const configurations =
    manifest?.UISceneConfigurations?.UIWindowSceneSessionRoleApplication;
  assert.equal(configurations?.length, 1);
  assert.equal(
    configurations[0].UISceneDelegateClassName,
    'EXExpoAppSceneDelegate',
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
  assertSpawnSucceeded(result, 'Expo prebuild');

  const applicationPath = path.join(temporaryRoot, 'ios', 'nm');
  const appDelegate = await readFile(
    path.join(applicationPath, 'AppDelegate.swift'),
    'utf8',
  );
  const infoPlist = plist.parse(
    await readFile(path.join(applicationPath, 'Info.plist'), 'utf8'),
  );

  validateAppDelegate(appDelegate);
  validateSceneManifest(infoPlist);

  for (const [description, mutation] of [
    [
      'factory construction',
      '    let factory = ExpoReactNativeFactory(delegate: delegate)\n',
    ],
    ['delegate retention', '    reactNativeDelegate = delegate\n'],
    [
      'Expo application startup forwarding',
      '    return super.application(application, didFinishLaunchingWithOptions: launchOptions)\n',
    ],
  ]) {
    assert.ok(
      appDelegate.includes(mutation),
      `generated ${description} not found`,
    );
    assert.throws(
      () => validateAppDelegate(appDelegate.replace(mutation, '')),
      assert.AssertionError,
      `validation must fail without ${description}`,
    );
  }
  assert.throws(
    () =>
      validateAppDelegate(
        appDelegate.replace(', ExpoReactNativeFactoryProvider', ''),
      ),
    assert.AssertionError,
    'validation must fail without AppDelegate factory-provider wiring',
  );
  assert.throws(
    () =>
      validateSceneManifest({
        ...infoPlist,
        UIApplicationSceneManifest: undefined,
      }),
    assert.AssertionError,
    'validation must fail without the scene manifest',
  );

  console.log(
    'Generated iOS app uses the Expo scene delegate for React Native startup.',
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
