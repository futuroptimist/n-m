import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { GameState } from '../engine';
import {
  clearGame,
  deserializeGame,
  GAME_STORAGE_KEY,
  loadGame,
  saveGame,
  serializeGame,
  SerializedGameWriter,
  StorageOperationError,
  type AsyncKeyValueStore,
} from './gameStorage';

class MemoryStore implements AsyncKeyValueStore {
  readonly values = new Map<string, string>();
  getError?: Error;
  setError?: Error;
  removeError?: Error;

  async getItem(key: string): Promise<string | null> {
    if (this.getError) throw this.getError;
    return this.values.get(key) ?? null;
  }
  async setItem(key: string, value: string): Promise<void> {
    if (this.setError) throw this.setError;
    this.values.set(key, value);
  }
  async removeItem(key: string): Promise<void> {
    if (this.removeError) throw this.removeError;
    this.values.delete(key);
  }
}

const grownGame: GameState = {
  schemaVersion: 1,
  activeK: 2,
  sideLength: 5,
  board: [
    [7, 2, null, null, null],
    [1, null, 3, null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
  ],
  highestCreatedExponent: 7,
  score: 9007199254740993123456789n,
  status: 'game-over',
};

test('round trips every persisted field exactly without importing AsyncStorage', () => {
  const serialized = serializeGame(grownGame);
  assert.deepEqual(Object.keys(JSON.parse(serialized)).sort(), [
    'activeK',
    'board',
    'highestCreatedExponent',
    'schemaVersion',
    'score',
    'sideLength',
    'status',
  ]);
  assert.equal(JSON.parse(serialized).score, '9007199254740993123456789');
  assert.deepEqual(deserializeGame(serialized), grownGame);
});

test('accepts canonical scores and rejects noncanonical or negative scores', () => {
  for (const score of ['0', '1', '9007199254740993123456789']) {
    assert.equal(
      deserializeGame(withField('score', score)).score,
      BigInt(score),
    );
  }
  for (const score of ['-1', '01', '+1', '1.0', '', 1]) {
    assert.throws(() => deserializeGame(withField('score', score)));
  }
});

test('rejects malformed JSON and invalid state fields', () => {
  assert.throws(() => deserializeGame('{nope'), SyntaxError);
  assert.throws(() => deserializeGame('[]'));
  assert.throws(() => deserializeGame(withField('board', [[1, 2]])));
  assert.throws(() => deserializeGame(withField('board', invalidBoard(0))));
  assert.throws(() => deserializeGame(withField('board', invalidBoard(1.5))));
  assert.throws(() => deserializeGame(withField('status', 'paused')));
  assert.throws(() => deserializeGame(withField('sideLength', 3)));
  assert.throws(() => deserializeGame(withField('board', invalidBoard(8))));
});

test('leaves unsupported saves untouched and classifies newer schemas', async () => {
  const store = new MemoryStore();
  const newer = withField('schemaVersion', 2);
  store.values.set(GAME_STORAGE_KEY, newer);
  assert.deepEqual(await loadGame(store), {
    kind: 'recovery',
    reason: 'unsupported-newer',
    message: 'This save was created by a newer app version.',
  });
  assert.equal(store.values.get(GAME_STORAGE_KEY), newer);

  const older = withField('schemaVersion', 0);
  store.values.set(GAME_STORAGE_KEY, older);
  assert.equal((await loadGame(store)).kind, 'recovery');
  assert.equal(store.values.get(GAME_STORAGE_KEY), older);
});

test('returns empty for an empty store and clears only on explicit discard', async () => {
  const store = new MemoryStore();
  assert.deepEqual(await loadGame(store), { kind: 'empty' });
  await saveGame(store, grownGame);
  assert.ok(store.values.has(GAME_STORAGE_KEY));
  await clearGame(store);
  assert.equal(store.values.has(GAME_STORAGE_KEY), false);
});

test('classifies malformed, invalid, and read failures without changing data', async () => {
  const store = new MemoryStore();
  store.values.set(GAME_STORAGE_KEY, '{bad');
  assert.equal((await loadGame(store)).kind, 'recovery');
  assert.equal(
    ((await loadGame(store)) as { reason: string }).reason,
    'malformed',
  );
  assert.equal(store.values.get(GAME_STORAGE_KEY), '{bad');

  const invalid = withField('status', 'paused');
  store.values.set(GAME_STORAGE_KEY, invalid);
  assert.equal(
    ((await loadGame(store)) as { reason: string }).reason,
    'invalid',
  );
  assert.equal(store.values.get(GAME_STORAGE_KEY), invalid);

  store.getError = new Error('read failed');
  assert.equal(
    ((await loadGame(store)) as { reason: string }).reason,
    'read-error',
  );
});

test('classifies write and clear failures', async () => {
  const store = new MemoryStore();
  store.setError = new Error('disk full');
  await assert.rejects(
    () => saveGame(store, grownGame),
    (error) => {
      assert.ok(error instanceof StorageOperationError);
      assert.equal(error.operation, 'write');
      return true;
    },
  );
  store.removeError = new Error('locked');
  await assert.rejects(
    () => clearGame(store),
    (error) => {
      assert.ok(error instanceof StorageOperationError);
      assert.equal(error.operation, 'clear');
      return true;
    },
  );
});

test('serialized writer cannot let an older slow write overwrite a newer one', async () => {
  const completions: (() => void)[] = [];
  const writes: string[] = [];
  const store: AsyncKeyValueStore = {
    getItem: async () => null,
    removeItem: async () => undefined,
    setItem: async (_key, value) => {
      writes.push(value);
      await new Promise<void>((resolve) => completions.push(resolve));
    },
  };
  const writer = new SerializedGameWriter(store);
  const first = writer.save({ ...grownGame, score: 1n });
  const second = writer.save({ ...grownGame, score: 2n });
  await waitUntil(() => completions.length === 1);
  assert.equal(writes.length, 1);
  completions.shift()?.();
  await first;
  await waitUntil(() => completions.length === 1);
  assert.equal(writes.length, 2);
  completions.shift()?.();
  await second;
  assert.equal(JSON.parse(writes.at(-1) ?? '').score, '2');
});

function withField(field: string, value: unknown): string {
  return JSON.stringify({
    ...JSON.parse(serializeGame(grownGame)),
    [field]: value,
  });
}

function invalidBoard(value: unknown): unknown[][] {
  const board = grownGame.board.map((row) => [...row]);
  board[0][0] = value as number;
  return board;
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let attempts = 0; attempts < 20 && !predicate(); attempts += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.ok(predicate(), 'condition was not reached');
}
