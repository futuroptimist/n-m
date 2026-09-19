import { deriveGrowth, ENGINE_SCHEMA_VERSION, type GameState } from '../engine';

export const GAME_STORAGE_KEY = 'n-m.current-run';
export const SAVE_SCHEMA_VERSION = 1 as const;

export interface AsyncKeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type SaveRecoveryReason =
  | 'malformed'
  | 'invalid'
  | 'unsupported-older'
  | 'unsupported-newer'
  | 'read-error';

export type LoadGameResult =
  | { readonly kind: 'empty' }
  | { readonly kind: 'loaded'; readonly game: GameState }
  | {
      readonly kind: 'recovery';
      readonly reason: SaveRecoveryReason;
      readonly message: string;
    };

interface PersistedGame {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  activeK: number;
  sideLength: number;
  board: (number | null)[][];
  highestCreatedExponent: number;
  score: string;
  status: GameState['status'];
}

export class StorageOperationError extends Error {
  constructor(
    readonly operation: 'write' | 'clear',
    options: { cause: unknown },
  ) {
    super(`Failed to ${operation} saved game`, options);
    this.name = 'StorageOperationError';
  }
}

export function serializeGame(game: GameState): string {
  validateGame(game);
  const persisted: PersistedGame = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    activeK: game.activeK,
    sideLength: game.sideLength,
    board: game.board.map((row) => [...row]),
    highestCreatedExponent: game.highestCreatedExponent,
    score: game.score.toString(10),
    status: game.status,
  };
  return JSON.stringify(persisted);
}

export function deserializeGame(value: string): GameState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new SyntaxError('Saved game is not valid JSON', { cause: error });
  }
  if (!isRecord(parsed)) throw new TypeError('Saved game must be an object');
  const version = parsed.schemaVersion;
  if (!Number.isInteger(version)) {
    throw new TypeError('Saved game has an invalid schema version');
  }
  if (version !== SAVE_SCHEMA_VERSION) {
    throw new UnsupportedSchemaError(version as number);
  }
  if (!isCanonicalScore(parsed.score)) {
    throw new TypeError('Score must be a canonical non-negative decimal');
  }
  const game: GameState = {
    schemaVersion: ENGINE_SCHEMA_VERSION,
    activeK: parsed.activeK as number,
    sideLength: parsed.sideLength as number,
    board: parsed.board as (number | null)[][],
    highestCreatedExponent: parsed.highestCreatedExponent as number,
    score: BigInt(parsed.score as string),
    status: parsed.status as GameState['status'],
  };
  validateGame(game);
  return game;
}

export async function loadGame(
  store: AsyncKeyValueStore,
): Promise<LoadGameResult> {
  let value: string | null;
  try {
    value = await store.getItem(GAME_STORAGE_KEY);
  } catch {
    return {
      kind: 'recovery',
      reason: 'read-error',
      message: 'The saved game could not be read.',
    };
  }
  if (value === null) return { kind: 'empty' };
  try {
    return { kind: 'loaded', game: deserializeGame(value) };
  } catch (error) {
    if (error instanceof UnsupportedSchemaError) {
      const newer = error.version > SAVE_SCHEMA_VERSION;
      return {
        kind: 'recovery',
        reason: newer ? 'unsupported-newer' : 'unsupported-older',
        message: newer
          ? 'This save was created by a newer app version.'
          : 'This save is from an unsupported app version.',
      };
    }
    return {
      kind: 'recovery',
      reason: error instanceof SyntaxError ? 'malformed' : 'invalid',
      message: 'The saved game is corrupt or invalid.',
    };
  }
}

export async function saveGame(
  store: AsyncKeyValueStore,
  game: GameState,
): Promise<void> {
  const value = serializeGame(game);
  try {
    await store.setItem(GAME_STORAGE_KEY, value);
  } catch (error) {
    throw new StorageOperationError('write', { cause: error });
  }
}

export async function clearGame(store: AsyncKeyValueStore): Promise<void> {
  try {
    await store.removeItem(GAME_STORAGE_KEY);
  } catch (error) {
    throw new StorageOperationError('clear', { cause: error });
  }
}

export class SerializedGameWriter {
  private pending: Promise<void> = Promise.resolve();

  constructor(private readonly store: AsyncKeyValueStore) {}

  save(game: GameState): Promise<void> {
    const operation = this.pending.then(() => saveGame(this.store, game));
    this.pending = operation.catch(() => undefined);
    return operation;
  }
}

class UnsupportedSchemaError extends Error {
  constructor(readonly version: number) {
    super(`Unsupported save schema version: ${version}`);
  }
}

function validateGame(game: GameState): void {
  if (!isRecord(game)) throw new TypeError('Game must be an object');
  if (game.schemaVersion !== ENGINE_SCHEMA_VERSION) {
    throw new TypeError('Invalid engine schema version');
  }
  if (
    !Number.isInteger(game.activeK) ||
    game.activeK < 1 ||
    game.activeK > 10
  ) {
    throw new TypeError('activeK must be an integer from 1 through 10');
  }
  if (
    !Number.isSafeInteger(game.highestCreatedExponent) ||
    game.highestCreatedExponent < 1
  ) {
    throw new TypeError(
      'highestCreatedExponent must be a positive safe integer',
    );
  }
  const expectedSide = deriveGrowth(
    game.highestCreatedExponent,
    game.activeK,
  ).sideLength;
  if (
    !Number.isSafeInteger(game.sideLength) ||
    game.sideLength !== expectedSide
  ) {
    throw new TypeError('sideLength does not match the growth invariant');
  }
  if (!Array.isArray(game.board) || game.board.length !== game.sideLength) {
    throw new TypeError('Board dimensions must match sideLength');
  }
  for (const row of game.board) {
    if (!Array.isArray(row) || row.length !== game.sideLength) {
      throw new TypeError('Board must be square');
    }
    for (const cell of row) {
      if (cell === null) continue;
      if (!Number.isSafeInteger(cell) || cell < 1) {
        throw new TypeError('Board exponents must be positive safe integers');
      }
      if (cell >= 3 && cell > game.highestCreatedExponent) {
        throw new TypeError('Board exponent exceeds the historical milestone');
      }
    }
  }
  if (typeof game.score !== 'bigint' || game.score < 0n) {
    throw new TypeError('Score must be a non-negative bigint');
  }
  if (game.status !== 'active' && game.status !== 'game-over') {
    throw new TypeError('Invalid game status');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCanonicalScore(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value);
}
