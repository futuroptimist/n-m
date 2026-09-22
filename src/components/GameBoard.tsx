import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';

import {
  tileValue,
  type Direction,
  type GameState,
  type MoveTransition,
} from '../engine';
import { colors, spacing } from '../theme';
import {
  MIN_ZOOM,
  boardContentSize,
  cellDescription,
  edgeDescription,
  fittedTileSize,
  maximumZoom,
  needsViewport,
  normalizeViewport,
  planTileTransitions,
  shouldCaptureBoardGesture,
  swipeDirection,
  visibleEdges,
  type ViewportPosition,
} from './boardInteraction';

interface GameBoardProps {
  controlsContent: ReactNode;
  game: GameState;
  onAnimationComplete: () => void;
  onMove: (direction: Direction) => void;
  transition: MoveTransition | null;
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

export function GameBoard({
  controlsContent,
  game,
  onAnimationComplete,
  onMove,
  transition,
}: GameBoardProps) {
  const [viewportSize, setViewportSize] = useState(0);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [position, setPosition] = useState<ViewportPosition>({ x: 0, y: 0 });
  const [controlsVisible, setControlsVisible] = useState(false);
  const [inspectorRow, setInspectorRow] = useState(0);
  const [inspectorColumn, setInspectorColumn] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [animation] = useState(() => new Animated.Value(1));
  const previousSideLength = useRef(game.sideLength);
  const gestureStart = useRef({
    distance: null as number | null,
    position: { x: 0, y: 0 },
    zoom: MIN_ZOOM,
  });
  const viewportGesture = useRef(false);
  const viewportState = useRef({ zoom: MIN_ZOOM, position: { x: 0, y: 0 } });
  const geometry = useRef({
    enlarged: false,
    overview: false,
    sideLength: game.sideLength,
    viewportSize: 0,
  });
  const onMoveRef = useRef(onMove);
  const overview = needsViewport(game.sideLength, viewportSize);
  const fitTileSize = Math.max(
    0,
    fittedTileSize(game.sideLength, viewportSize),
  );
  const contentSize = boardContentSize(game.sideLength, fitTileSize * zoom);
  const enlarged = zoom > MIN_ZOOM;
  const clampedPosition = normalizeViewport(
    overview,
    zoom,
    position,
    game.sideLength,
    viewportSize,
  ).position;
  const edges = visibleEdges(clampedPosition, contentSize, viewportSize);
  const tileSize = fitTileSize * zoom;
  const plannedTiles = useMemo(
    () =>
      transition === null ? [] : planTileTransitions(transition, tileSize),
    [tileSize, transition],
  );

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    animation.stopAnimation();
    if (transition === null || reduceMotion || viewportSize === 0) {
      animation.setValue(1);
      if (transition !== null) onAnimationComplete();
      return;
    }
    animation.setValue(0);
    Animated.timing(animation, {
      duration: 190,
      toValue: 1,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onAnimationComplete();
    });
    return () => animation.stopAnimation();
  }, [animation, onAnimationComplete, reduceMotion, transition, viewportSize]);

  useLayoutEffect(() => {
    const grew = previousSideLength.current !== game.sideLength;
    previousSideLength.current = game.sideLength;
    geometry.current = {
      enlarged: grew ? false : enlarged,
      overview,
      sideLength: game.sideLength,
      viewportSize,
    };
    const normalized = normalizeViewport(
      overview,
      grew ? MIN_ZOOM : viewportState.current.zoom,
      grew ? { x: 0, y: 0 } : viewportState.current.position,
      game.sideLength,
      viewportSize,
    );
    viewportState.current = normalized;
    setZoom(normalized.zoom);
    setPosition(normalized.position);
  }, [enlarged, game.sideLength, overview, viewportSize]);

  const applyViewport = (nextZoom: number, nextPosition: ViewportPosition) => {
    const current = geometry.current;
    const normalized = normalizeViewport(
      current.overview,
      nextZoom,
      nextPosition,
      current.sideLength,
      current.viewportSize,
    );
    viewportState.current = normalized;
    geometry.current.enlarged = normalized.zoom > MIN_ZOOM;
    setZoom(normalized.zoom);
    setPosition(normalized.position);
  };

  const viewportResponder = useMemo(
    () =>
      // Callbacks read the latest snapshots only after responder setup.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: (event) =>
          geometry.current.enlarged && event.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponder: (event, gesture) =>
          shouldCaptureBoardGesture(
            geometry.current.enlarged,
            event.nativeEvent.touches.length,
            gesture.dx,
            gesture.dy,
          ),
        onPanResponderGrant: (event) => {
          viewportGesture.current =
            geometry.current.enlarged && event.nativeEvent.touches.length >= 2;
          if (!viewportGesture.current) return;
          gestureStart.current = {
            distance: touchDistance(event),
            position: viewportState.current.position,
            zoom: viewportState.current.zoom,
          };
        },
        onPanResponderMove: (event, gesture) => {
          if (
            !geometry.current.enlarged ||
            event.nativeEvent.touches.length < 2
          )
            return;
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
        onPanResponderRelease: (_event, gesture) => {
          if (viewportGesture.current) {
            viewportGesture.current = false;
            return;
          }
          const direction = swipeDirection(gesture.dx, gesture.dy);
          if (direction !== null) onMoveRef.current(direction);
        },
        onPanResponderTerminate: () => {
          viewportGesture.current = false;
        },
      }),
    [],
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const size = Math.min(
      event.nativeEvent.layout.width,
      event.nativeEvent.layout.height,
    );
    if (size <= 0 || size === viewportSize) return;
    setViewportSize(size);
    geometry.current = {
      enlarged: viewportState.current.zoom > MIN_ZOOM,
      overview: needsViewport(game.sideLength, size),
      sideLength: game.sideLength,
      viewportSize: size,
    };
  };

  const row = Math.min(inspectorRow, game.sideLength - 1);
  const column = Math.min(inspectorColumn, game.sideLength - 1);
  const inspectorDescription = cellDescription(
    game.board[row][column],
    row,
    column,
  );
  const maxZoom = maximumZoom(game.sideLength, viewportSize);
  return (
    <View style={styles.section}>
      <Text accessibilityLiveRegion="polite" style={styles.scaleStatus}>
        {overview
          ? 'Overview · full board fit'
          : enlarged
            ? 'Touch-friendly · zoomed'
            : 'Touch-friendly · full board fit'}
      </Text>
      <View
        accessibilityLabel={`${game.sideLength} by ${game.sideLength} game board`}
        onLayout={onLayout}
        style={styles.viewport}
        {...viewportResponder.panHandlers}
      >
        {viewportSize > 0 ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.clippedBoard}
          >
            <View
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
                  {boardRow.map((exponent, columnIndex) => (
                    <Tile
                      exponent={transition === null ? exponent : null}
                      key={`cell-${rowIndex}-${columnIndex}`}
                      size={tileSize}
                    />
                  ))}
                </View>
              ))}
            </View>
            {transition === null
              ? null
              : plannedTiles.map((tile) => (
                  <Animated.View
                    key={tile.key}
                    style={[
                      styles.animatedTile,
                      {
                        height: tileSize,
                        left: tile.left + clampedPosition.x,
                        opacity: animation.interpolate({
                          inputRange: [0, 0.84, 1],
                          outputRange: [1, 1, 0],
                        }),
                        top: tile.top + clampedPosition.y,
                        transform: [
                          {
                            translateX: animation.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, tile.translateX],
                            }),
                          },
                          {
                            translateY: animation.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, tile.translateY],
                            }),
                          },
                        ],
                        width: tileSize,
                      },
                    ]}
                  >
                    <Tile exponent={tile.exponent} size={tileSize} />
                  </Animated.View>
                ))}
          </View>
        ) : null}
      </View>
      <Pressable
        accessibilityLabel="Open game controls"
        accessibilityRole="button"
        onPress={() => setControlsVisible(true)}
        style={({ pressed }) => [
          styles.controlsButton,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.controlsButtonText}>Controls</Text>
      </Pressable>

      <Modal
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={() => setControlsVisible(false)}
        presentationStyle="pageSheet"
        visible={controlsVisible}
      >
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <Text accessibilityRole="header" style={styles.modalTitle}>
              Game controls
            </Text>
            <BoardButton
              label="Close game controls"
              onPress={() => setControlsVisible(false)}
              text="Done"
            />
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.edgeText}>{edgeDescription(edges)}</Text>
            <Text style={styles.viewportHint}>
              Fit always shows the whole board. Two fingers pan or pinch after
              zooming in; one finger on the board moves tiles.
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
                disabled={zoom >= maxZoom}
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
                label="Fit entire board"
                onPress={() => applyViewport(MIN_ZOOM, { x: 0, y: 0 })}
                text="Fit board"
              />
            </View>

            <View style={styles.panel}>
              <Text accessibilityRole="header" style={styles.panelTitle}>
                Move tiles
              </Text>
              <View style={styles.moveGrid}>
                <View style={styles.moveSpacer} />
                <MoveButton direction="up" onMove={onMove} symbol="↑" />
                <View style={styles.moveSpacer} />
                <MoveButton direction="left" onMove={onMove} symbol="←" />
                <MoveButton direction="down" onMove={onMove} symbol="↓" />
                <MoveButton direction="right" onMove={onMove} symbol="→" />
              </View>
            </View>

            <View style={styles.panel}>
              <Text accessibilityRole="header" style={styles.panelTitle}>
                Board inspector
              </Text>
              <Text style={styles.inspectorValue}>{inspectorDescription}</Text>
              <View style={styles.controlRow}>
                <BoardButton
                  disabled={row === 0}
                  label="Previous board row"
                  onPress={() => {
                    const next = row - 1;
                    setInspectorRow(next);
                    AccessibilityInfo.announceForAccessibility(
                      cellDescription(game.board[next][column], next, column),
                    );
                  }}
                  text="Row −"
                />
                <BoardButton
                  disabled={row === game.sideLength - 1}
                  label="Next board row"
                  onPress={() => {
                    const next = row + 1;
                    setInspectorRow(next);
                    AccessibilityInfo.announceForAccessibility(
                      cellDescription(game.board[next][column], next, column),
                    );
                  }}
                  text="Row +"
                />
                <BoardButton
                  disabled={column === 0}
                  label="Previous board column"
                  onPress={() => {
                    const next = column - 1;
                    setInspectorColumn(next);
                    AccessibilityInfo.announceForAccessibility(
                      cellDescription(game.board[row][next], row, next),
                    );
                  }}
                  text="Column −"
                />
                <BoardButton
                  disabled={column === game.sideLength - 1}
                  label="Next board column"
                  onPress={() => {
                    const next = column + 1;
                    setInspectorColumn(next);
                    AccessibilityInfo.announceForAccessibility(
                      cellDescription(game.board[row][next], row, next),
                    );
                  }}
                  text="Column +"
                />
              </View>
            </View>
            {controlsContent}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function Tile({ exponent, size }: { exponent: number | null; size: number }) {
  const value = exponent === null ? null : tileValue(exponent).toString();
  const darkTile = exponent !== null && exponent > 5;
  return (
    <View
      style={[
        styles.cell,
        {
          backgroundColor:
            exponent === null ? colors.empty : tileBackground(exponent),
          height: size,
          width: size,
        },
      ]}
    >
      {value === null ? null : (
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.3}
          numberOfLines={1}
          style={[
            styles.tileValue,
            {
              color: darkTile ? colors.white : colors.ink,
              fontSize: Math.max(8, Math.min(30, size / 3)),
            },
          ]}
        >
          {value}
        </Text>
      )}
    </View>
  );
}

