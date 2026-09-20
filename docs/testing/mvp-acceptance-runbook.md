# MVP acceptance runbook

## Purpose and evidence discipline

Use this runbook to validate one MVP candidate commit on an iPhone Simulator, an
iPhone 13 Pro, and an Android emulator or device. Static checks and automated
tests are prerequisites, not substitutes for live validation.

Record **Pass**, **Fail**, or **Not run** for every check. For each environment,
record the candidate commit SHA and tool, device, OS/runtime, Node, and npm
versions. A failure record must include reproducible steps, the observed result,
the expected result, and relevant logs or screenshots. Never infer or report a
live-device success from CI, automated tests, another platform, or an unobserved
screen. Completion requires testing the exact candidate SHA; if testing moves to
a newer commit, identify and assess that commit separately.

## 1. Safe static preflight

Start in a clean checkout of the candidate. Node must satisfy `package.json`'s
`>=22 <25` requirement (`.nvmrc` selects Node 22).

```sh
git status --short
git rev-parse HEAD
node --version
npm --version
npm ci
npm run check
npx expo config --type public
git diff --check
git status --short
```

Expected results:

- both `git status --short` outputs are empty;
- `git rev-parse HEAD` is the SHA entered in the evidence record;
- Node is at least 22 and lower than 25;
- dependency installation, formatting, Markdown, ESLint, TypeScript, engine,
  storage, and interaction checks exit zero;
- Expo prints valid public configuration with iOS bundle identifier and Android
  package `com.futuroptimist.nm`; and
- `git diff --check` exits zero without output.

`expo run:ios` and `expo run:android` generate native projects through Expo CNG.
Run native generation and builds only in a disposable clone or clean temporary
worktree, not in the evidence/source checkout, so generated `ios/` or `android/`
directories cannot be accidentally committed. Confirm the disposable checkout is
at the recorded SHA before building:

```sh
candidate_sha=$(git rev-parse HEAD)
temporary_root=$(mktemp -d)
git worktree add --detach "$temporary_root/n-m" "$candidate_sha"
cd "$temporary_root/n-m"
test "$(git rev-parse HEAD)" = "$candidate_sha"
```

After all evidence is captured, return to the source checkout and remove the
temporary worktree with `git worktree remove "$temporary_root/n-m"`. Retain it
instead when logs are needed to investigate a failure.

## 2. Shared functional matrix

Execute these cases on every live platform unless a platform section explicitly
narrows the requirement. Capture screenshots at major states and a short video
for gestures or announcements when practical.

1. **Fresh game:** launch with no prior app data. Confirm a readable 2×2 board,
   two tiles, score 0, active `k=1`, next-growth text, and enabled play
   controls.
2. **Movement and score:** make deliberate one-finger swipes in all four
   cardinal directions. Confirm legal slides, equal-tile merges, exactly one
   resulting tile per pair, score increases by the merged value, one spawn after
   a changed move, and no score/spawn after a no-op. Repeat moves with the four
   accessible directional buttons and confirm the same behavior and 44-point
   targets.
3. **`k` controls:** step the proposed `k` from 1 through 10. Confirm decrement
   is disabled at 1, increment at 10, the visible value and help update, and a
   new run uses the selected value. Confirm `k=5–10` displays the documented
   growth limitation. Do not imply those settings can grow under current
   spawning.
4. **New-game confirmation:** while a run is unfinished, request a new game.
   Cancel and confirm the run is unchanged; request again, confirm replacement,
   and verify the new run and selected `k`. From game over, verify the offered
   new-game path remains usable.
5. **Growth:** in a naturally played `k=1` run, confirm the first merged 4 grows
   the board to 3×3, first merged 8 to 4×4, and first merged 16 to 5×5; existing
   cells remain in place and growth precedes the new spawn. Record any
   milestones actually reached rather than extrapolating.
6. **Save/resume:** note the board, score, `k`, size, milestone, and status;
   background the app, relaunch it, then terminate and relaunch it normally.
   Confirm the exact run resumes atomically without repeating growth.
7. **Game over:** naturally reach a blocked board. Confirm the final board stays
   understandable, game over and final score are presented/announced, moves no
   longer alter state, and starting another game works.

Automated engine and storage tests cover deterministic edge cases that may be
impractical to produce live, including multi-threshold growth and invalid-save
recovery. Record their result separately; do not relabel automated coverage as a
live-device observation.

## 3. iOS Simulator

These commands require macOS, Xcode, command-line tools, and an installed iOS
Simulator runtime. Work in the disposable worktree from the static preflight.

```sh
xcode-select -p
xcodebuild -version
xcrun simctl list runtimes available
xcrun simctl list devices available
```

Choose an available iPhone simulator from the output; do not assume a personal
name or identifier. Copy its UDID into the shell, verify it, and boot it without
erasing or deleting any simulator:

