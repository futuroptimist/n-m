import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const plist = require('@expo/plist').default;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'nm-ios-scenes-'));

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
  const manifest = infoPlist.UIApplicationSceneManifest;
  assert.ok(manifest, 'generated Info.plist must contain a scene manifest');
  assert.equal(manifest.UIApplicationSupportsMultipleScenes, false);

  const configurations =
    manifest.UISceneConfigurations?.UIWindowSceneSessionRoleApplication;
  assert.equal(
    configurations?.length,
    1,
    'scene manifest must contain one application scene configuration',
  );
  assert.equal(
    configurations[0].UISceneDelegateClassName,
    'EXExpoAppSceneDelegate',
    "application scene must use Expo's React Native-aware scene delegate",
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
    /#if os\(iOS\)[\s\S]*?factory\.startReactNative\(/,
    'AppDelegate must leave iOS window creation and React Native startup to the scene delegate',
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
    { cwd: temporaryRoot, encoding: 'utf8' },
  );
  assertSpawnSucceeded(result, 'Expo prebuild');

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

  const missingManifest = { ...infoPlist };
  delete missingManifest.UIApplicationSceneManifest;
  assert.throws(
    () => validateSceneManifest(missingManifest),
    (error) => error instanceof assert.AssertionError,
    'manifest validation must fail when the generated scene manifest is removed',
  );

  const legacyAppDelegate = appDelegate.replace(
    ', ExpoReactNativeFactoryProvider',
    '',
  );
  assert.throws(
    () => validateAppDelegate(legacyAppDelegate),
    (error) => error instanceof assert.AssertionError,
    'AppDelegate validation must fail when factory-provider wiring is removed',
  );

  console.log(
    'Generated iOS app uses ExpoAppSceneDelegate with React Native factory wiring.',
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
