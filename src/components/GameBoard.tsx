import {
  Children,
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
  type EngineEvent,
  type GameState,
  type TileTransition,
} from '../engine';
import { colors, spacing } from '../theme';
import {
  MIN_ZOOM,
  TILE_GUTTER,
  boardContentSize,
  boardScale,
  cellDescription,
  clampViewport,
  edgeDescription,
  normalizeViewport,
  planTileMotion,
  shouldCaptureBoardGesture,
  swipeDirection,
  visibleEdges,
  type ViewportPosition,
} from './boardInteraction';

interface GameBoardProps {
  game: GameState;
  onMove: (direction: Direction) => void;
  transition: readonly TileTransition[];
  events: readonly EngineEvent[];
  reducedMotion: boolean;
  onAnimationComplete: () => void;
  controlsVisible: boolean;
  onCloseControls: () => void;
  controls: ReactNode;
}

const SLIDE_DURATION = 150;
const SPAWN_DURATION = 110;

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
  game,
  onMove,
  transition,
  events,
  reducedMotion,
  onAnimationComplete,
  controlsVisible,
  onCloseControls,
  controls,
}: GameBoardProps) {
  const [viewportSize, setViewportSize] = useState(0);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [position, setPosition] = useState<ViewportPosition>({ x: 0, y: 0 });
  const [inspectorRow, setInspectorRow] = useState(0);
  const [inspectorColumn, setInspectorColumn] = useState(0);
  const [spawning, setSpawning] = useState(false);
  const [completedTransition, setCompletedTransition] = useState<
    readonly TileTransition[]
  >([]);
  const [progress] = useState(() => new Animated.Value(1));
  const [spawnProgress] = useState(() => new Animated.Value(1));
  const gestureStart = useRef({
    distance: null as number | null,
    position: { x: 0, y: 0 },
    zoom: MIN_ZOOM,
  });
  const viewportGesture = useRef(false);
  const viewportState = useRef({ zoom: MIN_ZOOM, position: { x: 0, y: 0 } });
  const previousSideLength = useRef(game.sideLength);
  const geometry = useRef({
    navigable: false,
    sideLength: game.sideLength,
    viewportSize: 0,
  });
  const onMoveRef = useRef(onMove);
  const scale = boardScale(game.sideLength, viewportSize);
  const contentSize = boardContentSize(
    game.sideLength,
    scale.fitTileSize * zoom,
  );
  const navigable = contentSize > viewportSize + 0.5;
  const clampedPosition = clampViewport(position, contentSize, viewportSize);
  const edges = visibleEdges(clampedPosition, contentSize, viewportSize);
  const tileSize = scale.fitTileSize * zoom;
  const cellPitch = tileSize + TILE_GUTTER;
  const motion = planTileMotion(transition, cellPitch);
  const spawn = events.find((event) => event.type === 'spawn');
  const sliding =
    transition.length > 0 &&
    transition !== completedTransition &&
    !reducedMotion &&
    viewportSize > 0;

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useLayoutEffect(() => {
    geometry.current = { navigable, sideLength: game.sideLength, viewportSize };
    const grew = game.sideLength > previousSideLength.current;
    previousSideLength.current = game.sideLength;
    const normalized = normalizeViewport(
      grew ? MIN_ZOOM : viewportState.current.zoom,
      grew ? { x: 0, y: 0 } : viewportState.current.position,
      game.sideLength,
      viewportSize,
    );
    viewportState.current = normalized;
    setZoom(normalized.zoom);
    setPosition(normalized.position);
  }, [game.sideLength, navigable, viewportSize]);

  useEffect(() => {
    if (transition.length === 0 || reducedMotion || viewportSize === 0) {
      progress.setValue(1);
      spawnProgress.setValue(1);
      onAnimationComplete();
      return;
    }
    progress.setValue(0);
    spawnProgress.setValue(0);
    const slide = Animated.timing(progress, {
      duration: SLIDE_DURATION,
      toValue: 1,
      useNativeDriver: true,
    });
    slide.start(({ finished }) => {
      setCompletedTransition(transition);
      if (!finished) {
        onAnimationComplete();
        return;
      }
      if (spawn === undefined) {
        onAnimationComplete();
        return;
      }
      setSpawning(true);
      Animated.timing(spawnProgress, {
        duration: SPAWN_DURATION,
        toValue: 1,
        useNativeDriver: true,
      }).start(() => {
        setSpawning(false);
        onAnimationComplete();
      });
    });
    return () => {
      slide.stop();
      progress.stopAnimation();
      spawnProgress.stopAnimation();
    };
  }, [
    events,
    onAnimationComplete,
    progress,
    reducedMotion,
    spawn,
    spawnProgress,
    transition,
    viewportSize,
  ]);

  const applyViewport = (nextZoom: number, nextPosition: ViewportPosition) => {
    const currentGeometry = geometry.current;
    const normalized = normalizeViewport(
      nextZoom,
      nextPosition,
      currentGeometry.sideLength,
      currentGeometry.viewportSize,
    );
    viewportState.current = normalized;
    setZoom(normalized.zoom);
    setPosition(normalized.position);
  };

  const viewportResponder = useMemo(
    () =>
      // Gesture callbacks intentionally read the latest ref snapshots after grant.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: (event) =>
          geometry.current.navigable && event.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponder: (event, gesture) =>
          shouldCaptureBoardGesture(
            geometry.current.navigable,
            event.nativeEvent.touches.length,
            gesture.dx,
            gesture.dy,
          ),
        onPanResponderGrant: (event) => {
          viewportGesture.current =
            geometry.current.navigable && event.nativeEvent.touches.length >= 2;
          gestureStart.current = {
            distance: touchDistance(event),
            position: viewportState.current.position,
            zoom: viewportState.current.zoom,
          };
        },
        onPanResponderMove: (event, gesture) => {
          if (
            !geometry.current.navigable ||
            event.nativeEvent.touches.length < 2
          )
            return;
          const distance = touchDistance(event);
          const start = gestureStart.current;
          const pinch =
            distance !== null && start.distance !== null && start.distance > 0
              ? distance / start.distance
              : 1;
          applyViewport(start.zoom * pinch, {
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
      }),
    [],
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const size = event.nativeEvent.layout.width;
    setViewportSize(size);
    geometry.current = {
      navigable:
        boardContentSize(
          game.sideLength,
          boardScale(game.sideLength, size).fitTileSize *
            viewportState.current.zoom,
        ) >
        size + 0.5,
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
  const overview = scale.overview && zoom === MIN_ZOOM;

  return (
    <View style={styles.section}>
      <Text accessibilityLiveRegion="polite" style={styles.modeText}>
        {overview
          ? 'Overview: full board fitted'
          : navigable
            ? 'Zoomed board'
            : 'Touch-friendly board'}
      </Text>
      <View
        accessibilityLabel={`${game.sideLength} by ${game.sideLength} game board. ${overview ? 'Overview, full board visible.' : 'Touch-friendly scale.'}`}
        onLayout={onLayout}
        style={styles.viewport}
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
                  const isSpawn =
                    spawn?.type === 'spawn' &&
                    spawn.row === rowIndex &&
                    spawn.column === columnIndex;
                  return (
                    <Tile
                      exponent={exponent}
                      hidden={sliding || (spawning && isSpawn)}
                      key={`cell-${rowIndex}-${columnIndex}`}
                      size={tileSize}
                    />
                  );
                })}
              </View>
            ))}
            {sliding
              ? motion.map((tile) => (
                  <Animated.View
                    key={tile.key}
                    style={[
                      styles.motionTile,
                      {
                        height: tileSize,
                        left: 6,
                        top: 6,
                        transform: [
                          {
                            translateX: progress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [tile.fromX, tile.toX],
                            }),
                          },
                          {
                            translateY: progress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [tile.fromY, tile.toY],
                            }),
                          },
                        ],
                        width: tileSize,
                      },
                    ]}
                  >
                    <TileContents exponent={tile.exponent} size={tileSize} />
                  </Animated.View>
                ))
              : null}
            {spawning && spawn?.type === 'spawn' ? (
              <Animated.View
                style={[
                  styles.motionTile,
                  {
                    height: tileSize,
                    left: 6 + spawn.column * cellPitch,
                    opacity: spawnProgress,
                    top: 6 + spawn.row * cellPitch,
                    transform: [
                      {
                        scale: spawnProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.65, 1],
                        }),
                      },
                    ],
                    width: tileSize,
                  },
                ]}
              >
                <TileContents exponent={spawn.exponent} size={tileSize} />
              </Animated.View>
            ) : null}
          </View>
        ) : null}
      </View>

      <Modal
        animationType={reducedMotion ? 'none' : 'slide'}
        onRequestClose={onCloseControls}
        presentationStyle="pageSheet"
        visible={controlsVisible}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text accessibilityRole="header" style={styles.modalTitle}>
              Controls
            </Text>
            <BoardButton
              label="Close controls"
              onPress={onCloseControls}
              text="Done"
            />
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.edgeText}>{edgeDescription(edges)}</Text>
            <Text style={styles.viewportHint}>
              One finger moves tiles. When zoomed, two fingers pan or pinch.
            </Text>
            <View style={styles.controlRow}>
              <BoardButton
                disabled={zoom <= scale.minimumZoom}
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
                disabled={zoom >= scale.maximumZoom}
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
            <View style={styles.inspector}>
              <Text accessibilityRole="header" style={styles.inspectorTitle}>
                Board inspector
              </Text>
              <Text style={styles.inspectorValue}>{inspectorDescription}</Text>
              <View style={styles.controlRow}>
                <BoardButton
                  disabled={row === 0}
                  label="Previous board row"
                  onPress={() =>
                    inspect(row - 1, column, setInspectorRow, game)
                  }
                  text="Row −"
                />
                <BoardButton
                  disabled={row === game.sideLength - 1}
                  label="Next board row"
                  onPress={() =>
                    inspect(row + 1, column, setInspectorRow, game)
                  }
                  text="Row +"
                />
                <BoardButton
                  disabled={column === 0}
                  label="Previous board column"
                  onPress={() =>
                    inspect(column - 1, row, setInspectorColumn, game, true)
                  }
                  text="Column −"
                />
                <BoardButton
                  disabled={column === game.sideLength - 1}
                  label="Next board column"
                  onPress={() =>
                    inspect(column + 1, row, setInspectorColumn, game, true)
                  }
                  text="Column +"
                />
              </View>
            </View>
            <View style={styles.movePanel}>
              <Text accessibilityRole="header" style={styles.inspectorTitle}>
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
            {Children.toArray(controls)}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function inspect(
  next: number,
  fixed: number,
  setter: (value: number) => void,
  game: GameState,
  column = false,
) {
  setter(next);
  const row = column ? fixed : next;
  const col = column ? next : fixed;
  AccessibilityInfo.announceForAccessibility(
    cellDescription(game.board[row][col], row, col),
  );
}

