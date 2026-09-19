import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import type { GameState } from '../engine';
import {
  GAME_STORAGE_KEY,
  GameStorage,
  StorageOperationError,
  deserializeGame,
  serializeGame,
  type AsyncKeyValueStore,
} from './gameStorage';

class MemoryStore implements AsyncKeyValueStore {
  readonly values = new Map<string, string>();
  fail: 'read' | 'write' | 'clear' | null = null;

  async getItem(key: string): Promise<string | null> {
    if (this.fail === 'read') throw new Error('read failed');
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.fail === 'write') throw new Error('write failed');
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (this.fail === 'clear') throw new Error('clear failed');
    this.values.delete(key);
  }
}

const grownGame: GameState = {
  schemaVersion: 1,
  activeK: 2,
  sideLength: 4,
  board: [
    [5, 2, null, null],
    [1, null, 2, null],
    [null, null, null, null],
    [null, null, null, 1],
  ],
  highestCreatedExponent: 5,
  score: 9_007_199_254_740_993_123_456_789n,
  status: 'active',
};

function saved(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    activeK: 1,
    sideLength: 2,
    board: [
      [1, null],
      [null, 2],
    ],
    highestCreatedExponent: 1,
    score: '0',
    status: 'active',
    ...overrides,
  });
}

test('round trips every persisted field with an exact bigint score', async () => {
  const store = new MemoryStore();
  const persistence = new GameStorage(store);

  await persistence.save(grownGame);

  assert.equal(
    JSON.parse(store.values.get(GAME_STORAGE_KEY)!).score,
    '9007199254740993123456789',
  );
  assert.deepEqual(await persistence.load(), {
    type: 'restored',
    game: grownGame,
  });
});

test('round trips a valid grown game-over run exactly', async () => {
  const gameOver: GameState = {
    schemaVersion: 1,
    activeK: 2,
    sideLength: 4,
    board: [
      [1, 2, 1, 2],
      [2, 1, 2, 1],
      [1, 2, 1, 2],
      [2, 1, 2, 5],
    ],
    highestCreatedExponent: 5,
    score: 9_007_199_254_740_993_123_456_789n,
    status: 'game-over',
  };
  const store = new MemoryStore();
  const persistence = new GameStorage(store);

  await persistence.save(gameOver);

  assert.deepEqual(await persistence.load(), {
    type: 'restored',
    game: gameOver,
  });
});

test('serializes canonical decimal scores and rejects other score forms', () => {
  assert.equal(
    JSON.parse(serializeGame({ ...grownGame, score: 0n })).score,
    '0',
  );
  assert.throws(
    () => serializeGame({ ...grownGame, score: -1n }),
    /Invalid score/,
  );
  assert.throws(
    () =>
      serializeGame({
        ...grownGame,
        score: 1 as unknown as bigint,
      }),
    /Invalid score/,
  );
  for (const score of ['-1', '01', '+1', '1.0', '', 1]) {
    assert.throws(() => deserializeGame(saved({ score })), /Invalid score/);
  }
});

test('rejects malformed JSON and invalid saved state fields', () => {
  assert.throws(() => deserializeGame('{'), SyntaxError);
  assert.throws(() => deserializeGame('[]'), /object/);
  assert.throws(
    () => deserializeGame(saved({ board: [[1]], sideLength: 2 })),
    /dimensions/,
  );
  assert.throws(
    () =>
      deserializeGame(
        saved({
          board: [
            [0, null],
            [null, 1],
          ],
        }),
      ),
    /exponent/,
  );
  assert.throws(() => deserializeGame(saved({ status: 'paused' })), /status/);
  assert.throws(
    () => deserializeGame(saved({ status: 'game-over' })),
    /Status does not match the board/,
  );
  assert.throws(
    () =>
      deserializeGame(
        saved({
          board: [
            [1, 2],
            [2, 1],
          ],
          status: 'active',
        }),
      ),
    /Status does not match the board/,
  );
  assert.throws(
    () =>
      deserializeGame(
        saved({ highestCreatedExponent: 2, sideLength: 2, activeK: 1 }),
      ),
    /growth invariant/,
  );
  assert.throws(
    () =>
      deserializeGame(
        saved({
          board: [
            [3, null],
            [null, 1],
          ],
        }),
      ),
    /historical milestone/,
  );
});

test('classifies malformed, unsupported, and newer saves without changing them', async () => {
  const cases = [
    ['{', 'invalid'],
    [saved({ schemaVersion: 0 }), 'invalid'],
    [saved({ schemaVersion: 2 }), 'newer-version'],
  ] as const;
  for (const [value, reason] of cases) {
    const store = new MemoryStore();
    store.values.set(GAME_STORAGE_KEY, value);
    assert.deepEqual(await new GameStorage(store).load(), {
      type: 'recovery',
      reason,
    });
    assert.equal(store.values.get(GAME_STORAGE_KEY), value);
  }
});

