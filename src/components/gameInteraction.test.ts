import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MIN_TILE_SIZE,
  announcementForEvents,
  clampViewport,
  edgeDescription,
  inspectorDescription,
  needsLargeBoardViewport,
  visibleEdges,
} from './gameInteraction';

test('switches to a viewport only below the 44-point fitted threshold', () => {
  assert.equal(MIN_TILE_SIZE, 44);
  assert.equal(needsLargeBoardViewport(220, 5), false);
  assert.equal(needsLargeBoardViewport(219, 5), true);
  assert.equal(needsLargeBoardViewport(0, 100), false);
});

test('clamps both axes without exposing space beyond the board', () => {
  assert.deepEqual(clampViewport({ x: 20, y: -500 }, 220, 264, 1), {
    x: 0,
    y: -44,
  });
  assert.deepEqual(clampViewport({ x: -100, y: -80 }, 220, 264, 2), {
    x: -100,
    y: -80,
  });
});

test('reports visible outer edges in words, including a centered view', () => {
  assert.equal(
    edgeDescription(visibleEdges({ x: 0, y: 0 }, 220, 264, 1)),
    'Visible board edges: top, left',
  );
  assert.equal(
    edgeDescription(visibleEdges({ x: -22, y: -22 }, 220, 264, 1)),
    'Board center; no outer edges visible',
  );
  assert.equal(
    edgeDescription(visibleEdges({ x: -44, y: -44 }, 220, 264, 1)),
    'Visible board edges: right, bottom',
  );
});

test('describes exact inspector coordinates, values, and empty cells', () => {
  assert.equal(inspectorDescription(2, 3, null), 'Row 3, column 4: empty');
  assert.equal(
    inspectorDescription(0, 0, 60),
    'Row 1, column 1: 1152921504606846976',
  );
});

test('announces only meaningful events with game over taking priority', () => {
  assert.equal(
    announcementForEvents([
      { type: 'move', direction: 'left' },
      { type: 'spawn', row: 0, column: 1, exponent: 1 },
    ]),
    null,
  );
  assert.equal(
    announcementForEvents([
      { type: 'merge', exponent: 2, value: 4n },
      { type: 'merge', exponent: 3, value: 8n },
    ]),
    'Merge. Score increased by 12.',
  );
  assert.equal(
    announcementForEvents([
      { type: 'merge', exponent: 2, value: 4n },
      { type: 'growth', from: 2, to: 3 },
    ]),
    'Board grew from 2 by 2 to 3 by 3. Score increased by 4.',
  );
  assert.equal(
    announcementForEvents([
      { type: 'growth', from: 2, to: 3 },
      { type: 'game-over' },
    ]),
    'Game over.',
  );
});
