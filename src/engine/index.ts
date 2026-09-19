export const ENGINE_SCHEMA_VERSION = 1 as const;

export type TileExponent = number;
export type Cell = TileExponent | null;
export type Board = readonly (readonly Cell[])[];
export type Direction = 'up' | 'down' | 'left' | 'right';
export type GameStatus = 'active' | 'game-over';
export type RandomSource = () => number;

export interface GameState {
  readonly schemaVersion: typeof ENGINE_SCHEMA_VERSION;
  readonly activeK: number;
  readonly sideLength: number;
  readonly board: Board;
  readonly highestCreatedExponent: TileExponent;
  readonly score: bigint;
  readonly status: GameStatus;
}

export interface GrowthInfo {
  readonly expansionCount: number;
  readonly sideLength: number;
  readonly nextExpansionExponent: TileExponent;
  readonly nextExpansionTile: bigint;
}

export type EngineEvent =
  | { readonly type: 'move'; readonly direction: Direction }
  | {
      readonly type: 'merge';
      readonly exponent: TileExponent;
      readonly value: bigint;
    }
  | { readonly type: 'growth'; readonly from: number; readonly to: number }
  | {
      readonly type: 'spawn';
      readonly row: number;
      readonly column: number;
      readonly exponent: 1 | 2;
    }
  | { readonly type: 'game-over' };

export interface MoveResult {
  readonly state: GameState;
  readonly moved: boolean;
  readonly events: readonly EngineEvent[];
}

export function tileValue(exponent: TileExponent): bigint {
  assertExponent(exponent);
  return 2n ** BigInt(exponent);
}

export function deriveGrowth(
  highestCreatedExponent: TileExponent,
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
  const size = state.board.length;
  const output = emptyBoard(size);
  const mergedExponents: number[] = [];
  let changed = false;

  for (let lineIndex = 0; lineIndex < size; lineIndex += 1) {
    const original = readLine(state.board, direction, lineIndex);
    const { line, merges } = collapseLine(original);
    if (line.some((cell, index) => cell !== original[index])) changed = true;
    mergedExponents.push(...merges);
    writeLine(output, direction, lineIndex, line);
  }

  if (!changed) return { state, moved: false, events: [] };

  const highestCreatedExponent = Math.max(
    state.highestCreatedExponent,
    ...mergedExponents,
  );
  const targetSize = Math.max(
    size,
    deriveGrowth(highestCreatedExponent, state.activeK).sideLength,
  );
  const grown = growBoard(output, targetSize);
  const exponent = randomSample(random) < 0.9 ? 1 : 2;
  const spawned = spawn(grown, exponent, random);
  const scoreIncrease = mergedExponents.reduce(
    (total, value) => total + tileValue(value),
    0n,
  );
  const status: GameStatus = isGameOver(spawned.board) ? 'game-over' : 'active';
  const events: EngineEvent[] = [
    { type: 'move', direction },
    ...mergedExponents.map((value): EngineEvent => ({
      type: 'merge',
      exponent: value,
      value: tileValue(value),
    })),
  ];
  if (targetSize > size)
    events.push({ type: 'growth', from: size, to: targetSize });
  events.push({ type: 'spawn', ...spawned.position, exponent });
  if (status === 'game-over') events.push({ type: 'game-over' });

  return {
    moved: true,
    events,
    state: {
      ...state,
      sideLength: targetSize,
      board: spawned.board,
      highestCreatedExponent,
      score: state.score + scoreIncrease,
      status,
    },
  };
}

export function availableMoves(board: Board): Direction[] {
  return (['up', 'down', 'left', 'right'] as const).filter((direction) =>
    canMove(board, direction),
  );
}

export function isGameOver(board: Board): boolean {
  return availableMoves(board).length === 0;
}

function canMove(board: Board, direction: Direction): boolean {
  for (let index = 0; index < board.length; index += 1) {
    const line = readLine(board, direction, index);
    if (
      collapseLine(line).line.some(
        (cell, cellIndex) => cell !== line[cellIndex],
      )
    )
      return true;
  }
  return false;
}

function collapseLine(line: readonly Cell[]): {
  line: Cell[];
  merges: number[];
} {
  const tiles = line.filter((cell): cell is number => cell !== null);
  const result: Cell[] = [];
  const merges: number[] = [];
  for (let index = 0; index < tiles.length; index += 1) {
    if (tiles[index] === tiles[index + 1]) {
      const exponent = tiles[index] + 1;
      result.push(exponent);
      merges.push(exponent);
      index += 1;
    } else {
      result.push(tiles[index]);
    }
  }
  while (result.length < line.length) result.push(null);
  return { line: result, merges };
}

function readLine(board: Board, direction: Direction, line: number): Cell[] {
  const size = board.length;
  return Array.from({ length: size }, (_, offset) => {
    if (direction === 'left') return board[line][offset];
    if (direction === 'right') return board[line][size - 1 - offset];
    if (direction === 'up') return board[offset][line];
    return board[size - 1 - offset][line];
  });
}

function writeLine(
  board: Cell[][],
  direction: Direction,
  line: number,
  cells: Cell[],
): void {
  const size = board.length;
  cells.forEach((cell, offset) => {
    if (direction === 'left') board[line][offset] = cell;
    else if (direction === 'right') board[line][size - 1 - offset] = cell;
    else if (direction === 'up') board[offset][line] = cell;
    else board[size - 1 - offset][line] = cell;
  });
}

function emptyBoard(size: number): Cell[][] {
  return Array.from({ length: size }, () => Array<Cell>(size).fill(null));
}

function growBoard(board: Board, size: number): Cell[][] {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => board[row]?.[column] ?? null),
  );
}

function spawn(
  board: Board,
  exponent: 1 | 2,
  random: RandomSource,
): { board: Cell[][]; position: { row: number; column: number } } {
  const empty: { row: number; column: number }[] = [];
  board.forEach((row, rowIndex) =>
    row.forEach((cell, column) => {
      if (cell === null) empty.push({ row: rowIndex, column });
    }),
  );
  if (empty.length === 0)
    throw new Error('Cannot spawn a tile on a full board');
  const position = empty[Math.floor(randomSample(random) * empty.length)];
  const copy = board.map((row) => [...row]);
  copy[position.row][position.column] = exponent;
  return { board: copy, position };
}

function randomSample(random: RandomSource): number {
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new RangeError('Random source must return a finite number in [0, 1)');
  }
  return sample;
}

function assertK(k: number): void {
  if (!Number.isInteger(k) || k < 1 || k > 10)
    throw new RangeError('k must be an integer from 1 through 10');
}

function assertExponent(exponent: number): void {
  if (!Number.isSafeInteger(exponent) || exponent < 1) {
    throw new RangeError('Tile exponent must be a positive safe integer');
  }
}
