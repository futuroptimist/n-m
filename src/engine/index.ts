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
  readonly transitions: readonly TileTransition[];
}

export interface TileTransition {
  readonly from: { readonly row: number; readonly column: number };
  readonly to: { readonly row: number; readonly column: number };
  readonly exponent: TileExponent;
  readonly merged: boolean;
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
  assertGameState(state);
  const size = state.board.length;
  const output = emptyBoard(size);
  const mergedExponents: number[] = [];
  const transitions: TileTransition[] = [];
  let changed = false;

  for (let lineIndex = 0; lineIndex < size; lineIndex += 1) {
    const original = readLine(state.board, direction, lineIndex);
    const { line, merges, movements } = collapseLine(original);
    if (line.some((cell, index) => cell !== original[index])) changed = true;
    mergedExponents.push(...merges);
    writeLine(output, direction, lineIndex, line);
    for (const movement of movements) {
      transitions.push({
        from: lineCoordinate(direction, lineIndex, movement.from, size),
        to: lineCoordinate(direction, lineIndex, movement.to, size),
        exponent: movement.exponent,
        merged: movement.merged,
      });
    }
  }

  if (!changed) return { state, moved: false, events: [], transitions: [] };

  let highestCreatedExponent = state.highestCreatedExponent;
  const mergeEvents: Extract<EngineEvent, { type: 'merge' }>[] = [];
  let scoreIncrease = 0n;
  for (const mergedExponent of mergedExponents) {
    highestCreatedExponent = Math.max(highestCreatedExponent, mergedExponent);
    const value = tileValue(mergedExponent);
    mergeEvents.push({ type: 'merge', exponent: mergedExponent, value });
    scoreIncrease += value;
  }
  const targetSize = Math.max(
    size,
    deriveGrowth(highestCreatedExponent, state.activeK).sideLength,
  );
  const grown = growBoard(output, targetSize);
  const exponent = randomSample(random) < 0.9 ? 1 : 2;
  const spawned = spawn(grown, exponent, random);
  const status: GameStatus = isGameOver(spawned.board) ? 'game-over' : 'active';
  const events: EngineEvent[] = [{ type: 'move', direction }, ...mergeEvents];
  if (targetSize > size)
    events.push({ type: 'growth', from: size, to: targetSize });
  events.push({ type: 'spawn', ...spawned.position, exponent });
  if (status === 'game-over') events.push({ type: 'game-over' });

  return {
    moved: true,
    events,
    transitions,
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
  assertBoard(board);
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
  movements: {
    from: number;
    to: number;
    exponent: TileExponent;
    merged: boolean;
  }[];
} {
  const tiles = line.flatMap((cell, index) =>
    cell === null ? [] : [{ exponent: cell, index }],
  );
  const result: Cell[] = [];
  const merges: number[] = [];
  const movements: {
    from: number;
    to: number;
    exponent: TileExponent;
    merged: boolean;
  }[] = [];
  for (let index = 0; index < tiles.length; index += 1) {
    const destination = result.length;
    if (tiles[index].exponent === tiles[index + 1]?.exponent) {
      const exponent = tiles[index].exponent + 1;
      result.push(exponent);
      merges.push(exponent);
      movements.push(
        {
          from: tiles[index].index,
          to: destination,
          exponent: tiles[index].exponent,
          merged: true,
        },
        {
          from: tiles[index + 1].index,
          to: destination,
          exponent: tiles[index + 1].exponent,
          merged: true,
        },
      );
      index += 1;
    } else {
      result.push(tiles[index].exponent);
      movements.push({
        from: tiles[index].index,
        to: destination,
        exponent: tiles[index].exponent,
        merged: false,
      });
    }
  }
  while (result.length < line.length) result.push(null);
  return { line: result, merges, movements };
}

function lineCoordinate(
  direction: Direction,
  line: number,
  offset: number,
  size: number,
): { row: number; column: number } {
  if (direction === 'left') return { row: line, column: offset };
  if (direction === 'right') return { row: line, column: size - 1 - offset };
  if (direction === 'up') return { row: offset, column: line };
  return { row: size - 1 - offset, column: line };
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

function assertBoard(
  board: Board,
  expectedSideLength?: number,
  highestCreatedExponent?: number,
): void {
  if (!Array.isArray(board) || board.length === 0) {
    throw new RangeError('Board must be a non-empty square array');
  }
  const sideLength = board.length;
  if (
    expectedSideLength !== undefined &&
    (!Number.isSafeInteger(expectedSideLength) ||
      expectedSideLength < 1 ||
      expectedSideLength !== sideLength)
  ) {
    throw new RangeError('Board dimensions must match sideLength');
  }
  for (const row of board) {
    if (!Array.isArray(row) || row.length !== sideLength) {
      throw new RangeError('Board must be square');
    }
    for (const cell of row) {
      if (cell === null) continue;
      assertExponent(cell);
      if (
        highestCreatedExponent !== undefined &&
        cell >= 3 &&
        cell > highestCreatedExponent
      ) {
        throw new RangeError(
          'Board exponent cannot exceed highestCreatedExponent',
        );
      }
    }
  }
}

function assertGameState(state: GameState): void {
  if (state === null || typeof state !== 'object') {
    throw new TypeError('State must be an object');
  }
  if (state.schemaVersion !== ENGINE_SCHEMA_VERSION) {
    throw new RangeError('Unsupported engine schema version');
  }
  assertK(state.activeK);
  assertExponent(state.highestCreatedExponent);
  if (typeof state.score !== 'bigint' || state.score < 0n) {
    throw new RangeError('Score must be a non-negative bigint');
  }
  assertBoard(state.board, state.sideLength, state.highestCreatedExponent);
  if (
    state.sideLength !==
    deriveGrowth(state.highestCreatedExponent, state.activeK).sideLength
  ) {
    throw new RangeError(
      'sideLength must match growth derived from highestCreatedExponent and activeK',
    );
  }
}
