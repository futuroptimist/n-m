import {
  deriveGrowth,
  ENGINE_SCHEMA_VERSION,
  type Cell,
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

export type LoadGameResult =
  | { readonly kind: 'empty' }
  | { readonly kind: 'loaded'; readonly game: GameState }
  | {
      readonly kind: 'recovery';
      readonly reason: 'invalid' | 'newer-version' | 'read-error';
    };

export type StorageOperationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'write-error' };

interface SavedGameV1 {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  activeK: number;
  sideLength: number;
  board: Cell[][];
  highestCreatedExponent: number;
  score: string;
  status: GameStatus;
}

export function serializeGame(game: GameState): string {
  const saved: SavedGameV1 = {
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

export function deserializeGame(value: string): GameState {
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed)) throw new Error('Saved game must be an object');
  if (parsed.schemaVersion !== SAVE_SCHEMA_VERSION) {
    throw new Error('Unsupported save schema version');
  }
  if (!isK(parsed.activeK)) throw new Error('Invalid activeK');
  if (!isPositiveSafeInteger(parsed.sideLength)) {
    throw new Error('Invalid sideLength');
  }
  if (!isExponent(parsed.highestCreatedExponent)) {
    throw new Error('Invalid highestCreatedExponent');
  }
  if (
    typeof parsed.score !== 'string' ||
    !/^(0|[1-9]\d*)$/.test(parsed.score)
  ) {
    throw new Error('Invalid score');
  }
  if (parsed.status !== 'active' && parsed.status !== 'game-over') {
    throw new Error('Invalid status');
  }
  const board = validateBoard(
    parsed.board,
    parsed.sideLength,
    parsed.highestCreatedExponent,
  );
  const growth = deriveGrowth(parsed.highestCreatedExponent, parsed.activeK);
  if (growth.sideLength !== parsed.sideLength) {
    throw new Error('Board dimensions do not match growth history');
  }
  return {
    schemaVersion: ENGINE_SCHEMA_VERSION,
    activeK: parsed.activeK,
    sideLength: parsed.sideLength,
    board,
    highestCreatedExponent: parsed.highestCreatedExponent,
    score: BigInt(parsed.score),
    status: parsed.status,
  };
}

export async function loadGame(
  store: AsyncKeyValueStore,
): Promise<LoadGameResult> {
  let saved: string | null;
  try {
    saved = await store.getItem(GAME_STORAGE_KEY);
  } catch {
    return { kind: 'recovery', reason: 'read-error' };
  }
  if (saved === null) return { kind: 'empty' };
  try {
    return { kind: 'loaded', game: deserializeGame(saved) };
  } catch {
    try {
      const parsed: unknown = JSON.parse(saved);
      if (
        isRecord(parsed) &&
        typeof parsed.schemaVersion === 'number' &&
        parsed.schemaVersion > SAVE_SCHEMA_VERSION
      ) {
        return { kind: 'recovery', reason: 'newer-version' };
      }
    } catch {
      // The common invalid-save result below handles malformed JSON.
    }
    return { kind: 'recovery', reason: 'invalid' };
  }
}

export async function clearGame(
  store: AsyncKeyValueStore,
): Promise<StorageOperationResult> {
  try {
    await store.removeItem(GAME_STORAGE_KEY);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'write-error' };
  }
}

export class SerializedGameWriter {
  private pending: Promise<void> = Promise.resolve();

  constructor(private readonly store: AsyncKeyValueStore) {}

  save(game: GameState): Promise<StorageOperationResult> {
    const serialized = serializeGame(game);
    const result = this.pending.then(
      async (): Promise<StorageOperationResult> => {
        try {
          await this.store.setItem(GAME_STORAGE_KEY, serialized);
          return { ok: true };
        } catch {
          return { ok: false, reason: 'write-error' };
        }
      },
    );
    this.pending = result.then(() => undefined);
    return result;
  }
}

function validateBoard(
  value: unknown,
  sideLength: number,
  highestCreatedExponent: number,
): Cell[][] {
  if (!Array.isArray(value) || value.length !== sideLength) {
    throw new Error('Invalid board dimensions');
  }
  return value.map((row) => {
    if (!Array.isArray(row) || row.length !== sideLength) {
      throw new Error('Board must be square');
    }
    return row.map((cell: unknown) => {
      if (cell === null) return null;
      if (!isExponent(cell)) throw new Error('Invalid board exponent');
      // Exponents 1 and 2 may be spawned. All higher tiles must have been made.
      if (cell >= 3 && cell > highestCreatedExponent) {
        throw new Error('Board exponent exceeds growth history');
      }
      return cell;
    });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isK(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 10;
}

function isExponent(value: unknown): value is number {
  return isPositiveSafeInteger(value);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}
