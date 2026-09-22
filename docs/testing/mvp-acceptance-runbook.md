# MVP acceptance runbook

## Purpose and evidence rules

Use this runbook to validate one MVP candidate on an iOS Simulator, an iPhone 13
Pro, and an Android emulator or device. Static checks and automated tests
support acceptance, but do not substitute for the live checks below.

Record every check as **Pass**, **Fail**, or **Not run**. Every record must name
the candidate commit SHA and the tool, device, OS/runtime, and assistive
technology versions used. For a failure, include exact reproduction steps,
expected and observed behavior, and links to captured evidence. Never infer a
device result from CI or claim success for an unperformed check. Completion
requires testing the exact candidate SHA; if a newer commit is tested instead,
record that SHA as a separate candidate and repeat affected checks.

The current continuous-fit interaction is provisional. A naturally played
session must reach the 128-triggered 8×8 board for the large-board checks. If it
cannot do so in the bounded session chosen by the operator, record those checks
as **Not run** and block final MVP acceptance. Do not add or use an undocumented
fixture and do not extrapolate from automated interaction tests.

## 1. Safe static preflight

Use a clean clone at the candidate commit. Replace `<candidate-sha>` only with
the full SHA under assessment:

```sh
git clone https://github.com/futuroptimist/n-m.git n-m-acceptance
cd n-m-acceptance
git fetch origin main
git checkout --detach <candidate-sha>
test -z "$(git status --short)" || {
  echo 'STOP: candidate checkout is not clean' >&2
  exit 1
}
test "$(git rev-parse HEAD)" = '<candidate-sha>' || {
  echo 'STOP: HEAD is not the requested candidate SHA' >&2
  exit 1
}
git rev-parse HEAD
node --version
npm --version
npm ci || {
  echo 'STOP: npm ci failed' >&2
  exit 1
}
./node_modules/.bin/expo --version
npm run check
npx expo config --type public
git status --short
git diff --check
```

Expected results:

- `git rev-parse HEAD` prints the candidate SHA, and both status commands print
  nothing.
- Node satisfies `package.json`'s `>=22 <25` requirement (`.nvmrc` selects Node
  22). Record the complete `node --version`, `npm --version`, Expo CLI output,
  host OS, and Xcode/Android tool versions rather than recording only “current.”
- `npm ci` exits zero and changes neither tracked files nor the lockfile.
- `npm run check` exits zero after meaningful formatting, Markdown, ESLint,
  TypeScript, engine, storage, and interaction checks.
- Expo public config exits zero and reports app slug `n-m`, iOS bundle ID
  `com.futuroptimist.nm`, and Android package `com.futuroptimist.nm`.
- `git diff --check` exits zero with no output.

Stop the assessment immediately if the clean-tree or exact-SHA guard fails, if
the Node/npm/Expo or native toolchain versions do not meet the recorded runtime
requirements, or if any install, check, build, bundle lookup, package lookup, or
launch verification fails. Correct the environment or create a new evidence
record; do not continue and reinterpret later results as evidence for the failed
candidate.

`npx expo run:ios` and `npx expo run:android` generate native projects through
Expo CNG. Run native generation and builds only in this disposable clone or a
clean temporary worktree. Before removing it, capture evidence and confirm with
`git status --short` that generated `ios/`, `android/`, or other build output
will not be committed. Never run `git add .` on generated output.

## 2. Shared live functional matrix

Run this matrix independently on every live target. Record each case separately
rather than writing one overall result.

1. **Fresh game:** launch after removing the prior development install (or
   explicitly clearing its app data). Confirm a readable 2×2 board with two
   distinct `2` tiles, score 0, active `k=1`, and the next-growth text.
2. **Movement and scoring:** use deliberate one-finger swipes in all four
   cardinal directions. A legal move slides tiles and creates exactly one new
   tile; a no-op does neither. Merge two equal values, confirm they merge only
   once per move, and confirm the score rises by the resulting tile value.
3. **Controls disclosure and directional controls:** confirm the normal play
   screen does not scroll and its visible Controls action opens the secondary
   panel. Invoke Move up/down/left/right there and confirm each follows the same
   rules as its swipe. Check that each target is comfortably operable and at
   least 44 logical points.
