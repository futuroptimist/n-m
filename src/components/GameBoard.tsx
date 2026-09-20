import { useRef, useState } from 'react';
import {
  AccessibilityInfo,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';

import { tileValue, type GameState } from '../engine';
import { colors, spacing } from '../theme';
import {
  MAX_ZOOM,
  MIN_TILE_SIZE,
  MIN_ZOOM,
  cellDescription,
  clampViewport,
  edgeDescription,
  needsViewport,
  visibleEdges,
  type ViewportPosition,
} from './boardInteraction';

interface GameBoardProps {
  game: GameState;
}

function tileBackground(exponent: number): string {
  if (exponent <= 2) return colors.tileLight;
  if (exponent <= 5) return colors.tileMid;
  return colors.tileDark;
}

function touchDistance(event: GestureResponderEvent): number | null {
  const [first, second] = event.nativeEvent.touches;
  if (first === undefined || second === undefined) return null;
  return Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
}

export function GameBoard({ game }: GameBoardProps) {
  const [viewportSize, setViewportSize] = useState(0);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [position, setPosition] = useState<ViewportPosition>({ x: 0, y: 0 });
  const [inspectorRow, setInspectorRow] = useState(0);
  const [inspectorColumn, setInspectorColumn] = useState(0);
  const gestureStart = useRef({
    distance: null as number | null,
    position: { x: 0, y: 0 },
    zoom: MIN_ZOOM,
  });
  const oversized = needsViewport(game.sideLength, viewportSize);
  const displayZoom = oversized ? zoom : MIN_ZOOM;
  const baseBoardSize = oversized
    ? game.sideLength * MIN_TILE_SIZE
    : viewportSize;
  const contentSize = baseBoardSize * displayZoom;
  const clampedPosition = clampViewport(
    oversized ? position : { x: 0, y: 0 },
    contentSize,
    viewportSize,
  );
  const edges = visibleEdges(clampedPosition, contentSize, viewportSize);

  const updateViewport = (nextZoom: number, nextPosition = position) => {
    const boundedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
    setZoom(boundedZoom);
    setPosition(
      clampViewport(nextPosition, baseBoardSize * boundedZoom, viewportSize),
    );
  };

  // Gesture callbacks need the latest mutable grant snapshot before React can
  // commit another render; this ref is intentionally read only by callbacks.
  // eslint-disable-next-line react-hooks/refs
  const viewportResponder = PanResponder.create({
    onStartShouldSetPanResponder: (event) =>
      oversized && event.nativeEvent.touches.length >= 2,
    onMoveShouldSetPanResponder: (event) =>
      oversized && event.nativeEvent.touches.length >= 2,
    onPanResponderGrant: (event) => {
      gestureStart.current = {
        distance: touchDistance(event),
        position: clampedPosition,
        zoom,
      };
    },
    onPanResponderMove: (event, gesture) => {
      if (event.nativeEvent.touches.length < 2) return;
      const distance = touchDistance(event);
      const start = gestureStart.current;
      const scale =
        distance !== null && start.distance !== null && start.distance > 0
          ? distance / start.distance
          : 1;
      const nextZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, start.zoom * scale),
      );
      setZoom(nextZoom);
      setPosition(
        clampViewport(
          {
            x: start.position.x + gesture.dx,
            y: start.position.y + gesture.dy,
          },
          baseBoardSize * nextZoom,
          viewportSize,
        ),
      );
    },
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const size = event.nativeEvent.layout.width;
    setViewportSize(size);
    if (!needsViewport(game.sideLength, size)) {
      setZoom(MIN_ZOOM);
      setPosition({ x: 0, y: 0 });
      return;
    }
    setPosition((current) =>
      clampViewport(current, game.sideLength * MIN_TILE_SIZE * zoom, size),
    );
  };

  const row = Math.min(inspectorRow, game.sideLength - 1);
  const column = Math.min(inspectorColumn, game.sideLength - 1);
  const inspectorDescription = cellDescription(
    game.board[row][column],
    row,
    column,
  );
  const tileSize = oversized
    ? MIN_TILE_SIZE * displayZoom
    : viewportSize / game.sideLength;

  return (
    <View style={styles.section}>
      <View
        accessibilityLabel={`${game.sideLength} by ${game.sideLength} game board`}
        onLayout={onLayout}
        style={[styles.viewport, oversized && styles.clippedViewport]}
        {...(oversized ? viewportResponder.panHandlers : {})}
      >
        {viewportSize > 0 ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.board,
              {
                height: contentSize,
                transform: [
                  { translateX: clampedPosition.x },
                  { translateY: clampedPosition.y },
                ],
                width: contentSize,
              },
            ]}
          >
            {game.board.map((boardRow, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.row}>
                {boardRow.map((exponent, columnIndex) => {
                  const value =
                    exponent === null ? null : tileValue(exponent).toString();
                  const darkTile = exponent !== null && exponent > 5;
                  return (
                    <View
                      key={`cell-${rowIndex}-${columnIndex}`}
                      style={[
                        styles.cell,
                        {
                          backgroundColor:
                            exponent === null
                              ? colors.empty
                              : tileBackground(exponent),
                          height: tileSize - 6,
                          width: tileSize - 6,
                        },
                      ]}
                    >
                      {value === null ? null : (
                        <Text
                          adjustsFontSizeToFit
                          minimumFontScale={0.45}
                          numberOfLines={1}
                          style={[
                            styles.tileValue,
                            {
                              color: darkTile ? colors.white : colors.ink,
                              fontSize: Math.max(
                                12,
                                Math.min(30, tileSize / 3),
                              ),
                            },
                          ]}
                        >
                          {value}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {oversized ? (
        <View style={styles.viewportControls}>
          <Text accessibilityLiveRegion="polite" style={styles.edgeText}>
            {edgeDescription(edges)}
          </Text>
          <Text style={styles.viewportHint}>
            Two fingers pan or pinch. One finger still moves tiles.
          </Text>
          <View style={styles.controlRow}>
            <BoardButton
              disabled={zoom <= MIN_ZOOM}
              label="Zoom board out"
              onPress={() => updateViewport(zoom - 0.25)}
              text="Zoom −"
            />
            <BoardButton
              disabled={zoom >= MAX_ZOOM}
              label="Zoom board in"
              onPress={() => updateViewport(zoom + 0.25)}
              text="Zoom +"
            />
            <BoardButton
              label="Reset board viewport"
              onPress={() => {
                setZoom(MIN_ZOOM);
                setPosition({ x: 0, y: 0 });
              }}
              text="Fit / reset"
            />
          </View>
        </View>
      ) : null}

      <View style={styles.inspector}>
        <Text accessibilityRole="header" style={styles.inspectorTitle}>
          Board inspector
        </Text>
        <Text style={styles.inspectorValue}>{inspectorDescription}</Text>
        <View style={styles.controlRow}>
          <BoardButton
            disabled={row === 0}
            label="Previous board row"
            onPress={() => {
              const nextRow = row - 1;
              setInspectorRow(nextRow);
              AccessibilityInfo.announceForAccessibility(
                cellDescription(game.board[nextRow][column], nextRow, column),
              );
            }}
            text="Row −"
          />
          <BoardButton
            disabled={row === game.sideLength - 1}
            label="Next board row"
            onPress={() => {
              const nextRow = row + 1;
              setInspectorRow(nextRow);
              AccessibilityInfo.announceForAccessibility(
                cellDescription(game.board[nextRow][column], nextRow, column),
              );
            }}
            text="Row +"
          />
          <BoardButton
            disabled={column === 0}
            label="Previous board column"
            onPress={() => {
              const nextColumn = column - 1;
              setInspectorColumn(nextColumn);
              AccessibilityInfo.announceForAccessibility(
                cellDescription(game.board[row][nextColumn], row, nextColumn),
              );
            }}
            text="Column −"
          />
          <BoardButton
            disabled={column === game.sideLength - 1}
            label="Next board column"
            onPress={() => {
              const nextColumn = column + 1;
              setInspectorColumn(nextColumn);
              AccessibilityInfo.announceForAccessibility(
                cellDescription(game.board[row][nextColumn], row, nextColumn),
              );
            }}
            text="Column +"
          />
        </View>
      </View>
    </View>
  );
}

interface BoardButtonProps {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  text: string;
}

function BoardButton({
  disabled = false,
  label,
  onPress,
  text,
}: BoardButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.controlButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.controlText, disabled && styles.disabledText]}>
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.small },
  viewport: { aspectRatio: 1, width: '100%' },
  clippedViewport: {
    borderColor: colors.ink,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
  },
  board: {
    backgroundColor: colors.board,
    borderRadius: 12,
    padding: 3,
  },
  row: { flexDirection: 'row' },
  cell: {
    alignItems: 'center',
    borderColor: 'rgba(39, 35, 31, 0.2)',
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    margin: 3,
  },
  tileValue: {
    fontWeight: '800',
    paddingHorizontal: 2,
    textAlign: 'center',
    width: '100%',
  },
  viewportControls: { gap: 4 },
  edgeText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  viewportHint: { color: colors.mutedInk, fontSize: 13 },
  controlRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small },
  controlButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  controlText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  disabledButton: { backgroundColor: '#d2cec7', borderWidth: 1 },
  disabledText: { color: '#706b64' },
  pressed: { backgroundColor: colors.primaryPressed, opacity: 0.9 },
  inspector: {
    backgroundColor: colors.panel,
    borderRadius: 12,
    gap: spacing.small,
    padding: 12,
  },
  inspectorTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  inspectorValue: { color: colors.ink, fontSize: 16 },
});
