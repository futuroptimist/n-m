import { useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';

import { tileValue, type Direction, type GameState } from '../engine';
import {
  MAX_VIEWPORT_ZOOM,
  baseTileSize,
  cellDescription,
  clampViewport,
  usesClippedViewport,
  visibleEdges,
  visibleRange,
  type ViewportTransform,
} from '../interaction/gameInteraction';
import { colors, spacing } from '../theme';

interface GameBoardProps {
  game: GameState;
  onMove: (direction: Direction) => void;
}

const MIN_SWIPE_DISTANCE = 32;
const CARDINAL_DOMINANCE = 1.5;

function swipeDirection(dx: number, dy: number): Direction | null {
  const horizontal = Math.abs(dx);
  const vertical = Math.abs(dy);
  if (
    horizontal >= MIN_SWIPE_DISTANCE &&
    horizontal >= vertical * CARDINAL_DOMINANCE
  )
    return dx > 0 ? 'right' : 'left';
  if (
    vertical >= MIN_SWIPE_DISTANCE &&
    vertical >= horizontal * CARDINAL_DOMINANCE
  )
    return dy > 0 ? 'down' : 'up';
  return null;
}

function tileBackground(exponent: number): string {
  if (exponent <= 2) return colors.tileLight;
  if (exponent <= 5) return colors.tileMid;
  return colors.tileDark;
}

function twoTouchGeometry(event: GestureResponderEvent) {
  const [first, second] = event.nativeEvent.touches;
  if (first === undefined || second === undefined) return null;
  const dx = second.pageX - first.pageX;
  const dy = second.pageY - first.pageY;
  return {
    centerX: (first.locationX + second.locationX) / 2,
    centerY: (first.locationY + second.locationY) / 2,
    distance: Math.hypot(dx, dy),
  };
}

export function GameBoard({ game, onMove }: GameBoardProps) {
  const [viewportSize, setViewportSize] = useState(0);
  const [transform, setTransform] = useState<ViewportTransform>({
    scale: 1,
    x: 0,
    y: 0,
  });
  const [inspectorRow, setInspectorRow] = useState(0);
  const [inspectorColumn, setInspectorColumn] = useState(0);
  const transformRef = useRef(transform);
  const lastTwoTouch = useRef<ReturnType<typeof twoTouchGeometry>>(null);

  const tileSize =
    viewportSize === 0 ? 0 : baseTileSize(viewportSize, game.sideLength);
  const boardSize = tileSize * game.sideLength;
  const clipped =
    viewportSize > 0 && usesClippedViewport(viewportSize, game.sideLength);

  const updateTransform = (next: ViewportTransform) => {
    const clamped = clampViewport(next, viewportSize, boardSize);
    transformRef.current = clamped;
    setTransform(clamped);
  };

  /* PanResponder callbacks run after render; refs keep high-frequency gesture
     geometry current without scheduling a render for every native touch. */
  /* eslint-disable react-hooks/refs */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) =>
          event.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponder: (event, gesture) =>
          event.nativeEvent.touches.length >= 2 ||
          swipeDirection(gesture.dx, gesture.dy) !== null,
        onMoveShouldSetPanResponderCapture: (event) =>
          event.nativeEvent.touches.length >= 2,
        onPanResponderGrant: (event) => {
          lastTwoTouch.current = twoTouchGeometry(event);
        },
        onPanResponderMove: (event) => {
          const geometry = twoTouchGeometry(event);
          const previous = lastTwoTouch.current;
          if (geometry === null) return;
          if (previous !== null && previous.distance > 0) {
            const current = transformRef.current;
            const scale = Math.min(
              MAX_VIEWPORT_ZOOM,
              Math.max(
                1,
                current.scale * (geometry.distance / previous.distance),
              ),
            );
            const ratio = scale / current.scale;
            updateTransform({
              scale,
              x: geometry.centerX - (previous.centerX - current.x) * ratio,
              y: geometry.centerY - (previous.centerY - current.y) * ratio,
            });
          }
          lastTwoTouch.current = geometry;
        },
        onPanResponderRelease: (event, gesture) => {
          if (lastTwoTouch.current === null) {
            const direction = swipeDirection(gesture.dx, gesture.dy);
            if (direction !== null) onMove(direction);
          }
          lastTwoTouch.current = null;
        },
        onPanResponderTerminate: () => {
          lastTwoTouch.current = null;
        },
      }),
    // onMove is stable in GameScreen. Viewport measurements are intentionally
    // captured so each responder clamps against the board currently on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boardSize, onMove, viewportSize],
  );
  /* eslint-enable react-hooks/refs */

  const displayTransform = clampViewport(transform, viewportSize, boardSize);

  const range =
    viewportSize === 0 || tileSize === 0
      ? null
      : visibleRange(displayTransform, viewportSize, tileSize, game.sideLength);
  const renderedCells = [];
  if (range !== null) {
    const scaledTile = tileSize * displayTransform.scale;
    for (let row = range.firstRow; row <= range.lastRow; row += 1) {
      for (
        let column = range.firstColumn;
        column <= range.lastColumn;
        column += 1
      ) {
        const exponent = game.board[row][column];
        const value = exponent === null ? null : tileValue(exponent).toString();
        const darkTile = exponent !== null && exponent > 5;
        renderedCells.push(
          <View
            importantForAccessibility="no-hide-descendants"
            key={`cell-${row}-${column}`}
            style={[
              styles.cell,
              {
                backgroundColor:
                  exponent === null ? colors.empty : tileBackground(exponent),
                height: scaledTile,
                left: displayTransform.x + column * scaledTile,
                top: displayTransform.y + row * scaledTile,
                width: scaledTile,
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
                    fontSize: Math.max(12, Math.min(30, scaledTile * 0.42)),
                  },
                ]}
              >
                {value}
              </Text>
            )}
          </View>,
        );
      }
    }
  }

  const zoom = (factor: number) =>
    updateTransform({
      ...transformRef.current,
      scale: transform.scale * factor,
    });
  const inspectorDescription = cellDescription(
    game.board,
    inspectorRow,
    inspectorColumn,
  );

  return (
    <View style={styles.section}>
      <View
        {...panResponder.panHandlers}
        accessible
        accessibilityLabel={`${game.sideLength} by ${game.sideLength} game board. One finger swipes move tiles${clipped ? '; two fingers pan and zoom' : ''}.`}
        onLayout={(event: LayoutChangeEvent) =>
          setViewportSize(Math.floor(event.nativeEvent.layout.width))
        }
        style={styles.viewport}
      >
        {renderedCells}
      </View>

      {clipped && range !== null ? (
        <View style={styles.viewportPanel}>
          <Text accessibilityLiveRegion="polite" style={styles.edgeStatus}>
            {visibleEdges(range, game.sideLength)}
          </Text>
          <View style={styles.controlRow}>
            <BoardButton
              disabled={transform.scale <= 1}
              label="Zoom board out"
              onPress={() => zoom(0.8)}
              text="Zoom −"
            />
            <BoardButton
              disabled={transform.scale >= MAX_VIEWPORT_ZOOM}
              label="Zoom board in"
              onPress={() => zoom(1.25)}
              text="Zoom +"
            />
            <BoardButton
              label="Fit and reset board viewport"
              onPress={() => updateTransform({ scale: 1, x: 0, y: 0 })}
              text="Fit / reset"
            />
          </View>
          <Text style={styles.viewportHelp}>
            Two fingers pan and pinch the view. One finger always moves tiles.
          </Text>
        </View>
      ) : null}

      <View style={styles.movePanel}>
        <Text accessibilityRole="header" style={styles.panelTitle}>
          Move tiles
        </Text>
        <View style={styles.directionGrid}>
          <BoardButton label="Move up" onPress={() => onMove('up')} text="↑" />
          <View style={styles.directionRow}>
            <BoardButton
              label="Move left"
              onPress={() => onMove('left')}
              text="←"
            />
            <BoardButton
              label="Move down"
              onPress={() => onMove('down')}
              text="↓"
            />
            <BoardButton
              label="Move right"
              onPress={() => onMove('right')}
              text="→"
            />
          </View>
        </View>
      </View>

      <View style={styles.inspector}>
        <Text accessibilityRole="header" style={styles.panelTitle}>
          Board inspector
        </Text>
        <Text accessibilityLiveRegion="polite" style={styles.inspectorValue}>
          {inspectorDescription}
        </Text>
        <View style={styles.controlRow}>
          <BoardButton
            disabled={inspectorRow === 0}
            label="Previous row"
            onPress={() => setInspectorRow((row) => Math.max(0, row - 1))}
            text="Row −"
          />
          <BoardButton
            disabled={inspectorRow === game.sideLength - 1}
            label="Next row"
            onPress={() =>
              setInspectorRow((row) => Math.min(game.sideLength - 1, row + 1))
            }
            text="Row +"
          />
          <BoardButton
            disabled={inspectorColumn === 0}
            label="Previous column"
            onPress={() =>
              setInspectorColumn((column) => Math.max(0, column - 1))
            }
            text="Column −"
          />
          <BoardButton
            disabled={inspectorColumn === game.sideLength - 1}
            label="Next column"
            onPress={() =>
              setInspectorColumn((column) =>
                Math.min(game.sideLength - 1, column + 1),
              )
            }
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
  viewport: {
    aspectRatio: 1,
    backgroundColor: colors.board,
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
  cell: {
    alignItems: 'center',
    borderColor: 'rgba(39, 35, 31, 0.2)',
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    position: 'absolute',
  },
  tileValue: {
    fontWeight: '800',
    paddingHorizontal: 2,
    textAlign: 'center',
    width: '100%',
  },
  viewportPanel: { gap: 6 },
  edgeStatus: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  viewportHelp: { color: colors.mutedInk, fontSize: 14 },
  controlRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  controlButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
  },
  controlText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  pressed: { backgroundColor: colors.primaryPressed, opacity: 0.9 },
  disabledButton: {
    backgroundColor: '#d2cec7',
    borderColor: '#aaa49b',
    borderWidth: 1,
  },
  disabledText: { color: '#706b64' },
  movePanel: { alignItems: 'center', gap: 6 },
  panelTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  directionGrid: {
    alignItems: 'center',
    gap: 6,
  },
  directionRow: { flexDirection: 'row', gap: 6 },
  inspector: {
    backgroundColor: colors.panel,
    borderRadius: 12,
    gap: 8,
    padding: 12,
  },
  inspectorValue: { color: colors.ink, fontSize: 16, fontWeight: '700' },
});