4. **`k` range and replacement:** decrement at 1 and increment through every
   displayed value to 10. Confirm the bounds are disabled, the active run's `k`
   does not change, and the warning appears for 5–10. With an unfinished run,
   select another value and press New game: first cancel and retain the exact
   run, then confirm and get a fresh 2×2 run at the selected `k`.
5. **Growth:** in natural play at `k=1`, merge the first 4, 8, and 16. Confirm
   board sizes 3×3, 4×4, and 5×5 respectively; existing positions remain while
   space is added below/right, next-growth text advances, and play continues.
   Continue through the first 128 and confirm the resulting 8×8 board returns to
   overview fit with all rows, columns, cells, and edges visible.
6. **Motion:** observe ordinary moves in all four directions. Existing tiles
   must slide from their source cells; equal tiles must converge before the
   merged result resolves; the spawn must not appear before movement resolves.
   Enter several inputs quickly and confirm no duplicate/stale tile or
   conflicting move appears.
7. **Persistence:** note `k`, board cells, score, next milestone, and status;
   background the app, then terminate and relaunch it through the normal OS app
   switcher/launcher flow. Confirm the same state resumes atomically. Make
   another move and repeat. This is a real relaunch, not hot reload.
8. **Game over:** naturally fill a run until no slide or merge remains. Confirm
   `Game over`, the final score, an understandable final board, and no further
   move response. Confirm New game starts immediately without an unfinished-run
   warning. A full but mergeable board must remain playable if encountered.

Recovery from corrupt, invalid, unreadable, and newer-version saves is covered
by deterministic storage tests in `npm run check`. Record that evidence as
automated, not as a live-device pass. If a safe, documented live injection
method is unavailable, mark live recovery **Not run**; do not manipulate app
containers ad hoc or destroy evidence.

## 3. iOS Simulator

### Discover, boot, build, and launch

Run on macOS with Xcode selected. Use two terminals in the same disposable
candidate checkout. In terminal 1, verify the SHA again and keep Metro running:

```sh
cd n-m-acceptance
test "$(git rev-parse HEAD)" = '<candidate-sha>' || exit 1
npm start
```

In terminal 2, keep identifiers in shell variables so no personal simulator
identifier enters the repository, then build without starting a second bundler:

```sh
xcodebuild -version
xcode-select -p
xcrun simctl list devices available
export IOS_SIMULATOR_UDID='<UDID copied from an available iPhone entry>'
xcrun simctl bootstatus "$IOS_SIMULATOR_UDID" -b || {
  xcrun simctl boot "$IOS_SIMULATOR_UDID"
  xcrun simctl bootstatus "$IOS_SIMULATOR_UDID" -b
}
open -a Simulator
npx expo run:ios --device "$IOS_SIMULATOR_UDID" --no-bundler
xcrun simctl get_app_container "$IOS_SIMULATOR_UDID" com.futuroptimist.nm app
xcrun simctl launch --terminate-running-process \
  "$IOS_SIMULATOR_UDID" com.futuroptimist.nm
```

Choose an actually listed iPhone simulator; do not invent a UDID. Stop if the
bundle lookup fails or resolves a different identifier. The boot guard reuses a
booted simulator and otherwise boots only the selected simulator; it does not
erase, reset, or delete any simulator. Record the simulator model, UDID in the
private evidence record if appropriate, iOS runtime, Xcode, Expo, and host
versions.

Leave terminal 1 and Metro running for all launch and relaunch checks. After a
fresh installation or cleared-data launch, confirm the actual game UI from this
checkout loads with the expected 2×2 board, two distinct 2s, score 0, active
`k=1`, and next-growth text. On a persistence relaunch, instead confirm the
previously recorded board and dimensions, score, active `k`, milestone, and
status return exactly; an unexpected reset to 2×2 fails the check. A
development-client shell, loading screen, or bundle-open event alone is not a
pass. Stop before live testing if the build, bundle lookup, launch, Metro
connection, or game-load check fails.

### Simulator checks

Perform the shared live functional matrix, then:

