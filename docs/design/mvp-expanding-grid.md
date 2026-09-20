# MVP design: expanding grid

## Status and terminology

This document is the implementation source of truth for the single `n^m` MVP
mode. It separates **maintainer requirements** (requested behavior) from
**proposed design decisions** (defaults chosen where behavior was unspecified).
Changing a requirement needs an explicit maintainer decision; proposed decisions
can be revisited, but must not silently drift between the engine, UI, and tests.

A tile is represented by its exponent `e`; its displayed value is `2` raised to
`e`. Thus exponent 1 is tile 2, exponent 2 is tile 4, and so on. In formulas in
this document, `^` means exponentiation. It is **not** JavaScript's
exponentiation operator (`**`), and must not be copied into TypeScript as though
it were one.

## Product goals

- Deliver a free, open-source, approachable mobile puzzle for iOS and Android.
- Make an expanding board the clear distinguishing mechanic while retaining
  familiar directional sliding and merging.
- Give a first-time mobile maintainer a small, testable architecture based on
  React Native, Expo, and TypeScript.
- Keep deterministic game rules independent from mobile UI and services.

### MVP boundary and non-goals

The MVP contains only the expanding-grid mode specified here. It has no
accounts, backend, multiplayer, advertising, analytics, or purchases. It does
not include other modes, cloud sync, social features, competitive leaderboards,
or a generalized game-mode framework. Reaching 2048 is not a win condition and
does not end the run.

The initial implementation must not silently change the 2×2 starting size,
growth thresholds, or allowed `k` range to make balancing or presentation
easier.

## Maintainer requirements

1. A new game starts with a 2×2 square grid.
2. Tiles contain powers of 2. The tile growth factor is fixed at 2 for this MVP.
3. Two equal tiles merge into one tile with twice their value.
4. Both grid dimensions increase by 1 for every `k` additional exponent levels
   reached beyond the starting tile value 2.
5. Growth depends on the highest milestone reached during the run, not the
   number of merges. Recreating a previously reached milestone never expands the
   board again.
6. `k` is an integer from 1 through 10 inclusive and is exposed in the game UI
   through a slider or increment/decrement controls.
7. With `k=1`, the first merged 4 expands the board to 3×3, the first merged 8
   to 4×4, and the first merged 16 to 5×5.
8. With `k=2`, the first merged 8 expands the board to 3×3, the first merged 32
   to 4×4, and the first merged 128 to 5×5.

### Mathematical growth rule

Let `H` be the highest tile exponent ever produced by a merge during the current
run, initialized to 1. For the active `k`:

```text
expansionCount = floor((H - 1) / k)
sideLength = 2 + expansionCount
nextExpansionExponent = 1 + k * (expansionCount + 1)
nextExpansionTile = 2 ^ nextExpansionExponent
```

Compute `sideLength` directly from the historical maximum `H`. Do not increment
size in response to individual merges.

| Active `k` | First milestone → size     | Second milestone → size       | Third milestone → size           |
| ---------- | -------------------------- | ----------------------------- | -------------------------------- |
| 1          | merged 4 (`H=2`) → 3×3     | merged 8 (`H=3`) → 4×4        | merged 16 (`H=4`) → 5×5          |
| 2          | merged 8 (`H=3`) → 3×3     | merged 32 (`H=5`) → 4×4       | merged 128 (`H=7`) → 5×5         |
| 3          | merged 16 (`H=4`) → 3×3    | merged 128 (`H=7`) → 4×4      | merged 1024 (`H=10`) → 5×5       |
| 5          | merged 64 (`H=6`) → 3×3    | merged 2048 (`H=11`) → 4×4    | merged 65536 (`H=16`) → 5×5      |
| 10         | merged 2048 (`H=11`) → 3×3 | merged 2097152 (`H=21`) → 4×4 | merged 2147483648 (`H=31`) → 5×5 |

## Proposed design decisions

The following resolve behavior not supplied in the original requirements. They
are proposed MVP defaults, not maintainer-originated requirements.

### Run setup and setting

- Default to `k=1`.
- Present labeled, accessible decrement and increment buttons around a visible
  numeric value. Disable decrement at 1 and increment at 10. This is preferred
  over a slider because every discrete value and bound is apparent.
- A run's `k` is immutable. Setting changes apply to the next game. If the
  current run is unfinished, ask for confirmation before replacing it.
- Start a run with two exponent-1 tiles (displayed as 2) placed in two distinct,
  uniformly selected cells.

### Movement, merge, growth, and spawn order

