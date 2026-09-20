# MVP acceptance runbook

## Purpose and evidence discipline

Use this runbook to assess one MVP candidate commit on an iOS Simulator, an
iPhone 13 Pro, and an Android emulator or device. Static and automated results
do not substitute for live interaction evidence.

Record every command and matrix check as **Pass**, **Fail**, or **Not run**.
Each record must include the candidate commit SHA, tool/runtime and device
versions, and the evidence named below. For a failure, also record exact
reproduction steps and relevant logs or screenshots. Never infer or report a
success for an unperformed check.

Completion requires all required checks against the exact candidate SHA. If a
fix is assessed on a newer commit, record that SHA separately and repeat every
affected check; do not combine results as though they came from one build.

## 1. Safe static preflight

Run these steps in a fresh clone or a clean, detached worktree. The required
Node range is `>=22 <25` from `package.json`; `.nvmrc` selects Node 24.

```sh
git clone https://github.com/futuroptimist/n-m.git n-m-acceptance
cd n-m-acceptance
git fetch origin main
git checkout --detach <candidate-sha>

test -z "$(git status --short)"
git status --short
git rev-parse HEAD

nvm install
nvm use
node --version
npm --version
npm ci
npm run check
npx expo config --type public
git diff --check
git status --short
```

Expected results:

- Both `git status --short` invocations and `git diff --check` produce no
  output, and `git rev-parse HEAD` exactly equals `<candidate-sha>`.
- `node --version` is Node 22, 23, or 24 (Node 24 is selected by `.nvmrc`).
- `npm ci` completes from the lockfile without changing it.
- `npm run check` passes formatting, Markdown lint, ESLint, TypeScript, engine,
  storage, and interaction tests.
- `npx expo config --type public` exits successfully and reports app name `n^m`,
  iOS bundle identifier `com.futuroptimist.nm`, and Android package
  `com.futuroptimist.nm`.

Record the full command output or a durable CI/log link. Treat a dirty checkout,
wrong SHA, wrong Node version, changed lockfile, or failing command as a
failure.

> `npx expo run:ios` and `npx expo run:android` generate native projects. Run
> native generation/build commands only in a disposable clone or another clean
> temporary worktree. Confirm generated `ios/` or `android/` directories are not
> copied back, staged, or committed.

## 2. Shared manual procedure

For each live target, save the target name, OS version, host/tool versions,
candidate SHA, start/end time, and development-build identity. Capture a short
screen recording for gestures plus screenshots for stable states. Redact any
personal device or signing information before publishing evidence.

Exercise this functional matrix on every live target:

1. Remove the prior candidate app (or clear its data), install the candidate,
   and open it. Confirm a readable 2×2 board with two `2` tiles, score 0, active
   `k=1`, and next-growth text.
2. Swipe with one finger in each cardinal direction. Confirm deliberate valid
   swipes move/merge once, while taps, scrolling, and no-op swipes do not spawn,
   score, or move tiles. Repeat moves with the four 44-point directional buttons
   and verify the same game path.
3. Create equal-tile merges. Confirm standard merge ordering, one merge per
   resulting tile per move, score increases by the displayed merged values, and
   exactly one 2/4 tile spawns only after a successful move.
4. Play `k=1` through growth where feasible: the first merged 4, 8, and 16 must
   yield 3×3, 4×4, and 5×5. Confirm existing coordinates remain and new rows and
   columns appear at the bottom and right. For other values, compare the
   displayed next-growth milestone with the design formula.
5. Use decrement/increment controls through every next-game value 1–10. Confirm
   bounds are disabled, the selected value is visible, active `k` does not
   change mid-run, and the high-`k` limitation text is present. Start games at
   representative values including 1, 2, 5, and 10.
6. During an unfinished run, request a new game. Cancel once and verify the run
   remains exact; then confirm and verify a fresh game uses the selected `k`.
   From game over, verify New game works without an unfinished-run prompt.
7. Make a distinctive scored state, background the app, return, then terminate
   and relaunch it. Confirm active `k`, board, dimensions, score, milestone, and
   status resume atomically. A fresh install/data clear may start a new game.
8. Play a 2×2 high-`k` game until no cardinal slide or merge remains. Confirm
   the final board stays visible, Game over and final score appear, game over is
   announced, moves no longer change state, and a new game can be started.

