# MVP acceptance runbook

## Purpose and evidence rules

Use this runbook to validate one MVP candidate on an iOS Simulator, an iPhone 13
Pro, and an Android emulator or device. Static or CI success is not evidence
that a live-device check passed.

Record every check as **Pass**, **Fail**, or **Not run**. Each record must
include the candidate commit SHA, tool/device/runtime versions, and the evidence
named in the matrix. For a failure, include exact reproduction steps and
relevant logs or screenshots. Never infer or report success for an unperformed
check. Completion requires testing the exact candidate commit, or separately
recording and fully testing a newer commit. Results from different commits must
not be combined into one passing disposition.

## Safe static preflight

Node must satisfy `package.json` (`>=22 <25`; `.nvmrc` selects Node 22). Start
from a clean clone or worktree and substitute the commit under assessment:

```sh
git fetch origin main
export CANDIDATE_SHA='<full-40-character-commit-sha>'
git checkout --detach "$CANDIDATE_SHA"
test "$(git rev-parse HEAD)" = "$CANDIDATE_SHA"
git status --short
node --version
npm --version
npm ci
npm run check
npx expo config --type public
git diff --check
git status --short
git rev-parse HEAD
```

Expected: both status commands and `git diff --check` print nothing; SHA
comparison and all install/check/config commands exit zero; Node reports 22, 23,
or 24; and the public Expo config identifies `n^m`, iOS bundle identifier
`com.futuroptimist.nm`, and Android package `com.futuroptimist.nm`. Capture the
full SHA and complete command output (secrets redacted), not only screenshots of
green terminal lines.

`expo run:ios` and `expo run:android` generate native projects through CNG. Run
native generation/build commands only in a disposable clone or another clean,
temporary worktree. Confirm generated `ios/` or `android/` directories remain
there and are never copied to or committed from the source branch.

## Common live functional matrix

Perform this matrix on every live target unless a platform section explicitly
narrows it. Before each target, capture the app version/bundle identifier and
the target OS/runtime version.

1. Launch after a fresh install. Confirm a readable 2×2 board with two `2`
   tiles, score 0, active `k=1`, and next-growth text.
2. Make deliberate one-finger swipes in all four cardinal directions. Confirm
   each successful move changes the board and a settled no-op does not spawn or
   change score. Use each 44-point directional button and confirm it invokes the
   corresponding move.
3. Merge equal tiles. Confirm standard movement order, one merge per resulting
   tile per move, and score increases by the displayed merged value. Confirm a
   spawned tile does not itself trigger growth.
4. Use the next-game decrement/increment controls across every value 1
   through 10. Confirm bounds are disabled, selected `k` is visible, and the
   high-`k` limitation is textual. Start representative games and confirm the
   active run's `k` does not change. Do not claim every setting's unreachable
   growth threshold was exercised.
5. With an unfinished run, request a new game. Cancel once and confirm the run
   remains; then confirm replacement and verify a fresh board and the selected
   `k`. At game over, confirm final score and final board remain understandable
   and the new-game action works.
6. Play several successful moves, note board, score, `k`, and next milestone;
   background/foreground the app, then terminate and relaunch it normally.
   Confirm the same run returns. Do not clear app data between these checks.
7. Reach growth naturally and verify each attained milestone grows both board
   dimensions once while preserving cells and updating next-growth text. Record
   the actual sequence; do not manufacture or inject state for live evidence.

Automated engine/storage tests validate deterministic edge cases such as exact
growth sequences, game-over boards, and invalid-save recovery. Record their
output separately; do not present them as live UI/device evidence. Destructive
save corruption is not required in a live acceptance installation.

## iOS Simulator

### Discover, boot, build, install, and launch

Run on macOS with Xcode selected. Use an available iPhone runtime and its
discovered name or UDID; do not erase simulators or uninstall unrelated apps.

```sh
xcodebuild -version
xcrun simctl list runtimes
xcrun simctl list devices available
export SIMULATOR_UDID='<UDID-from-the-available-devices-list>'
xcrun simctl boot "$SIMULATOR_UDID" 2>/dev/null || true
open -a Simulator
xcrun simctl bootstatus "$SIMULATOR_UDID" -b
npx expo run:ios --device "$SIMULATOR_UDID"
xcrun simctl get_app_container "$SIMULATOR_UDID" com.futuroptimist.nm app
xcrun simctl launch "$SIMULATOR_UDID" com.futuroptimist.nm
```