function MoveButton({
  direction,
  onMove,
  symbol,
}: {
  direction: Direction;
  onMove: (direction: Direction) => void;
  symbol: string;
}) {
  return (
    <Pressable
      accessibilityLabel={`Move ${direction}`}
      accessibilityRole="button"
      onPress={() => onMove(direction)}
      style={({ pressed }) => [styles.moveButton, pressed && styles.pressed]}
    >
      <Text style={styles.moveSymbol}>{symbol}</Text>
    </Pressable>
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
  section: { flex: 1, gap: 6, minHeight: 0 },
  scaleStatus: { color: colors.mutedInk, fontSize: 13, fontWeight: '700' },
  viewport: { aspectRatio: 1, maxHeight: '100%', width: '100%' },
  clippedBoard: {
    borderRadius: 12,
    flex: 1,
    overflow: 'hidden',
  },
  board: { backgroundColor: colors.board, borderRadius: 10, padding: 3 },
  row: { flexDirection: 'row' },
  cell: {
    alignItems: 'center',
    borderColor: 'rgba(39, 35, 31, 0.2)',
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    margin: 3,
  },
  animatedTile: { position: 'absolute' },
  tileValue: {
    fontWeight: '800',
    paddingHorizontal: 1,
    textAlign: 'center',
    width: '100%',
  },
  controlsButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
  },
  controlsButtonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  modalScreen: { backgroundColor: colors.background, flex: 1, paddingTop: 20 },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.medium,
  },
  modalTitle: { color: colors.ink, fontSize: 26, fontWeight: '900' },
  modalContent: {
    gap: spacing.medium,
    padding: spacing.medium,
    paddingBottom: 40,
  },
  edgeText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  viewportHint: { color: colors.mutedInk, fontSize: 14, lineHeight: 20 },
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
  panel: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: 12,
    gap: spacing.small,
    padding: 12,
  },
  panelTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  inspectorValue: { color: colors.ink, fontSize: 16 },
  moveGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, width: 144 },
  moveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  moveSpacer: { height: 44, width: 44 },
  moveSymbol: { color: colors.white, fontSize: 25, fontWeight: '800' },
});
