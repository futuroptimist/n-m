import { tileValue, type Cell, type EngineEvent } from '../engine';

export const MIN_TILE_SIZE = 44;
export const TILE_GUTTER = 6;
export const BOARD_PADDING = 3;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 2.5;

export interface ViewportPosition {
  readonly x: number;
  readonly y: number;
}

export interface VisibleEdges {
  readonly top: boolean;
  readonly right: boolean;
  readonly bottom: boolean;
  readonly left: boolean;
}

export function needsViewport(
  sideLength: number,
  availableSize: number,
): boolean {
  return availableSize > 0 && minimumBoardSize(sideLength) > availableSize;
}

export function minimumBoardSize(sideLength: number): number {
  return boardContentSize(sideLength, MIN_TILE_SIZE);
}

export function boardContentSize(
  sideLength: number,
  renderedTileSize: number,
): number {
  return sideLength * (renderedTileSize + TILE_GUTTER) + BOARD_PADDING * 2;
}

export function fittedTileSize(
  sideLength: number,
  availableSize: number,
): number {
  return (availableSize - BOARD_PADDING * 2) / sideLength - TILE_GUTTER;
}

export function clampViewport(
  position: ViewportPosition,
  contentSize: number,
  viewportSize: number,
): ViewportPosition {
  const minimum = Math.min(0, viewportSize - contentSize);
  return {
    x: Math.max(minimum, Math.min(0, position.x)),
    y: Math.max(minimum, Math.min(0, position.y)),
  };
}

export function normalizeViewport(
  oversized: boolean,
  zoom: number,
  position: ViewportPosition,
  sideLength: number,
  viewportSize: number,
): { zoom: number; position: ViewportPosition } {
  if (!oversized) {
    return { zoom: MIN_ZOOM, position: { x: 0, y: 0 } };
  }
  const boundedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  return {
    zoom: boundedZoom,
    position: clampViewport(
      position,
      boardContentSize(sideLength, MIN_TILE_SIZE * boundedZoom),
      viewportSize,
    ),
  };
}

export function visibleEdges(
  position: ViewportPosition,
  contentSize: number,
  viewportSize: number,
): VisibleEdges {
  const epsilon = 0.5;
  return {
    top: position.y >= -epsilon,
    left: position.x >= -epsilon,
    right: position.x <= viewportSize - contentSize + epsilon,
    bottom: position.y <= viewportSize - contentSize + epsilon,
  };
}

export function edgeDescription(edges: VisibleEdges): string {
  const edgeOrder: readonly (keyof VisibleEdges)[] = [
    'top',
    'right',
    'bottom',
    'left',
  ];
  const visible = edgeOrder.filter((edge) => edges[edge]);
  return visible.length === 0
    ? 'Board interior visible; no board edges visible'
    : `Visible board edges: ${visible.join(', ')}`;
}

export function cellDescription(
  cell: Cell,
  rowIndex: number,
  columnIndex: number,
): string {
  const contents = cell === null ? 'empty' : tileValue(cell).toString();
  return `Row ${rowIndex + 1}, column ${columnIndex + 1}: ${contents}`;
}

export function selectMoveAnnouncement(
  events: readonly EngineEvent[],
): string | null {
  if (events.some((event) => event.type === 'game-over')) return 'Game over';

  const growth = events.find((event) => event.type === 'growth');
  const scoreIncrease = events.reduce(
    (total, event) => total + (event.type === 'merge' ? event.value : 0n),
    0n,
  );
  if (growth?.type === 'growth') {
    const growthMessage = `Board grew from ${growth.from} by ${growth.from} to ${growth.to} by ${growth.to}`;
    return scoreIncrease > 0n
      ? `${growthMessage}. Merge scored ${scoreIncrease.toString()} points`
      : growthMessage;
  }
  return scoreIncrease > 0n
    ? `Merge scored ${scoreIncrease.toString()} points`
    : null;
}
