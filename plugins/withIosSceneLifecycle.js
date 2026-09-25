const { withAppDelegate, withInfoPlist } = require('@expo/config-plugins');

const SCENE_DELEGATE_CLASS = 'EXExpoAppSceneDelegate';

function withIosSceneLifecycle(config) {
  config = withInfoPlist(config, (modConfig) => {
    modConfig.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: SCENE_DELEGATE_CLASS,
          },
        ],
      },
    };
    return modConfig;
  });

  return withAppDelegate(config, (modConfig) => {
    if (modConfig.modResults.language !== 'swift') {
      throw new Error(
        'The iOS scene lifecycle plugin requires a Swift AppDelegate.',
      );
    }

    let contents = modConfig.modResults.contents;
    const appDelegateDeclaration = 'class AppDelegate: ExpoAppDelegate {';
    if (!contents.includes('ExpoReactNativeFactoryProvider')) {
      if (!contents.includes(appDelegateDeclaration)) {
        throw new Error('Could not find the Expo AppDelegate declaration.');
      }
      contents = contents.replace(
        appDelegateDeclaration,
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
      );
    }

    const legacyStartup =
      /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\n#endif/;
    if (legacyStartup.test(contents)) {
      contents = contents.replace(
        legacyStartup,
        `#if os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif`,
      );
    } else if (/^\s*factory\.startReactNative\(/m.test(contents)) {
      throw new Error(
        'Could not safely move React Native startup to the scene delegate.',
      );
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });
}

module.exports = withIosSceneLifecycle;
