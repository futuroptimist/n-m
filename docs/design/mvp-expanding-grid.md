# MVP design: expanding grid

## Status and terminology

This document is the implementable source of truth for the `n^m` MVP. It
separates **maintainer requirements**, which must not change without an explicit
product decision, from **proposed design decisions**, which resolve behavior
that the original concept left unspecified.

A tile is represented by exponent `e` and displays the mathematical value
`2^e`. The starting value 2 therefore has exponent 1. In formulas and prose
below, `^` denotes exponentiation; it is **not** JavaScript's exponentiation
operator (JavaScript uses `**`).

## Product goals

- Deliver a free, open-source, approachable mobile puzzle for iOS and Android.
- Make the expanding board understandable: players can see their active growth
  interval and the next tile milestone.
- Keep game behavior deterministic and testable independently of the mobile UI.
- Establish a manageable first mobile project with a small, well-defined MVP.

## MVP boundary

The MVP contains only the expanding-grid mode specified here. It includes local
play, scoring, game-over handling, a configurable growth interval, and local
save/resume.

### Explicit non-goals

- Additional playable modes or a generalized mode framework
- Accounts, a backend, cloud synchronization, multiplayer, leaderboards, or
  social features
- Advertising, analytics, or purchases
- Silently changing the 2×2 initial size, growth thresholds, or allowed `k`
  range to improve balance
- Ending or declaring a win when a 2048 tile is reached

## Required growth behavior

The following rules are **maintainer requirements**:

1. Every new run starts on a 2×2 square grid.
2. Tiles contain powers of 2; the tile growth factor is fixed at 2 for this MVP.
3. Two equal tiles merge into one tile with twice their value.
4. Both grid dimensions increase by one for each `k` additional exponent levels
   reached beyond the starting value 2.
5. Growth depends on the highest milestone reached during the run, not on merge
   count. Recreating any previously reached milestone never expands the board
   again.
6. `k` is an integer from 1 through 10, inclusive, and is exposed in the UI by
   a slider or increment/decrement buttons.
7. At `k=1`, the first merged 4 produces 3×3, the first merged 8 produces 4×4,
   and the first merged 16 produces 5×5.
8. At `k=2`, the first merged 8 produces 3×3, the first merged 32 produces 4×4,
   and the first merged 128 produces 5×5.

Let `H` be the highest tile exponent ever produced by a merge during the
current run, initialized to 1:

```text
expansionCount = floor((H - 1) / k)
sideLength = 2 + expansionCount
nextExpansionExponent = 1 + k * (expansionCount + 1)
nextExpansionTile = 2 ^ nextExpansionExponent
```

`H` is monotonic. It does not decrease if the corresponding tile later merges
or disappears. Because only merge results update `H`, a spawned tile cannot by
itself satisfy a milestone.

### Example milestones

Each milestone is the first merge result that produces the listed tile.

| `k` | Initial board | First expansion     | Second expansion       | Third expansion           |
| --: | ------------- | ------------------- | ---------------------- | ------------------------- |
|   1 | 2×2 (`H=1`)   | 4 → 3×3 (`H=2`)     | 8 → 4×4 (`H=3`)        | 16 → 5×5 (`H=4`)          |
|   2 | 2×2 (`H=1`)   | 8 → 3×3 (`H=3`)     | 32 → 4×4 (`H=5`)       | 128 → 5×5 (`H=7`)         |
|   3 | 2×2 (`H=1`)   | 16 → 3×3 (`H=4`)    | 128 → 4×4 (`H=7`)      | 1024 → 5×5 (`H=10`)       |
|   5 | 2×2 (`H=1`)   | 64 → 3×3 (`H=6`)    | 2048 → 4×4 (`H=11`)    | 65536 → 5×5 (`H=16`)      |
|  10 | 2×2 (`H=1`)   | 2048 → 3×3 (`H=11`) | 2097152 → 4×4 (`H=21`) | 2147483648 → 5×5 (`H=31`) |

