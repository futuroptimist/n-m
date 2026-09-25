const { withDangerousMod, withInfoPlist } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const SCENE_DELEGATE_CLASS = 'EXExpoAppSceneDelegate';

function withSceneManifest(config) {
  return withInfoPlist(config, (modConfig) => {
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
}

function updateAppDelegate(contents) {
  const originalDeclaration = 'class AppDelegate: ExpoAppDelegate {';
  const sceneDeclaration =
    'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {';

  if (contents.includes(originalDeclaration)) {
    contents = contents.replace(originalDeclaration, sceneDeclaration);
  } else if (!contents.includes(sceneDeclaration)) {
    throw new Error(
      'Could not add UIScene support to the generated AppDelegate',
    );
  }

  const legacyStartup = `#if os(iOS) || os(tvOS)\n    window = UIWindow(frame: UIScreen.main.bounds)\n    factory.startReactNative(\n      withModuleName: "main",\n      in: window,\n      launchOptions: launchOptions)\n#endif\n\n`;

  if (contents.includes(legacyStartup)) {
    contents = contents.replace(legacyStartup, '');
  } else if (
    /factory\.startReactNative\([\s\S]*?launchOptions: launchOptions\)/.test(
      contents,
    )
  ) {
    throw new Error(
      'Could not safely move React Native startup from AppDelegate to ExpoAppSceneDelegate',
    );
  }

  return contents;
}

function withSceneAppDelegate(config) {
  return withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const appDelegatePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        modConfig.modRequest.projectName,
        'AppDelegate.swift',
      );
      const contents = await fs.promises.readFile(appDelegatePath, 'utf8');
      await fs.promises.writeFile(appDelegatePath, updateAppDelegate(contents));
      return modConfig;
    },
  ]);
}

function withIosSceneLifecycle(config) {
  return withSceneAppDelegate(withSceneManifest(config));
}

module.exports = withIosSceneLifecycle;
module.exports.updateAppDelegate = updateAppDelegate;
