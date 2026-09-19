import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import type { GameState } from '../engine';
import {
  clearGame,
  deserializeGame,
  GAME_STORAGE_KEY,
  loadGame,
  serializeGame,
  SerializedGameWriter,
  type AsyncKeyValueStore,
} from './gameStorage';

class MemoryStore implements AsyncKeyValueStore {
  readonly values = new Map<string, string>();
  failRead = false;
  failWrite = false;

  async getItem(key: string): Promise<string | null> {
    if (this.failRead) throw new Error('read failed');
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.failWrite) throw new Error('write failed');
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (this.failWrite) throw new Error('clear failed');
    this.values.delete(key);
  }
}

const grownGame: GameState = {
  schemaVersion: 1,
  activeK: 2,
  sideLength: 4,
  board: [
    [5, 2, null, null],
    [1, 3, null, null],
    [null, null, 4, null],
    [null, null, null, 1],
  ],
  highestCreatedExponent: 5,
  score: 90071992547409931234567890n,
  status: 'game-over',
};

test('round trips every persisted field exactly with a canonical bigint score', () => {
  const serialized = serializeGame(grownGame);
  assert.equal(JSON.parse(serialized).score, '90071992547409931234567890');
  assert.deepEqual(deserializeGame(serialized), grownGame);
});

test('rejects noncanonical and negative scores', () => {
  for (const score of ['-1', '01', '+1', '1.0', '', 1]) {
    assert.throws(() => deserializeGame(saved({ score })));
  }
});

test('rejects malformed JSON and invalid save fields', () => {
  assert.throws(() => deserializeGame('{'));
  assert.throws(() => deserializeGame(saved({ board: [[1]] })));
  assert.throws(() =>
    deserializeGame(
      saved({
        board: [
          [0, null],
          [null, 1],
        ],
      }),
    ),
  );
  assert.throws(() => deserializeGame(saved({ status: 'paused' })));
  assert.throws(() =>
    deserializeGame(
      saved({ activeK: 1, sideLength: 2, highestCreatedExponent: 2 }),
    ),
  );
  assert.throws(() =>
    deserializeGame(
      saved({
        board: [
          [3, null],
          [null, 1],
        ],
        highestCreatedExponent: 1,
      }),
    ),
  );
});

test('returns empty when no saved run exists', async () => {
  assert.deepEqual(await loadGame(new MemoryStore()), { kind: 'empty' });
});

test('classifies invalid and newer saves without changing stored data', async () => {
  for (const [raw, reason] of [
    ['{', 'invalid'],
    [JSON.stringify({ schemaVersion: 2 }), 'newer-version'],
  ] as const) {
    const store = new MemoryStore();
    store.values.set(GAME_STORAGE_KEY, raw);
    assert.deepEqual(await loadGame(store), { kind: 'recovery', reason });
    assert.equal(store.values.get(GAME_STORAGE_KEY), raw);
  }
});

test('clear only discards the save after an explicit call', async () => {
  const store = new MemoryStore();
  store.values.set(GAME_STORAGE_KEY, serializeGame(grownGame));
  assert.deepEqual(await clearGame(store), { ok: true });
  assert.equal(store.values.has(GAME_STORAGE_KEY), false);
});

test('classifies storage read, write, and clear failures', async () => {
  const store = new MemoryStore();
  store.failRead = true;
  assert.deepEqual(await loadGame(store), {
    kind: 'recovery',
    reason: 'read-error',
  });
  store.failRead = false;
  store.failWrite = true;
  const writer = new SerializedGameWriter(store);
  assert.deepEqual(await writer.save(grownGame), {
    ok: false,
    reason: 'write-error',
  });
  assert.deepEqual(await clearGame(store), {
    ok: false,
    reason: 'write-error',
  });
});

test('serialized writes cannot let an older state finish last', async () => {
  const completions: (() => void)[] = [];
  const written: string[] = [];
  const store: AsyncKeyValueStore = {
    getItem: async () => null,
    removeItem: async () => undefined,
    setItem: async (_key, value) => {
      written.push(value);
      await new Promise<void>((resolve) => completions.push(resolve));
    },
  };
  const writer = new SerializedGameWriter(store);
  const older = writer.save({ ...grownGame, score: 1n });
  const newer = writer.save({ ...grownGame, score: 2n });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(written.length, 1);
  completions.shift()?.();
  await older;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(written.length, 2);
  completions.shift()?.();
  await newer;
  assert.equal(JSON.parse(written.at(-1)!).score, '2');
});

test('the pure Node test path does not import the native adapter', async () => {
  const source = await readFile(
    new URL('./gameStorage.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /async-storage|asyncStorageAdapter/);
});

function saved(overrides: Record<string, unknown>): string {
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