## Proposed gameplay decisions

Everything in this section is a **proposed design decision**, not an original
maintainer requirement, unless it restates the required growth behavior above.

### Setting and run lifecycle

- Default to `k=1`.
- Present accessible decrement and increment buttons, a persistent visible
  value, and disabled controls at the 1 and 10 bounds. Buttons are preferred to
  a slider because they expose exact discrete values and clear bounds.
- A run's active `k` is immutable. A setting change applies to the next game.
  If starting with the new setting would replace an unfinished run, ask for
  confirmation; cancel preserves the current run and active `k`.
- Start a run with two exponent-1 (value-2) tiles in distinct, uniformly chosen
  cells.

### Move, merge, expand, and spawn

- Use standard 2048 movement. A swipe slides all tiles in one cardinal
  direction; equal adjacent tiles merge in movement order; each resulting tile
  may merge at most once in that move.
- Resolve all sliding and merging on the original board. Add every merge result
  value to the score, update `H` to the greatest merge-result exponent seen,
  resize directly to the formula's `sideLength`, and only then spawn.
- Expansion adds empty rows below and empty columns to the right. Existing
  `(row, column)` coordinates are unchanged.
- A move can cross several milestones. Calculate size from the final `H` rather
  than limiting growth to one step. At `k=1`, for example, two spawned 4s can
  merge into the first 8 on a 2×2 board and expand it directly to 4×4.
- After each successful move, spawn exactly one tile in a uniformly selected
  empty cell: exponent 1 (value 2) with 90% probability or exponent 2 (value 4)
  with 10% probability. Injected randomness must select both value and cell.
- Spawned tiles never update `H`; only merge results do. In particular, a
  spawned 4 at `k=1` does not expand the board, while a merged 4 does.
- An unchanged move does not spawn, consume randomness, change score, or expand
  the board.
- Determine game over after movement, any expansion, and spawning. A full board
  is not game over while at least one horizontal or vertical equal pair remains.
- Reaching 2048 does not stop play.

### High-`k` reachability limitation

> [!WARNING]
> With the proposed standard 2/4 spawn distribution, a fixed 2×2 board can
> produce at most a 32. Consequently, `k=5` through `k=10` cannot reach their
> first expansion threshold. `k=5` requires 64 and `k=10` requires 2048.

The required setting range remains 1–10. The MVP must not hide this limitation
by silently changing the initial board or spawn rules. Beside the setting,
provide concise help such as: **“Higher k grows less often. With current 2/4
spawns, k 5–10 cannot grow beyond 2×2.”** The new-game confirmation should
leave this help discoverable before committing to a run.

Possible future balancing work belongs in a later product decision: changing
spawn values or probabilities, adding starting capacity, allowing a recovery
mechanic, or redefining thresholds. Each would alter gameplay and requires an
explicit design revision; none is adopted for this MVP.

## Screen and interaction model

A single gameplay screen contains:

- the `n^m` title, current score, active `k`, and next growth tile;
- the square board, with clearly bounded cells and readable tile labels;
- new-game controls and the next-run `k` stepper with its settings help;
- a confirmation dialog when replacing an unfinished run; and
- a game-over state that preserves the final board and score and offers a new
  game with the selected next-run setting.

Swipes in four cardinal directions are the primary move input. Touch targets
for buttons must meet platform accessibility guidance and expose role, label,
value, state, and hint to assistive technology. Do not rely on tile color alone:
use readable labels, sufficient foreground/background contrast, and scalable
text that avoids ambiguous truncation. Reduced-motion mode should disable
decorative transitions and replace movement/merge/expansion animation with an
immediate state update; it must not change timing-sensitive game logic because
animation is not part of the engine.

### Increasingly large boards

