export const GAME_SCHEMA_VERSION = 1 as const;

export type TileExponent = number;
export type Cell = TileExponent | null;
export type Board = readonly (readonly Cell[])[];
export type Direction = 'up' | 'down' | 'left' | 'right';
export type GameStatus = 'playing' | 'game-over';
export type RandomSource = () => number;

export interface GameState {
  readonly schemaVersion: typeof GAME_SCHEMA_VERSION;
  readonly activeK: number;
  readonly board: Board;
  readonly sideLength: number;
  readonly highestCreatedExponent: number;
  readonly score: bigint;
  readonly status: GameStatus;
}

export interface Coordinate {
  readonly row: number;
  readonly column: number;
}

export type GameEvent =
  | {
      readonly type: 'merged';
      readonly exponent: number;
      readonly value: bigint;
    }
  | { readonly type: 'grew'; readonly from: number; readonly to: number }
  | ({ readonly type: 'spawned'; readonly exponent: number } & Coordinate)
  | { readonly type: 'game-over' };

export interface MoveResult {
  readonly state: GameState;
  readonly moved: boolean;
  readonly events: readonly GameEvent[];
}

export interface GrowthInfo {
  readonly expansionCount: number;
  readonly sideLength: number;
  readonly nextExpansionExponent: number;
  readonly nextExpansionTile: bigint;
}

interface CollapsedLine {
  readonly cells: Cell[];
  readonly mergedExponents: number[];
}

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

  for (let count = 0; count < 2; count += 1) {
    const emptyCells = findEmptyCells(board);
    const location = emptyCells[randomIndex(emptyCells.length, random)];
    board[location.row][location.column] = 1;
  }

  return {
    schemaVersion: GAME_SCHEMA_VERSION,
    activeK: k,
    board,
    sideLength: 2,
    highestCreatedExponent: 1,
    score: 0n,
    status: 'playing',
  };
}

export function moveGame(
  state: GameState,
  direction: Direction,
  random: RandomSource,
): MoveResult {
  const movedBoard = cloneBoard(state.board);
  const mergedExponents: number[] = [];

  for (let index = 0; index < state.sideLength; index += 1) {
    const coordinates = lineCoordinates(direction, index, state.sideLength);
    const line = coordinates.map(({ row, column }) => state.board[row][column]);
    const collapsed = collapseLine(line);
    mergedExponents.push(...collapsed.mergedExponents);
    coordinates.forEach(({ row, column }, cellIndex) => {
      movedBoard[row][column] = collapsed.cells[cellIndex];
    });
  }

  if (boardsEqual(state.board, movedBoard)) {
    return { state, moved: false, events: [] };
  }

  const events: GameEvent[] = mergedExponents.map((exponent) => ({
    type: 'merged',
    exponent,
    value: tileValue(exponent),
  }));
  const scoreIncrease = mergedExponents.reduce(
    (total, exponent) => total + tileValue(exponent),
    0n,
  );
  const highestCreatedExponent = Math.max(
    state.highestCreatedExponent,
    ...mergedExponents,
  );
  const requiredSize = deriveGrowth(
    highestCreatedExponent,
    state.activeK,
  ).sideLength;
  let board = growBoard(movedBoard, requiredSize);

  if (requiredSize > state.sideLength) {
    events.push({ type: 'grew', from: state.sideLength, to: requiredSize });
  }

  const emptyCells = findEmptyCells(board);
  const spawnAt = emptyCells[randomIndex(emptyCells.length, random)];
  const spawnExponent = readRandom(random) < 0.9 ? 1 : 2;
  board[spawnAt.row][spawnAt.column] = spawnExponent;
  events.push({ type: 'spawned', exponent: spawnExponent, ...spawnAt });

  const status = evaluateGameStatus(board);
  if (status === 'game-over') {
    events.push({ type: 'game-over' });
  }

  return {
    moved: true,
    events,
    state: {
      ...state,
      board,
      sideLength: board.length,
      highestCreatedExponent,
      score: state.score + scoreIncrease,
      status,
    },
  };
}

export function getAvailableMoves(board: Board): Direction[] {
  const directions: Direction[] = ['up', 'down', 'left', 'right'];
  return directions.filter((direction) => canMove(board, direction));
}

export function evaluateGameStatus(board: Board): GameStatus {
  return getAvailableMoves(board).length === 0 ? 'game-over' : 'playing';
}

function canMove(board: Board, direction: Direction): boolean {
  for (let index = 0; index < board.length; index += 1) {
    const coordinates = lineCoordinates(direction, index, board.length);
    const line = coordinates.map(({ row, column }) => board[row][column]);
    if (!cellsEqual(line, collapseLine(line).cells)) return true;
  }
  return false;
}

function collapseLine(line: readonly Cell[]): CollapsedLine {
  const compacted = line.filter((cell): cell is number => cell !== null);
  const cells: Cell[] = [];
  const mergedExponents: number[] = [];

  for (let index = 0; index < compacted.length; index += 1) {
    const exponent = compacted[index];
    if (exponent === compacted[index + 1]) {
      const mergedExponent = exponent + 1;
      cells.push(mergedExponent);
      mergedExponents.push(mergedExponent);
      index += 1;
    } else {
      cells.push(exponent);
    }
  }
  while (cells.length < line.length) cells.push(null);
  return { cells, mergedExponents };
}

function lineCoordinates(
  direction: Direction,
  index: number,
  size: number,
): Coordinate[] {
  return Array.from({ length: size }, (_, offset) => {
    switch (direction) {
      case 'left':
        return { row: index, column: offset };
      case 'right':
        return { row: index, column: size - 1 - offset };
      case 'up':
        return { row: offset, column: index };
      case 'down':
        return { row: size - 1 - offset, column: index };
    }
  });
}

function growBoard(board: Cell[][], requiredSize: number): Cell[][] {
  const size = Math.max(board.length, requiredSize);
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => board[row]?.[column] ?? null),
  );
}

function emptyBoard(size: number): Cell[][] {
  return Array.from({ length: size }, () => Array<Cell>(size).fill(null));
}

function cloneBoard(board: Board): Cell[][] {
  return board.map((row) => [...row]);
}

function findEmptyCells(board: Board): Coordinate[] {
  const emptyCells: Coordinate[] = [];
  board.forEach((row, rowIndex) =>
    row.forEach((cell, columnIndex) => {
      if (cell === null)
        emptyCells.push({ row: rowIndex, column: columnIndex });
    }),
  );
  return emptyCells;
}

function randomIndex(length: number, random: RandomSource): number {
  if (length === 0) throw new Error('Cannot choose from an empty collection');
  return Math.floor(readRandom(random) * length);
}

function readRandom(random: RandomSource): number {
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new RangeError('Random source must return a number in [0, 1)');
  }
  return sample;
}

function assertK(k: number): void {
  if (!Number.isInteger(k) || k < 1 || k > 10) {
    throw new RangeError('k must be an integer from 1 through 10');
  }
}

function assertExponent(exponent: number): void {
  if (!Number.isSafeInteger(exponent) || exponent < 1) {
    throw new RangeError('Tile exponent must be a positive safe integer');
  }
}

function cellsEqual(a: readonly Cell[], b: readonly Cell[]): boolean {
  return a.every((cell, index) => cell === b[index]);
}

function boardsEqual(a: Board, b: Board): boolean {
  return (
    a.length === b.length && a.every((row, index) => cellsEqual(row, b[index]))
  );
}
