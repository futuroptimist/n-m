# MVP design: expanding grid

## Status and terminology

This document is the source of truth for the first playable version of **n^m**.
It deliberately separates **maintainer requirements** (requested product
behavior) from **proposed design decisions** (defaults selected here where the
request left behavior open). Proposed decisions should be validated during
implementation and playtesting; they are not additional game modes.

A tile is represented by its exponent `e` and displays the mathematical value
`2^e`. The starting value 2 therefore has exponent 1.

## Product goals

- Deliver a free, open-source, understandable puzzle game on iOS and Android.
- Make board growth predictable and visible while retaining familiar sliding and
  merging interactions.
- Give a first-time mobile maintainer a small, testable architecture based on
  React Native, Expo, and TypeScript.
- Preserve a platform-independent rules engine so behavior can be tested without
  a device or renderer.

## MVP boundaries

The MVP contains one playable mode: the expanding-grid mode specified here. It
stores a current run locally and works without an account or network service.

Explicit non-goals are additional modes, accounts, a backend, multiplayer,
advertising, analytics, purchases, social features, and cloud synchronization.
The MVP must not silently change the starting size, growth thresholds, or
allowed `k` range. Distribution automation and hosted builds may follow, but are
not prerequisites for implementing or testing the game.

## Required growth behavior

The following are **maintainer requirements**:

- A new game starts with a 2×2 square grid.
- Tiles contain powers of 2, and the tile growth factor is fixed at 2.
- Merging two equal tiles creates one tile with twice their value.
- Both grid dimensions increase by 1 for each `k` additional exponent levels
  reached beyond the starting value of 2.
- Growth depends on the highest milestone reached during the run, not on the
  number of merges. Recreating a reached milestone never expands the board
  again.
- `k` is an integer from 1 through 10, inclusive, exposed in the game UI with a
  slider or increment/decrement buttons.
- With `k=1`, the first merged 4 produces 3×3, the first merged 8 produces 4×4,
  and the first merged 16 produces 5×5.
- With `k=2`, the first merged 8 produces 3×3, the first merged 32 produces 4×4,
  and the first merged 128 produces 5×5.

### Mathematical rule

Let `H` be the highest tile exponent ever produced by a merge during the current
run, initialized to 1.

```text
expansionCount = floor((H - 1) / k)
sideLength = 2 + expansionCount
nextExpansionExponent = 1 + k * (expansionCount + 1)
nextExpansionTile = 2 ^ nextExpansionExponent
```

Here `^` denotes exponentiation in mathematical notation. It is **not**
JavaScript's exponentiation operator (JavaScript uses `**`; `^` is bitwise XOR).

`H` records merge results only. Computing `sideLength` directly makes growth
idempotent and permits more than one threshold to be crossed in a move.

### Example milestones

The tile shown in each milestone column is the first merge result that causes
that board size.

| `k` | Start | 3×3  |    4×4    |      5×5      | First-expansion exponent |
| --: | :---: | :--: | :-------: | :-----------: | -----------------------: |
|   1 |  2×2  |  4   |     8     |      16       |                        2 |
|   2 |  2×2  |  8   |    32     |      128      |                        3 |
|   3 |  2×2  |  16  |    128    |     1024      |                        4 |
|   5 |  2×2  |  64  |   2048    |    65,536     |                        6 |
|  10 |  2×2  | 2048 | 2,097,152 | 2,147,483,648 |                       11 |

## Proposed gameplay decisions

Everything in this section is a **proposed design decision**, not an original
maintainer requirement.

### Settings and run lifecycle

- Default to `k=1`.
- Present accessible decrement and increment buttons, a visible numeric value,
  and disabled controls at 1 and 10. This is preferred over a slider because it
  makes the integer selection and bounds explicit.
- The active run's `k` is immutable. A setting change applies to the next game.
  Starting that game while an unfinished run exists requires confirmation.
