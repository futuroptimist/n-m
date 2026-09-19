import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  ENGINE_SCHEMA_VERSION,
  createGame,
  deriveGrowth,
  evaluateStatus,
  getAvailableMoves,
  move,
  tileValue,
  type Board,
  type GameState,
  type RandomSource,
} from './index';

function samples(...values: number[]): RandomSource {
  let index = 0;
  return () => {
    assert.ok(
      index < values.length,
      'engine requested an unexpected RNG sample',
    );
    return values[index++];
  };
}

function state(
  board: Board,
  options: Partial<
    Pick<GameState, 'activeK' | 'highestCreatedExponent' | 'score'>
  > = {},
): GameState {
  return {
    schemaVersion: ENGINE_SCHEMA_VERSION,
    activeK: options.activeK ?? 10,
    sideLength: board.length,
    board,
    highestCreatedExponent: options.highestCreatedExponent ?? 1,
    score: options.score ?? 0n,
    status: 'active',
  };
}

describe('game creation and growth calculations', () => {
  test('creates a 2x2 game with two distinct exponent-1 tiles', () => {
    const game = createGame(1, samples(0, 0.99));

    assert.equal(game.schemaVersion, 1);
    assert.equal(game.sideLength, 2);
    assert.equal(game.highestCreatedExponent, 1);
    assert.equal(game.score, 0n);
    assert.deepEqual(game.board, [
      [1, null],
      [null, 1],
    ]);
  });

  test('accepts only integer k values from 1 through 10', () => {
    assert.doesNotThrow(() => createGame(1, samples(0, 0)));
    assert.doesNotThrow(() => createGame(10, samples(0, 0)));
    for (const invalid of [0, 11, 1.5, Number.NaN]) {
      assert.throws(
        () => createGame(invalid, samples()),
        /k must be an integer/,
      );
    }
  });

  test('derives size and next expansion from the historical exponent', () => {
    assert.deepEqual(deriveGrowth(3, 2), {
      expansionCount: 1,
      sideLength: 3,
      nextExpansionExponent: 5,
      nextExpansionTile: 32n,
    });
    assert.equal(tileValue(60), 1_152_921_504_606_846_976n);
  });
});

describe('movement and scoring', () => {
  test('moves in every direction', () => {
    const board = [
      [null, 1],
      [null, null],
    ] as const;

    assert.deepEqual(move(state(board), 'left', samples(0, 0)).state.board, [
      [1, 1],
      [null, null],
    ]);
    assert.deepEqual(move(state(board), 'down', samples(0, 0)).state.board, [
      [1, null],
      [null, 1],
    ]);
    assert.deepEqual(
      move(
        state([
          [1, null],
          [null, null],
        ]),
        'right',
        samples(0, 0),
      ).state.board,
      [
        [1, 1],
        [null, null],
      ],
    );
    assert.deepEqual(
      move(
        state([
          [null, null],
          [1, null],
        ]),
        'up',
        samples(0, 0),
      ).state.board,
      [
        [1, 1],
        [null, null],
      ],
    );
  });

  test('merges each tile at most once and accumulates an exact bigint score', () => {
    const result = move(
      state(
        [
          [1, 1, 1, 1],
          [2, 2, 3, 3],
          [null, null, null, null],
          [null, null, null, null],
        ],
        {
          activeK: 1,
          score: 7n,
        },
      ),
      'left',
      samples(0, 0),
    ).state;

    assert.deepEqual(result.board[0].slice(0, 4), [2, 2, 1, null]);
    assert.deepEqual(result.board[1].slice(0, 4), [3, 4, null, null]);
    assert.equal(result.score, 7n + 4n + 4n + 8n + 16n);
  });

  test('a no-op preserves the state reference and consumes no randomness', () => {
    const input = state([
      [1, null],
      [2, null],
    ]);
    let calls = 0;
    const result = move(input, 'left', () => {
      calls += 1;
      return 0;
    });

    assert.strictEqual(result.state, input);
    assert.deepEqual(result.events, []);
    assert.equal(calls, 0);
  });

  test('does not mutate the state or its nested board rows', () => {
    const board = Object.freeze([
      Object.freeze([null, 1]),
      Object.freeze([null, 1]),
    ]);
    const input = Object.freeze(state(board));
    const before = structuredClone(input);

    move(input, 'left', samples(0, 0));

    assert.deepEqual(input, before);
  });
});

