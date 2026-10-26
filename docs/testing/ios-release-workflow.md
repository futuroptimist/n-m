# Local iOS Release simulator workflow

Use a clean checkout on macOS with full Xcode. This workflow installs the locked
JavaScript dependencies, generates an iOS project once through Expo CNG,
installs Pods, and invokes the existing `npm run ios` script in Release
configuration. The app embeds its JavaScript bundle and does not need a running
Metro server. Metro still performs bundling during the build. This is simulator
validation; it does not validate physical devices, signing, distribution, or
TestFlight.

## Prerequisites and owner command

Install full Xcode and an iOS simulator runtime using Xcode Settings >
Components. Open Xcode yourself to complete the license and first-launch setup,
and select its Command Line Tools under Settings > Locations. Install a working
CocoaPods `pod` command using your preferred Ruby/package manager. The workflow
diagnoses missing tools but never installs system tools, accepts licenses, or
changes signing settings. An Apple developer account is not required for the
simulator.

Before Expo launch, generated entitlement files are parsed with macOS `plutil`;
nonempty entitlements stop the workflow because some capabilities cause Expo to
configure signing even for simulator builds. This workflow supports the current
app's empty entitlement set only.

Use the project's patched Node pin with your existing nvm installation:

```sh
nvm install
nvm use
npm run ios:release -- --device <simulator-UDID>
```

The pin is Node 24.22.1. The workflow accepts later patched Node 24 versions;
other major versions and older Node 24 releases are rejected. No global npm
installation is needed. The wrapper itself uses only Node built-ins, so it can
run before `npm ci`.

Find simulator identifiers with `xcrun simctl list devices available`. With
exactly one available iOS simulator, `--device` may be omitted. Multiple
simulators require an explicit UDID, including when only one is already booted.
Names, physical-device identifiers and unavailable runtimes are rejected.

Run the read-only preflight separately when diagnosing setup:

```sh
npm run ios:doctor -- --device <simulator-UDID>
```

Doctor checks Node, Git, npm, the active Xcode developer directory, Xcode
first-launch status, simulator SDK/runtime, CocoaPods and workspace safety. It
does not install packages, generate native files, boot a simulator or write a
state file. A successful doctor is prerequisite evidence, not proof a native
build will succeed; compile/Pod failures still stop the launch.

## Side effects and safe reruns

The launch command runs `npm ci` on every invocation. This replaces
`node_modules`, downloads locked packages from the configured npm registry and
runs their installation scripts. On first use it runs the installed Expo CLI's
`prebuild --platform ios --no-install`, followed by `pod install` inside `ios/`.
Pod installation may download native dependencies and execute project hooks.
Finally it runs:

```sh
npm run ios -- --configuration Release --device <simulator-UDID> --no-bundler --no-install
```

This builds into Xcode's derived data, boots/opens the chosen simulator as
needed, and installs/launches the app. Installation can replace a previous
simulator app with the same bundle identifier. Keep any valuable simulator app
data backed up. Build output is printed when each step completes; the first
build can take time.

Only a completely successful run records a native-source fingerprint in the
ignored `.expo/ios-release-state.json`. A subsequent run on the same commit with
the same native source skips generation and Pod installation. Pod build
products, `ios/build`, Xcode user data and `.DS_Store` are excluded from that
fingerprint; native source, Podfile and Podfile.lock are included. If Pods were
removed or are broken, the build fails; recover in a fresh checkout instead of
bypassing the guards. Do not edit or copy the state file to adopt existing
native files.

Tracked changes, tracked native files, an existing Android directory, unexpected
untracked files outside `ios/`, local `.env` files, and unowned/modified iOS
directories stop the workflow. A changed Git commit also requires a fresh
checkout for native generation. Preserve and inspect existing work yourself; the
script never deletes, stashes, resets, or runs `prebuild --clean`. Use a clean
environment without Expo configuration overrides.

If setup changes a tracked file, the command stops before the next step and
leaves the diff for inspection. Partial failures preserve their output but do
not grant ownership to a partial native project. Inspect it and use a separate
clean checkout for another attempt. Generated native directories remain local
and must not be committed. The existing CNG policy remains in effect.

## Validation and limits

Run `npm run test:ios-workflow` for dependency-free Node tests. These mock
native commands to check selection, prerequisite errors, dirty guards, safe
reruns, failure propagation and command construction. CI includes these tests in
`npm run check`; Windows/Linux mock results are not iOS validation.

On a Mac, record the exact commit, Node/Xcode/CocoaPods versions, simulator UDID
and runtime, then run doctor and the owner command. Close any Metro server,
terminate the app in Simulator and relaunch it from its icon. Confirm the app
opens and plays with its embedded bundle; repeat the owner command to verify a
safe rerun. Report actual results and failures. Mac end-to-end validation
remains an owner-run requirement before relying on this workflow.

See the official
[Expo local build guide](https://docs.expo.dev/guides/local-app-development/)
and [Expo CLI reference](https://docs.expo.dev/more/expo-cli/) for Release build
and device flags.