The logical board has no undocumented gameplay cap. Rendering must not assume
tiles can shrink forever. Use a minimum legible tile and label size; while the
board fits, size cells to the available square viewport. Once that minimum is
reached, place the board in a bounded two-dimensional pan/zoom viewport (with
an explicit reset/fit control and accessible non-gesture alternatives), keep
the viewport stable across moves, and ensure move swipes are distinguishable
from board navigation. Prototype the exact gesture arbitration on devices.

For very large boards, render only the visible cell window plus a small
overscan region rather than mounting every cell. The board remains logically
complete: panning, zooming, or virtualization must never affect movement,
random selection, save data, or game-over detection. Announce expansion and
the new size without forcing focus away from the board. Large-board usability
needs device validation before distribution.

## State and persistence

Represent tiles by non-negative integer exponents, with `null` for an empty
cell, rather than storing floating-point tile values. A versioned persisted run
should contain at least:

```ts
type PersistedRunV1 = {
  version: 1;
  activeK: number;
  board: Array<Array<number | null>>;
  score: string;
  highestMergedExponent: number;
  status: "active" | "game-over";
};
```

Persist and restore the active `k`, complete board, score, `H`, and status
locally after each successful state transition. Validate version, integer
ranges, rectangular square shape, and the formula-derived side length on load.
An unsupported or invalid save must fail safely with a user-visible option to
start a new run, not be partially loaded. Migration logic should be explicit
and tested when a version 2 is introduced.

JavaScript `number` cannot exactly represent arbitrary powers or indefinitely
growing scores. Engine arithmetic should use `bigint` for score and generate
display values from exponents with `1n << BigInt(e)` avoided: bitwise-looking
operations invite fixed-width assumptions in other contexts. Prefer `2n **
BigInt(e)` within a documented practical computation limit and switch very
large labels to an exponent form such as `2^100000` without constructing the
full decimal integer. Serialize scores as base-10 strings and parse them with
validated `BigInt`; JSON does not serialize `bigint` directly. Never use
JavaScript number bitwise operators, which impose signed 32-bit coercion.

## Architecture

Implement the rules as a pure TypeScript engine. It receives immutable state,
a direction, and an injected random source and returns the next state plus
events useful to a renderer. It must not import React Native, Expo, gesture,
animation, clock, or storage APIs. UI code translates swipes and buttons into
commands; animation reacts to events; a persistence adapter encodes validated
snapshots. This boundary supports deterministic tests and future UI evolution.

Keep extension points modest: stable engine inputs/outputs, persistence
versioning, and adapters are sufficient. Do not build a generalized game-mode
registry for hypothetical future modes.

### Planned source layout

This is a **planned** layout for one future Expo application; these directories
must not be created as empty placeholders during the documentation phase.

```text
src/
  engine/       # pure state, move, growth, spawn, scoring, and rule tests
  components/   # reusable native UI components
  screens/      # gameplay screen composition
  accessibility/# announcements and platform accessibility helpers
  persistence/  # versioned local-save adapter and validation
  theme/        # colors, spacing, and responsive tile presentation
```

## Development workflow

- Use Codex for narrowly scoped changes and automated checks, following
  repository instructions and reporting results honestly.
- Use Expo development tooling and physical-device testing for rapid UI,
  gesture, layout, and accessibility iteration.
- Use Xcode on macOS for local iOS simulator and native verification. Use the
  Android SDK/emulator or physical Android devices for Android verification.
- Hosted build services may help with distribution or access to build hardware,
  but they are optional and are not a prerequisite for development.

### Proposed implementation sequence

1. Scaffold one minimal Expo/TypeScript application in a separately scoped
   change and add meaningful type/lint commands.
2. Implement the pure engine and deterministic acceptance tests.
3. Build the gameplay board, status display, settings, and swipe interaction.
4. Add versioned persistence, accessibility semantics, and reduced motion.
5. Validate gestures, layouts, restoration, and performance on representative
   iOS and Android devices, including large boards.
6. Prepare icons, metadata, signed builds, store review material, and release
   documentation for distribution.

## Future behavioral acceptance cases

