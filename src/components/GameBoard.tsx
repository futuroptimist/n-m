import { useState } from 'react';
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
import { colors } from '../theme';
import {
  clampViewport,
  edgeDescription,
  inspectorDescription,
  MAX_VIEWPORT_SCALE,
  MIN_TILE_SIZE,
  usesClippedViewport,
  visibleEdges,
  type Viewport,
} from './boardInteraction';

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

function touchDistance(event: GestureResponderEvent): number {
  const [first, second] = event.nativeEvent.touches;
  return first && second
    ? Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY)
    : 0;
}

function tileBackground(exponent: number): string {
  if (exponent <= 2) return colors.tileLight;
  if (exponent <= 5) return colors.tileMid;
  return colors.tileDark;
}

export function GameBoard({ game, onMove }: GameBoardProps) {
  const [width, setWidth] = useState(0);
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, x: 0, y: 0 });
  const [inspector, setInspector] = useState({ row: 0, column: 0 });
  const [gestureStart, setGestureStart] = useState({ viewport, distance: 0 });
  const [usedTwoFingerGesture, setUsedTwoFingerGesture] = useState(false);
  const clipped = usesClippedViewport(game.sideLength, width);
  const tileSize = clipped ? MIN_TILE_SIZE : width / game.sideLength;
  const boardSize = tileSize * game.sideLength;

  const inspectedCell = {
    column: Math.min(inspector.column, game.sideLength - 1),
    row: Math.min(inspector.row, game.sideLength - 1),
  };

  const updateViewport = (next: Viewport) =>
    setViewport(clampViewport(next, boardSize, width));
  const resetViewport = () => setViewport({ scale: 1, x: 0, y: 0 });
  const zoom = (amount: number) =>
    updateViewport({ ...viewport, scale: viewport.scale + amount });

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (event, gesture) =>
      event.nativeEvent.touches.length >= 2 ||
      swipeDirection(gesture.dx, gesture.dy) !== null,
    onPanResponderGrant: (event) => {
      setUsedTwoFingerGesture(event.nativeEvent.touches.length >= 2);
      setGestureStart({ viewport, distance: touchDistance(event) });
    },
    onPanResponderMove: (event, gesture) => {
      if (!clipped || event.nativeEvent.touches.length < 2) return;
      setUsedTwoFingerGesture(true);
      const distance = touchDistance(event);
      const ratio =
        gestureStart.distance > 0 ? distance / gestureStart.distance : 1;
      updateViewport({
        scale: gestureStart.viewport.scale * ratio,
        x: gestureStart.viewport.x + gesture.dx,
        y: gestureStart.viewport.y + gesture.dy,
      });
    },
    onPanResponderRelease: (event, gesture) => {
      if (usedTwoFingerGesture) return;
      const direction = swipeDirection(gesture.dx, gesture.dy);
      if (direction !== null) onMove(direction);
    },
  });

  const edges = edgeDescription(visibleEdges(viewport, boardSize, width));
  const onLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setWidth(nextWidth);
    setViewport((current) =>
      clampViewport(
        current,
        Math.max(nextWidth, game.sideLength * MIN_TILE_SIZE),
        nextWidth,
      ),
    );
  };

  return (
    <View onLayout={onLayout}>
      <View
        {...panResponder.panHandlers}
        accessibilityLabel={`${game.sideLength} by ${game.sideLength} game board. ${edges}`}
        style={[styles.viewport, width > 0 && { height: width }]}
      >
        <View
          style={[
            styles.board,
            {
              height: boardSize,
              left: viewport.x,
              top: viewport.y,
              transform: [{ scale: viewport.scale }],
              width: boardSize,
            },
          ]}
        >
          {game.board.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.row}>
              {row.map((exponent, columnIndex) => {
                const value =
                  exponent === null ? null : tileValue(exponent).toString();
                return (
                  <View
                    importantForAccessibility="no-hide-descendants"
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
                            color:
                              exponent !== null && exponent > 5
                                ? colors.white
                                : colors.ink,
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
      </View>

      <Text accessibilityLiveRegion="polite" style={styles.edgeText}>
        {edges}
      </Text>
      {clipped ? (
        <View style={styles.zoomControls}>
          <BoardButton
            disabled={viewport.scale >= MAX_VIEWPORT_SCALE}
            label="Zoom in"
            onPress={() => zoom(0.25)}
            text="Zoom +"
          />
          <BoardButton
            disabled={viewport.scale <= 1}
            label="Zoom out"
            onPress={() => zoom(-0.25)}
            text="Zoom −"
          />
          <BoardButton
            disabled={
              viewport.scale === 1 && viewport.x === 0 && viewport.y === 0
            }
            label="Fit and reset board viewport"
            onPress={resetViewport}
            text="Fit / reset"
          />
        </View>
      ) : null}

      <View style={styles.moveControls}>
        {(['up', 'left', 'down', 'right'] as const).map((direction) => (
          <BoardButton
            key={direction}
            disabled={game.status === 'game-over'}
            label={`Move ${direction}`}
            onPress={() => onMove(direction)}
            text={direction[0].toUpperCase() + direction.slice(1)}
          />
        ))}
      </View>

      <View style={styles.inspector}>
        <Text accessibilityRole="header" style={styles.inspectorTitle}>
          Board inspector
        </Text>
        <Text accessibilityLiveRegion="polite" style={styles.inspectorValue}>
          {inspectorDescription(
            game.board,
            inspectedCell.row,
            inspectedCell.column,
          )}
        </Text>
        <View style={styles.inspectorControls}>
          <BoardButton
            disabled={inspectedCell.row === 0}
            label="Previous row"
            onPress={() =>
              setInspector((value) => ({
                ...value,
                row: inspectedCell.row - 1,
              }))
            }
            text="Row −"
          />
          <BoardButton
            disabled={inspectedCell.row === game.sideLength - 1}
            label="Next row"
            onPress={() =>
              setInspector((value) => ({
                ...value,
                row: inspectedCell.row + 1,
              }))
            }
            text="Row +"
          />
          <BoardButton
            disabled={inspectedCell.column === 0}
            label="Previous column"
            onPress={() =>
              setInspector((value) => ({
                ...value,
                column: inspectedCell.column - 1,
              }))
            }
            text="Column −"
          />
          <BoardButton
            disabled={inspectedCell.column === game.sideLength - 1}
            label="Next column"
            onPress={() =>
              setInspector((value) => ({
                ...value,
                column: inspectedCell.column + 1,
              }))
            }
            text="Column +"
          />
        </View>
      </View>
    </View>
  );
}

function BoardButton({
  disabled,
  label,
  onPress,
  text,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  text: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonText, disabled && styles.disabledText]}>
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  viewport: {
    backgroundColor: colors.board,
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
  board: {
    backgroundColor: colors.board,
    transformOrigin: 'top left',
  },
  row: { flexDirection: 'row' },
  cell: {
    alignItems: 'center',
    borderColor: 'rgba(39, 35, 31, 0.2)',
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
  },
  tileValue: {
    fontSize: 24,
    fontWeight: '800',
    paddingHorizontal: 2,
    textAlign: 'center',
    width: '100%',
  },
  edgeText: {
    color: colors.mutedInk,
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  zoomControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 8,
  },
  moveControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 12,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
  },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  disabled: {
    backgroundColor: '#d2cec7',
    borderColor: '#aaa49b',
    borderWidth: 1,
  },
  disabledText: { color: '#706b64' },
  pressed: { backgroundColor: colors.primaryPressed, opacity: 0.9 },
  inspector: {
    backgroundColor: colors.panel,
    borderRadius: 12,
    marginTop: 12,
    padding: 12,
  },
  inspectorTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  inspectorValue: { color: colors.ink, fontSize: 16, marginVertical: 8 },
  inspectorControls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
