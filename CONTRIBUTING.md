# Contributing to n^m

Thank you for helping build `n^m`. Contributions of any experience level are
welcome. Keep each change focused so it is easy to understand and review.

## Current repository setup

The repository contains the MVP specification and a minimal Expo-managed React
Native and TypeScript application shell. The current screen verifies that the
mobile foundation runs, but it does not contain gameplay yet. Install
[Node.js 24](https://nodejs.org/) with its bundled npm, clone the repository,
and run:

```sh
nvm install 24
nvm use 24
npm ci
npm run check
npx expo config --type public
git diff --check
```

`npm ci` installs exactly the versions in `package-lock.json`. `npm run check`
checks Prettier formatting, Markdown and application lint rules, and TypeScript.
To apply formatting, run `npm run format`, then repeat the checks.

Start the Expo development server with `npm start`. Use a compatible development
build to open the app. On macOS with Xcode and an iOS Simulator installed, you
can generate and run a local development build with `npx expo run:ios`. Android
development builds similarly require the Android SDK and an emulator or device.
These commands generate native projects through Expo CNG; do not commit the
generated `ios/` or `android/` directories.

For a physical iOS development build, the repository's Expo config plugin adds a
final Xcode build phase that signs every framework after CocoaPods embeds it.
After generating the native project, verify that durable configuration without
requiring a signing certificate:

```sh
npx expo prebuild --platform ios
npm run check:ios-signing -- ios
```

Keep the generated `ios/` directory local. The signing phase is skipped for
simulator builds and uses Xcode's selected development identity for `iphoneos`
builds; it does not store or select certificates or provisioning profiles.

## Making a contribution

1. Read [AGENTS.md](AGENTS.md) and the
   [MVP design](docs/design/mvp-expanding-grid.md).
2. Create a short-lived branch and make one scoped change.
3. Update the design when gameplay behavior changes, keeping requirements and
   proposed decisions explicit.
4. Add meaningful tests when executable behavior is introduced. In particular,
   future engine changes need deterministic tests with injected randomness.
5. Run the available checks and describe their results in the pull request.
6. Include screenshots for visible UI work, or state why they are not relevant.

Do not commit `.env` files, API tokens, signing certificates, provisioning
profiles, keystores, or passwords.

## Mobile development

Expo is the mobile iteration environment. Test interaction changes on
representative iOS and Android devices or simulators; iOS native/simulator work
needs macOS and Xcode, while Android verification needs the Android SDK/emulator
or a device. Hosted build services may help with distribution but are not
required for local contributions. Report exactly which app, native, and device
checks you ran, and state when the required environment was unavailable.

Contributions are provided under the repository's [MIT License](LICENSE).
