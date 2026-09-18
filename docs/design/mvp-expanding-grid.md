# MVP design: expanding grid

## Status and terminology

This document is the implementable source of truth for the sole MVP game mode.
It separates **maintainer requirements** from **proposed design decisions** that
resolve unspecified behavior. Proposed decisions are defaults for implementation
and remain open to explicit revision; they are not presented as original
requirements.

A tile is stored by exponent `e` and represents the value `2` raised to `e`. A
**run** begins at new-game creation and ends when replaced or game over.

## Product goals

- Deliver a free, open-source, approachable puzzle game on iOS and Android.
- Make board growth predictable: players can see the active interval and next
  milestone.
- Keep rules deterministic and testable apart from injected random choices.
- Establish a modest first-mobile-project path with Expo and device feedback.

### MVP boundaries and non-goals

The MVP contains only expanding-grid play. It has no accounts, backend,
multiplayer, advertising, analytics, purchases, or additional playable modes.
Reaching 2048 does not end a run. This design does not silently alter the 2×2
start, growth thresholds, or allowed `k` range. A generalized mode framework is
not part of the MVP.

## Required game rules

The following behavior is supplied by the maintainer:

1. A new run starts on a square 2×2 grid. Tiles contain powers of 2, and the
   tile growth factor is fixed at 2 for the MVP.
2. Merging two equal tiles produces one tile with twice their value.
3. Both grid dimensions increase by 1 for every `k` additional exponent levels
   reached beyond the starting value 2.
4. Growth uses the highest milestone reached during the run, not merge count.
   Recreating a reached milestone never expands the board again.
5. `k` is an integer from 1 through 10 inclusive and is exposed in the game UI
   with a slider or increment/decrement buttons.
6. With `k=1`, the first merged 4, 8, and 16 yield 3×3, 4×4, and 5×5 boards.
   With `k=2`, the first merged 8, 32, and 128 yield those same sizes.

### Mathematical growth rule

Let `H` be the highest tile exponent ever produced **by a merge** in the current
run, initialized to `1`:

```text
expansionCount = floor((H - 1) / k)
sideLength = 2 + expansionCount
nextExpansionExponent = 1 + k * (expansionCount + 1)
nextExpansionTile = 2 ^ nextExpansionExponent
```

Here `^` denotes exponentiation in mathematical notation. It is **not** the
JavaScript exponentiation operator (JavaScript uses `**`; `^` is bitwise XOR).

| `k` | First milestone → size     | Second milestone → size         | Third milestone → size              |
| --: | -------------------------- | ------------------------------- | ----------------------------------- |
|   1 | merged 4 (`e=2`) → 3×3     | merged 8 (`e=3`) → 4×4          | merged 16 (`e=4`) → 5×5             |
|   2 | merged 8 (`e=3`) → 3×3     | merged 32 (`e=5`) → 4×4         | merged 128 (`e=7`) → 5×5            |
|   3 | merged 16 (`e=4`) → 3×3    | merged 128 (`e=7`) → 4×4        | merged 1024 (`e=10`) → 5×5          |
|   5 | merged 64 (`e=6`) → 3×3    | merged 2048 (`e=11`) → 4×4      | merged 65536 (`e=16`) → 5×5         |
|  10 | merged 2048 (`e=11`) → 3×3 | merged 2,097,152 (`e=21`) → 4×4 | merged 2,147,483,648 (`e=31`) → 5×5 |

## Proposed design decisions

These decisions fill gaps in the supplied requirements:

- Default to `k=1`. Present accessible decrement and increment buttons, a
  visible numeric value, and disabled controls at 1 and 10.
- A run's `k` is immutable. Setting changes apply to the next run. Starting that
  run while the current one is unfinished requires confirmation.
- Place two exponent-1 (value 2) tiles in distinct, uniformly selected cells at
  start. After each successful move, spawn exactly one tile in a uniformly
  selected empty cell: exponent 1/value 2 with 90% probability or exponent
  2/value 4 with 10% probability.
- Spawned tiles never update `H` or directly expand the board. Only merge
  results do so.
- Follow standard 2048 movement: slide in one cardinal direction, merge equal
  adjacent tiles in movement order, and permit each resulting tile to merge at
  most once in that move.
- Resolve every slide and merge on the original board; update score and `H` from
  all merge results; calculate and apply the final board size; then spawn. Add
  empty rows below and columns to the right so all existing coordinates remain
  unchanged.
