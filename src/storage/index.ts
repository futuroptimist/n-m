import {
  deriveGrowth,
  ENGINE_SCHEMA_VERSION,
  type Cell,
  type GameState,
  type GameStatus,
} from '../engine';

export const GAME_STORAGE_KEY = 'n-m.current-run.v1';
export const SAVE_SCHEMA_VERSION = 1 as const;

export interface AsyncKeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type LoadResult =
  | { readonly kind: 'empty' }
  | { readonly kind: 'loaded'; readonly game: GameState }
  | {
      readonly kind: 'recovery';
      readonly reason: 'invalid' | 'newer-schema' | 'read-error';
    };

export type StorageResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'write-error' | 'clear-error' };

interface SavedGame {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  activeK: number;
  sideLength: number;
  board: Cell[][];
  highestCreatedExponent: number;
  score: string;
  status: GameStatus;
}

export function serializeGame(game: GameState): string {
  validateGame(game);
  const saved: SavedGame = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    activeK: game.activeK,
    sideLength: game.sideLength,
    board: game.board.map((row) => [...row]),
    highestCreatedExponent: game.highestCreatedExponent,
    score: game.score.toString(10),
    status: game.status,
  };
  return JSON.stringify(saved);
}

export function deserializeGame(serialized: string): GameState {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new Error('Saved game is not valid JSON');
  }
  if (!isRecord(value)) throw new Error('Saved game must be an object');
  if (value.schemaVersion !== SAVE_SCHEMA_VERSION) {
    throw new Error('Unsupported saved-game schema');
  }
  const score = value.score;
  if (typeof score !== 'string' || !/^(0|[1-9][0-9]*)$/.test(score)) {
    throw new Error('Saved score must be a canonical non-negative decimal');
  }
  const game: GameState = {
    schemaVersion: ENGINE_SCHEMA_VERSION,
    activeK: value.activeK as number,
    sideLength: value.sideLength as number,
    board: value.board as Cell[][],
    highestCreatedExponent: value.highestCreatedExponent as number,
    score: BigInt(score),
    status: value.status as GameStatus,
  };
  validateGame(game);
  return game;
}

export class GameStorage {
  private writes: Promise<void> = Promise.resolve();

  public constructor(private readonly store: AsyncKeyValueStore) {}

  public async load(): Promise<LoadResult> {
    let serialized: string | null;
    try {
      serialized = await this.store.getItem(GAME_STORAGE_KEY);
    } catch {
      return { kind: 'recovery', reason: 'read-error' };
    }
    if (serialized === null) return { kind: 'empty' };

    try {
      const parsed: unknown = JSON.parse(serialized);
      if (
        isRecord(parsed) &&
        typeof parsed.schemaVersion === 'number' &&
        parsed.schemaVersion > SAVE_SCHEMA_VERSION
      ) {
        return { kind: 'recovery', reason: 'newer-schema' };
      }
      return { kind: 'loaded', game: deserializeGame(serialized) };
    } catch {
      return { kind: 'recovery', reason: 'invalid' };
    }
  }

  public save(game: GameState): Promise<StorageResult> {
    const serialized = serializeGame(game);
    return this.enqueue(async () => {
      await this.store.setItem(GAME_STORAGE_KEY, serialized);
    }, 'write-error');
  }

  public clear(): Promise<StorageResult> {
    return this.enqueue(async () => {
      await this.store.removeItem(GAME_STORAGE_KEY);
    }, 'clear-error');
  }

  private enqueue(
    operation: () => Promise<void>,
    reason: 'write-error' | 'clear-error',
  ): Promise<StorageResult> {
    const result = this.writes.then(operation);
    this.writes = result.catch(() => undefined);
    return result.then(
      () => ({ ok: true }),
      () => ({ ok: false, reason }),
    );
  }
}

function validateGame(game: GameState): void {
  if (
    !Number.isInteger(game.activeK) ||
    game.activeK < 1 ||
    game.activeK > 10
  ) {
    throw new Error('Saved k is invalid');
  }
  if (
    !Number.isSafeInteger(game.highestCreatedExponent) ||
    game.highestCreatedExponent < 1
  ) {
    throw new Error('Saved highest exponent is invalid');
  }
  if (typeof game.score !== 'bigint' || game.score < 0n) {
    throw new Error('Saved score is invalid');
  }
  if (game.status !== 'active' && game.status !== 'game-over') {
    throw new Error('Saved status is invalid');
  }
  if (
    !Number.isSafeInteger(game.sideLength) ||
    game.sideLength < 1 ||
    !Array.isArray(game.board) ||
    game.board.length !== game.sideLength
  ) {
    throw new Error('Saved board dimensions are invalid');
  }
  for (const row of game.board) {
    if (!Array.isArray(row) || row.length !== game.sideLength) {
      throw new Error('Saved board must be square');
    }
    for (const cell of row) {
      if (cell === null) continue;
      if (!Number.isSafeInteger(cell) || cell < 1) {
        throw new Error('Saved tile exponent is invalid');
      }
      // Exponents 1 and 2 may be spawned before they have ever been merged.
      if (cell >= 3 && cell > game.highestCreatedExponent) {
        throw new Error('Saved tile exceeds the historical merge milestone');
      }
    }
  }
  if (
    game.sideLength !==
    deriveGrowth(game.highestCreatedExponent, game.activeK).sideLength
  ) {
    throw new Error('Saved board does not match its growth milestone');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