```sh
SIMULATOR_UDID='<discovered-available-iPhone-simulator-UDID>'
xcrun simctl list devices available | grep -F "$SIMULATOR_UDID"
xcrun simctl boot "$SIMULATOR_UDID" 2>/dev/null || true
open -a Simulator
xcrun simctl bootstatus "$SIMULATOR_UDID" -b
npx expo run:ios --device "$SIMULATOR_UDID"
xcrun simctl get_app_container "$SIMULATOR_UDID" com.futuroptimist.nm app
xcrun simctl launch "$SIMULATOR_UDID" com.futuroptimist.nm
```

The ignored `boot` failure is acceptable only when `bootstatus` confirms the
chosen simulator was already booted. The build must succeed, `get_app_container`
must locate the installed app, and `launch` must open `n^m`, not Expo Go or a
different bundle. Keep Metro running if prompted by the development build.

Run the shared functional matrix, then these focused checks:

### Simulator accessibility

- Enable VoiceOver in Simulator Accessibility settings. Navigate in logical
  order through header, score/status, board, viewport/inspector, directional
  controls, and new-game controls. Confirm names, values, roles, disabled
  states, and focus remain understandable without sight.
- Move the inspector by row and column and confirm it reports coordinates and
  the exact value or “empty,” including cells outside the visible viewport.
- Confirm tile values, score, active `k`, edges, and game over have textual
  representation and never depend on color alone.
- Confirm announcements occur for score-changing merges, growth, explicit
  inspector steps, and game over; game over wins when events coincide. Confirm
  spawns, no-ops, viewport changes, and redraws do not flood announcements.
- Select a larger Dynamic Type accessibility size, relaunch, and confirm
  critical labels and controls remain readable, reachable, and operable without
  overlap that prevents play.

### Simulator large-board gate

Continue a naturally playable run until fitting the entire board would violate
the 44-point tile threshold. Confirm fitted boards have no viewport navigation;
oversized boards switch to the clipped viewport and expose two-finger navigation
and zoom controls. On an oversized board confirm:

- one-finger cardinal swipes still make game moves, while two-finger pan and
  pinch navigate/zoom without making moves;
- Zoom in, Zoom out, and Fit/reset work and keep cells readable;
- panning and zooming never expose blank area beyond the board;
- visible-edge text accurately identifies the top/right/bottom/left edges in
  view and is not conveyed by color alone; and
- the inspector reaches and reports offscreen cells without moving tiles.

If a naturally playable session cannot reach an oversized board in a bounded
validation session, mark every unobserved large-board requirement **Not run**
and block final MVP acceptance. Do not claim it passed. Record the need for a
deterministic live-test fixture as an acceptance blocker for later work; do not
alter the candidate during this acceptance run.

## 4. iPhone 13 Pro

Use an actual iPhone 13 Pro. Before building, confirm:

- it is connected by USB or through an approved, previously paired wireless
  connection, unlocked, and has trusted the Mac;
- Developer Mode is enabled when required by its iOS version;
- Xcode has an available Apple development team for this local development build
  (record only the team label, never credentials or signing material); and
- Xcode tooling discovers the device:

```sh
xcrun xctrace list devices
xcrun devicectl list devices
```

Copy the discovered device name or UDID; never hard-code a personal UDID,
signing identity, or secret. In the disposable worktree, build and install with
the actual selector:

```sh
IOS_DEVICE='<discovered-iPhone-13-Pro-name-or-UDID>'
npx expo run:ios --device "$IOS_DEVICE"
```

If Xcode requests signing configuration, choose the authorized development team
locally and keep generated native files and signing state in the disposable
worktree. Confirm the installed app displays `n^m` and its bundle identifier is
`com.futuroptimist.nm`; launch it from the device home screen.

Execute the complete shared functional, simulator accessibility, and large-board
matrices on the phone itself. Additionally confirm comfortable one-handed
reachability of 44-point controls, physical one- versus two-finger gesture
recognition, behavior at larger system font sizes, VoiceOver inspection on the
touchscreen, and persistence after a real background, app termination, and
home-screen relaunch. Simulator results cannot stand in for these checks.

Cleanup is optional and occurs only after evidence capture. If the operator
chooses cleanup, first identify the installed development app by the displayed
name and bundle identifier `com.futuroptimist.nm`, then remove that app through
iOS storage/home-screen controls. Do not erase, reset, or unpair the device.

## 5. Android emulator or device

Use a supported JDK and Android SDK with platform tools, build tools, and either
an installed emulator image or an approved physical device. Record versions and
discover targets before building:

```sh
java -version
echo "$ANDROID_HOME"
adb version
emulator -version
emulator -list-avds
adb devices -l
```

Start an AVD through Android Studio Device Manager or
`emulator -avd '<discovered-AVD-name>'`, then wait for `adb devices -l` to
report it as `device`. For hardware, enable developer options and USB debugging,
authorize the host, and select the actual discovered serial. With exactly one
target connected, `npx expo run:android` is sufficient; otherwise pass the
discovered name/serial:

```sh
ANDROID_TARGET='<discovered-emulator-name-or-device-serial>'
npx expo run:android --device "$ANDROID_TARGET"
adb -s "$ANDROID_TARGET" shell pm path com.futuroptimist.nm
adb -s "$ANDROID_TARGET" shell monkey -p com.futuroptimist.nm 1
```