The guarded boot tolerates only the already-booted case; investigate any other
boot error. A returned app-container path proves the intended bundle is
installed, and `simctl launch` must return a process identifier. Keep Metro
running if requested by the development build. Record the selected simulated
model and iOS runtime, then run the common matrix.

### iOS accessibility and large-board checks

- Enable VoiceOver in Simulator Accessibility settings. Traverse in logical
  order; verify header/status, named new-game and `k` controls, directional
  controls, viewport controls when present, and inspector controls have useful
  focus and state. Inspector row/column actions must report the selected
  coordinate and exact value or “empty,” including offscreen cells.
- Verify values, disabled state, active `k`, viewport edges, score, and game
  over have text and never depend on color. Make both score-changing and no-op
  moves: announcements are bounded to merges, growth, game over, and explicit
  inspector steps; ordinary spawns, viewport changes, and redraws stay quiet;
  game over takes priority.
- Increase the simulated system text size, including an accessibility size.
  Confirm important labels remain readable and controls usable without hiding
  game state. Restore the setting afterward.
- On a board that still fits at the 44-point tile threshold, confirm the full
  board is fitted and oversized-only viewport gestures/controls are absent. On a
  naturally reached oversized board, confirm the clipped viewport appears;
  one-finger cardinal swipes still move tiles; two-finger pan and pinch navigate
  without causing a move; zoom in, zoom out, and fit/reset work; edge text
  correctly names visible top/right/bottom/left edges; panning/zooming exposes
  no blank area; and the inspector reaches offscreen cells.

If natural play cannot reach an oversized board within the bounded validation
session, mark the large-board viewport requirement **Not run** and block final
MVP acceptance. Do not inject a fixture or claim a pass. Record the need for a
deterministic live-test fixture as an acceptance blocker for a later scoped
change.

## iPhone 13 Pro

Connect an iPhone 13 Pro by USB or approved wireless pairing. Confirm Trust on
both sides, enable Developer Mode when the installed iOS requires it, select an
available Apple development team in the generated Xcode project, and keep all
credentials/signing material outside Git. Discover rather than guess identity:

```sh
xcodebuild -version
xcrun devicectl list devices
xcrun xctrace list devices
export IOS_DEVICE='<exact-discovered-device-name-or-UDID>'
npx expo run:ios --device "$IOS_DEVICE"
xcrun devicectl device info apps --device "$IOS_DEVICE" | grep com.futuroptimist.nm
xcrun devicectl device process launch --device "$IOS_DEVICE" com.futuroptimist.nm
```

If the local Xcode version uses different `devicectl` subcommand spelling, use
`xcrun devicectl help` and record the equivalent command. Confirm the discovered
device is actually an iPhone 13 Pro before proceeding. Run the complete common,
iOS accessibility, and large-board matrices on hardware. Additionally verify
comfortable reachability of directional/viewport/inspector controls, physical
one- versus two-finger gesture recognition, every supported system font-scaling
setting used for evidence, VoiceOver with touch exploration, and persistence
after a real app termination and relaunch (not only backgrounding).

After capturing evidence, cleanup is optional. First identify the installed
development app by bundle identifier in the app listing above; only if the
operator chooses, remove that app (and no other app):

```sh
xcrun devicectl device uninstall app --device "$IOS_DEVICE" com.futuroptimist.nm
```

## Android emulator or device

Use a supported JDK and installed Android SDK/platform/build tools. Discover a
target rather than hard-coding a serial:

```sh
java -version
printf 'ANDROID_HOME=%s\nANDROID_SDK_ROOT=%s\n' "$ANDROID_HOME" "$ANDROID_SDK_ROOT"
adb version
adb devices -l
emulator -list-avds
```

For an emulator, start one discovered AVD in a separate terminal with
`emulator -avd '<discovered-AVD-name>'`, then wait for `adb` to report it as
`device`. For hardware, enable developer options and USB debugging, approve the
host key, and verify the listed serial/model. With exactly one target connected,
or after selecting the actual serial, build and launch from the disposable
worktree:

```sh
export ANDROID_SERIAL='<serial-from-adb-devices>'
adb -s "$ANDROID_SERIAL" wait-for-device
adb -s "$ANDROID_SERIAL" shell getprop ro.build.version.release
adb -s "$ANDROID_SERIAL" shell getprop ro.product.model
npx expo run:android --device "$ANDROID_SERIAL"
adb -s "$ANDROID_SERIAL" shell pm path com.futuroptimist.nm
adb -s "$ANDROID_SERIAL" shell monkey -p com.futuroptimist.nm -c android.intent.category.LAUNCHER 1
```