- Record Xcode and iOS runtime versions first. Where that runtime supports
  native simulated VoiceOver, activate it in the simulated **Settings app →
  Accessibility → VoiceOver** (and record the exact route used). Traverse in
  logical order. Confirm the score and board dimensions are spoken; New game,
  the four moves, `k` decrement/increment, inspector, and viewport controls have
  descriptive roles, labels, bounds, and disabled states. Confirm focus is not
  trapped or lost.
- Use Xcode Accessibility Inspector separately to inspect element metadata,
  names, roles, values, states, bounds, and focus order. Inspector metadata is
  not evidence that VoiceOver focused or spoke an element and cannot substitute
  for speech, focus, or announcement evidence. If the recorded Xcode/runtime
  cannot run native simulated VoiceOver, record VoiceOver cases **Not run** with
  that limitation; do not waive any required gate. Physical iPhone VoiceOver
  verification remains mandatory.
- With the board inspector, step to first/last rows and columns and confirm
  one-based row/column plus exact tile value or “empty” is visible and announced
  only after explicit row/column actions. Confirm tile meaning, edge state, and
  disabled state remain understandable without color.
- Confirm a score-changing merge, growth, and game over are announced without
  announcements for spawns, no-op swipes, viewport changes, or redraws. When
  game over coincides with other events, it takes priority.
- Increase iOS Larger Text/Dynamic Type through a large accessibility size,
  relaunch, and confirm labels remain readable, controls reachable, the normal
  gameplay surface still does not scroll, the Controls panel scrolls internally
  where necessary, and board values remain identifiable. Restore the original
  setting and record both sizes.
- Enable Reduce Motion, then perform a slide, merge, and board growth. Confirm
  each resulting board state remains understandable and movement, merge, and
  growth transitions update immediately or use restrained fades. Restore the
  original setting after recording the result.

Perform ordinary one-finger swipe, two-finger pan, and pinch gesture tests with
VoiceOver off. Then turn VoiceOver on for accessible-control and inspector
focus/speech/announcement tests; do not treat screen-reader gestures as ordinary
gameplay gesture evidence. Record the screen-reader state for each result.

### Continuous-fit large-board gate

In a naturally played `k=1` session, continue through the first merged 128 and
the resulting 8×8 board, then continue farther if the bounded session permits.
Confirm:

1. overview mode shows the entire 8×8 board with no clipped edge or blank cell,
   and every later growth dimension can return to the same full-board fit;
2. portrait gameplay at default text size does not vertically scroll, and
   one-finger up/down/left/right board swipes still move tiles;
3. in Controls, Zoom + enlarges into the navigable view, Zoom − reaches the
   dynamic overview bound, and Fit board resets to the complete board without
   altering game state;
4. two-finger pan and pinch navigate only the enlarged board and never create a
   move or expose blank area beyond the board;
5. mode and top/right/bottom/left visible-edge text update without relying on
   color; and
6. the inspector reaches and accurately reports corner/interior cells without
   moving the viewport or tiles.

Time-boxing is allowed, but omission is not a pass. If natural play does not
reach this state within the recorded bound, mark every unobserved large-board
item **Not run**, identify the missing deterministic live-test fixture as an
acceptance blocker, and block final MVP acceptance.

## 4. iPhone 13 Pro

### Device preflight, build, and launch

Use an actual iPhone 13 Pro. Connect it over USB or an explicitly approved
wireless Xcode pairing, accept **Trust This Computer**, enable Developer Mode
when that iOS version requires it, and ensure Xcode has an available Apple
development team. Never record credentials, provisioning profiles, signing
identities, or secrets in the repository.

Discover the device rather than hard-coding an identifier. As with the
simulator, keep `npm start` running in terminal 1 from the exact disposable
candidate checkout. In terminal 2 in that same checkout, define and use the
device variable:

```sh
xcodebuild -version
xcrun devicectl list devices
# On Xcode versions that provide it, this is an additional discovery view:
xcrun xctrace list devices
export IOS_DEVICE='<exact discovered iPhone 13 Pro name or identifier>'
npx expo run:ios --device "$IOS_DEVICE" --no-bundler
xcrun devicectl device info apps --device "$IOS_DEVICE" \
  --bundle-id com.futuroptimist.nm
xcrun devicectl device process launch --device "$IOS_DEVICE" \
  --terminate-existing com.futuroptimist.nm
```

