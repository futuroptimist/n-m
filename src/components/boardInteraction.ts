import { tileValue, type Board, type EngineEvent } from '../engine';

export const MIN_TILE_SIZE = 44;
export const MAX_VIEWPORT_SCALE = 3;

export interface Viewport {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

export interface VisibleEdges {
  readonly top: boolean;
  readonly right: boolean;
  readonly bottom: boolean;
  readonly left: boolean;
}

export function usesClippedViewport(
  sideLength: number,
  width: number,
): boolean {
  return width > 0 && width / sideLength < MIN_TILE_SIZE;
}

export function clampViewport(
  viewport: Viewport,
  boardSize: number,
  viewportSize: number,
): Viewport {
  const scale = Math.min(MAX_VIEWPORT_SCALE, Math.max(1, viewport.scale));
  const overflow = Math.max(0, boardSize * scale - viewportSize);
  return {
    scale,
    x: Math.min(0, Math.max(-overflow, viewport.x)),
    y: Math.min(0, Math.max(-overflow, viewport.y)),
  };
}

export function visibleEdges(
  viewport: Viewport,
  boardSize: number,
  viewportSize: number,
): VisibleEdges {
  const clamped = clampViewport(viewport, boardSize, viewportSize);
  const overflow = Math.max(0, boardSize * clamped.scale - viewportSize);
  return {
    top: clamped.y === 0,
    right: -clamped.x === overflow,
    bottom: -clamped.y === overflow,
    left: clamped.x === 0,
  };
}

export function edgeDescription(edges: VisibleEdges): string {
  const visible = (Object.keys(edges) as (keyof VisibleEdges)[]).filter(
    (edge) => edges[edge],
  );
  return `Visible edges: ${visible.length === 0 ? 'none' : visible.join(', ')}`;
}

export function inspectorDescription(
  board: Board,
  row: number,
  column: number,
): string {
  const exponent = board[row]?.[column];
  const contents =
    exponent === null || exponent === undefined
      ? 'empty'
      : tileValue(exponent).toString();
  return `Row ${row + 1}, column ${column + 1}, ${contents}`;
}

export function selectAnnouncement(
  events: readonly EngineEvent[],
  score: bigint,
): string | null {
  if (events.some((event) => event.type === 'game-over'))
    return `Game over. Final score ${score.toString()}.`;
  const mergeTotal = events.reduce(
    (total, event) => total + (event.type === 'merge' ? event.value : 0n),
    0n,
  );
  const growth = events.find((event) => event.type === 'growth');
  if (growth?.type === 'growth') {
    const mergeMessage =
      mergeTotal > 0n
        ? ` Score increased by ${mergeTotal.toString()} to ${score.toString()}.`
        : '';
    return `Board grew from ${growth.from} by ${growth.from} to ${growth.to} by ${growth.to}.${mergeMessage}`;
  }
  return mergeTotal > 0n
    ? `Merged tiles. Score increased by ${mergeTotal.toString()} to ${score.toString()}.`
    : null;
}