- Calculate size directly from the final `H`, allowing one move to cross several
  thresholds. For example, at `k=1`, merging two spawned 4s into the first 8 can
  take a 2×2 board directly to 4×4.
- A move that changes nothing does not spawn, consume randomness, score, update
  `H`, or expand.
- After movement, any expansion, and spawning, declare game over only when no
  empty cell and no horizontally or vertically adjacent equal pair remains. A
  full board with a possible merge is not over.
- Add each merge result's represented value to the score. A move with several
  merges adds every result. Reaching 2048 does not end play.
- Persist and resume one current run locally, including schema version, active
  `k`, board, score, and `H`.

## Important balance limitation

> **A fixed 2×2 board with the proposed standard 2/4 spawning can produce at
> most a 32. Therefore `k=5–10` cannot reach their first expansion threshold
> under these defaults.** `k=5` first requires 64, and `k=10` requires 2048.

The required `k=1–10` range remains available; the initial board and spawning
rules are not changed to hide the consequence. Settings help should say: “Higher
growth intervals are very difficult. With the current 2/4 spawn rules, values
5–10 cannot expand beyond 2×2.” This limitation must also be accessible to
screen readers and visible before starting a high-`k` run.

Possible future balancing investigations include a larger initial board,
different initial/spawn distributions, a wildcard or reserve mechanic, or a
revised mapping from `k` to thresholds. Each would change behavior and requires
a later design decision; none is adopted for this MVP.

## Screen and interaction

Use one gameplay screen with the board as the primary element. A compact status
area shows score, immutable active `k`, and the next growth milestone. New-game
controls expose the next-run `k`, decrement/increment buttons, help, and a clear
start action with replacement confirmation. On game over, announce the state,
retain the final board and score, and offer a new game.

Swipes select four cardinal moves. Provide accessible button alternatives for
all four directions, generous targets, semantic labels/hints, logical focus
order, and non-gesture access to every action. Tile text must remain readable at
supported zoom and font scaling; color is not the sole value cue and foreground
and background contrast should meet WCAG AA where applicable. With reduced
motion enabled, replace movement/growth animations with immediate updates or a
brief non-motion state change; animations must never gate input or rules.

### Increasingly large boards

Do not impose an undocumented gameplay cap or keep shrinking tiles until labels
are illegible. Render a square board with a documented minimum tile target. Once
that minimum no longer fits, place the board in a bounded two-dimensional
pan/zoom viewport with clear edge cues, a “fit board” action, stable focus, and
accessible row/column/value announcements. Keep logical board state independent
of what is visible and virtualize off-screen cells if profiling justifies it.
Prototype on small phones and with large text before choosing exact dimensions.
Whether a documented practical cap or an overview/minimap is eventually needed
remains an open product decision, not an implicit rule.

## State, numeric safety, and persistence

Represent the board as a square array of `null` or non-negative integer tile
exponents, never floating-point tile values. Use ordinary arithmetic rather than
bitwise operations, which coerce values to a 32-bit range. Validate dimensions,
exponents, `k`, `H`, and invariants at engine and persistence boundaries.

JavaScript `number` cannot exactly represent arbitrarily large powers or scores.
Derive small display values from exponents only while safe; otherwise format
from the exponent (for example, exact decimal conversion using `BigInt`, or an
explicit compact `2^e` label). Accumulate score with `bigint` in memory and
serialize it as a base-10 string because JSON does not encode `bigint`. Never
coerce score through floating point. Persist a shape such as:

```text
{ version: 1, activeK, boardExponents, scoreDecimal, highestMergedExponent }
```

Storage adapters validate and migrate known versions before constructing engine
state. Unknown/newer or corrupt versions must not be partially loaded; preserve
the data where practical and offer a safe new run rather than crashing. Persist
after each successful settled move and on app lifecycle transitions.

## Architecture and planned layout

The engine will be pure TypeScript with injected random samples or a random
source interface. It returns state and events and knows nothing about React,
Expo, gestures, animation, clocks, or storage. UI translates gestures/buttons to
directions; animation consumes engine events; storage serializes snapshots.
Clear boundaries permit later experimentation without implementing a generalized
mode abstraction now.

The following is a **planned** layout for one future Expo application; these
empty directories must not be created during documentation setup:

```text
app/                  Expo Router screens and navigation
src/engine/           pure state, movement, growth, scoring, game-over rules
src/components/       React Native presentation components
src/features/game/    gameplay controller, gestures, and accessibility
src/storage/          versioned local persistence adapter
src/theme/            tokens for color, spacing, type, and motion
tests/engine/         deterministic behavioral tests
```