If automatic signing cannot select a team, open the generated Xcode workspace
inside the disposable checkout, select the discovered device and an authorized
development team, then build/run. Record that manual step without recording
private signing data. Confirm the installed and launched bundle is
`com.futuroptimist.nm` before testing. Keep Metro available through OS-icon and
force-quit relaunches, and confirm the game UI from the assessed checkout loads;
the development-client bundle opening is insufficient. Stop on any build,
bundle, launch, Metro, or game-load failure.

Run the complete shared, simulator accessibility, and oversized-board matrices
again on the phone; simulator evidence cannot be reused. Additionally verify:

- controls, inspector, viewport buttons, and the whole scrollable screen are
  reachable when held normally;
- physical one-finger swipes remain distinct from two-finger pan/pinch on an
  oversized board, including near screen and viewport edges;
- at default and a large system font size, text remains readable and controls
  remain reachable; and
- with Reduce Motion enabled, slide, merge, and growth transitions update
  immediately or use restrained fades while every resulting state remains
  understandable; and
- state persists after backgrounding, force-quitting from the app switcher, and
  launching the installed icon again (not from Metro/Xcode alone).

Physical iPhone VoiceOver verification is mandatory. Test ordinary swipe,
two-finger pan, and pinch behavior with VoiceOver off; test accessible controls,
inspector focus/speech, and announcements with VoiceOver on.

After evidence capture, cleanup is optional and recoverable by rebuilding. First
use the app-info command above to verify the bundle identifier, then—only if the
operator chooses—remove that development app:

```sh
xcrun devicectl device uninstall app --device "$IOS_DEVICE" \
  com.futuroptimist.nm
```

Do not erase or reset the device.

## 5. Android emulator or device

### Preflight, build, and launch

Record host OS, JDK, SDK, build-tools, platform-tools/ADB, emulator/device, API
level, and Android version. Ensure `JAVA_HOME` and `ANDROID_HOME` (or
`ANDROID_SDK_ROOT`) point to the intended installations:

```sh
java -version
javac -version
adb version
sdkmanager --version
emulator -version
emulator -list-avds
adb devices -l
```

Use two terminals in the same disposable candidate checkout. In terminal 1,
verify the candidate SHA and keep `npm start` running. In terminal 2, first run
`adb devices -l`, choose exactly one listed target, and set `ANDROID_SERIAL`
before any wait. For a physical device, enable developer options/USB debugging,
approve that host's prompt, and skip all AVD/emulator-start commands.

For the emulator path only, start an AVD actually returned by
`emulator -list-avds`:

```sh
export ANDROID_AVD='<discovered AVD name>'
emulator -avd "$ANDROID_AVD" &
```

For either path, select the target from fresh output, reject unauthorized,
offline, or mismatched targets, and use a selected-serial and bounded wait:

```sh
adb devices -l
export ANDROID_SERIAL='<exact serial from adb devices -l>'
if ! node <<'NODE'
const { spawnSync } = require('node:child_process');

const serial = process.env.ANDROID_SERIAL;
if (!serial) throw new Error('ANDROID_SERIAL is required');

function adb(args, timeout, capture = false) {
  const result = spawnSync('adb', ['-s', serial, ...args], {
    encoding: 'utf8',
    stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit',
    timeout,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`adb ${args.join(' ')} exited ${result.status}`);
  }
  return capture ? result.stdout.trim() : '';
}

if (adb(['get-state'], 10_000, true) !== 'device') {
  throw new Error(`${serial} is not an authorized online device`);
}
adb(['wait-for-device'], 30_000);

const deadline = Date.now() + 120_000;
while (true) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new Error(`${serial} did not become boot-ready within 120 seconds`);
  }
  if (
    adb(
      ['shell', 'getprop', 'sys.boot_completed'],
      Math.min(5_000, remaining),
      true,
    ).replace(/\r/g, '') === '1'
  ) {
    break;
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1_000);
}

console.log(`Model: ${adb(['shell', 'getprop', 'ro.product.model'], 5_000, true)}`);
console.log(
  `Android: ${adb(['shell', 'getprop', 'ro.build.version.release'], 5_000, true)}`,
);
NODE
then
  echo "STOP: $ANDROID_SERIAL failed Android readiness verification" >&2
  exit 1
fi
npx expo run:android --device "$ANDROID_SERIAL" --no-bundler
adb -s "$ANDROID_SERIAL" shell pm path com.futuroptimist.nm
adb -s "$ANDROID_SERIAL" shell monkey -p com.futuroptimist.nm \
  -c android.intent.category.LAUNCHER 1
adb -s "$ANDROID_SERIAL" shell dumpsys activity activities | \
  grep -F com.futuroptimist.nm
```