- Use standard 2048 movement: slide all tiles in one cardinal direction, merge
  equal adjacent tiles in movement order, and permit each resulting tile to
  merge at most once in that move.
- Score each merge by adding the resulting tile's displayed value.
- A move is successful only when at least one tile changes coordinate or merges.
  An unchanged move does not spawn a tile, consume randomness, change score, or
  expand the board.
- For a successful move, resolve every slide and merge on the original board;
  update `H` from all merge results; derive and apply the new board size; then
  spawn exactly one tile in a uniformly selected empty cell. The spawned tile is
  exponent 1 (value 2) with 90% probability and exponent 2 (value 4) with 10%
  probability.
- Spawned tiles never update `H` or directly trigger growth. A spawned 4 affects
  `H` only after it participates in a merge that produces a later result.
- Preserve all existing coordinates when growing: append empty rows below and
  empty columns to the right.
- A move may cross multiple thresholds. Derive the final size without limiting
  growth to one expansion per move. For example, at `k=1`, merging two spawned
  4s into the run's first 8 can take a 2×2 board directly to 4×4.
- Determine game over after movement, any expansion, and spawning. The run is
  over only if no cardinal move can slide or merge a tile; a full board is not
  sufficient when adjacent equal tiles can still merge.

### Local continuity

Save and resume the current run locally. At minimum, persist the active `k`,
board exponents and dimensions, score, historical merge milestone `H`, run/game-
over status, and a schema version. Save after each completed state transition
and when app lifecycle events allow; restoration must be atomic from the user's
perspective. A corrupt, incompatible, or invalid save must fail safely and offer
a new game rather than partially restoring state.

## Important balancing limitation

> **Known MVP constraint:** with the proposed standard 2/4 spawn distribution, a
> fixed 2×2 board can produce at most a 32. Consequently, `k=5–10` cannot reach
> their first expansion threshold under these defaults. `k=5` first needs 64,
> and `k=10` first needs 2048.

The required setting range remains 1–10. High values are therefore selectable
but lead to runs that cannot expand and will eventually end on the 2×2 board.
Settings help should say: **“Higher k grows less often. With current 2/4 tile
spawns, k values 5–10 cannot grow beyond 2×2.”** The new-game confirmation may
repeat this note when one of those values is selected.

Do not conceal this issue by changing the initial board or spawn distribution.
Possible post-MVP experiments—requiring an explicit rule/design revision—include
larger-valued spawns, a different starting position, threshold-aware spawning,
or a revised relationship between `k` and milestones. Their fairness,
explainability, and effect on deterministic tests must be evaluated separately.

## Screen and interaction

The main screen has one gameplay hierarchy:

1. Header with the `n^m` name, score, and new-game action.
2. Status text showing the immutable active `k` and the next growth milestone
   (for example, “Next growth: merge 16 → 5×5”).
3. Square board with readable tile labels and clear empty cells.
4. New-game settings with `k` decrement/value/increment controls, short setting
   help, and confirmation when an unfinished run would be discarded.
5. A game-over state that announces the final score and offers a new game while
   leaving the final board understandable.

Primary play uses one-finger swipes in four cardinal directions. Gesture
recognition must distinguish deliberate swipes from taps and scrolling without
making short swipes inaccessible. New-game and setting actions must be standard
accessible controls with descriptive names, logical focus order, adequate touch
targets, and disabled state communicated beyond color. Announce score, board
growth, and game over without flooding screen-reader output on every animation.

Tile values need sufficient foreground/background contrast and labels that
remain legible under system font scaling. Do not rely on color alone to convey
values. Honor reduced-motion preferences: replace movement/merge/growth
transitions with immediate state updates or restrained fades, and never make
animation necessary to understand the resulting board.

### Increasingly large boards on phones

The rules impose no gameplay size cap, and tiles cannot shrink indefinitely. As
a **proposed interaction decision**, render the whole board as a fitted square
while each rendered tile itself is at least 44 logical points wide and tall,
excluding the six-point inter-cell gutter and board padding. When fitting would
make tiles smaller than that provisional threshold, use a clipped
two-dimensional viewport whose initial tile target remains 44 points. Clamp
panning so blank space cannot be exposed. Visible text identifies which top,
right, bottom, and left board edges are in view, so location never depends on
color alone. Visible, accessible controls zoom in, zoom out, and fit/reset the
viewport.

