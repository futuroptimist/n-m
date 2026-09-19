import { tileValue, type EngineEvent } from '../engine';

export const MIN_TILE_SIZE = 44;
export const MAX_VIEWPORT_SCALE = 3;

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

export function needsLargeBoardViewport(
  viewportSize: number,
  sideLength: number,
): boolean {
  return viewportSize > 0 && viewportSize / sideLength < MIN_TILE_SIZE;
}

export function clampViewport(
  position: ViewportPosition,
  viewportSize: number,
  contentSize: number,
  scale: number,
): ViewportPosition {
  const minimum = Math.min(0, viewportSize - contentSize * scale);
  return {
    x: Math.min(0, Math.max(minimum, position.x)),
    y: Math.min(0, Math.max(minimum, position.y)),
  };
}

export function visibleEdges(
  position: ViewportPosition,
  viewportSize: number,
  contentSize: number,
  scale: number,
): VisibleEdges {
  const clamped = clampViewport(position, viewportSize, contentSize, scale);
  const minimum = Math.min(0, viewportSize - contentSize * scale);
  const tolerance = 0.5;
  return {
    top: clamped.y >= -tolerance,
    right: clamped.x <= minimum + tolerance,
    bottom: clamped.y <= minimum + tolerance,
    left: clamped.x >= -tolerance,
  };
}

export function edgeDescription(edges: VisibleEdges): string {
  const names = (['top', 'right', 'bottom', 'left'] as const).filter(
    (edge) => edges[edge],
  );
  return names.length === 0
    ? 'Board center; no outer edges visible'
    : `Visible board edges: ${names.join(', ')}`;
}

export function inspectorDescription(
  row: number,
  column: number,
  exponent: number | null,
): string {
  const location = `Row ${row + 1}, column ${column + 1}`;
  return exponent === null
    ? `${location}: empty`
    : `${location}: ${tileValue(exponent).toString()}`;
}

export function announcementForEvents(
  events: readonly EngineEvent[],
): string | null {
  if (events.some((event) => event.type === 'game-over')) return 'Game over.';

  const scoreIncrease = events.reduce(
    (total, event) => (event.type === 'merge' ? total + event.value : total),
    0n,
  );
  const growth = events.find(
    (event): event is Extract<EngineEvent, { type: 'growth' }> =>
      event.type === 'growth',
  );
  if (growth !== undefined) {
    const mergeMessage =
      scoreIncrease > 0n
        ? ` Score increased by ${scoreIncrease.toString()}.`
        : '';
    return `Board grew from ${growth.from} by ${growth.from} to ${growth.to} by ${growth.to}.${mergeMessage}`;
  }

  return scoreIncrease > 0n
    ? `Merge. Score increased by ${scoreIncrease.toString()}.`
    : null;
}
