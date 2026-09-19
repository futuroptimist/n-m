import {
  ENGINE_SCHEMA_VERSION,
  deriveGrowth,
  isGameOver,
  type Board,
  type GameState,
  type GameStatus,
} from '../engine';

export const GAME_STORAGE_KEY = 'n-m.current-run';
export const SAVE_SCHEMA_VERSION = 1 as const;

export interface AsyncKeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type RecoveryReason = 'invalid' | 'newer-version' | 'read-error';

export type LoadResult =
  | { readonly type: 'empty' }
  | { readonly type: 'restored'; readonly game: GameState }
  | { readonly type: 'recovery'; readonly reason: RecoveryReason };

interface SavedGameV1 {
  readonly schemaVersion: typeof SAVE_SCHEMA_VERSION;
  readonly activeK: number;
  readonly sideLength: number;
  readonly board: Board;
  readonly highestCreatedExponent: number;
  readonly score: string;
  readonly status: GameStatus;
}

export class StorageOperationError extends Error {
  constructor(
    readonly operation: 'write' | 'clear',
    options: { cause: unknown },
  ) {
    super(
      `Failed to ${operation === 'write' ? 'save' : 'clear'} game`,
      options,
    );
    this.name = 'StorageOperationError';
  }
}

export function serializeGame(game: GameState): string {
  // Deserializing our own representation applies the same validation used for
  // untrusted stored data and prevents writing an invalid engine state.
  const saved: SavedGameV1 = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    activeK: game.activeK,
    sideLength: game.sideLength,
    board: game.board,
    highestCreatedExponent: game.highestCreatedExponent,
    score: game.score.toString(10),
    status: game.status,
  };
  const serialized = JSON.stringify(saved);
  deserializeGame(serialized);
  return serialized;
}

export function deserializeGame(serialized: string): GameState {
  const value: unknown = JSON.parse(serialized);
  if (!isRecord(value)) throw new Error('Saved game must be an object');
  if (value.schemaVersion !== SAVE_SCHEMA_VERSION) {
    throw new Error('Unsupported save schema version');
  }

  const { activeK, sideLength, highestCreatedExponent, score, status } = value;
  if (
    typeof activeK !== 'number' ||
    !Number.isInteger(activeK) ||
    activeK < 1 ||
    activeK > 10
  ) {
    throw new Error('Invalid activeK');
  }
  if (
    typeof sideLength !== 'number' ||
    !Number.isSafeInteger(sideLength) ||
    sideLength < 2
  ) {
    throw new Error('Invalid sideLength');
  }
  if (
    typeof highestCreatedExponent !== 'number' ||
    !Number.isSafeInteger(highestCreatedExponent) ||
    highestCreatedExponent < 1
  ) {
    throw new Error('Invalid highestCreatedExponent');
  }
  if (typeof score !== 'string' || !/^(0|[1-9]\d*)$/.test(score)) {
    throw new Error('Invalid score');
  }
  if (status !== 'active' && status !== 'game-over') {
    throw new Error('Invalid status');
  }
  if (!Array.isArray(value.board) || value.board.length !== sideLength) {
    throw new Error('Invalid board dimensions');
  }
  for (const row of value.board) {
    if (!Array.isArray(row) || row.length !== sideLength) {
      throw new Error('Invalid board dimensions');
    }
    for (const cell of row) {
      if (cell === null) continue;
      if (!Number.isSafeInteger(cell) || cell < 1) {
        throw new Error('Invalid board exponent');
      }
      if (cell >= 3 && cell > highestCreatedExponent) {
        throw new Error('Board exponent exceeds the historical milestone');
      }
    }
  }
  if (
    deriveGrowth(highestCreatedExponent as number, activeK as number)
      .sideLength !== sideLength
  ) {
    throw new Error('Board dimensions violate the growth invariant');
  }
  if ((status === 'game-over') !== isGameOver(value.board as Board)) {
    throw new Error('Status does not match the board');
  }

  return {
    schemaVersion: ENGINE_SCHEMA_VERSION,
    activeK: activeK as number,
    sideLength: sideLength as number,
    board: value.board as Board,
    highestCreatedExponent: highestCreatedExponent as number,
    score: BigInt(score),
    status,
  };
}

export class GameStorage {
  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly store: AsyncKeyValueStore) {}

  async load(): Promise<LoadResult> {
    let serialized: string | null;
    try {
      serialized = await this.store.getItem(GAME_STORAGE_KEY);
    } catch {
      return { type: 'recovery', reason: 'read-error' };
    }
    if (serialized === null) return { type: 'empty' };

    try {
      const parsed: unknown = JSON.parse(serialized);
      if (
        isRecord(parsed) &&
        typeof parsed.schemaVersion === 'number' &&
        parsed.schemaVersion > SAVE_SCHEMA_VERSION
      ) {
        return { type: 'recovery', reason: 'newer-version' };
      }
      return { type: 'restored', game: deserializeGame(serialized) };
    } catch {
      return { type: 'recovery', reason: 'invalid' };
    }
  }

  save(game: GameState): Promise<void> {
    const serialized = serializeGame(game);
    const write = this.writes.then(() =>
      this.store.setItem(GAME_STORAGE_KEY, serialized),
    );
    this.writes = write.catch(() => undefined);
    return write.catch((cause: unknown) => {
      throw new StorageOperationError('write', { cause });
    });
  }

  clear(): Promise<void> {
    const clear = this.writes.then(() =>
      this.store.removeItem(GAME_STORAGE_KEY),
    );
    this.writes = clear.catch(() => undefined);
    return clear.catch((cause: unknown) => {
      throw new StorageOperationError('clear', { cause });
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