Keep Metro running in terminal 1 (and a foreground emulator in another terminal
if needed) throughout relaunch checks. The commands intentionally leave ADB and
boot errors visible. Stop before building if authorization, bounded readiness,
model/OS target verification, or serial selection fails. Do not use an unlisted
serial. Stop if the build, package lookup, activity verification, Metro
connection, or launch fails. For a fresh installation or cleared-data launch,
confirm the expected 2×2 board, two distinct 2s, score 0, active `k=1`, and
next-growth text from the assessed checkout actually load. For a persistence
relaunch, require the previously recorded board and dimensions, score, active
`k`, milestone, and status; an unexpected reset fails. Merely opening the
development-client bundle is not a pass.

Run the shared functional matrix, the natural-play oversized-board gate, and the
applicable non-color, inspector, announcement, and large-font checks. Enable
TalkBack and use swipe/focus navigation to verify logical focus, descriptive
control labels/roles/states, inspector access, and bounded announcements. Verify
persistence across backgrounding, removal from Recents, and a launcher relaunch.
Enable the target's reduced-motion or Remove animations preference and confirm
that slide, merge, and growth transitions update immediately or use restrained
fades while every resulting board state remains understandable; then restore the
original setting. Record the exact preference used. If the target provides no
applicable preference, record the check as **Not run** with the OS and reason.
On a physical Android device, additionally check real hand reachability,
physical gesture separation, system font scaling, and USB or wireless relaunch.
If only an emulator is used, record every physical-Android-only check as **Not
run**.

Perform ordinary swipe, pan, and pinch tests with TalkBack off. Turn TalkBack on
for accessible-control and inspector focus/speech/announcement tests, and record
its state with each result.

Android acceptance requires only a local development build. It does not require
release signing, a store upload, ads, analytics, or production distribution.

## 6. Acceptance and evidence matrix

Use one result per environment where the row applies.

| Area                             | Expected observation                                                                                      | Minimum evidence                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Static validation                | Clean candidate; required Node; install, checks, tests, config, and diff checks exit zero                 | SHA plus complete command log and tool versions                                   |
| Fresh game                       | 2×2, two distinct 2s, score 0, `k=1`, milestone shown                                                     | Screenshot and brief observation                                                  |
| `k` settings                     | Every 1–10 value reachable; bounds disabled; 5–10 warning; active `k` immutable                           | Screenshots at bounds/warning and notes                                           |
| Movement / merges / score        | Four directions work; legal/no-op spawn behavior; equal tiles merge once; exact score delta               | Before/after capture and action sequence                                          |
| Growth                           | At `k=1`, first merged 4/8/16 yields exactly 3×3/4×4/5×5                                                  | Milestone screenshots/video and move notes                                        |
| Game over                        | Blocked board announces final score, rejects moves, and starts fresh without unfinished warning           | Final/fresh screenshots and observation                                           |
| Save / resume                    | Exact run returns after background and true relaunch                                                      | Before/after captures and relaunch steps                                          |
| Recovery behavior                | Automated tests cover valid, corrupt, newer, read/write/clear failure behavior without silent destruction | Named test command/output; live result separately Not run unless safely exercised |
| Small-board swipe                | Fitted board accepts deliberate one-finger swipes in four directions                                      | Short video or action/result notes                                                |
| Continuous-fit large board       | Natural 128/8×8 fits fully; later growth, gesture separation, zoom/fit, clamping, and inspection work     | Video/screenshots for each item, or Not run blocker                               |
| Compact gameplay                 | Header, status, full board, and Controls fit without page scrolling; vertical board swipes move tiles     | Portrait video showing bounds and up/down moves                                   |
| Tile motion                      | Four-direction slides, merge convergence, spawn timing, and rapid-input serialization are coherent        | Slow video plus action/result notes                                               |
| Inspector / directional controls | 44-point accessible controls; exact one-based cell text; all rows/columns and moves reachable             | Assistive-tech notes and representative captures                                  |
| Announcements                    | Only inspector actions, merges, growth, and game over announce; game over has priority                    | VoiceOver/TalkBack recording or transcript                                        |
| Dynamic Type / font size         | Large text is readable; gameplay stays fixed and the secondary Controls panel scrolls as needed           | Default/large screenshots and configured size                                     |
| Reduced motion                   | With the platform preference enabled, slide, merge, and growth states remain clear without full motion    | Preference name/value and video or action/result notes                            |
| VoiceOver / TalkBack             | Logical focus; names, roles, states, bounds; no focus trap; non-color meaning                             | Version/settings and narrated transcript/video                                    |
| iOS Simulator                    | All applicable simulator cases run on the recorded runtime                                                | Device/runtime/Xcode versions and matrix results                                  |
| iPhone 13 Pro                    | Full matrix rerun on hardware, including reachability and real relaunch                                   | Model/iOS/app bundle, versions, video/screenshots                                 |
| Android                          | Full applicable matrix on discovered target; physical-only rows distinguished                             | Model or AVD/API, Android/JDK/SDK versions, captures                              |

