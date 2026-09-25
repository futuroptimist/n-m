import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const withIosSceneLifecycle = require('../plugins/withIosSceneLifecycle');
const { addSceneManifest, updateAppDelegate } = withIosSceneLifecycle;

const appDelegateFixture = `import Expo
import React
import ReactAppDependencyProvider

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

function validateAppDelegate(contents) {
  assert.match(
    contents,
    /class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider \{/,
    'AppDelegate must expose its React Native factory to the Expo scene delegate',
  );
  assert.match(contents, /reactNativeFactory = factory/);
  assert.doesNotMatch(
    contents,
    /factory\.startReactNative\(/,
    'AppDelegate must leave window creation and React Native startup to the scene delegate',
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

const infoPlist = addSceneManifest({ CFBundleDisplayName: 'n^m' });
const appDelegate = updateAppDelegate(appDelegateFixture, 'swift');

validateAppDelegate(appDelegate);
validateSceneManifest(infoPlist);
assert.equal(infoPlist.CFBundleDisplayName, 'n^m');
assert.equal(
  updateAppDelegate(appDelegate, 'swift'),
  appDelegate,
  'AppDelegate transformation must be idempotent',
);

assert.throws(
  () => updateAppDelegate(appDelegateFixture, 'objc'),
  /requires a Swift AppDelegate/,
);
assert.throws(
  () => updateAppDelegate('class UnexpectedAppDelegate {}', 'swift'),
  /Could not add Expo scene support/,
);
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

console.log('iOS scene lifecycle config transformations passed.');