## Development workflow and sequence

Use Codex for tightly scoped changes and automated checks, and Expo plus
physical devices/emulators for interaction iteration. Xcode on macOS is needed
for local iOS simulator/native work; Android Studio/SDK tools support Android
verification. Hosted builds are optional distribution aids, not a development
prerequisite.

Implement in separate reviewable stages:

1. Scaffold one Expo/TypeScript app without game behavior.
2. Implement the pure engine and deterministic acceptance tests.
3. Add gameplay rendering, controls, gestures, and growth presentation.
4. Add versioned persistence and complete accessibility/reduced-motion behavior.
5. Validate usability and lifecycle behavior on representative iOS and Android
   devices, especially large boards and text scaling.
6. Prepare store metadata, signing, privacy disclosures, and distribution.

## Future behavioral acceptance cases

These are specifications for future deterministic tests, not tests implemented
by this documentation change. Inject spawn values and cell choices.

| Case                    | Setup/action                                                            | Expected behavior                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Exact `k=1` sequence    | First merged exponents 2, 3, 4                                          | Sizes are 3×3, 4×4, 5×5 respectively.                                                                                        |
| Exact `k=2` sequence    | First merged exponents 3, 5, 7                                          | Sizes are 3×3, 4×4, 5×5 respectively; exponent 2 remains 2×2.                                                                |
| Below threshold         | `k=3`, merge to exponent 3                                              | `H=3`, size stays 2×2, next milestone is exponent 4/value 16.                                                                |
| Repeated milestone      | Reach exponent 3, then merge another exponent 3                         | `H` and size do not increase a second time.                                                                                  |
| Multiple thresholds     | `k=1`, initial `H=1`, merge two spawned 4s to exponent 3                | Size is calculated directly as 4×4, not 3×3.                                                                                 |
| Spawned versus merged 4 | Inject a spawned exponent 2, then separately merge two exponent-1 tiles | Spawn leaves `H` unchanged; merge sets `H=2` and triggers applicable growth.                                                 |
| Multiple merges         | Move `[2,2,4,4]` toward the first cell                                  | Results are `[4,8,…]`; both results score and update `H`.                                                                    |
| No chain merge          | Move `[2,2,4,…]` toward the first cell                                  | Result begins `[4,4,…]`, not `[8,…]`; a result merges at most once.                                                          |
| No-op                   | Swipe with no displacement or merge                                     | State, score, `H`, RNG-call count, and spawn count are unchanged.                                                            |
| Expand before spawn     | A merge crosses a threshold with an injected new-edge spawn             | Existing coordinates remain fixed; lower/right cells are added empty; spawn may select any empty cell on the expanded board. |
| Full with merge         | Fill board but include one adjacent equal pair                          | Game is not over.                                                                                                            |
| Full without merge      | Fill board with no horizontal/vertical equal neighbors                  | Game is over after the full move pipeline.                                                                                   |
| Restore                 | Save non-default active `k`, board, decimal score, and `H`; reload      | Validated state restores exactly, including milestone history and next threshold.                                            |
| Change `k`              | Select a new next-run `k` during an unfinished run                      | Active `k` is unchanged; replacement asks confirmation; confirmed new run uses selection.                                    |
| Setting bounds          | Decrement at 1 and increment at 10                                      | Controls are disabled, value remains in inclusive range, and no run changes.                                                 |
| High-`k` limitation     | Select each `k=5–10`                                                    | Help warns first expansion is unreachable under current 2/4 defaults; values remain selectable.                              |

## Risks, decisions, and open questions

| Area         | Current proposed decision                                    | Risk or open question                                                                                      |
| ------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| High `k`     | Preserve 1–10 and explain unreachable expansion for 5–10.    | Is deliberate non-expansion acceptable, or should a future version rebalance?                              |
| Large boards | Minimum readable tiles plus pan/zoom and fit-board controls. | Exact breakpoints, performance, focus behavior, and whether a documented cap is needed require prototypes. |
| Randomness   | Inject random decisions and uniformly select empty cells.    | Choose a reproducible PRNG/testing seam without implying competitive fairness.                             |
| Huge numbers | Store exponents, use `bigint` score, serialize decimal text. | Set display notation and accessibility wording for very large exponents.                                   |
| Persistence  | One versioned local run, validated at boundaries.            | Select the Expo-compatible storage adapter and recovery UX later.                                          |
| Expansion UX | Add bottom/right while retaining coordinates.                | Animation must communicate growth without disorientation or reduced-motion regressions.                    |
