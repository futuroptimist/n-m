import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MIN_TILE_SIZE,
  baseTileSize,
  cellDescription,
  clampViewport,
  moveAnnouncement,
  usesClippedViewport,
  visibleEdges,
  visibleRange,
} from './gameInteraction';

test('fits boards until a tile would fall below 44 points', () => {
  assert.equal(usesClippedViewport(220, 5), false);
  assert.equal(baseTileSize(220, 5), MIN_TILE_SIZE);
  assert.equal(usesClippedViewport(219, 5), true);
  assert.equal(baseTileSize(219, 5), MIN_TILE_SIZE);
});

test('clamps pan and zoom without exposing blank space', () => {
  assert.deepEqual(clampViewport({ scale: 0.5, x: 20, y: 30 }, 200, 300), {
    scale: 1,
    x: 0,
    y: 0,
  });
  assert.deepEqual(clampViewport({ scale: 4, x: -900, y: -5 }, 200, 300), {
    scale: 3,
    x: -700,
    y: -5,
  });
  assert.deepEqual(clampViewport({ scale: 2, x: -20, y: -20 }, 300, 100), {
    scale: 2,
    x: 0,
    y: 0,
  });
});

test('reports the clipped cells and visible board edges', () => {
  const range = visibleRange({ scale: 1, x: -44, y: -88 }, 132, 44, 6);
  assert.deepEqual(range, {
    firstRow: 2,
    lastRow: 4,
    firstColumn: 1,
    lastColumn: 3,
  });
  assert.equal(
    visibleEdges(range, 6),
    'Visible rows 3–5 and columns 2–4. Board edges visible: none.',
  );
  assert.equal(
    visibleEdges({ ...range, firstRow: 0, lastColumn: 5 }, 6),
    'Visible rows 1–5 and columns 2–6. Board edges visible: top, right.',
  );
});

test('describes inspector cells with exact values or empty', () => {
  const board = [
    [null, 1],
    [60, null],
  ];
  assert.equal(cellDescription(board, 0, 0), 'Row 1, column 1: empty');
  assert.equal(
    cellDescription(board, 1, 0),
    'Row 2, column 1: 1152921504606846976',
  );
});

test('selects concise announcements by priority and ignores noise', () => {
  assert.equal(
    moveAnnouncement([
      { type: 'move', direction: 'left' },
      { type: 'spawn', row: 0, column: 0, exponent: 1 },
    ]),
    null,
  );
  assert.equal(
    moveAnnouncement([
      { type: 'merge', exponent: 2, value: 4n },
      { type: 'merge', exponent: 3, value: 8n },
    ]),
    'Merged. Score increased by 12.',
  );
  assert.equal(
    moveAnnouncement([
      { type: 'merge', exponent: 2, value: 4n },
      { type: 'growth', from: 2, to: 3 },
    ]),
    'Merged. Score increased by 4. Board grew from 2 by 2 to 3 by 3.',
  );
  assert.equal(
    moveAnnouncement([
      { type: 'growth', from: 2, to: 3 },
      { type: 'game-over' },
    ]),
    'Game over.',
  );
});
