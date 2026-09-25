const { withAppDelegate, withInfoPlist } = require('@expo/config-plugins');

const SCENE_DELEGATE_CLASS = 'EXExpoAppSceneDelegate';

function addSceneManifest(infoPlist) {
  return {
    ...infoPlist,
    UIApplicationSceneManifest: {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: SCENE_DELEGATE_CLASS,
          },
        ],
      },
    },
  };
}

function updateAppDelegate(contents, language) {
  if (language !== 'swift') {
    throw new Error(
      'The iOS scene lifecycle plugin requires a Swift AppDelegate.',
    );
  }

  const appDelegateDeclaration = 'class AppDelegate: ExpoAppDelegate {';
  const sceneAppDelegateDeclaration =
    'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {';

  if (contents.includes(appDelegateDeclaration)) {
    contents = contents.replace(
      appDelegateDeclaration,
      sceneAppDelegateDeclaration,
    );
  } else if (!contents.includes(sceneAppDelegateDeclaration)) {
    throw new Error('Could not add Expo scene support to the iOS AppDelegate.');
  }

  const legacyStartup =
    /\n#if os\(iOS\) \|\| os\(tvOS\)\n    window = UIWindow\(frame: UIScreen\.main\.bounds\)\n    factory\.startReactNative\([\s\S]*?\n#endif\n/;
  if (legacyStartup.test(contents)) {
    contents = contents.replace(legacyStartup, '\n');
  } else if (/factory\.startReactNative\(/.test(contents)) {
    throw new Error(
      'Could not move React Native startup to the iOS scene delegate.',
    );
  }

  return contents;
}

function withIosSceneLifecycle(config) {
  config = withInfoPlist(config, (modConfig) => {
    modConfig.modResults = addSceneManifest(modConfig.modResults);
    return modConfig;
  });

  return withAppDelegate(config, (modConfig) => {
    modConfig.modResults.contents = updateAppDelegate(
      modConfig.modResults.contents,
      modConfig.modResults.language,
    );
    return modConfig;
  });
}

module.exports = withIosSceneLifecycle;
module.exports.addSceneManifest = addSceneManifest;
module.exports.updateAppDelegate = updateAppDelegate;
