import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BOARD_PADDING,
  MIN_TILE_SIZE,
  TILE_GUTTER,
  boardContentSize,
  cellDescription,
  clampViewport,
  edgeDescription,
  fittedTileSize,
  maximumZoom,
  minimumBoardSize,
  needsViewport,
  normalizeViewport,
  planTileTransitions,
  selectMoveAnnouncement,
  shouldCaptureBoardGesture,
  visibleEdges,
} from './boardInteraction';

test('captures gameplay swipes on every board and viewport gestures only when oversized', () => {
  assert.equal(shouldCaptureBoardGesture(false, 1, 40, 0), true);
  assert.equal(shouldCaptureBoardGesture(true, 1, 40, 0), true);
  assert.equal(shouldCaptureBoardGesture(false, 2, 0, 0), false);
  assert.equal(shouldCaptureBoardGesture(true, 2, 0, 0), true);
});

test('fits every board continuously and identifies overview scale', () => {
  assert.equal(MIN_TILE_SIZE, 44);
  assert.equal(TILE_GUTTER, 6);
  assert.equal(BOARD_PADDING, 3);
  assert.equal(minimumBoardSize(10), 506);
  assert.equal(boardContentSize(10, 88), 946);
  assert.equal(needsViewport(10, 506), false);
  assert.equal(needsViewport(10, 505), true);
  assert.equal(fittedTileSize(10, 506), 44);
  assert.equal(fittedTileSize(8, 358), 38);
  assert.equal(boardContentSize(8, fittedTileSize(8, 358)), 358);
  assert.equal(maximumZoom(8, 358), 2.5);
  assert.ok(maximumZoom(20, 358) > 2.5);
  assert.equal(needsViewport(4, 0), false);
});

test('clamps viewport positions without exposing blank space', () => {
  assert.deepEqual(clampViewport({ x: 20, y: -500 }, 600, 300), {
    x: 0,
    y: -300,
  });
  assert.deepEqual(clampViewport({ x: -20, y: -40 }, 200, 300), {
    x: 0,
    y: 0,
  });
});

test('normalizes fitted viewports and clamps oversized viewports', () => {
  assert.deepEqual(normalizeViewport(false, 2, { x: -40, y: -20 }, 10, 300), {
    zoom: 2,
    position: { x: -40, y: -20 },
  });
  assert.deepEqual(normalizeViewport(true, 3, { x: -900, y: 10 }, 10, 300), {
    zoom: 2.5,
    position: { x: -351, y: 0 },
  });
  assert.deepEqual(normalizeViewport(true, 0, { x: -90, y: -20 }, 10, 300), {
    zoom: 1,
    position: { x: 0, y: 0 },
  });
});

test('plans immutable slide and merge geometry from engine transitions', () => {
  const plan = planTileTransitions(
    {
      grew: false,
      spawn: { row: 1, column: 1, exponent: 1 },
      tiles: [
        {
          exponent: 2,
          from: { row: 0, column: 2 },
          merges: true,
          to: { row: 0, column: 0 },
        },
        {
          exponent: 2,
          from: { row: 0, column: 1 },
          merges: true,
          to: { row: 0, column: 0 },
        },
      ],
    },
    44,
  );
  assert.deepEqual(
    plan.map(({ left, top, translateX, translateY, merges }) => ({
      left,
      top,
      translateX,
      translateY,
      merges,
    })),
    [
      { left: 103, top: 3, translateX: -100, translateY: 0, merges: true },
      { left: 53, top: 3, translateX: -50, translateY: 0, merges: true },
    ],
  );
});

test('describes visible edges without relying on color', () => {
  assert.equal(
    edgeDescription({ top: true, right: true, bottom: true, left: true }),
    'Visible board edges: top, right, bottom, left',
  );
  assert.equal(
    edgeDescription(visibleEdges({ x: 0, y: 0 }, 600, 300)),
    'Visible board edges: top, left',
  );
  assert.equal(
    edgeDescription(visibleEdges({ x: -150, y: -150 }, 600, 300)),
    'Board interior visible; no board edges visible',
  );
});

test('inspector descriptions identify exact values and empty cells', () => {
  assert.equal(cellDescription(10, 1, 2), 'Row 2, column 3: 1024');
  assert.equal(cellDescription(null, 0, 0), 'Row 1, column 1: empty');
});

test('announcements prefer game over, then growth, then merge score', () => {
  assert.equal(selectMoveAnnouncement([]), null);
  assert.equal(
    selectMoveAnnouncement([
      { type: 'move', direction: 'left' },
      { type: 'spawn', row: 0, column: 1, exponent: 1 },
    ]),
    null,
  );
  assert.equal(
    selectMoveAnnouncement([
      { type: 'merge', exponent: 2, value: 4n },
      { type: 'merge', exponent: 3, value: 8n },
    ]),
    'Merge scored 12 points',
  );
  assert.equal(
    selectMoveAnnouncement([
      { type: 'merge', exponent: 2, value: 4n },
      { type: 'growth', from: 2, to: 3 },
    ]),
    'Board grew from 2 by 2 to 3 by 3. Merge scored 4 points',
  );
  assert.equal(
    selectMoveAnnouncement([
      { type: 'growth', from: 2, to: 3 },
      { type: 'game-over' },
    ]),
    'Game over',
  );
});