Any required **Fail** blocks acceptance. Any required **Not run**, especially
the natural-play oversized-board checks on the required targets, also blocks
acceptance until it is executed against the same candidate or a separately
recorded newer candidate.

## Step 19 evidence record template

Copy this section into the acceptance record. Leave unavailable fields blank or
mark them **Not run**; never prefill a result based on expectation.

```markdown
# MVP acceptance evidence

## Candidate

- Repository:
- Branch/tag (if any):
- Full candidate SHA:
- Base SHA:
- Validation dates (UTC):
- Operator(s):

## Environments

| Target        | Model/name | OS/runtime | Toolchain versions      | App bundle/package |
| ------------- | ---------- | ---------- | ----------------------- | ------------------ |
| Host/static   |            |            | Node / npm / Expo:      | N/A                |
| iOS Simulator |            |            | Xcode / Expo:           |                    |
| iPhone 13 Pro |            |            | Xcode / Expo:           |                    |
| Android       |            |            | JDK / SDK / ADB / Expo: |                    |

## Command results

| Exact command | Environment | Pass / Fail / Not run | Exit/result and evidence link |
| ------------- | ----------- | --------------------- | ----------------------------- |
|               |             |                       |                               |

## Acceptance matrix results

| Area                             | Environment | Pass / Fail / Not run | Observation and evidence link |
| -------------------------------- | ----------- | --------------------- | ----------------------------- |
| Static validation                |             |                       |                               |
| Fresh game                       |             |                       |                               |
| k settings                       |             |                       |                               |
| Movement / merges / score        |             |                       |                               |
| Growth                           |             |                       |                               |
| Game over                        |             |                       |                               |
| Save / resume                    |             |                       |                               |
| Recovery behavior (automated)    |             |                       |                               |
| Recovery behavior (live)         |             |                       |                               |
| Small-board swipe                |             |                       |                               |
| Large-board viewport             |             |                       |                               |
| Inspector / directional controls |             |                       |                               |
| Announcements                    |             |                       |                               |
| Dynamic Type / font size         |             |                       |                               |
| Reduced motion                   |             |                       |                               |
| VoiceOver / TalkBack             |             |                       |                               |
| iOS Simulator overall            |             |                       |                               |
| iPhone 13 Pro overall            |             |                       |                               |
| Android overall                  |             |                       |                               |

## Failure details

### <short failure name>

- Environment and exact candidate SHA:
- Preconditions:
- Reproduction steps:
- Expected:
- Observed:
- Logs/captures:

## Known limitations and Not-run blockers

-

## Final disposition

- Disposition: Accept / Reject / Blocked
- Rationale:
- Required follow-up:
- Evidence reviewed by/date:
```
