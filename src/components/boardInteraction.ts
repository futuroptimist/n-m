import {
  tileValue,
  type Cell,
  type Direction,
  type EngineEvent,
} from '../engine';

export const TOUCH_TILE_SIZE = 44;
export const TILE_GUTTER = 6;
export const BOARD_PADDING = 3;
export const MAX_ZOOM = 2.5;

const MIN_SWIPE_DISTANCE = 32;
const CARDINAL_DOMINANCE = 1.5;

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

export function swipeDirection(dx: number, dy: number): Direction | null {
  const horizontal = Math.abs(dx);
  const vertical = Math.abs(dy);
  if (
    horizontal >= MIN_SWIPE_DISTANCE &&
    horizontal >= vertical * CARDINAL_DOMINANCE
  ) {
    return dx > 0 ? 'right' : 'left';
  }
  if (
    vertical >= MIN_SWIPE_DISTANCE &&
    vertical >= horizontal * CARDINAL_DOMINANCE
  ) {
    return dy > 0 ? 'down' : 'up';
  }
  return null;
}

export function shouldCaptureBoardGesture(
  oversized: boolean,
  activeTouches: number,
  dx: number,
  dy: number,
): boolean {
  return (
    (oversized && activeTouches >= 2) ||
    (activeTouches === 1 && swipeDirection(dx, dy) !== null)
  );
}

export function needsViewport(
  contentSize: number,
  availableSize: number,
): boolean {
  return availableSize > 0 && contentSize > availableSize + 0.5;
}

export function minimumBoardSize(sideLength: number): number {
  return boardContentSize(sideLength, TOUCH_TILE_SIZE);
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

export function boardScaleBounds(
  sideLength: number,
  availableSize: number,
): { fit: number; touchFriendly: number; maximum: number } {
  if (availableSize <= 0)
    return { fit: 1, touchFriendly: 1, maximum: MAX_ZOOM };
  const fit = Math.min(
    MAX_ZOOM,
    Math.max(0.1, fittedTileSize(sideLength, availableSize) / TOUCH_TILE_SIZE),
  );
  return { fit, touchFriendly: Math.max(1, fit), maximum: MAX_ZOOM };
}

export function scaleMode(scale: number): 'overview' | 'touch-friendly' {
  return scale < 1 - 0.001 ? 'overview' : 'touch-friendly';
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
  zoom: number,
  position: ViewportPosition,
  sideLength: number,
  viewportSize: number,
): { zoom: number; position: ViewportPosition } {
  const bounds = boardScaleBounds(sideLength, viewportSize);
  const boundedZoom = Math.max(bounds.fit, Math.min(bounds.maximum, zoom));
  return {
    zoom: boundedZoom,
    position: clampViewport(
      position,
      boardContentSize(sideLength, TOUCH_TILE_SIZE * boundedZoom),
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