- Reaching 2048 does not end a run.

### Initial tiles, moves, and spawning

- Start with two exponent-1 tiles (value 2) in distinct cells chosen uniformly
  at random.
- Use standard 2048 movement. A swipe slides every tile in one cardinal
  direction; equal adjacent tiles merge in movement order; each resulting tile
  can merge at most once in that move.
- Resolve all slides and merges on the original board. Then update `H`, compute
  and apply the final board size, and finally spawn exactly one tile in a
  uniformly selected empty cell: exponent 1 (value 2) with 90% probability or
  exponent 2 (value 4) with 10% probability.
- Spawned tiles do not update `H` and therefore do not directly cause growth.
  Only a merge result advances the milestone.
- Preserve all existing coordinates while expanding: append empty rows below and
  empty columns to the right.
- Calculate the new size directly rather than limiting a move to one expansion.
  For example, with `k=1`, merging two spawned 4s into the first 8 can grow a
  2×2 board directly to 4×4.
- A move that changes neither positions nor values does not spawn, consume
  randomness, change score, or expand the board.

### Score and end condition

- Add the value of every merge result to the score. Multiple merges add all
  their result values.
- Check game over after movement, any expansion, and spawning. The run is over
  only when no empty cell and no horizontal or vertical equal neighbor remain; a
  full board alone is insufficient.

## Important balance limitation

> **Known limitation:** with the proposed standard 2/4 spawning, a fixed 2×2
> board can produce at most a 32. Consequently, `k=5–10` cannot reach their
> first expansion threshold. `k=5` requires 64, while `k=10` requires 2048.

The required 1–10 range remains available. Those high settings create runs that
cannot expand under the proposed MVP defaults; this must not be hidden by
changing the initial board or spawn distribution. Put concise help beside the
setting, such as: **“Higher k grows less often. With MVP spawning, k 5–10 cannot
grow beyond 2×2.”** Confirmation for a new high-`k` run should repeat this fact
without preventing selection.

Possible future balancing experiments belong outside the MVP: a larger initial
board, different starting inventory, alternate spawn values, a threshold rule
that considers spawned tiles, or a different loss/recovery mechanic. Any such
change needs playtesting and an explicit design revision; none is adopted here.

## Screen and interaction design

The single gameplay screen contains:

1. the n^m title, current score, and new-game action;
2. active `k` (distinct from the next-run setting) and the next growth milestone
   as a tile value;
3. the square board and readable tile labels;
4. next-run decrement/value/increment controls and concise settings help; and
5. an accessible game-over state with final score and a new-game action.

Swipe in four cardinal directions over the board. Keyboard arrow support is a
useful Expo-web development aid but not a substitute for touch testing. All
buttons need accessible names, roles, states, and touch targets; score and
milestone updates should be announced without overwhelming screen-reader users.
Do not rely on tile color alone: use legible labels, sufficient foreground and
background contrast, and scalable text. Under reduced-motion preferences,
replace travel/merge/growth animation with an immediate state update or a
minimal crossfade, while retaining equivalent feedback.

### Increasingly large boards

The board must not have an undocumented gameplay cap, and tiles cannot shrink
indefinitely. Render comfortable tile and label sizes for small boards. Once the
whole board would fall below a tested minimum touch/label size, keep a minimum
cell size and place the board in a two-dimensional pan/zoom viewport. Keep
swipe-to-move distinct from viewport navigation—for example, a deliberate
one-finger swipe performs a move while two-finger gestures pan/zoom—and provide
an accessible non-gesture direction pad. Offer “fit board” and a clear viewport
position indicator. Prototype this interaction on small phones and with screen
readers before locking it in; virtualize or otherwise avoid mounting costly
off-screen decoration if profiling shows a problem, without altering engine
state or board dimensions.

## State and persistence

### Logical state

A planned engine state can be expressed with JSON-safe data:

```ts
type GameStateV1 = {
  version: 1;
  board: Array<Array<number | null>>; // positive integer exponents
  activeK: number;
  highestMergedExponent: number; // H, initialized to 1
  score: string; // nonnegative base-10 integer
  status: 'playing' | 'game-over';
};
```

This shape is illustrative, not application scaffolding. Validate dimensions,
exponents, `activeK`, score syntax, and status at the storage boundary. Include
the schema `version`; reject corrupt data safely and migrate known older
versions explicitly rather than guessing.

Store exponents, not floating-point tile values. Avoid shifts and all bitwise
arithmetic because JavaScript bitwise operations impose 32-bit limits. For
display, small tiles may use `2 ** exponent` only while the result is a safe
integer. Large values should be formatted exactly with arbitrary-precision
`BigInt` (`2n ** BigInt(exponent)`) or with a deterministic scientific/compact
label derived from the exponent. Serialize exact tile state as exponents and
exact score as a base-10 string; perform score arithmetic with `BigInt` at the
engine boundary and convert it back to a string for JSON. Set practical input
validation limits for resource safety, but do not turn them into an undocumented
gameplay board cap.

Persist the current run locally after each successful transition, including
board, active `k`, score, `H`, status, and schema version. Restoring `H` is
essential: deriving it from the current board could re-trigger old milestones
after the highest tile has merged or otherwise changed. Persist the next-run
setting separately. Use an atomic write strategy appropriate to the selected
Expo storage adapter and recover to a confirmed new game if saved data is
invalid.

## Architecture and planned source layout

Implement rules as a pure TypeScript engine. Its transition accepts game state,
a direction, and injected random values (or a narrow random source), then
returns new state plus events useful to the UI. It must not import React Native,
Expo, animation, gesture, or storage APIs. Rendering maps immutable engine state
to views; separate adapters own gestures, animation, and persistence.

The following is a **planned** layout for one Expo application. These paths must
not be created as empty placeholders during this documentation phase:

```text
src/
  engine/       pure state, movement, growth, scoring, and engine tests
  components/   reusable accessible UI
  screens/      gameplay and settings composition
  input/        gestures and alternate controls
  storage/      versioned local persistence adapter
  theme/        colors, spacing, type, and motion preferences
App.tsx         Expo application entry point
```

Clear engine and adapter boundaries leave room for future behavior, but the MVP
should use direct, well-named expanding-grid types—not a generalized game-mode
framework. Extract shared abstractions only when a real second mode requires
them.

## Future behavioral acceptance cases

These cases specify future deterministic tests; they are not placeholder tests
for this documentation-only repository.

| Area                    | Setup/action                                                    | Expected behavior                                                                                |
| ----------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `k=1` sequence          | First merged results reach 4, 8, then 16                        | Board becomes 3×3, 4×4, then 5×5 exactly.                                                        |
| `k=2` sequence          | First merged results reach 8, 32, then 128                      | Board becomes 3×3, 4×4, then 5×5 exactly; merged 4 and 16 do not grow it.                        |
| Below threshold         | With `k=3`, produce merged 4 or 8                               | `H` advances, but board remains 2×2 until merged 16.                                             |
| Repeated milestone      | Recreate a merge result at or below `H`                         | No additional expansion occurs.                                                                  |
| Multiple thresholds     | On 2×2 with `k=1`, merge two spawned 4s into first 8            | Directly compute and create a 4×4 board in one move.                                             |
| Spawned versus merged 4 | Spawn a 4, then separately merge two 2s into 4 with `k=1`       | Spawn does not grow; merged 4 advances `H` and grows to 3×3.                                     |
| Multiple merges         | Move `[2,2,2,2]` toward the first cell                          | Produce `[4,4,…]`, add 8 total score, and do not chain into 8 that move.                         |
| Merge once              | Move `[2,2,4,…]` toward the first cell                          | Produce `[4,4,…]`, not `[8,…]`.                                                                  |
| No-op                   | Swipe a settled row toward its occupied edge                    | State, score, size, and random-source position are unchanged; no spawn occurs.                   |
| Expansion order         | A merge crosses a threshold with a deterministic spawn cell     | Expand before spawning; new rows/columns participate in uniform empty-cell selection.            |
| Coordinates             | Expand a populated board                                        | Existing `(row,column)` values remain; empty rows append below and columns to the right.         |
| Full with merge         | Fill every cell but retain one equal neighbor                   | Status remains playable.                                                                         |
| Full without merge      | Fill every cell with no equal orthogonal neighbors              | Status becomes game-over after the completed transition.                                         |
| Restore                 | Save a run whose `H` exceeds visible current tiles, then reload | Board, score, active `k`, status, and exact `H` are restored; old growth cannot repeat.          |
| Change `k`              | Select a different next-run `k` during an unfinished run        | Active `k` stays fixed; replacement asks for confirmation; confirmed new run uses the selection. |
| Setting bounds          | Decrement at 1 or increment at 10                               | Value remains in 1–10 and the corresponding button is disabled.                                  |
| High `k`                | Start with any `k` from 5 through 10 under MVP spawning         | UI allows it and explains that the 2×2 run cannot reach its first growth threshold.              |