test('rejects status mismatches during load without changing the save', async () => {
  const cases = [
    saved({ status: 'game-over' }),
    saved({
      board: [
        [1, 2],
        [2, 1],
      ],
      status: 'active',
    }),
  ];

  for (const value of cases) {
    const store = new MemoryStore();
    store.values.set(GAME_STORAGE_KEY, value);

    assert.deepEqual(await new GameStorage(store).load(), {
      type: 'recovery',
      reason: 'invalid',
    });
    assert.equal(store.values.get(GAME_STORAGE_KEY), value);
  }
});

test('reports an empty store and clears only after an explicit discard', async () => {
  const store = new MemoryStore();
  const persistence = new GameStorage(store);
  assert.deepEqual(await persistence.load(), { type: 'empty' });
  store.values.set(GAME_STORAGE_KEY, serializeGame(grownGame));
  await persistence.clear();
  assert.equal(store.values.has(GAME_STORAGE_KEY), false);
});

test('classifies read, write, and clear failures', async () => {
  const store = new MemoryStore();
  const persistence = new GameStorage(store);
  store.fail = 'read';
  assert.deepEqual(await persistence.load(), {
    type: 'recovery',
    reason: 'read-error',
  });
  store.fail = 'write';
  await assert.rejects(
    persistence.save(grownGame),
    (error: unknown) =>
      error instanceof StorageOperationError && error.operation === 'write',
  );
  store.fail = 'clear';
  await assert.rejects(
    persistence.clear(),
    (error: unknown) =>
      error instanceof StorageOperationError && error.operation === 'clear',
  );
});

test('serializes writes so an older delayed write cannot win', async () => {
  const resolvers: (() => void)[] = [];
  const written: string[] = [];
  const store: AsyncKeyValueStore = {
    async getItem() {
      return null;
    },
    async setItem(_key, value) {
      written.push(value);
      await new Promise<void>((resolve) => resolvers.push(resolve));
    },
    async removeItem() {},
  };
  const persistence = new GameStorage(store);
  const first = persistence.save({ ...grownGame, score: 1n });
  const second = persistence.save({ ...grownGame, score: 2n });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(written.length, 1);
  resolvers.shift()!();
  await first;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(written.length, 2);
  resolvers.shift()!();
  await second;
  assert.deepEqual(
    written.map((value) => JSON.parse(value).score),
    ['1', '2'],
  );
});

test('serializes clear with saves in invocation order', async () => {
  const resolvers: (() => void)[] = [];
  const operations: string[] = [];
  let storedValue: string | null = null;
  const store: AsyncKeyValueStore = {
    async getItem() {
      return storedValue;
    },
    async setItem(_key, value) {
      operations.push('save');
      await new Promise<void>((resolve) => resolvers.push(resolve));
      storedValue = value;
    },
    async removeItem() {
      operations.push('clear');
      await new Promise<void>((resolve) => resolvers.push(resolve));
      storedValue = null;
    },
  };
  const persistence = new GameStorage(store);
  const firstSave = persistence.save({ ...grownGame, score: 1n });
  const clear = persistence.clear();
  const secondSave = persistence.save({ ...grownGame, score: 2n });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(operations, ['save']);
  resolvers.shift()!();
  await firstSave;
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(operations, ['save', 'clear']);
  resolvers.shift()!();
  await clear;
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(operations, ['save', 'clear', 'save']);
  resolvers.shift()!();
  await secondSave;
  assert.equal(JSON.parse(storedValue!).score, '2');
});

test('continues queued operations after a failure', async () => {
  const operations: string[] = [];
  let storedValue: string | null = null;
  let failNextSave = true;
  const store: AsyncKeyValueStore = {
    async getItem() {
      return storedValue;
    },
    async setItem(_key, value) {
      operations.push('save');
      if (failNextSave) {
        failNextSave = false;
        throw new Error('write failed');
      }
      storedValue = value;
    },
    async removeItem() {
      operations.push('clear');
      storedValue = null;
    },
  };
  const persistence = new GameStorage(store);
  const failedSave = persistence.save({ ...grownGame, score: 1n });
  const clear = persistence.clear();
  const finalSave = persistence.save({ ...grownGame, score: 2n });

  await assert.rejects(
    failedSave,
    (error: unknown) =>
      error instanceof StorageOperationError && error.operation === 'write',
  );
  await clear;
  await finalSave;

  assert.deepEqual(operations, ['save', 'clear', 'save']);
  assert.equal(JSON.parse(storedValue!).score, '2');
});

test('the pure Node test path does not import native AsyncStorage', async () => {
  const source = await readFile(
    new URL('./gameStorage.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /@react-native-async-storage/);
});
