const {
  IOSConfig,
  withDangerousMod,
  withInfoPlist,
} = require('@expo/config-plugins');
const { readFile, writeFile } = require('node:fs/promises');

const SCENE_DELEGATE_CLASS = 'EXExpoAppSceneDelegate';

const LEGACY_WINDOW_STARTUP = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif`;

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

  return withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const appDelegatePath = IOSConfig.Paths.getAppDelegateFilePath(
        modConfig.modRequest.projectRoot,
      );
      let contents = await readFile(appDelegatePath, 'utf8');
      const original = contents;

      const classDeclaration = 'class AppDelegate: ExpoAppDelegate {';
      const sceneClassDeclaration =
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {';

      if (contents.includes(classDeclaration)) {
        contents = contents.replace(classDeclaration, sceneClassDeclaration);
      } else if (!contents.includes(sceneClassDeclaration)) {
        throw new Error(
          'Unable to add ExpoReactNativeFactoryProvider to the generated AppDelegate.',
        );
      }

      if (contents.includes(LEGACY_WINDOW_STARTUP)) {
        contents = contents.replace(`${LEGACY_WINDOW_STARTUP}\n\n`, '');
      } else if (contents.includes('factory.startReactNative(')) {
        throw new Error(
          'Unable to move React Native startup from the generated AppDelegate to the Expo scene delegate.',
        );
      }

      if (contents !== original) {
        await writeFile(appDelegatePath, contents);
      }
      return modConfig;
    },
  ]);
}

module.exports = withIosSceneLifecycle;