If Expo reports a different selector than `adb`, use Expo's discovered selector
for the build and the `adb devices -l` serial for the two ADB commands. Confirm
the package is installed and the command launches `n^m` rather than another app.

Execute the shared functional matrix, including controls and save/resume. Enable
TalkBack and enlarged system font/display settings; verify logical focus,
descriptive controls and cells, inspector navigation, bounded announcements,
textual/non-color state, and operability at scale. Execute the large-board gate
and record emulator and physical-device evidence separately. Mark checks that
specifically require physical Android touch hardware **Not run** unless an
actual physical Android device is used. Release signing, store upload, ads,
analytics, and production distribution are outside this MVP acceptance run.

## 6. Acceptance matrix

Every row needs one result per applicable environment. Link evidence rather than
embedding secrets, device identifiers, or signing details in the repository.

| Area                           | Expected observation                                                                                     | Evidence to capture                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Static validation              | Locked install, all checks, Expo config, and clean-tree checks pass at candidate SHA                     | Command transcript with versions and SHA                   |
| Fresh game                     | 2×2, two tiles, score 0, `k=1`, next milestone, usable controls                                          | Screenshot and notes                                       |
| `k` settings                   | Every integer 1–10 selectable for a new run; bounds disabled; high-`k` warning shown                     | Screenshots at 1, 5, 10 and result notes                   |
| Movement/merges/score          | Four directions work; equal pairs merge once; score and spawn/no-op behavior match rules                 | Before/after captures or video                             |
| Growth                         | Reached milestones produce the exact size while preserving coordinates                                   | Before/after milestone captures                            |
| Game over                      | Blocked board is final, understandable, announced, and offers new game                                   | Final-board screenshot/video                               |
| Save/resume                    | Exact state survives background and real relaunch                                                        | Before/after screenshots and lifecycle steps               |
| Automated recovery             | Storage tests pass for valid restore and corrupt/incompatible/invalid recovery                           | `npm run check` test transcript; label automated only      |
| Small-board swipe              | One-finger cardinal swipes work while board remains fitted                                               | Gesture video/notes                                        |
| Large-board viewport           | Threshold switch, gesture separation, zoom/reset, clamping, edge text, and offscreen inspection all work | Video/screenshots, board size, or explicit Not run blocker |
| Inspector/directional controls | 44-point controls move through rows/columns or invoke game moves as labeled                              | Screen-reader video/notes                                  |
| Announcements                  | Only specified semantic events announce; game over has priority; no flooding                             | VoiceOver/TalkBack recording or exact observation log      |
| Dynamic Type/font scaling      | Large text remains readable, reachable, and operable                                                     | Screenshots with setting recorded                          |
| VoiceOver/TalkBack             | Logical focus, roles, values, disabled state, tiles, and inspector are understandable                    | Assistive-technology recording/notes                       |
| iOS Simulator                  | Entire simulator procedure and applicable matrix completed                                               | Model/runtime/Xcode versions and linked evidence           |
| iPhone 13 Pro                  | Entire physical iOS matrix, reachability, gestures, and real relaunch completed                          | iOS/Xcode versions and linked evidence                     |
| Android                        | Emulator/device matrix completed; hardware-only rows accurately scoped                                   | Model/API/JDK/SDK versions and linked evidence             |

An unexercised oversized-board viewport on any required live platform is an
explicit final-acceptance blocker, not a pass based on source review or tests.

## Step 19 evidence record template

Copy this blank template into the acceptance record. Add a row when an area
needs separate results; do not replace **Not run** with **Pass** without direct
evidence.

```markdown
# MVP acceptance evidence

## Candidate

- Candidate SHA:
- Branch/tag:
- Repository state clean (Pass/Fail/Not run):
- Evidence date/time and operator:

## Environments

| Environment             | Tool/device | OS/runtime | Toolchain versions | Candidate SHA confirmed | Notes |
| ----------------------- | ----------- | ---------- | ------------------ | ----------------------- | ----- |
| Static/CI               |             |            | Node / npm / Expo: |                         |       |
| iOS Simulator           |             |            | Xcode / Simulator: |                         |       |
| iPhone 13 Pro           |             |            | Xcode / iOS:       |                         |       |
| Android emulator/device |             |            | JDK / SDK / ADB:   |                         |       |

## Command results

| Command                           | Pass/Fail/Not run | Evidence/log | Notes |
| --------------------------------- | ----------------- | ------------ | ----- |
| `git status --short`              |                   |              |       |
| `git rev-parse HEAD`              |                   |              |       |
| `node --version && npm --version` |                   |              |       |
| `npm ci`                          |                   |              |       |
| `npm run check`                   |                   |              |       |
| `npx expo config --type public`   |                   |              |       |
| `git diff --check`                |                   |              |       |

## Acceptance results

| Matrix area | Environment | Pass/Fail/Not run | Evidence | Failure reproduction/notes |
| ----------- | ----------- | ----------------- | -------- | -------------------------- |
|             |             |                   |          |                            |

## Known limitations and blockers

-

## Final disposition

- Disposition (Accepted/Rejected/Blocked):
- Rationale:
- Unverified requirements:
- Follow-up owner/reference:
```