Confirm `pm path` returns the intended installed package. Run the common matrix,
large-board gate, and Android equivalents of non-color text, enlarged system
font/display scaling, logical TalkBack focus, inspector access, useful control
names/states, and bounded announcements. Verify persistence after backgrounding
and a normal process/app relaunch. Run physical reachability and physical
gesture checks only on actual Android hardware; otherwise record each as **Not
run**. Release signing, store upload, ads, analytics, and production
distribution are outside MVP acceptance.

## Acceptance matrix

Create one result per applicable target; do not let automated evidence replace a
live result.

| Area                           | Expected observation                                                            | Evidence to capture                                                      |
| ------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Static validation              | Clean exact-SHA checkout; install, checks, and Expo config exit zero            | SHA, Node/npm versions, timestamped command log                          |
| Fresh game                     | 2×2, two `2`s, score 0, `k=1`, next milestone visible                           | Screen recording/screenshot and target details                           |
| `k` settings                   | 1–10 selectable, bounds disabled, warning textual, run immutable                | Recording at both bounds and representative new game                     |
| Movement/merges/score          | Four directions work; standard merges; exact score; no-op unchanged             | Short recording plus before/after values                                 |
| Growth                         | Reached milestone grows once and preserves cells                                | Before/after recording and milestone/size notes                          |
| Game over                      | No moves remain; final score/board and new-game action available                | Recording and reproduction move sequence                                 |
| Save/resume                    | Exact run survives background and real relaunch                                 | Before/after screenshots with state values                               |
| Automated recovery             | Invalid/newer/read-error saves fail safely in tests                             | `npm run check` test names/output; label non-live                        |
| Small-board swipe              | Fitted board accepts one-finger cardinal play                                   | Recording of four directions                                             |
| Large-board viewport           | Threshold switches modes; gestures separate; zoom/fit, edges, clamps work       | Recording including touch indicators and board size, or blocking Not run |
| Inspector/directional controls | 44-point controls move; inspector reports on/offscreen cells                    | Accessibility recording and reported coordinates                         |
| Announcements                  | Only specified events announce; game over has priority                          | Screen-reader recording/event notes                                      |
| Dynamic Type/font scale        | Enlarged text remains readable and operable                                     | Settings level plus screenshots                                          |
| VoiceOver/TalkBack             | Logical focus, descriptive state, playable alternate path                       | Screen-reader recording and target/runtime                               |
| Simulator                      | Full applicable matrix completed on selected iPhone Simulator                   | Simulator model/runtime and result links                                 |
| iPhone 13 Pro                  | Full matrix plus reachability/physical gestures/relaunch completed              | iOS/build versions and device model (no personal identifiers)            |
| Android                        | Core play, persistence, controls, accessibility, and large-board gate completed | Model/emulator, API/OS version, and result links                         |

## Step 19 evidence record template

Copy this block without pre-filling results. Use one matrix entry per target and
retain every Fail or Not run in the final disposition.

```markdown
# MVP acceptance evidence

## Candidate

- Candidate SHA:
- Branch/tag (informational):
- Validation date/time (UTC):
- Operator:

## Environments

| Target        | Hardware/model | OS/runtime | Tool versions                  | Bundle/package confirmed? |
| ------------- | -------------- | ---------- | ------------------------------ | ------------------------- |
| iOS Simulator |                |            | Xcode / Expo / Node:           |                           |
| iPhone 13 Pro |                |            | Xcode / Expo / Node:           |                           |
| Android       |                |            | JDK / SDK / ADB / Expo / Node: |                           |

## Command results

| Command                              | Pass / Fail / Not run | Output or evidence link | Notes |
| ------------------------------------ | --------------------- | ----------------------- | ----- |
| `npm ci`                             |                       |                         |       |
| `npm run check`                      |                       |                         |       |
| `npx expo config --type public`      |                       |                         |       |
| `git diff --check`                   |                       |                         |       |
| Native build/install/launch commands |                       |                         |       |

## Acceptance matrix results

| Area | Target | Pass / Fail / Not run | Evidence link | Failure reproduction / notes |
| ---- | ------ | --------------------- | ------------- | ---------------------------- |
|      |        |                       |               |                              |

## Known limitations and blockers

-

## Final disposition

- Disposition: Pass / Fail / Blocked
- Large-board viewport gate exercised on each required target: Yes / No
- All evidence is for the candidate SHA above: Yes / No
- Rationale and required follow-ups:
```
