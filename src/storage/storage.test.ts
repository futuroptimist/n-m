import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import type { GameState } from '../engine';
import {
  deserializeGame,
  GAME_STORAGE_KEY,
  GameStorage,
  serializeGame,
  type AsyncKeyValueStore,
} from './index';

class MemoryStore implements AsyncKeyValueStore {
  public readonly values = new Map<string, string>();
  public failRead = false;
  public failWrite = false;
  public failClear = false;

  public async getItem(key: string): Promise<string | null> {
    if (this.failRead) throw new Error('read failed');
    return this.values.get(key) ?? null;
  }

  public async setItem(key: string, value: string): Promise<void> {
    if (this.failWrite) throw new Error('write failed');
    this.values.set(key, value);
  }

  public async removeItem(key: string): Promise<void> {
    if (this.failClear) throw new Error('clear failed');
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
  score: 9007199254740993123456789n,
  status: 'game-over',
};

test('round trips a grown nondefault game without losing bigint precision', () => {
  const serialized = serializeGame(grownGame);
  assert.deepEqual(deserializeGame(serialized), grownGame);
  const raw = JSON.parse(serialized) as Record<string, unknown>;
  assert.equal(raw.score, '9007199254740993123456789');
  assert.deepEqual(Object.keys(raw).sort(), [
    'activeK',
    'board',
    'highestCreatedExponent',
    'schemaVersion',
    'score',
    'sideLength',
    'status',
  ]);
});

test('accepts canonical scores and rejects noncanonical or negative scores', () => {
  assert.equal(deserializeGame(saved({ score: '0' })).score, 0n);
  for (const score of ['00', '01', '-1', '+1', '1.0', 1]) {
    assert.throws(() => deserializeGame(saved({ score })));
  }
});

test('rejects malformed JSON and invalid saved fields', () => {
  assert.throws(() => deserializeGame('{'));
  assert.throws(() => deserializeGame(saved({ board: [[1]], sideLength: 1 })));
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
      saved({ activeK: 2, highestCreatedExponent: 7, sideLength: 3 }),
    ),
  );
  assert.throws(() =>
    deserializeGame(
      saved({
        board: [
          [3, null],
          [null, 1],
        ],
        highestCreatedExponent: 2,
      }),
    ),
  );
});

test('reports empty storage without creating a save', async () => {
  const store = new MemoryStore();
  assert.deepEqual(await new GameStorage(store).load(), { kind: 'empty' });
  assert.equal(store.values.size, 0);
});

test('leaves unsupported newer and invalid saves untouched for recovery', async () => {
  for (const value of [saved({ schemaVersion: 2 }), '{bad']) {
    const store = new MemoryStore();
    store.values.set(GAME_STORAGE_KEY, value);
    const result = await new GameStorage(store).load();
    assert.equal(result.kind, 'recovery');
    assert.equal(
      result.kind === 'recovery' ? result.reason : null,
      value === '{bad' ? 'invalid' : 'newer-schema',
    );
    assert.equal(store.values.get(GAME_STORAGE_KEY), value);
  }
});

test('only explicit clear discards a stored game', async () => {
  const store = new MemoryStore();
  store.values.set(GAME_STORAGE_KEY, serializeGame(grownGame));
  assert.deepEqual(await new GameStorage(store).clear(), { ok: true });
  assert.equal(store.values.has(GAME_STORAGE_KEY), false);
});

test('classifies storage read, write, and clear failures', async () => {
  const store = new MemoryStore();
  const storage = new GameStorage(store);
  store.failRead = true;
  assert.deepEqual(await storage.load(), {
    kind: 'recovery',
    reason: 'read-error',
  });
  store.failWrite = true;
  assert.deepEqual(await storage.save(grownGame), {
    ok: false,
    reason: 'write-error',
  });
  store.failWrite = false;
  store.failClear = true;
  assert.deepEqual(await storage.clear(), {
    ok: false,
    reason: 'clear-error',
  });
});

test('serializes writes so a slow older save cannot replace a newer save', async () => {
  const completions: (() => void)[] = [];
  const values: string[] = [];
  const store: AsyncKeyValueStore = {
    getItem: async () => null,
    removeItem: async () => undefined,
    setItem: async (_key, value) => {
      await new Promise<void>((resolve) => completions.push(resolve));
      values.push(value);
    },
  };
  const storage = new GameStorage(store);
  const first = storage.save({ ...grownGame, score: 1n });
  const second = storage.save({ ...grownGame, score: 2n });
  await waitFor(() => completions.length === 1);
  completions.shift()?.();
  await waitFor(() => completions.length === 1);
  completions.shift()?.();
  await Promise.all([first, second]);
  assert.equal(deserializeGame(values.at(-1) ?? '').score, 2n);
});

test('pure Node test path does not import the native AsyncStorage adapter', async () => {
  const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /react-native-async-storage/);
});

function saved(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    activeK: 1,
    sideLength: 2,
    board: [
      [1, 2],
      [null, null],
    ],
    highestCreatedExponent: 1,
    score: '0',
    status: 'active',
    ...overrides,
  });
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20 && !predicate(); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.equal(predicate(), true);
}
