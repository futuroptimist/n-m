import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ENGINE_SCHEMA_VERSION,
  move,
  tileValue,
  type GameState,
} from '../engine';

import {
  BOARD_PADDING,
  FIT_ZOOM,
  TOUCH_TILE_SIZE,
  TILE_GUTTER,
  TILE_SLIDE_DURATION_MS,
  TILE_SPAWN_DURATION_MS,
  boardContentSize,
  cellDescription,
  clampViewport,
  edgeDescription,
  fittedBoardGeometry,
  fittedTileSize,
  minimumBoardSize,
  maximumZoom,
  normalizeViewport,
  planBoardPresentation,
  planTileMotion,
  selectMoveAnnouncement,
  shouldCaptureBoardGesture,
  touchFriendlyZoom,
  visibleEdges,
} from './boardInteraction';

test('captures gameplay swipes on every board and viewport gestures only when oversized', () => {
  assert.equal(shouldCaptureBoardGesture(false, 1, 40, 0), true);
  assert.equal(shouldCaptureBoardGesture(true, 1, 40, 0), true);
  assert.equal(shouldCaptureBoardGesture(false, 2, 0, 0), false);
  assert.equal(shouldCaptureBoardGesture(true, 2, 0, 0), true);
});

test('fits every board continuously and offers a touch-friendly enlarged scale', () => {
  assert.equal(TOUCH_TILE_SIZE, 44);
  assert.equal(TILE_GUTTER, 6);
  assert.equal(BOARD_PADDING, 3);
  assert.equal(minimumBoardSize(10), 506);
  assert.equal(boardContentSize(10, 88), 946);
  assert.equal(fittedTileSize(8, 360), 38.25);
  assert.equal(boardContentSize(8, fittedTileSize(8, 360)), 360);
  assert.equal(touchFriendlyZoom(8, 360), 44 / 38.25);
  assert.equal(FIT_ZOOM, 1);
  assert.equal(maximumZoom(20, 320) > 2.5, true);

  for (const [sideLength, frame] of [
    [8, 360],
    [53, 320],
    [58, 344],
  ] as const) {
    const geometry = fittedBoardGeometry(sideLength, frame);
    assert.equal(geometry.tileSize > 0, true);
    assert.equal(
      boardContentSize(
        sideLength,
        geometry.tileSize,
        geometry.gutter,
        geometry.padding,
      ) <=
        frame + Number.EPSILON * frame,
      true,
    );
  }
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

test('normalizes full-board fit and clamps enlarged viewports', () => {
  assert.deepEqual(normalizeViewport(0.5, { x: -40, y: -20 }, 10, 300), {
    zoom: 1,
    position: { x: 0, y: 0 },
  });
  assert.deepEqual(normalizeViewport(3, { x: -900, y: 10 }, 10, 300), {
    zoom: 2.5,
    position: { x: -450, y: 0 },
  });
});

test('plans deterministic tile paths including duplicate-value merges', () => {
  assert.deepEqual(
    planTileMotion(
      [
        {
          from: { row: 0, column: 1 },
          to: { row: 0, column: 0 },
          exponent: 1,
          merges: true,
        },
        {
          from: { row: 0, column: 2 },
          to: { row: 0, column: 0 },
          exponent: 1,
          merges: true,
        },
      ],
      44,
    ),
    [
      {
        key: '0:1:0',
        exponent: 1,
        fromX: 56,
        fromY: 6,
        toX: 6,
        toY: 6,
        merges: true,
      },
      {
        key: '0:2:1',
        exponent: 1,
        fromX: 106,
        fromY: 6,
        toX: 6,
        toY: 6,
        merges: true,
      },
    ],
  );
});

test('presents an engine merge with distinct motion and reveal identities', () => {
  const game: GameState = {
    schemaVersion: ENGINE_SCHEMA_VERSION,
    activeK: 10,
    sideLength: 2,
    board: [
      [1, 1],
      [null, null],
    ],
    highestCreatedExponent: 1,
    score: 0n,
    status: 'active',
    lastHorizontalDirection: null,
    lastVerticalDirection: null,
  };
  const random = [0, 0][Symbol.iterator]();
  const result = move(game, 'left', () => random.next().value ?? 0);
  const sliding = planBoardPresentation(
    result.state.board,
    result.transitions,
    true,
  );
  const revealed = planBoardPresentation(
    result.state.board,
    result.transitions,
    false,
  );
  const participants = planTileMotion(sliding.overlays, 44).filter(
    ({ merges }) => merges,
  );
  const hiddenDestination = sliding.cells.find(
    ({ row, column }) => row === 0 && column === 0,
  );
  const visibleDestinations = revealed.cells.filter(
    ({ row, column, exponent, visible }) =>
      row === 0 && column === 0 && exponent === 2 && visible,
  );

  assert.equal(result.state.board[0]?.[0], 2);
  assert.equal(tileValue(result.state.board[0]?.[0] ?? 0), 4n);
  assert.equal(participants.length, 2);
  assert.notEqual(participants[0]?.key, participants[1]?.key);
  assert.deepEqual(
    participants.map(({ toX, toY }) => ({ toX, toY })),
    [
      { toX: 6, toY: 6 },
      { toX: 6, toY: 6 },
    ],
  );
  assert.equal(hiddenDestination?.exponent, 2);
  assert.equal(hiddenDestination?.visible, false);
  assert.equal(visibleDestinations.length, 1);
  assert.equal(revealed.overlays.length, 0);
  assert.notEqual(hiddenDestination?.key, visibleDestinations[0]?.key);

  // Reduce Motion takes the same immediate, overlay-free presentation path.
  const reducedMotion = planBoardPresentation(
    result.state.board,
    result.transitions,
    false,
  );
  assert.deepEqual(reducedMotion, revealed);
});

test('presents prepended growth at shifted final coordinates for every edge combination', () => {
  for (const [vertical, horizontal, rowOffset, columnOffset] of [
    ['down', 'right', 1, 1],
    ['down', 'left', 1, 0],
    ['up', 'right', 0, 1],
    ['up', 'left', 0, 0],
  ] as const) {
    const stationaryColumn = horizontal === 'right' ? 1 : 0;
    const game: GameState = {
      schemaVersion: ENGINE_SCHEMA_VERSION,
      activeK: 1,
      sideLength: 2,
      board: [[1, 1], stationaryColumn === 0 ? [2, null] : [null, 2]],
      highestCreatedExponent: 1,
      score: 0n,
      status: 'active',
      lastHorizontalDirection: horizontal,
      lastVerticalDirection: vertical,
    };
    const samples = [0, 0.999][Symbol.iterator]();
    const result = move(game, horizontal, () => samples.next().value ?? 0);
    const sliding = planBoardPresentation(
      result.state.board,
      result.transitions,
      true,
    );
    const settled = planBoardPresentation(
      result.state.board,
      result.transitions,
      false,
    );
    const destinationColumn = horizontal === 'right' ? columnOffset + 1 : 0;
    const destination = sliding.cells.find(
      ({ row, column }) => row === rowOffset && column === destinationColumn,
    );
    const stationary = sliding.cells.find(
      ({ row, column }) =>
        row === rowOffset + 1 && column === stationaryColumn + columnOffset,
    );
    const spawn = result.events.find((event) => event.type === 'spawn');

    assert.equal(sliding.cells.length, 9);
    assert.equal(destination?.exponent, 2);
    assert.equal(destination?.visible, false);
    assert.equal(stationary?.exponent, 2);
    assert.equal(stationary?.visible, true);
    assert.equal(result.transitions.filter(({ merges }) => merges).length, 2);
    assert.ok(
      result.transitions.every(
        ({ from, to }) =>
          from.row >= rowOffset &&
          from.column >= columnOffset &&
          to.row >= rowOffset &&
          to.column >= columnOffset,
      ),
    );
    assert.ok(spawn?.type === 'spawn');
    assert.equal(result.state.board[spawn.row][spawn.column], spawn.exponent);
    assert.notEqual(
      destination?.key,
      settled.cells.find(
        ({ row, column }) => row === rowOffset && column === destinationColumn,
      )?.key,
    );
  }
});

test('uses animation durations that are exactly half their original values', () => {
  assert.equal(TILE_SLIDE_DURATION_MS, 150 / 2);
  assert.equal(TILE_SPAWN_DURATION_MS, 100 / 2);
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
      {
        type: 'growth',
        from: 2,
        to: 3,
        rowOffset: 0,
        columnOffset: 0,
      },
    ]),
    'Board grew from 2 by 2 to 3 by 3. Merge scored 4 points',
  );
  assert.equal(
    selectMoveAnnouncement([
      {
        type: 'growth',
        from: 2,
        to: 3,
        rowOffset: 0,
        columnOffset: 0,
      },
      { type: 'game-over' },
    ]),
    'Game over',
  );
});