function Tile({
  exponent,
  hidden,
  size,
}: {
  exponent: number | null;
  hidden: boolean;
  size: number;
}) {
  return (
    <View
      style={[
        styles.cell,
        {
          backgroundColor:
            exponent === null ? colors.empty : tileBackground(exponent),
          height: size,
          opacity: hidden && exponent !== null ? 0 : 1,
          width: size,
        },
      ]}
    >
      {exponent === null ? null : (
        <TileContents exponent={exponent} size={size} />
      )}
    </View>
  );
}

function TileContents({ exponent, size }: { exponent: number; size: number }) {
  return (
    <View
      style={[
        styles.tileContents,
        { backgroundColor: tileBackground(exponent) },
      ]}
    >
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.35}
        numberOfLines={1}
        style={[
          styles.tileValue,
          {
            color: exponent > 5 ? colors.white : colors.ink,
            fontSize: Math.max(8, Math.min(30, size / 3)),
          },
        ]}
      >
        {tileValue(exponent).toString()}
      </Text>
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
  section: { flexShrink: 1, gap: 4 },
  modeText: { color: colors.mutedInk, fontSize: 13, fontWeight: '700' },
  viewport: {
    aspectRatio: 1,
    borderColor: colors.ink,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
  board: { backgroundColor: colors.board, borderRadius: 11, padding: 3 },
  row: { flexDirection: 'row' },
  cell: {
    alignItems: 'center',
    borderColor: 'rgba(39, 35, 31, 0.2)',
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    margin: 3,
  },
  tileContents: {
    alignItems: 'center',
    borderRadius: 6,
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  tileValue: {
    fontWeight: '800',
    paddingHorizontal: 2,
    textAlign: 'center',
    width: '100%',
  },
  motionTile: {
    borderColor: 'rgba(39, 35, 31, 0.2)',
    borderRadius: 6,
    borderWidth: 1,
    position: 'absolute',
  },
  modal: {
    backgroundColor: colors.background,
    flex: 1,
    paddingHorizontal: spacing.medium,
    paddingTop: 24,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalTitle: { color: colors.ink, fontSize: 28, fontWeight: '900' },
  modalContent: {
    gap: spacing.medium,
    paddingBottom: 40,
    paddingTop: spacing.medium,
  },
  edgeText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  viewportHint: { color: colors.mutedInk, fontSize: 14 },
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
  movePanel: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: 12,
    gap: spacing.small,
    padding: 12,
  },
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
  moveSymbol: {
    color: colors.white,
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 28,
  },
});
