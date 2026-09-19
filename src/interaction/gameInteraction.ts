import { tileValue, type Board, type EngineEvent } from '../engine';

export const MIN_TILE_SIZE = 44;
export const MAX_VIEWPORT_ZOOM = 3;

export interface ViewportTransform {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

export interface VisibleRange {
  readonly firstRow: number;
  readonly lastRow: number;
  readonly firstColumn: number;
  readonly lastColumn: number;
}

export function usesClippedViewport(
  viewportSize: number,
  sideLength: number,
): boolean {
  return viewportSize / sideLength < MIN_TILE_SIZE;
}

export function baseTileSize(viewportSize: number, sideLength: number): number {
  return usesClippedViewport(viewportSize, sideLength)
    ? MIN_TILE_SIZE
    : viewportSize / sideLength;
}

export function clampViewport(
  transform: ViewportTransform,
  viewportSize: number,
  boardSize: number,
): ViewportTransform {
  const scale = Math.min(MAX_VIEWPORT_ZOOM, Math.max(1, transform.scale));
  const scaledBoard = boardSize * scale;
  const minimumOffset = Math.min(0, viewportSize - scaledBoard);
  return {
    scale,
    x: Math.min(0, Math.max(minimumOffset, transform.x)),
    y: Math.min(0, Math.max(minimumOffset, transform.y)),
  };
}

export function visibleRange(
  transform: ViewportTransform,
  viewportSize: number,
  tileSize: number,
  sideLength: number,
): VisibleRange {
  const scaledTile = tileSize * transform.scale;
  const firstColumn = Math.max(0, Math.floor(-transform.x / scaledTile));
  const firstRow = Math.max(0, Math.floor(-transform.y / scaledTile));
  return {
    firstRow,
    lastRow: Math.min(
      sideLength - 1,
      Math.ceil((viewportSize - transform.y) / scaledTile) - 1,
    ),
    firstColumn,
    lastColumn: Math.min(
      sideLength - 1,
      Math.ceil((viewportSize - transform.x) / scaledTile) - 1,
    ),
  };
}

export function visibleEdges(range: VisibleRange, sideLength: number): string {
  const edges = [
    range.firstRow === 0 ? 'top' : null,
    range.lastRow === sideLength - 1 ? 'bottom' : null,
    range.firstColumn === 0 ? 'left' : null,
    range.lastColumn === sideLength - 1 ? 'right' : null,
  ].filter((edge): edge is string => edge !== null);
  return `Visible rows ${range.firstRow + 1}–${range.lastRow + 1} and columns ${range.firstColumn + 1}–${range.lastColumn + 1}. Board edges visible: ${edges.length === 0 ? 'none' : edges.join(', ')}.`;
}

export function cellDescription(
  board: Board,
  row: number,
  column: number,
): string {
  const exponent = board[row]?.[column];
  const value = exponent == null ? 'empty' : tileValue(exponent).toString();
  return `Row ${row + 1}, column ${column + 1}: ${value}`;
}

export function moveAnnouncement(
  events: readonly EngineEvent[],
): string | null {
  if (events.some((event) => event.type === 'game-over')) return 'Game over.';
  const growth = events.find(
    (event): event is Extract<EngineEvent, { type: 'growth' }> =>
      event.type === 'growth',
  );
  const mergeScore = events.reduce(
    (total, event) => total + (event.type === 'merge' ? event.value : 0n),
    0n,
  );
  if (growth !== undefined) {
    const merge =
      mergeScore > 0n ? `Merged. Score increased by ${mergeScore}. ` : '';
    return `${merge}Board grew from ${growth.from} by ${growth.from} to ${growth.to} by ${growth.to}.`;
  }
  return mergeScore > 0n ? `Merged. Score increased by ${mergeScore}.` : null;
}