### Accessibility on every target

- Enable VoiceOver on iOS or TalkBack on Android. Traverse in logical order;
  verify every action has a descriptive name, disabled states are conveyed,
  focus remains usable after state changes, and all controls have comfortable
  touch targets.
- Use Previous/Next board row and column in the inspector. Confirm each action
  reports the one-based row, column, and exact value or `empty`, including an
  offscreen cell on an oversized board. Inspector and viewport-control gestures
  must not move tiles.
- Confirm tile values, active/next `k`, score, board dimensions, game-over
  state, and visible edges have readable text and never depend on color alone.
- Listen for bounded announcements: score-changing merges, growth, and game over
  are announced; game over wins when events coincide. Inspector actions announce
  the selected cell. Spawns, no-ops, viewport changes, and redraws do not
  announce.
- Test the largest practical system font/Dynamic Type setting. Confirm text and
  controls remain understandable and operable without clipped critical state. On
  Android, record the font-size/display-size settings used.

### Required oversized-board gate

At the point where fitted tiles would fall below the 44-point threshold, confirm
the board changes from fitted mode to a clipped viewport. Then verify:

1. One-finger cardinal swipes still make game moves; they do not pan.
2. Two-finger pan and pinch navigate only the oversized viewport and never make
   a game move. Small/fitted boards do not expose oversized-only navigation.
3. Zoom in, Zoom out, and Fit / reset visibly work and remain clamped.
4. The top/right/bottom/left visible-edge text matches the viewport.
5. Panning and zooming cannot expose blank space beyond board content.
6. The inspector reaches and accurately reports offscreen cells.

This is a final-acceptance gate. If natural play cannot reach an oversized board
within the bounded session allocated by the test plan, record **Not run** and
block final MVP acceptance. Do not infer success from automated tests or alter
the app/create a fixture in this documentation task. Record the absence of a
deterministic live-test fixture as an explicit acceptance blocker if needed.

## 3. iOS Simulator

Perform native work in the disposable checkout used for this target.

### Discover, boot, build, install, and launch

```sh
xcodebuild -version
xcrun simctl list runtimes
xcrun simctl list devices available
```

Choose an available iPhone simulator from the output; do not assume a name. Set
its exact name or UDID, boot it without erasing other simulators, and wait:

```sh
export SIMULATOR_ID='<discovered-name-or-udid>'
xcrun simctl boot "$SIMULATOR_ID" 2>/dev/null || true
open -a Simulator
xcrun simctl bootstatus "$SIMULATOR_ID" -b
npx expo run:ios --device "$SIMULATOR_ID"
xcrun simctl get_app_container booted com.futuroptimist.nm app
xcrun simctl launch booted com.futuroptimist.nm
```

The guarded `boot` tolerates only the normal already-booted case; inspect any
other error before continuing. `get_app_container` must return the installed
candidate's container and `launch` must report a PID for `com.futuroptimist.nm`.
Confirm the visible app is `n^m`, not Expo Go or an older build. Record the
selected simulator model/runtime, Xcode version, build log, bundle identifier,
and a screenshot showing the launched app.

Execute the shared functional, accessibility, and oversized-board procedures.
Use an iPhone 13 Pro simulator when that runtime/device type is installed;
otherwise name the substitute and do not count it as physical-device evidence.

## 4. iPhone 13 Pro

### Device preflight

On the Mac, connect the phone by USB or use an explicitly approved existing
wireless pairing. Unlock it, accept **Trust This Computer**, enable Developer
Mode when its iOS version requires it, and confirm that Xcode has an available
Apple development signing team. Never record credentials, provisioning profiles,
private keys, or signing secrets.

Discover the actual device name/UDID rather than copying a personal identifier:

```sh
xcodebuild -version
xcrun devicectl list devices
xcrun xctrace list devices
```

Record a redacted device identifier, exact model (`iPhone 13 Pro`), iOS version,
connection type, and Xcode version. If Xcode does not report the device as
available, stop and record **Not run** plus the discovery output.

### Build, install, launch, and assess

In a disposable checkout, select the discovered device interactively so Expo and
Xcode use the configured development team:

```sh
npx expo run:ios --device
```

Choose the actual iPhone 13 Pro by name. Do not place a UDID, signing identity,
team ID, or secret in this runbook or evidence. Confirm the build log targets
that device and candidate SHA. After installation, tap the `n^m` development
app; verify its bundle identifier in Xcode's installed-app/device UI is
`com.futuroptimist.nm` and record the launch result.