These cases specify future deterministic tests; they are not placeholder tests
for the documentation-only repository.

| Area                    | Setup/action                                                                        | Expected result                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Exact `k=1` sequence    | First merged results reach 4, 8, then 16                                            | Sizes are exactly 3×3, 4×4, then 5×5.                                                               |
| Exact `k=2` sequence    | First merged results reach 8, 32, then 128                                          | Sizes are exactly 3×3, 4×4, then 5×5; merged 4 and 16 do not expand.                                |
| Below threshold         | At `k=3`, produce merged 4 and 8                                                    | `H` advances, but size remains 2×2 until merged 16.                                                 |
| Repeated milestone      | Reach a milestone, later recreate the same exponent                                 | Size does not increase again because `H` is unchanged.                                              |
| Multiple thresholds     | At `k=1` on 2×2, merge two spawned 4s into the first 8                              | Size is calculated directly as 4×4, crossing two thresholds.                                        |
| Spawned versus merged 4 | At `k=1`, spawn a 4, then separately produce a merged 4                             | Spawn leaves `H=1` and 2×2; merge sets `H=2` and expands to 3×3.                                    |
| Multiple merges         | Move `[2,2,4,4]` toward the first cell                                              | Result is `[4,8,…]`, score increases by 12, and both results may affect final `H`.                  |
| No chain merge          | Move `[2,2,4,…]` toward the first cell                                              | Result begins `[4,4,…]`, not `[8,…]`; a merge result merges at most once.                           |
| No-op                   | Swipe when no tile changes position or merges                                       | State, score, size, and random-source call count are unchanged.                                     |
| Expand before spawn     | A merge reaches a threshold with an injected spawn cell in the new area             | Existing coordinates stay fixed; bottom/right cells are added before the one spawn is selected.     |
| Full but mergeable      | Fill the board with at least one orthogonally adjacent equal pair                   | Run remains active because a legal merge exists.                                                    |
| Full and blocked        | Fill the board with no empty cells or orthogonally adjacent equals                  | Run becomes game over after the completed move/spawn sequence.                                      |
| Restore milestone       | Save after prior growth, remove the highest tile through later merges, then restore | Board, score, active `k`, and monotonic `H` restore; the old milestone cannot expand again.         |
| Change `k`              | Select a new next-run `k` during an active run                                      | Active `k` is unchanged; confirmed new game uses the selection, while cancel preserves the run.     |
| Setting bounds          | Operate decrement at 1 and increment at 10                                          | Visible value remains in 1–10 and the respective boundary control is disabled.                      |
| High-`k` limitation     | Start standard runs with `k=5` through `k=10`                                       | Help warns that first growth is unreachable under 2/4 spawns; required thresholds remain unchanged. |

## Risks, decisions, and open questions

| Topic                 | Current proposed decision                                                                 | Risk or open question                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| High-`k` reachability | Preserve 1–10 and disclose that 5–10 cannot expand                                        | Is an intentionally non-expanding option acceptable long-term, or should a later version revise balance? |
| Large boards          | Minimum legible size, then pan/zoom and virtualization; no gameplay cap                   | What minimum size and gesture scheme remain usable with screen readers and on small phones?              |
| Large values          | Exponents in board state, `bigint` score, string persistence, exponent labels when needed | Choose and test the decimal-to-exponent display transition without misleading rounding.                  |
| Randomness            | Inject value/cell randomness and consume it only on successful moves                      | Define a stable random-source interface that makes probability boundaries easy to test.                  |
| Persistence           | Versioned, validated local save after state transitions                                   | Select the Expo-compatible storage adapter and recovery copy once the app exists.                        |
| Expansion animation   | Engine emits facts; UI honors reduced motion                                              | Validate that growth is understandable without animation and does not disrupt focus.                     |
| Gesture arbitration   | Separate move swipes from navigation in large-board viewport                              | Requires prototypes and device/accessibility testing before the interaction is fixed.                    |
