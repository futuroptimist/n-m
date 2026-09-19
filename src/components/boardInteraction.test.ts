import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MIN_TILE_SIZE,
  cellDescription,
  clampViewport,
  edgeDescription,
  needsViewport,
  selectMoveAnnouncement,
  visibleEdges,
} from './boardInteraction';

test('switches to a viewport only below the 44-point fitted threshold', () => {
  assert.equal(MIN_TILE_SIZE, 44);
  assert.equal(needsViewport(10, 440), false);
  assert.equal(needsViewport(11, 440), true);
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

test('describes visible edges without relying on color', () => {
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
