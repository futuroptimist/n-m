import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BOARD_PADDING,
  MIN_TILE_SIZE,
  TILE_GUTTER,
  boardContentSize,
  boardScale,
  cellDescription,
  clampViewport,
  edgeDescription,
  fittedTileSize,
  minimumBoardSize,
  normalizeViewport,
  planTileMotion,
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

test('continuous fit can shrink below the touch-friendly target without clipping', () => {
  assert.equal(MIN_TILE_SIZE, 44);
  assert.equal(TILE_GUTTER, 6);
  assert.equal(BOARD_PADDING, 3);
  assert.equal(minimumBoardSize(10), 506);
  assert.equal(boardContentSize(10, 88), 946);
  assert.equal(fittedTileSize(10, 506), 44);
  assert.deepEqual(boardScale(8, 358), {
    fitTileSize: 38,
    overview: true,
    minimumZoom: 1,
    maximumZoom: 2.5,
  });
  assert.equal(boardContentSize(8, boardScale(8, 358).fitTileSize), 358);
  assert.equal(boardScale(4, 358).overview, false);
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

test('normalizes zoom to dynamic fit bounds and clamps panning', () => {
  assert.deepEqual(normalizeViewport(0.5, { x: -40, y: -20 }, 10, 506), {
    zoom: 1,
    position: { x: 0, y: 0 },
  });
  assert.deepEqual(normalizeViewport(3, { x: -900, y: 10 }, 10, 506), {
    zoom: 2.5,
    position: { x: -660, y: 0 },
  });
});

test('plans deterministic slide and merge geometry from engine transitions', () => {
  assert.deepEqual(
    planTileMotion(
      [
        {
          from: { row: 2, column: 3 },
          to: { row: 0, column: 3 },
          exponent: 4,
          merges: true,
        },
      ],
      50,
    ),
    [
      {
        key: '2-3-0',
        exponent: 4,
        fromX: 150,
        fromY: 100,
        toX: 150,
        toY: 0,
        merges: true,
      },
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
