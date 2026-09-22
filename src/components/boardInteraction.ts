import {
  tileValue,
  type Cell,
  type Direction,
  type EngineEvent,
  type TileTransition,
} from '../engine';

export const TOUCH_TILE_SIZE = 44;
export const TILE_GUTTER = 6;
export const BOARD_PADDING = 3;
export const FIT_ZOOM = 1;
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

export function touchFriendlyZoom(
  sideLength: number,
  availableSize: number,
): number {
  const fitted = fittedTileSize(sideLength, availableSize);
  return fitted <= 0 ? FIT_ZOOM : Math.max(FIT_ZOOM, TOUCH_TILE_SIZE / fitted);
}

export function maximumZoom(sideLength: number, availableSize: number): number {
  return Math.max(MAX_ZOOM, touchFriendlyZoom(sideLength, availableSize));
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
  const boundedZoom = Math.max(
    FIT_ZOOM,
    Math.min(maximumZoom(sideLength, viewportSize), zoom),
  );
  const fittedSize = Math.max(0, fittedTileSize(sideLength, viewportSize));
  return {
    zoom: boundedZoom,
    position: clampViewport(
      position,
      boardContentSize(sideLength, fittedSize * boundedZoom),
      viewportSize,
    ),
  };
}

export interface TileMotion {
  readonly key: string;
  readonly exponent: number;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly merges: boolean;
}

export function planTileMotion(
  transitions: readonly TileTransition[],
  tileSize: number,
): TileMotion[] {
  const step = tileSize + TILE_GUTTER;
  return transitions.map((transition, index) => ({
    key: `${transition.from.row}:${transition.from.column}:${index}`,
    exponent: transition.exponent,
    fromX: BOARD_PADDING + transition.from.column * step,
    fromY: BOARD_PADDING + transition.from.row * step,
    toX: BOARD_PADDING + transition.to.column * step,
    toY: BOARD_PADDING + transition.to.row * step,
    merges: transition.merges,
  }));
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
