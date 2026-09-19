import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GAME_SCHEMA_VERSION,
  createGame,
  deriveGrowth,
  evaluateGameStatus,
  getAvailableMoves,
  moveGame,
  tileValue,
  type Board,
  type GameState,
  type RandomSource,
} from './index';

function samples(...values: number[]): RandomSource {
  return () => {
    const value = values.shift();
    assert.notEqual(
      value,
      undefined,
      'RNG consumed more samples than expected',
    );
    return value!;
  };
}

function state(
  board: Board,
  activeK = 10,
  highestCreatedExponent = 1,
): GameState {
  return {
    schemaVersion: GAME_SCHEMA_VERSION,
    activeK,
    board,
    sideLength: board.length,
    highestCreatedExponent,
    score: 0n,
    status: 'playing',
  };
}

test('creates a 2x2 game with two distinct 2 tiles and validates k', () => {
  const game = createGame(1, samples(0, 0.99));
  assert.equal(game.board.flat().filter((cell) => cell === 1).length, 2);
  assert.equal(game.sideLength, 2);
  assert.equal(game.highestCreatedExponent, 1);
  assert.equal(game.schemaVersion, 1);
  assert.doesNotThrow(() => createGame(10, samples(0, 0)));
  for (const invalid of [0, 11, 1.5, Number.NaN]) {
    assert.throws(
      () => createGame(invalid, samples()),
      /integer from 1 through 10/,
    );
  }
});

test('moves in every direction and merges each tile at most once', () => {
  const left = moveGame(
    state([
      [1, 1, 1, 1],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]),
    'left',
    samples(0.99, 0),
  ).state;
  assert.deepEqual(left.board[0], [2, 2, null, null]);
  assert.equal(left.score, 8n);

  const directional: ['right' | 'up' | 'down', Board, Board][] = [
    [
      'right',
      [
        [1, null],
        [1, null],
      ],
      [
        [null, 1],
        [null, 1],
      ],
    ],
    [
      'up',
      [
        [null, 1],
        [null, 1],
      ],
      [
        [null, 2],
        [null, null],
      ],
    ],
    [
      'down',
      [
        [null, 1],
        [null, null],
      ],
      [
        [null, null],
        [null, 1],
      ],
    ],
  ];
  for (const [direction, board, expectedBeforeSpawn] of directional) {
    const result = moveGame(state(board), direction, samples(0, 0));
    const spawned = result.events.find((event) => event.type === 'spawned');
    const withoutSpawn = result.state.board.map((row) => [...row]);
    if (spawned?.type === 'spawned')
      withoutSpawn[spawned.row][spawned.column] = null;
    assert.deepEqual(withoutSpawn, expectedBeforeSpawn);
  }
});

test('accumulates exact bigint score and converts large tile exponents', () => {
  const result = moveGame(
    state([
      [1, 1],
      [2, 2],
    ]),
    'left',
    samples(0, 0),
  );
  assert.equal(result.state.score, 12n);
  assert.equal(tileValue(60), 1_152_921_504_606_846_976n);
});

test('derives milestones and grows at k=1 and k=2 thresholds', () => {
  assert.deepEqual(deriveGrowth(1, 1), {
    expansionCount: 0,
    sideLength: 2,
    nextExpansionExponent: 2,
    nextExpansionTile: 4n,
  });
  assert.equal(deriveGrowth(3, 1).sideLength, 4);
  assert.equal(deriveGrowth(2, 2).sideLength, 2);
  assert.equal(deriveGrowth(3, 2).sideLength, 3);
  assert.equal(deriveGrowth(5, 2).sideLength, 4);

  const four = moveGame(
    state(
      [
        [1, 1],
        [null, null],
      ],
      1,
    ),
    'left',
    samples(0, 0),
  );
  assert.equal(four.state.sideLength, 3);
  assert.equal(four.state.highestCreatedExponent, 2);
  const eight = moveGame(
    state(
      [
        [2, 2],
        [null, null],
      ],
      1,
    ),
    'left',
    samples(0, 0),
  );
  assert.equal(eight.state.sideLength, 4);
  assert.equal(eight.state.highestCreatedExponent, 3);

  const k2Eight = moveGame(
    state(
      [
        [2, 2],
        [null, null],
      ],
      2,
    ),
    'left',
    samples(0, 0),
  );
  assert.equal(k2Eight.state.sideLength, 3);
  const k2ThirtyTwo = moveGame(
    state(
      [
        [4, 4, null],
        [null, null, null],
        [null, null, null],
      ],
      2,
      3,
    ),
    'left',
    samples(0, 0),
  );
  assert.equal(k2ThirtyTwo.state.sideLength, 4);
  assert.equal(k2ThirtyTwo.state.highestCreatedExponent, 5);
});

test('grows before spawning and can spawn in newly appended space', () => {
  const result = moveGame(
    state(
      [
        [1, 1],
        [null, null],
      ],
      1,
    ),
    'left',
    samples(0.99, 0),
  );
  assert.equal(result.state.sideLength, 3);
  assert.equal(result.state.board[2][2], 1);
  assert.deepEqual(result.events.at(-1), {
    type: 'spawned',
    exponent: 1,
    row: 2,
    column: 2,
  });
});

test('a spawned 4 does not advance the historical merge exponent', () => {
  const result = moveGame(
    state(
      [
        [1, null],
        [null, null],
      ],
      1,
    ),
    'right',
    samples(0, 0.95),
  );
  assert.equal(result.state.highestCreatedExponent, 1);
  assert.equal(result.state.sideLength, 2);
  assert.ok(result.state.board.flat().includes(2));
});

test('a no-op preserves the state and consumes no randomness', () => {
  const original = state([
    [1, null],
    [null, null],
  ]);
  let calls = 0;
  const result = moveGame(original, 'left', () => {
    calls += 1;
    return 0;
  });
  assert.equal(result.state, original);
  assert.equal(result.moved, false);
  assert.equal(calls, 0);
});

test('evaluates available moves and final game over correctly', () => {
  const blocked: Board = [
    [1, 2],
    [3, 4],
  ];
  const mergeable: Board = [
    [1, 1],
    [3, 4],
  ];
  assert.equal(evaluateGameStatus(blocked), 'game-over');
  assert.deepEqual(getAvailableMoves(blocked), []);
  assert.equal(evaluateGameStatus(mergeable), 'playing');
  assert.ok(getAvailableMoves(mergeable).includes('left'));

  const result = moveGame(
    state([
      [1, 2],
      [3, null],
    ]),
    'right',
    samples(0, 0.95),
  );
  assert.equal(result.state.status, 'game-over');
  assert.equal(result.events.at(-1)?.type, 'game-over');
});

test('moving and growing do not mutate state or nested board arrays', () => {
  const original = state(
    [
      [1, 1],
      [null, null],
    ],
    1,
  );
  const snapshot = original.board.map((row) => [...row]);
  const result = moveGame(original, 'left', samples(0, 0));
  assert.deepEqual(original.board, snapshot);
  assert.notEqual(result.state, original);
  assert.notEqual(result.state.board, original.board);
  original.board.forEach((row, index) =>
    assert.notEqual(result.state.board[index], row),
  );
});