Test randomness using a fake source that supplies spawn-value and empty-cell
choices. Assert that a no-op consumes neither value.

## Development workflow and implementation sequence

Use Codex for focused, reviewable changes and automated checks, not broad
unsupervised rewrites. Expo and real devices support short UI iteration loops.
Use Xcode on macOS for the iOS simulator and native iOS work; use the Android
SDK, emulator, and/or devices for Android verification. Hosted build services
may simplify later distribution, but are optional and must not become a local
development prerequisite.

Implement in this order, with each stage separately reviewable:

1. Scaffold one minimal Expo TypeScript application and its real checks.
2. Build the pure engine with deterministic tests for movement, growth, scoring,
   injected randomness, and end detection.
3. Build the gameplay screen, board viewport, input, and state-driven animation.
4. Add versioned persistence and complete accessibility/reduced-motion behavior.
5. Validate gestures, layouts, restoration, performance, and accessibility on
   representative iOS and Android devices.
6. Prepare icons, store metadata, release configuration, signing outside source
   control, and distribution builds.

## Risks, decisions, and open questions

### Recorded proposed decisions

- Use `k=1`, two starting 2s, standard 2048 merging, 90/10 spawning, merge-only
  milestones, expansion-before-spawn, and sum-of-merge-values scoring.
- Keep `k` immutable within a run and persist exact exponent/milestone state.
- Use a minimum readable tile size plus a navigable viewport for large boards.

### Risks

- **High-`k` reachability:** `k=5–10` cannot expand under the proposed MVP spawn
  rules. Honest in-product help reduces surprise but not the limitation.
- **Large-board usability:** panning and move swipes may conflict;
  accessibility, label density, memory, and animation performance require device
  prototypes.
- **Unbounded numeric growth:** native numbers and bitwise operations would
  eventually corrupt values; exponent state, `BigInt`, string serialization, and
  resource validation are required.
- **Persistence evolution:** partial or old saves can create impossible states;
  versioned validation and explicit migration are required.
- **Platform differences:** gesture recognition, text scaling, storage, and
  reduced-motion behavior need verification on both platforms.

### Open questions for playtesting or implementation

- Is the proposed high-`k` warning sufficient, or should those values receive a
  stronger confirmation while remaining selectable?
- What minimum cell size and viewport controls work across supported phone
  sizes, screen readers, and large text settings?
- Which compact exact/abbreviated presentation best communicates very large tile
  values and scores?
- When should auto-save occur relative to visual animation, and what storage
  adapter best provides recoverable writes in the chosen Expo SDK?
- Which device and OS-version matrix is realistic for the first release?
