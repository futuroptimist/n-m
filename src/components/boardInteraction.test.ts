import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BOARD_PADDING,
  TOUCH_TILE_SIZE,
  TILE_GUTTER,
  boardContentSize,
  boardScaleBounds,
  cellDescription,
  clampViewport,
  edgeDescription,
  fittedTileSize,
  minimumBoardSize,
  needsViewport,
  normalizeViewport,
  scaleMode,
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

test('derives continuous full-board fit below the touch-friendly scale', () => {
  assert.equal(TOUCH_TILE_SIZE, 44);
  assert.equal(TILE_GUTTER, 6);
  assert.equal(BOARD_PADDING, 3);
  assert.equal(minimumBoardSize(10), 506);
  assert.equal(boardContentSize(10, 88), 946);
  assert.equal(needsViewport(506, 506), false);
  assert.equal(needsViewport(506, 505), true);
  assert.equal(fittedTileSize(10, 506), 44);
  assert.equal(needsViewport(200, 0), false);
  assert.equal(boardScaleBounds(8, 344).fit, 36.25 / 44);
  assert.equal(boardScaleBounds(8, 344).touchFriendly, 1);
  assert.equal(boardScaleBounds(8, 344).maximum, 2.5);
  assert.equal(
    boardContentSize(8, TOUCH_TILE_SIZE * boardScaleBounds(8, 344).fit),
    344,
  );
  assert.equal(scaleMode(0.75), 'overview');
  assert.equal(scaleMode(1), 'touch-friendly');
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

test('normalizes zoom to dynamic fit and clamps enlarged viewports', () => {
  assert.deepEqual(normalizeViewport(0, { x: -40, y: -20 }, 10, 286), {
    zoom: 0.5,
    position: { x: 0, y: 0 },
  });
  assert.deepEqual(normalizeViewport(3, { x: -900, y: 10 }, 10, 300), {
    zoom: 2.5,
    position: { x: -866, y: 0 },
  });
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