One-finger cardinal swipes within the square board viewport remain gameplay
moves at every board size; swipes on the inspector or viewport controls do not
move tiles. Two-finger pan and pinch gestures navigate the oversized-board
viewport only while it is needed. Accessible 44-point directional controls
invoke the same gameplay move path, while a board inspector steps independently
through rows and columns and reports each exact value or “empty,” including
cells outside the visual viewport. Live announcements are limited to explicit
inspector row/column actions and to score-changing merges, growth, and game
over; game over takes priority when events coincide. Spawns, no-op gestures,
viewport changes, and redraws are not announced. Edge status remains readable
text rather than a live region.

These threshold and gesture choices remain provisional until they are validated
on the iPhone 13 Pro in the later physical-device acceptance step. That check
must cover reachability, pinch/pan separation, screen-reader inspection, and
system font scaling before the decisions are locked down. Clip off-screen cells
and avoid animation-heavy work as boards become large. These presentation
choices must not truncate engine state or create an undocumented maximum board
size. If real device limits ultimately require a cap, that is a future gameplay-
rule decision requiring specification and player-facing communication.

## Architecture and data

### Pure engine boundary

Implement game rules as a pure TypeScript engine. It accepts state, a direction,
and an injected random source (or predetermined random samples) and returns a
new state plus semantic events such as moves, merges, growth, spawn, and game
over. It must not import React Native/Expo modules or directly perform storage,
gestures, rendering, animation, clocks, or platform I/O. The UI interprets
events; storage serializes validated engine state. This supports deterministic
tests without implementing a generalized mode framework.

Keep narrow boundaries—engine types and operations, a persistence adapter, and
screen components—so a future explicitly designed mode could reuse appropriate
parts. Do not add speculative mode registries, plug-in abstractions, or flags in
the MVP.

### State representation and safe numbers

A conceptual persisted state is:

```text
{
  schemaVersion,
  runId,
  activeK,
  sideLength,
  board: (null | exponent)[][],
  highestMergedExponent,
  score,
  status
}
```

Use positive safe integer exponents (`e >= 1`) and `null` for empty cells, not
floating-point displayed values. Validate that the board is square, dimensions
match the growth formula, exponents are positive safe integers, `activeK` is in
range, and `highestMergedExponent` is consistent enough to prevent accidental
board shrinkage. Do not use bit shifts or other bitwise arithmetic: JavaScript
bitwise operations impose signed 32-bit behavior.

Displayed values can exceed `Number.MAX_SAFE_INTEGER`; format `2^e` with
`BigInt` (`1n << BigInt(e)` is acceptable because BigInt shifts are not 32-bit)
or an exponent/compact notation without converting through `Number`. Keep score
as an exact `bigint` in memory and serialize it as a base-10 string, since JSON
does not directly encode BigInt. Validate canonical decimal strings on load.
Likewise, serialize exponents as JSON numbers only while they remain safe
integers; reject impossible or unsafe state rather than rounding it.

Begin persistence at `schemaVersion: 1`. Route reads through version validation
and explicit future migrations; write the newest version. Unknown newer versions
must not be guessed at or overwritten without confirmation.

### Planned source layout (do not create yet)

After the separate Expo scaffolding task, one application can use this minimal
layout:

```text
src/
  engine/       # pure state transitions, rules, and deterministic tests
  screens/      # gameplay and new-game presentation
  components/   # reusable mobile UI
  storage/      # versioned persistence adapter and validation
  accessibility/# announcements and non-gesture controls, if needed
  theme/        # colors, spacing, and type tokens
```

Exact Expo entry/config files should follow the scaffold selected at that time.
Do not create empty directories now.

## Development workflow

- Use Codex for small, explicitly scoped changes and automated checks, following
  repository `AGENTS.md` and reporting limitations accurately.
- Use Expo for rapid application iteration and test on representative physical
  devices as gesture, layout, accessibility, and persistence work lands.
- Use Xcode on macOS for local iOS simulator and native verification. It is not
  expected to run on non-macOS contributor machines.
- Use the Android SDK/emulator and physical Android devices for Android-specific
  verification.
- Hosted build services are optional aids for distribution or hardware access,
  not prerequisites for local development or ordinary review.

### Proposed implementation sequence

1. Scaffold one Expo/React Native TypeScript application and add real type/test
   scripts in a separately scoped change.
2. Implement the pure engine and deterministic acceptance tests.
3. Build the gameplay screen, gestures, alternate controls, responsive board,
   and event-driven animation.
4. Add versioned persistence, restore/error flows, and accessibility polish.
5. Validate layouts, gestures, lifecycle behavior, performance, and assistive
   technology on representative iOS and Android devices.