describe('expansion and spawning order', () => {
  test('k=1 expands at merged 4 and then merged 8', () => {
    const first = move(
      state(
        [
          [1, 1],
          [null, null],
        ],
        { activeK: 1 },
      ),
      'left',
      samples(0, 0),
    ).state;
    assert.equal(first.sideLength, 3);
    assert.equal(first.highestCreatedExponent, 2);

    const second = move(
      state(
        [
          [2, 2, null],
          [null, null, null],
          [null, null, null],
        ],
        {
          activeK: 1,
          highestCreatedExponent: 2,
        },
      ),
      'left',
      samples(0, 0),
    ).state;
    assert.equal(second.sideLength, 4);
    assert.equal(second.highestCreatedExponent, 3);
  });

  test('k=2 expands first at 8 and next at 32', () => {
    const atEight = move(
      state(
        [
          [2, 2],
          [null, null],
        ],
        { activeK: 2, highestCreatedExponent: 2 },
      ),
      'left',
      samples(0, 0),
    ).state;
    assert.equal(atEight.sideLength, 3);

    const atSixteen = move(
      state(
        [
          [3, 3, null],
          [null, null, null],
          [null, null, null],
        ],
        {
          activeK: 2,
          highestCreatedExponent: 3,
        },
      ),
      'left',
      samples(0, 0),
    ).state;
    assert.equal(atSixteen.sideLength, 3);

    const atThirtyTwo = move(
      state(
        [
          [4, 4, null],
          [null, null, null],
          [null, null, null],
        ],
        {
          activeK: 2,
          highestCreatedExponent: 4,
        },
      ),
      'left',
      samples(0, 0),
    ).state;
    assert.equal(atThirtyTwo.sideLength, 4);
  });

  test('applies the full growth delta before spawning into appended space', () => {
    const result = move(
      state(
        [
          [2, 2],
          [null, null],
        ],
        { activeK: 1 },
      ),
      'left',
      // First select a 2; then select the final empty cell on the new 4x4 board.
      samples(0, 0.999),
    ).state;

    assert.equal(result.sideLength, 4);
    assert.equal(result.highestCreatedExponent, 3);
    assert.equal(result.board[3][3], 1);
  });

  test('a spawned 4 does not update the merge milestone', () => {
    const result = move(
      state(
        [
          [null, 1],
          [null, null],
        ],
        { activeK: 1 },
      ),
      'left',
      samples(0.95, 0),
    ).state;

    assert.equal(result.highestCreatedExponent, 1);
    assert.equal(result.sideLength, 2);
    assert.equal(result.board.flat().includes(2), true);
  });
});

describe('available moves and game over', () => {
  test('distinguishes a full mergeable board from a blocked board', () => {
    const mergeable = [
      [1, 1],
      [2, 3],
    ] as const;
    const blocked = [
      [1, 2],
      [3, 4],
    ] as const;

    assert.equal(evaluateStatus(mergeable), 'active');
    assert.deepEqual(getAvailableMoves(mergeable), ['left', 'right']);
    assert.equal(evaluateStatus(blocked), 'game_over');
    assert.deepEqual(getAvailableMoves(blocked), []);
  });

  test('evaluates game over after the post-move spawn', () => {
    const result = move(
      state([
        [1, 2],
        [3, null],
      ]),
      'right',
      samples(0.95, 0),
    );

    assert.deepEqual(result.state.board, [
      [1, 2],
      [2, 3],
    ]);
    assert.equal(result.state.status, 'game_over');
    assert.equal(result.events.at(-1)?.type, 'game_over');
  });
});