Run the complete shared functional, accessibility, and oversized-board matrix.
In addition, explicitly assess thumb/reachability of all controls, physical one-
versus two-finger gesture recognition, pinch/pan separation, the phone's largest
practical system font settings, VoiceOver rotor/focus behavior, and persistence
after backgrounding, force-quitting, and a real app relaunch. This
physical-device result cannot be replaced by simulator evidence.

After evidence is captured, cleanup is optional. In Xcode's Devices and
Simulators window, identify the installed development app by bundle identifier
`com.futuroptimist.nm`, then remove only that app if the operator chooses. Do
not erase or reset the device.

## 5. Android emulator or device

### Preflight, build, install, and launch

Use the JDK version supported by the installed Expo/React Native toolchain and
record it. Verify SDK tools and discover targets:

```sh
java -version
printf 'ANDROID_HOME=%s\n' "$ANDROID_HOME"
adb version
emulator -version
sdkmanager --version
adb devices -l
```

Start an installed AVD through Android Studio Device Manager or, after listing
available AVD names, from the terminal:

```sh
emulator -list-avds
emulator -avd '<discovered-avd-name>'
```

Wait in another terminal until `adb devices -l` shows exactly which authorized
target will be used and Android has completed booting:

```sh
export ANDROID_SERIAL='<discovered-adb-serial>'
adb -s "$ANDROID_SERIAL" wait-for-device
until [ "$(adb -s "$ANDROID_SERIAL" shell getprop sys.boot_completed | tr -d '\r')" = 1 ]; do sleep 2; done
adb -s "$ANDROID_SERIAL" shell getprop ro.product.model
adb -s "$ANDROID_SERIAL" shell getprop ro.build.version.release
npx expo run:android --device "$ANDROID_SERIAL"
adb -s "$ANDROID_SERIAL" shell pm path com.futuroptimist.nm
adb -s "$ANDROID_SERIAL" shell monkey -p com.futuroptimist.nm -c android.intent.category.LAUNCHER 1
```

`pm path` must find the installed package and the launch command must open
`n^m`. Record Android Studio/SDK, JDK, ADB, emulator/device model, API/Android
version, build log, serial in redacted form, and screenshot.

Execute the shared playable-game, persistence, controls, accessibility, and
oversized-board procedures with TalkBack. Also check Android back/app-switcher
behavior and relaunch persistence. If this target is an emulator, mark checks
that specifically require physical Android gesture ergonomics, hardware, or
lifecycle behavior **Not run**; never present emulator evidence as physical
Android evidence. Release signing, store upload, ads, analytics, and production
distribution are outside MVP acceptance.

## 6. Acceptance matrix

Use one result column per target. A screenshot alone is insufficient for a
gesture or announcement check; capture a short recording or observation notes.

| Check                          | Expected observation                                                             | Minimum evidence                                   |
| ------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------- |
| Static validation              | Exact SHA; clean tree; supported Node; all required commands pass                | SHA, versions, complete logs                       |
| Fresh game                     | 2×2, two 2 tiles, score 0, `k=1`, next growth shown                              | Screenshot and reset/install steps                 |
| `k` settings                   | 1–10 selectable; bounds disabled; active run immutable; high-`k` warning         | Recording at both bounds and representative starts |
| Movement, merges, score        | Cardinal movement; merge-once ordering; score sum; spawn only on successful move | Recording plus before/after state notes            |
| Growth                         | Milestones derive correct sizes; cells retained; bottom/right appended           | Before/after screenshots and move sequence         |
| Game over                      | Only blocked board ends; final board/score and New game remain usable            | Final-state screenshot and announcement note       |
| Save/resume                    | Exact state returns after background and terminated relaunch                     | Before/after screenshots and lifecycle steps       |
| Automated recovery behavior    | Invalid/incompatible/read/write recovery tests pass without partial restore      | Named `npm run check` test output; no live claim   |
| Small-board swipe              | One-finger cardinal swipes work; viewport gestures absent                        | Gesture recording                                  |
| Large-board viewport           | Threshold, two-finger pan/pinch, zoom/reset, edges, clamps all work              | Recording at threshold and zoom/pan extremes       |
| Inspector/directional controls | 44-point controls work; inspector reports exact onscreen/offscreen cells         | Screen-reader recording/notes                      |
| Announcements                  | Only inspector, scored merge, growth, game over announce; priority correct       | VoiceOver/TalkBack observation log                 |
| Dynamic Type/font scaling      | Largest practical text remains understandable and operable                       | Settings plus screenshots                          |
| VoiceOver/TalkBack             | Logical focus, labels, disabled state, non-color state                           | Assistive-technology recording/notes               |
| iOS Simulator                  | Correct bundle installed/launched; full simulator matrix recorded                | Model/runtime, build log, screenshot, results      |
| iPhone 13 Pro                  | Correct physical model; reachability, gestures, scaling, persistence pass        | iOS/Xcode versions and physical-device results     |
| Android                        | Correct package installed/launched; full Android matrix recorded                 | Target/API/tool versions, build log, results       |

