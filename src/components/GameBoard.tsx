import { useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { tileValue, type GameState } from '../engine';
import { colors, spacing } from '../theme';
import {
  MAX_VIEWPORT_SCALE,
  MIN_TILE_SIZE,
  clampViewport,
  edgeDescription,
  inspectorDescription,
  needsLargeBoardViewport,
  visibleEdges,
  type ViewportPosition,
} from './gameInteraction';

interface GameBoardProps {
  game: GameState;
}

function tileBackground(exponent: number): string {
  if (exponent <= 2) return colors.tileLight;
  if (exponent <= 5) return colors.tileMid;
  return colors.tileDark;
}

function touchDistance(
  touches: readonly { pageX: number; pageY: number }[],
): number | null {
  if (touches.length < 2) return null;
  return Math.hypot(
    touches[0].pageX - touches[1].pageX,
    touches[0].pageY - touches[1].pageY,
  );
}

export function GameBoard({ game }: GameBoardProps) {
  const [viewportSize, setViewportSize] = useState(0);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState<ViewportPosition>({ x: 0, y: 0 });
  const [inspector, setInspector] = useState({ row: 0, column: 0 });
  const gestureStart = useRef({
    position: { x: 0, y: 0 },
    scale: 1,
    distance: null as number | null,
  });
  const usesViewport = needsLargeBoardViewport(viewportSize, game.sideLength);
  const contentSize = game.sideLength * MIN_TILE_SIZE;
  const clampedPosition = clampViewport(
    position,
    viewportSize,
    contentSize,
    scale,
  );
  const inspectedCell = {
    row: Math.min(inspector.row, game.sideLength - 1),
    column: Math.min(inspector.column, game.sideLength - 1),
  };

  const panResponder = useMemo(
    () =>
      // PanResponder invokes these stored handlers after render.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onMoveShouldSetPanResponder: (event) =>
          usesViewport && event.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponderCapture: (event) =>
          usesViewport && event.nativeEvent.touches.length >= 2,
        onPanResponderGrant: (event) => {
          gestureStart.current = {
            position: clampedPosition,
            scale,
            distance: touchDistance(event.nativeEvent.touches),
          };
        },
        onPanResponderMove: (event, gesture) => {
          if (event.nativeEvent.touches.length < 2) return;
          const start = gestureStart.current;
          const distance = touchDistance(event.nativeEvent.touches);
          const nextScale = Math.min(
            MAX_VIEWPORT_SCALE,
            Math.max(
              1,
              start.distance === null || distance === null
                ? start.scale
                : start.scale * (distance / start.distance),
            ),
          );
          setScale(nextScale);
          setPosition(
            clampViewport(
              {
                x: start.position.x + gesture.dx,
                y: start.position.y + gesture.dy,
              },
              viewportSize,
              contentSize,
              nextScale,
            ),
          );
        },
      }),
    [clampedPosition, contentSize, scale, usesViewport, viewportSize],
  );

  const setZoom = (nextScale: number) => {
    const bounded = Math.min(MAX_VIEWPORT_SCALE, Math.max(1, nextScale));
    setScale(bounded);
    setPosition((current) =>
      clampViewport(current, viewportSize, contentSize, bounded),
    );
  };
  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };
  const edges = visibleEdges(clampedPosition, viewportSize, contentSize, scale);
  const edgeStatus = edgeDescription(edges);
  const inspectedExponent = game.board[inspectedCell.row][inspectedCell.column];
  const inspectedDescription = inspectorDescription(
    inspectedCell.row,
    inspectedCell.column,
    inspectedExponent,
  );

  const onLayout = (event: LayoutChangeEvent) => {
    setViewportSize(event.nativeEvent.layout.width);
  };

  return (
    <View style={styles.container}>
      <View
        accessibilityLabel={`${game.sideLength} by ${game.sideLength} game board. One finger swipes move tiles${usesViewport ? '; use two fingers to pan or zoom the view' : ''}.`}
        onLayout={onLayout}
        style={styles.viewport}
        {...panResponder.panHandlers}
      >
        <View
          accessibilityElementsHidden={usesViewport}
          importantForAccessibility={
            usesViewport ? 'no-hide-descendants' : 'auto'
          }
          style={[
            styles.board,
            usesViewport && {
              height: contentSize,
              left: clampedPosition.x,
              position: 'absolute',
              top: clampedPosition.y,
              transform: [{ scale }],
              transformOrigin: 'top left',
              width: contentSize,
            },
          ]}
        >
          {game.board.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.row}>
              {row.map((exponent, columnIndex) => {
                const value =
                  exponent === null ? null : tileValue(exponent).toString();
                const darkTile = exponent !== null && exponent > 5;
                return (
                  <View
                    accessibilityLabel={inspectorDescription(
                      rowIndex,
                      columnIndex,
                      exponent,
                    )}
                    accessible
                    key={`cell-${rowIndex}-${columnIndex}`}
                    style={[
                      styles.cell,
                      usesViewport && {
                        flex: undefined,
                        height: MIN_TILE_SIZE - 6,
                        width: MIN_TILE_SIZE - 6,
                      },
                      {
                        backgroundColor:
                          exponent === null
                            ? colors.empty
                            : tileBackground(exponent),
                      },
                    ]}
                  >
                    {value !== null ? (
                      <Text
                        adjustsFontSizeToFit
                        minimumFontScale={0.45}
                        numberOfLines={1}
                        style={[
                          styles.tileValue,
                          {
                            color: darkTile ? colors.white : colors.ink,
                            fontSize: usesViewport
                              ? 16
                              : Math.max(
                                  10,
                                  Math.min(30, 104 / game.sideLength),
                                ),
                          },
                        ]}
                      >
                        {value}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {usesViewport ? (
        <View style={styles.viewportTools}>
          <Text accessibilityLiveRegion="polite" style={styles.edgeStatus}>
            {edgeStatus}
          </Text>
          <View style={styles.buttonRow}>
            <ToolButton
              disabled={scale >= MAX_VIEWPORT_SCALE}
              label="Zoom in"
              onPress={() => setZoom(scale + 0.25)}
              text="Zoom +"
            />
            <ToolButton
              disabled={scale <= 1}
              label="Zoom out"
              onPress={() => setZoom(scale - 0.25)}
              text="Zoom −"
            />
            <ToolButton
              disabled={
                scale === 1 &&
                clampedPosition.x === 0 &&
                clampedPosition.y === 0
              }
              label="Fit or reset board view"
              onPress={resetView}
              text="Fit / reset"
            />
          </View>
        </View>
      ) : null}

      <View style={styles.inspector}>
        <Text accessibilityRole="header" style={styles.inspectorTitle}>
          Board inspector
        </Text>
        <Text accessibilityLiveRegion="polite" style={styles.inspectorValue}>
          {inspectedDescription}
        </Text>
        <View style={styles.buttonRow}>
          <ToolButton
            disabled={inspectedCell.row === 0}
            label="Inspect previous row"
            onPress={() =>
              setInspector({ ...inspectedCell, row: inspectedCell.row - 1 })
            }
            text="Row −"
          />
          <ToolButton
            disabled={inspectedCell.row === game.sideLength - 1}
            label="Inspect next row"
            onPress={() =>
              setInspector({ ...inspectedCell, row: inspectedCell.row + 1 })
            }
            text="Row +"
          />
          <ToolButton
            disabled={inspectedCell.column === 0}
            label="Inspect previous column"
            onPress={() =>
              setInspector({
                ...inspectedCell,
                column: inspectedCell.column - 1,
              })
            }
            text="Column −"
          />
          <ToolButton
            disabled={inspectedCell.column === game.sideLength - 1}
            label="Inspect next column"
            onPress={() =>
              setInspector({
                ...inspectedCell,
                column: inspectedCell.column + 1,
              })
            }
            text="Column +"
          />
        </View>
      </View>
    </View>
  );
}

interface ToolButtonProps {
  disabled: boolean;
  label: string;
  onPress: () => void;
  text: string;
}

function ToolButton({ disabled, label, onPress, text }: ToolButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.toolButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}
    >
      <Text style={[styles.toolButtonText, disabled && styles.disabledText]}>
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.small },
  viewport: {
    aspectRatio: 1,
    backgroundColor: colors.board,
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
  board: {
    backgroundColor: colors.board,
    height: '100%',
    padding: 3,
    width: '100%',
  },
  row: { flex: 1, flexDirection: 'row' },
  cell: {
    alignItems: 'center',
    borderColor: 'rgba(39, 35, 31, 0.2)',
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    margin: 3,
    minHeight: 0,
    minWidth: 0,
  },
  tileValue: {
    fontWeight: '800',
    paddingHorizontal: 2,
    textAlign: 'center',
    width: '100%',
  },
  viewportTools: { gap: spacing.small },
  edgeStatus: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
    justifyContent: 'center',
  },
  toolButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  toolButtonText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  disabledButton: {
    backgroundColor: '#d2cec7',
    borderColor: '#aaa49b',
    borderWidth: 1,
  },
  disabledText: { color: '#706b64' },
  pressedButton: { backgroundColor: colors.primaryPressed },
  inspector: {
    backgroundColor: colors.panel,
    borderRadius: 12,
    gap: spacing.small,
    padding: 12,
  },
  inspectorTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  inspectorValue: { color: colors.ink, fontSize: 16, minHeight: 22 },
});