6. Prepare icons/metadata, privacy disclosures, signing outside version control,
   release builds, and store distribution.

## Future behavioral acceptance cases

These cases specify future deterministic engine, persistence, and interaction
tests. They are not placeholder tests for this documentation-only phase.

| Area                    | Setup/action                                                       | Expected behavior                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Exact `k=1` sequence    | Merge the run's first 4, 8, then 16                                | Sizes are exactly 3×3, 4×4, then 5×5; `H` is 2, 3, then 4.                                                                             |
| Exact `k=2` sequence    | Merge the run's first 8, 32, then 128                              | Sizes are exactly 3×3, 4×4, then 5×5; intermediate 4, 16, and 64 do not expand.                                                        |
| Below threshold         | At `k=2`, merge a first 4                                          | `H` becomes 2, board remains 2×2, and next milestone is 8.                                                                             |
| Repeated milestone      | Recreate a tile at or below historical `H`                         | Historical `H` and board size do not increase again.                                                                                   |
| Multiple thresholds     | At `k=1` on 2×2, merge two spawned 4s into first 8                 | `H=3` and board grows directly to 4×4 in that move.                                                                                    |
| Spawned versus merged 4 | Spawn a 4, then separately merge two 2s into 4                     | Spawn alone leaves `H=1`; merged 4 sets `H=2` and grows at `k=1`.                                                                      |
| Multiple merges         | Move `[2,2,4,4]` toward the first cell                             | Result is `[4,8,…]`, score increases by 12, and both results can update `H`.                                                           |
| No chain merge          | Move `[2,2,4,…]` toward the first cell                             | Result starts `[4,4,…]`, not `[8,…]`; a newly merged tile merges at most once.                                                         |
| No-op                   | Move toward an already settled edge with no merge                  | State and score are unchanged and no RNG sample, spawn, or growth occurs.                                                              |
| Order and coordinates   | A successful merge crosses a threshold                             | Resolve original-board merges, append bottom/right space, then spawn; old coordinates are preserved and spawn may use new empty cells. |
| Full but mergeable      | Fill board with at least one orthogonally adjacent equal pair      | Not game over because a merge move exists.                                                                                             |
| Full and blocked        | Fill board with no legal slide or orthogonally adjacent equal pair | Game over is set after the move/growth/spawn phase.                                                                                    |
| Restore                 | Save a run with nondefault `k`, `H`, board, and score, then load   | Exact active `k`, milestone, dimensions, exponent cells, score, and status return; prior milestones do not regrow.                     |
| Change `k`              | Select a new `k` while a run is active                             | Active run stays unchanged until confirmed replacement; new run uses selected `k`.                                                     |
| Setting bounds          | Use decrement at 1 and increment at 10                             | Controls are disabled at bounds and no out-of-range run can start.                                                                     |
| High-`k` limitation     | Start any `k=5–10` run with standard 2/4 spawning                  | Help warns that first growth is unreachable on fixed 2×2; rules and range remain unchanged.                                            |

## Risks, decisions, and open questions

| Topic                  | Current position                                                                                         | Follow-up question or risk                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| High-`k` reachability  | Preserve 1–10 and disclose that 5–10 cannot expand under proposed defaults.                              | Is a post-MVP balance experiment desirable, and how will existing saves be handled?                              |
| Large-board usability  | Use a minimum readable tile size, then pan/zoom plus accessible move/inspection controls; no hidden cap. | Device prototypes must determine thresholds, navigation gestures, performance, and screen-reader representation. |
| Randomness             | Inject samples; use uniform empty-cell selection and 90/10 tile choice.                                  | Define sample consumption order precisely in engine tests so refactors remain reproducible.                      |
| Large values and score | Store exponents and exact BigInt-derived decimal score strings; avoid bitwise Number arithmetic.         | Choose compact visual notation and screen-reader phrasing for extremely large exponents.                         |
| Persistence failures   | Version and validate saves; fail safely to a recoverable new-game path.                                  | Decide whether invalid saves can be exported for diagnostics without collecting analytics.                       |
| New-game confirmation  | Active `k` is immutable; confirm replacement of an unfinished run.                                       | Define “unfinished” across game-over and manually abandoned states during UI work.                               |
| Board growth placement | Add rows below and columns right, retaining coordinates.                                                 | Ensure asymmetric visual growth feels understandable in animation and reduced-motion modes.                      |
| Future modes           | Maintain clean engine/UI/storage boundaries only.                                                        | Add abstractions only after a second mode has concrete requirements.                                             |