Any required **Fail** or **Not run**, including an unexercised oversized-board
viewport or missing iPhone 13 Pro result, blocks final MVP acceptance. Automated
recovery tests are valid evidence only for the recovery row they exercise.

## 7. Blank Step 19 evidence record

Copy this template without pre-filling outcomes:

```markdown
# MVP acceptance evidence

## Candidate

- Candidate SHA:
- Repository/branch or PR:
- Evidence date/time (UTC):
- Operator:
- Newer SHA(s) assessed separately, if any:

## Environments

| Target        | Device/model | OS/runtime | Host and tools    | Build identity  | Result  |
| ------------- | ------------ | ---------- | ----------------- | --------------- | ------- |
| Static/CI     |              |            | Node / npm / Expo | Candidate SHA   | Not run |
| iOS Simulator |              |            | macOS / Xcode     | Bundle ID / SHA | Not run |
| iPhone 13 Pro |              |            | macOS / Xcode     | Bundle ID / SHA | Not run |
| Android       |              |            | JDK / SDK / ADB   | Package / SHA   | Not run |

## Command results

| Command                           | Target           | Pass / Fail / Not run | Output or evidence link |
| --------------------------------- | ---------------- | --------------------- | ----------------------- |
| `git status --short`              | Static           | Not run               |                         |
| `git rev-parse HEAD`              | Static           | Not run               |                         |
| `node --version && npm --version` | Static           | Not run               |                         |
| `npm ci`                          | Static           | Not run               |                         |
| `npm run check`                   | Static           | Not run               |                         |
| `npx expo config --type public`   | Static           | Not run               |                         |
| `git diff --check`                | Static           | Not run               |                         |
| Native build/install/launch       | Each live target | Not run               |                         |

## Acceptance matrix results

| Check                          | iOS Simulator | iPhone 13 Pro | Android | Evidence / failure reproduction |
| ------------------------------ | ------------- | ------------- | ------- | ------------------------------- |
| Static validation              | Not run       | Not run       | Not run |                                 |
| Fresh game                     | Not run       | Not run       | Not run |                                 |
| k settings                     | Not run       | Not run       | Not run |                                 |
| Movement/merges/score          | Not run       | Not run       | Not run |                                 |
| Growth                         | Not run       | Not run       | Not run |                                 |
| Game over                      | Not run       | Not run       | Not run |                                 |
| Save/resume                    | Not run       | Not run       | Not run |                                 |
| Automated recovery behavior    | Not run       | Not run       | Not run |                                 |
| Small-board swipe              | Not run       | Not run       | Not run |                                 |
| Large-board viewport           | Not run       | Not run       | Not run |                                 |
| Inspector/directional controls | Not run       | Not run       | Not run |                                 |
| Announcements                  | Not run       | Not run       | Not run |                                 |
| Dynamic Type/font scaling      | Not run       | Not run       | Not run |                                 |
| VoiceOver/TalkBack             | Not run       | Not run       | Not run |                                 |
| Simulator target               | Not run       | Not run       | Not run |                                 |
| iPhone 13 Pro target           | Not run       | Not run       | Not run |                                 |
| Android target                 | Not run       | Not run       | Not run |                                 |

## Known limitations and blockers

-

## Failures and reproduction steps

-

## Final disposition

- Disposition: Not assessed
- Blocking rows:
- Follow-up owner/link:
- Statement confirming whether every required result is from the candidate SHA:
```
