import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

import { tileValue, type Direction, type GameState } from '../engine';
import { colors, spacing } from '../theme';
import {
  MAX_ZOOM,
  MIN_TILE_SIZE,
  MIN_ZOOM,
  boardContentSize,
  cellDescription,
  clampViewport,
  edgeDescription,
  fittedTileSize,
  minimumBoardSize,
  needsViewport,
  normalizeViewport,
  shouldCaptureBoardGesture,
  swipeDirection,
  visibleEdges,
  type ViewportPosition,
} from './boardInteraction';

interface GameBoardProps {
  game: GameState;
  onMove: (direction: Direction) => void;
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

export function GameBoard({ game, onMove }: GameBoardProps) {
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
  const viewportGesture = useRef(false);
  const viewportState = useRef({ zoom: MIN_ZOOM, position: { x: 0, y: 0 } });
  const geometry = useRef({
    oversized: false,
    sideLength: game.sideLength,
    viewportSize: 0,
  });
  const onMoveRef = useRef(onMove);
  const oversized = needsViewport(game.sideLength, viewportSize);
  const displayZoom = oversized ? zoom : MIN_ZOOM;
  const baseBoardSize = oversized
    ? minimumBoardSize(game.sideLength)
    : viewportSize;
  const contentSize = oversized
    ? boardContentSize(game.sideLength, MIN_TILE_SIZE * displayZoom)
    : viewportSize;
  const clampedPosition = clampViewport(
    oversized ? position : { x: 0, y: 0 },
    contentSize,
    viewportSize,
  );
  const edges = visibleEdges(clampedPosition, contentSize, viewportSize);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useLayoutEffect(() => {
    geometry.current = { oversized, sideLength: game.sideLength, viewportSize };
    const normalized = normalizeViewport(
      oversized,
      viewportState.current.zoom,
      viewportState.current.position,
      game.sideLength,
      viewportSize,
    );
    viewportState.current = normalized;
    setZoom(normalized.zoom);
    setPosition(normalized.position);
  }, [game.sideLength, oversized, viewportSize]);

  const applyViewport = (nextZoom: number, nextPosition: ViewportPosition) => {
    const currentGeometry = geometry.current;
    const normalized = normalizeViewport(
      currentGeometry.oversized,
      nextZoom,
      nextPosition,
      currentGeometry.sideLength,
      currentGeometry.viewportSize,
    );
    viewportState.current = normalized;
    setZoom(normalized.zoom);
    setPosition(normalized.position);
  };

  // Gesture callbacks need the latest mutable grant snapshot before React can
  // commit another render; this ref is intentionally read only by callbacks.
  const viewportResponder = useMemo(() => {
    // The responder stays stable while its event callbacks read current refs.
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onStartShouldSetPanResponder: (event) =>
        geometry.current.oversized && event.nativeEvent.touches.length >= 2,
      onMoveShouldSetPanResponder: (event, gesture) =>
        shouldCaptureBoardGesture(
          geometry.current.oversized,
          event.nativeEvent.touches.length,
          gesture.dx,
          gesture.dy,
        ),
      onPanResponderGrant: (event) => {
        viewportGesture.current =
          geometry.current.oversized && event.nativeEvent.touches.length >= 2;
        if (!viewportGesture.current) return;
        gestureStart.current = {
          distance: touchDistance(event),
          position: viewportState.current.position,
          zoom: viewportState.current.zoom,
        };
      },
      onPanResponderMove: (event, gesture) => {
        if (
          !geometry.current.oversized ||
          event.nativeEvent.touches.length < 2
        ) {
          return;
        }
        const distance = touchDistance(event);
        const start = gestureStart.current;
        const scale =
          distance !== null && start.distance !== null && start.distance > 0
            ? distance / start.distance
            : 1;
        applyViewport(start.zoom * scale, {
          x: start.position.x + gesture.dx,
          y: start.position.y + gesture.dy,
        });
      },
      onPanResponderRelease: (event, gesture) => {
        if (viewportGesture.current) {
          viewportGesture.current = false;
          return;
        }
        const direction = swipeDirection(gesture.dx, gesture.dy);
        if (direction !== null) onMoveRef.current(direction);
      },
    });
  }, []);

  const onLayout = (event: LayoutChangeEvent) => {
    const size = event.nativeEvent.layout.width;
    setViewportSize(size);
    const nextOversized = needsViewport(game.sideLength, size);
    geometry.current = {
      oversized: nextOversized,
      sideLength: game.sideLength,
      viewportSize: size,
    };
    applyViewport(viewportState.current.zoom, viewportState.current.position);
  };

  const row = Math.min(inspectorRow, game.sideLength - 1);
  const column = Math.min(inspectorColumn, game.sideLength - 1);
  const inspectorDescription = cellDescription(
    game.board[row][column],
    row,
    column,
  );
  const tileSize = oversized
    ? fittedTileSize(game.sideLength, baseBoardSize) * displayZoom
    : fittedTileSize(game.sideLength, viewportSize);

  return (
    <View style={styles.section}>
      <View
        accessibilityLabel={`${game.sideLength} by ${game.sideLength} game board`}
        onLayout={onLayout}
        style={[styles.viewport, oversized && styles.clippedViewport]}
        {...viewportResponder.panHandlers}
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
                          height: tileSize,
                          width: tileSize,
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
          <Text style={styles.edgeText}>{edgeDescription(edges)}</Text>
          <Text style={styles.viewportHint}>
            Two fingers pan or pinch. One finger still moves tiles.
          </Text>
          <View style={styles.controlRow}>
            <BoardButton
              disabled={zoom <= MIN_ZOOM}
              label="Zoom board out"
              onPress={() =>
                applyViewport(
                  viewportState.current.zoom - 0.25,
                  viewportState.current.position,
                )
              }
              text="Zoom −"
            />
            <BoardButton
              disabled={zoom >= MAX_ZOOM}
              label="Zoom board in"
              onPress={() =>
                applyViewport(
                  viewportState.current.zoom + 0.25,
                  viewportState.current.position,
                )
              }
              text="Zoom +"
            />
            <BoardButton
              label="Reset board viewport"
              onPress={() => {
                applyViewport(MIN_ZOOM, { x: 0, y: 0 });
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
