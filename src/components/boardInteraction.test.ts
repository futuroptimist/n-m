import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clampViewport,
  edgeDescription,
  inspectorDescription,
  MIN_TILE_SIZE,
  selectAnnouncement,
  usesClippedViewport,
  visibleEdges,
} from './boardInteraction';

test('switches to a clipped viewport only below the 44 point tile threshold', () => {
  assert.equal(MIN_TILE_SIZE, 44);
  assert.equal(usesClippedViewport(10, 440), false);
  assert.equal(usesClippedViewport(11, 440), true);
});

test('clamps scale and offsets without exposing blank space', () => {
  assert.deepEqual(clampViewport({ scale: 4, x: 20, y: -9999 }, 440, 220), {
    scale: 3,
    x: 0,
    y: -1100,
  });
});

test('reports the meaningful visible board edges', () => {
  assert.equal(
    edgeDescription(visibleEdges({ scale: 1, x: -220, y: -220 }, 440, 220)),
    'Visible edges: right, bottom',
  );
});

test('describes exact inspector coordinates and contents', () => {
  assert.equal(inspectorDescription([[1, null]], 0, 0), 'Row 1, column 1, 2');
  assert.equal(
    inspectorDescription([[1, null]], 0, 1),
    'Row 1, column 2, empty',
  );
});

test('announcements prefer game over, then growth, and ignore quiet events', () => {
  assert.equal(
    selectAnnouncement(
      [{ type: 'merge', exponent: 2, value: 4n }, { type: 'game-over' }],
      12n,
    ),
    'Game over. Final score 12.',
  );
  assert.equal(
    selectAnnouncement(
      [
        { type: 'merge', exponent: 2, value: 4n },
        { type: 'growth', from: 2, to: 3 },
      ],
      4n,
    ),
    'Board grew from 2 by 2 to 3 by 3. Score increased by 4 to 4.',
  );
  assert.equal(
    selectAnnouncement([{ type: 'merge', exponent: 2, value: 4n }], 4n),
    'Merged tiles. Score increased by 4 to 4.',
  );
  assert.equal(
    selectAnnouncement([{ type: 'move', direction: 'up' }], 0n),
    null,
  );
});
