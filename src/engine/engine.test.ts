import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ENGINE_SCHEMA_VERSION,
  availableMoves,
  createGame,
  deriveGrowth,
  isGameOver,
  move,
  tileValue,
  type Board,
  type GameState,
  type RandomSource,
} from './index';

function sequence(...samples: number[]): RandomSource {
  let index = 0;
  return () => {
    assert.ok(
      index < samples.length,
      'random source was called more often than expected',
    );
    return samples[index++];
  };
}

function state(
  board: Board,
  activeK = 10,
  highestCreatedExponent = 1,
  score = 0n,
): GameState {
  return {
    schemaVersion: ENGINE_SCHEMA_VERSION,
    activeK,
    sideLength: board.length,
    board,
    highestCreatedExponent,
    score,
    status: isGameOver(board) ? 'game-over' : 'active',
  };
}

test('new games validate k and place exactly two exponent-1 tiles', () => {
  for (const k of [1, 10]) {
    const game = createGame(k, sequence(0, 0.999));
    assert.equal(game.schemaVersion, 1);
    assert.equal(game.activeK, k);
    assert.equal(game.sideLength, 2);
    assert.equal(game.highestCreatedExponent, 1);
    assert.equal(game.score, 0n);
    assert.deepEqual(game.board, [
      [1, null],
      [null, 1],
    ]);
  }
  for (const invalid of [0, 11, 1.5, Number.NaN]) {
    assert.throws(
      () => createGame(invalid, sequence()),
      /k must be an integer from 1 through 10/,
    );
  }
});

test('growth and tile values use exact bigint calculations', () => {
  assert.equal(tileValue(60), 1_152_921_504_606_846_976n);
  assert.deepEqual(deriveGrowth(3, 1), {
    expansionCount: 2,
    sideLength: 4,
    nextExpansionExponent: 4,
    nextExpansionTile: 16n,
  });
  assert.deepEqual(deriveGrowth(3, 2), {
    expansionCount: 1,
    sideLength: 3,
    nextExpansionExponent: 5,
    nextExpansionTile: 32n,
  });
});

test('moves in every direction and merges each tile at most once', () => {
  const horizontal = state([
    [1, 1, 1, 1],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
  ]);
  assert.deepEqual(
    move(horizontal, 'left', sequence(0, 0.999)).state.board[0],
    [2, 2, null, null],
  );
  assert.deepEqual(move(horizontal, 'right', sequence(0, 0)).state.board[0], [
    1,
    null,
    2,
    2,
  ]);

  const vertical = state([
    [1, null, null, null],
    [1, null, null, null],
    [2, null, null, null],
    [2, null, null, null],
  ]);
  assert.deepEqual(
    move(vertical, 'up', sequence(0, 0.999)).state.board.map((row) => row[0]),
    [2, 3, null, null],
  );
  assert.deepEqual(
    move(vertical, 'down', sequence(0, 0)).state.board.map((row) => row[0]),
    [1, null, 2, 3],
  );
});

test('multiple merges accumulate exact score and do not chain merge', () => {
  const result = move(
    state([
      [1, 1, 2, 2],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]),
    'left',
    sequence(0, 0.999),
  );
  assert.deepEqual(result.state.board[0], [2, 3, null, null]);
  assert.equal(result.state.score, 12n);
  assert.equal(result.state.highestCreatedExponent, 3);
});

test('k=1 expands at merged 4 and merged 8 milestones', () => {
  const first = move(
    state(
      [
        [1, 1],
        [null, null],
      ],
      1,
    ),
    'left',
    sequence(0, 0.999),
  );
  assert.equal(first.state.sideLength, 3);
  assert.equal(first.state.highestCreatedExponent, 2);

  const second = move(
    state(
      [
        [2, 2, null],
        [null, null, null],
        [null, null, null],
      ],
      1,
      2,
    ),
    'left',
    sequence(0, 0.999),
  );
  assert.equal(second.state.sideLength, 4);
  assert.equal(second.state.highestCreatedExponent, 3);
});

test('k=2 first expands at 8 and next expands at 32', () => {
  const atEight = move(
    state(
      [
        [2, 2],
        [null, null],
      ],
      2,
      2,
    ),
    'left',
    sequence(0, 0.999),
  );
  assert.equal(atEight.state.sideLength, 3);

  const atThirtyTwo = move(
    state(
      [
        [4, 4, null],
        [null, null, null],
        [null, null, null],
      ],
      2,
      4,
    ),
    'left',
    sequence(0, 0.999),
  );
  assert.equal(atThirtyTwo.state.sideLength, 4);
  assert.equal(atThirtyTwo.state.highestCreatedExponent, 5);
});

test('growth precedes spawning, including multiple increments and appended space', () => {
  const result = move(
    state(
      [
        [2, 2],
        [null, null],
      ],
      1,
    ),
    'left',
    sequence(0, 0.999),
  );
  assert.equal(result.state.sideLength, 4);
  assert.equal(result.state.board[3][3], 1);
  assert.deepEqual(
    result.events.find((event) => event.type === 'growth'),
    {
      type: 'growth',
      from: 2,
      to: 4,
    },
  );
});

test('a spawned 4 does not advance the merge milestone', () => {
  const result = move(
    state([
      [1, null],
      [null, null],
    ]),
    'right',
    sequence(0.95, 0),
  );
  assert.equal(result.state.highestCreatedExponent, 1);
  assert.equal(result.state.board[0][0], 2);
});

test('no-op moves preserve state and consume no randomness', () => {
  const input = state([
    [1, null],
    [2, null],
  ]);
  let calls = 0;
  const result = move(input, 'left', () => {
    calls += 1;
    return 0;
  });
  assert.equal(result.state, input);
  assert.equal(result.moved, false);
  assert.deepEqual(result.events, []);
  assert.equal(calls, 0);
});

test('status evaluation distinguishes blocked and mergeable full boards', () => {
  const blocked: Board = [
    [1, 2],
    [2, 3],
  ];
  const mergeable: Board = [
    [1, 1],
    [2, 3],
  ];
  assert.equal(isGameOver(blocked), true);
  assert.deepEqual(availableMoves(blocked), []);
  assert.equal(isGameOver(mergeable), false);

  const final = move(
    state([
      [1, 2],
      [3, null],
    ]),
    'right',
    sequence(0.95, 0),
  );
  assert.equal(final.state.status, 'game-over');
  assert.equal(final.events.at(-1)?.type, 'game-over');
});

test('moving and spawning do not mutate the input or its nested board rows', () => {
  const board: Board = [
    [1, 1],
    [null, null],
  ];
  const input = state(board, 1);
  const snapshot = input.board.map((row) => [...row]);
  const result = move(input, 'left', sequence(0, 0));
  assert.deepEqual(input.board, snapshot);
  assert.notEqual(result.state, input);
  assert.notEqual(result.state.board, input.board);
  assert.notEqual(result.state.board[0], input.board[0]);
});
