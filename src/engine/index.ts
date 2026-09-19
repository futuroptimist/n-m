export const ENGINE_SCHEMA_VERSION = 1 as const;
export const MIN_K = 1;
export const MAX_K = 10;

export type TileExponent = number;
export type Cell = TileExponent | null;
export type Board = readonly (readonly Cell[])[];
export type Direction = 'up' | 'down' | 'left' | 'right';
export type GameStatus = 'active' | 'game_over';
export type RandomSource = () => number;

export interface GameState {
  readonly schemaVersion: typeof ENGINE_SCHEMA_VERSION;
  readonly activeK: number;
  readonly sideLength: number;
  readonly board: Board;
  readonly highestCreatedExponent: number;
  readonly score: bigint;
  readonly status: GameStatus;
}

export interface GrowthInfo {
  readonly expansionCount: number;
  readonly sideLength: number;
  readonly nextExpansionExponent: number;
  readonly nextExpansionTile: bigint;
}

export type GameEvent =
  | { readonly type: 'moved'; readonly direction: Direction }
  | {
      readonly type: 'merged';
      readonly exponent: number;
      readonly score: bigint;
    }
  | { readonly type: 'grew'; readonly from: number; readonly to: number }
  | {
      readonly type: 'spawned';
      readonly row: number;
      readonly column: number;
      readonly exponent: 1 | 2;
    }
  | { readonly type: 'game_over' };

export interface MoveResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

export function tileValue(exponent: number): bigint {
  assertExponent(exponent);
  return 2n ** BigInt(exponent);
}

export function deriveGrowth(
  highestCreatedExponent: number,
  k: number,
): GrowthInfo {
  assertExponent(highestCreatedExponent);
  assertK(k);
  const expansionCount = Math.floor((highestCreatedExponent - 1) / k);
  const nextExpansionExponent = 1 + k * (expansionCount + 1);

  return {
    expansionCount,
    sideLength: 2 + expansionCount,
    nextExpansionExponent,
    nextExpansionTile: tileValue(nextExpansionExponent),
  };
}

export function createGame(k: number, random: RandomSource): GameState {
  assertK(k);
  let board: Cell[][] = emptyBoard(2);
  board = spawn(board, 1, random).board;
  board = spawn(board, 1, random).board;

  return {
    schemaVersion: ENGINE_SCHEMA_VERSION,
    activeK: k,
    sideLength: 2,
    board,
    highestCreatedExponent: 1,
    score: 0n,
    status: 'active',
  };
}

export function move(
  state: GameState,
  direction: Direction,
  random: RandomSource,
): MoveResult {
  const movement = moveBoard(state.board, direction);
  if (!movement.changed) {
    return { state, events: [] };
  }

  const highestCreatedExponent = Math.max(
    state.highestCreatedExponent,
    ...movement.mergedExponents,
  );
  const targetSize = deriveGrowth(
    highestCreatedExponent,
    state.activeK,
  ).sideLength;
  let board = growBoard(movement.board, targetSize);
  const events: GameEvent[] = [
    { type: 'moved', direction },
    ...movement.mergedExponents.map((exponent) => ({
      type: 'merged' as const,
      exponent,
      score: tileValue(exponent),
    })),
  ];

  if (targetSize > state.sideLength) {
    events.push({ type: 'grew', from: state.sideLength, to: targetSize });
  }

  const exponent = randomSample(random) < 0.9 ? 1 : 2;
  const spawned = spawn(board, exponent, random);
  board = spawned.board;
  events.push({ type: 'spawned', ...spawned.position, exponent });

  const status = evaluateStatus(board);
  if (status === 'game_over') {
    events.push({ type: 'game_over' });
  }

  return {
    state: {
      schemaVersion: ENGINE_SCHEMA_VERSION,
      activeK: state.activeK,
      sideLength: targetSize,
      board,
      highestCreatedExponent,
      score:
        state.score +
        movement.mergedExponents.reduce(
          (total, mergedExponent) => total + tileValue(mergedExponent),
          0n,
        ),
      status,
    },
    events,
  };
}

export function getAvailableMoves(board: Board): readonly Direction[] {
  return DIRECTIONS.filter((direction) => moveBoard(board, direction).changed);
}

export function evaluateStatus(board: Board): GameStatus {
  return getAvailableMoves(board).length === 0 ? 'game_over' : 'active';
}

function moveBoard(
  board: Board,
  direction: Direction,
): {
  board: Cell[][];
  changed: boolean;
  mergedExponents: number[];
} {
  const size = board.length;
  const result = emptyBoard(size);
  const mergedExponents: number[] = [];

  for (let lineIndex = 0; lineIndex < size; lineIndex += 1) {
    const cells = Array.from({ length: size }, (_, offset) => {
      const [row, column] = coordinate(direction, lineIndex, offset, size);
      return board[row]?.[column] ?? null;
    }).filter((cell): cell is number => cell !== null);
    const merged: number[] = [];

    for (let index = 0; index < cells.length; index += 1) {
      if (cells[index] === cells[index + 1]) {
        const exponent = cells[index] + 1;
        merged.push(exponent);
        mergedExponents.push(exponent);
        index += 1;
      } else {
        merged.push(cells[index]);
      }
    }

    merged.forEach((cell, offset) => {
      const [row, column] = coordinate(direction, lineIndex, offset, size);
      result[row][column] = cell;
    });
  }

  return {
    board: result,
    changed: !boardsEqual(board, result),
    mergedExponents,
  };
}

function coordinate(
  direction: Direction,
  line: number,
  offset: number,
  size: number,
): readonly [number, number] {
  switch (direction) {
    case 'left':
      return [line, offset];
    case 'right':
      return [line, size - 1 - offset];
    case 'up':
      return [offset, line];
    case 'down':
      return [size - 1 - offset, line];
  }
}

function growBoard(board: Board, targetSize: number): Cell[][] {
  return Array.from({ length: targetSize }, (_, row) =>
    Array.from(
      { length: targetSize },
      (_, column) => board[row]?.[column] ?? null,
    ),
  );
}

function spawn(
  board: Board,
  exponent: 1 | 2,
  random: RandomSource,
): { board: Cell[][]; position: { row: number; column: number } } {
  const empty: { row: number; column: number }[] = [];
  board.forEach((row, rowIndex) =>
    row.forEach((cell, columnIndex) => {
      if (cell === null) empty.push({ row: rowIndex, column: columnIndex });
    }),
  );
  if (empty.length === 0) throw new Error('Cannot spawn on a full board.');

  const position = empty[Math.floor(randomSample(random) * empty.length)];
  const copy = board.map((row) => [...row]);
  copy[position.row][position.column] = exponent;
  return { board: copy, position };
}

function randomSample(random: RandomSource): number {
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new RangeError(
      'Random source must return a number from 0 (inclusive) to 1 (exclusive).',
    );
  }
  return sample;
}

function emptyBoard(size: number): Cell[][] {
  return Array.from({ length: size }, () => Array<Cell>(size).fill(null));
}

function boardsEqual(left: Board, right: Board): boolean {
  return left.every((row, rowIndex) =>
    row.every((cell, columnIndex) => cell === right[rowIndex]?.[columnIndex]),
  );
}

function assertK(k: number): void {
  if (!Number.isInteger(k) || k < MIN_K || k > MAX_K) {
    throw new RangeError(
      `k must be an integer from ${MIN_K} through ${MAX_K}.`,
    );
  }
}

function assertExponent(exponent: number): void {
  if (!Number.isSafeInteger(exponent) || exponent < 1) {
    throw new RangeError('Tile exponents must be positive safe integers.');
  }
}
