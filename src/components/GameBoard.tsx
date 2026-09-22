/* Gesture callbacks intentionally read current snapshots before React commits. */
/* eslint-disable react-hooks/refs */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
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
  type MoveResult,
} from '../engine';
import { colors, spacing } from '../theme';
import {
  FIT_ZOOM,
  boardContentSize,
  cellDescription,
  clampViewport,
  edgeDescription,
  fittedBoardGeometry,
  maximumZoom,
  normalizeViewport,
  planTileMotion,
  shouldCaptureBoardGesture,
  swipeDirection,
  touchFriendlyZoom,
  visibleEdges,
  type ViewportPosition,
} from './boardInteraction';

interface GameBoardProps {
  controlsOpen: boolean;
  game: GameState;
  moveResult: MoveResult | null;
  onAnimationComplete: () => void;
  onCloseControls: () => void;
  onMove: (direction: Direction) => void;
  onPendingKChange: (k: number) => void;
  pendingK: number;
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
  controlsOpen,
  game,
  moveResult,
  onAnimationComplete,
  onCloseControls,
  onMove,
  onPendingKChange,
  pendingK,
}: GameBoardProps) {
  const [viewportSize, setViewportSize] = useState(0);
  const [zoom, setZoom] = useState(FIT_ZOOM);
  const [position, setPosition] = useState<ViewportPosition>({ x: 0, y: 0 });
  const [inspectorRow, setInspectorRow] = useState(0);
  const [inspectorColumn, setInspectorColumn] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [sliding, setSliding] = useState(false);
  const [progress] = useState(() => new Animated.Value(1));
  const [spawnProgress] = useState(() => new Animated.Value(1));
  const previousSideLength = useRef(game.sideLength);
  const gestureStart = useRef({
    distance: null as number | null,
    position: { x: 0, y: 0 },
    zoom: FIT_ZOOM,
  });
  const viewportGesture = useRef(false);
  const viewportState = useRef({ zoom: FIT_ZOOM, position: { x: 0, y: 0 } });
  const geometry = useRef({ sideLength: game.sideLength, viewportSize: 0 });
  const onMoveRef = useRef(onMove);

  const growth = moveResult?.events.find((event) => event.type === 'growth');
  const presentationSideLength =
    growth?.type === 'growth' ? growth.from : game.sideLength;
  const boardGeometry = fittedBoardGeometry(
    presentationSideLength,
    viewportSize,
  );
  const tileSize = boardGeometry.tileSize;
  const renderedGutter = boardGeometry.gutter * zoom;
  const renderedPadding = boardGeometry.padding * zoom;
  const contentSize = boardContentSize(
    presentationSideLength,
    tileSize * zoom,
    renderedGutter,
    renderedPadding,
  );
  const clampedPosition = clampViewport(position, contentSize, viewportSize);
  const enlarged = zoom > FIT_ZOOM + 0.01;
  const edges = visibleEdges(clampedPosition, contentSize, viewportSize);
  const motions = planTileMotion(
    moveResult?.transitions ?? [],
    tileSize * zoom,
    renderedGutter,
    renderedPadding,
  );
  const incomingCells = new Set(
    (moveResult?.transitions ?? []).map(({ to }) => `${to.row}:${to.column}`),
  );
  const spawn = moveResult?.events.find((event) => event.type === 'spawn');

  const applyViewport = useCallback(
    (nextZoom: number, nextPosition: ViewportPosition) => {
      const normalized = normalizeViewport(
        nextZoom,
        nextPosition,
        geometry.current.sideLength,
        geometry.current.viewportSize,
      );
      viewportState.current = normalized;
      setZoom(normalized.zoom);
      setPosition(normalized.position);
    },
    [],
  );

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (moveResult !== null) return;
    if (game.sideLength > previousSideLength.current) {
      geometry.current = {
        sideLength: game.sideLength,
        viewportSize: geometry.current.viewportSize,
      };
      applyViewport(FIT_ZOOM, { x: 0, y: 0 });
    }
    previousSideLength.current = game.sideLength;
  }, [applyViewport, game.sideLength, moveResult]);

  useLayoutEffect(() => {
    if (moveResult === null) return;
    progress.stopAnimation();
    spawnProgress.stopAnimation();
    if (reduceMotion || viewportSize === 0) {
      // Reduced motion deliberately resolves transient presentation immediately.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSliding(false);
      progress.setValue(1);
      spawnProgress.setValue(1);
      onAnimationComplete();
      return;
    }
    setSliding(true);
    progress.setValue(0);
    spawnProgress.setValue(0);
    Animated.timing(progress, {
      duration: 150,
      toValue: 1,
      useNativeDriver: true,
    }).start(({ finished }) => {
      setSliding(false);
      if (!finished) {
        onAnimationComplete();
        return;
      }
      Animated.parallel([
        Animated.timing(spawnProgress, {
          duration: 100,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start(() => onAnimationComplete());
    });
    return () => {
      progress.stopAnimation();
      spawnProgress.stopAnimation();
    };
  }, [
    moveResult,
    onAnimationComplete,
    progress,
    reduceMotion,
    spawnProgress,
    viewportSize,
  ]);

  const viewportResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) =>
          event.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponder: (event, gesture) =>
          shouldCaptureBoardGesture(
            geometry.current.viewportSize > 0,
            event.nativeEvent.touches.length,
            gesture.dx,
            gesture.dy,
          ),
        onPanResponderGrant: (event) => {
          viewportGesture.current = event.nativeEvent.touches.length >= 2;
          if (!viewportGesture.current) return;
          gestureStart.current = {
            distance: touchDistance(event),
            position: viewportState.current.position,
            zoom: viewportState.current.zoom,
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
      }),
    [applyViewport],
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const size = event.nativeEvent.layout.width;
    setViewportSize(size);
    geometry.current = { sideLength: game.sideLength, viewportSize: size };
    applyViewport(viewportState.current.zoom, viewportState.current.position);
  };

  const row = Math.min(inspectorRow, game.sideLength - 1);
  const column = Math.min(inspectorColumn, game.sideLength - 1);
  const mode = enlarged
    ? 'Touch-friendly enlarged view'
    : 'Full-board overview';

  return (
    <View style={styles.section}>
      <Text accessibilityLiveRegion="polite" style={styles.modeText}>
        {mode} · {Math.round(zoom * 100)}%
      </Text>
      <View
        accessibilityLabel={`${game.sideLength} by ${game.sideLength} game board, ${mode}`}
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
                padding: renderedPadding,
                width: contentSize,
              },
            ]}
          >
            {game.board
              .slice(0, presentationSideLength)
              .map((boardRow, rowIndex) => (
                <View key={`row-${rowIndex}`} style={styles.row}>
                  {boardRow
                    .slice(0, presentationSideLength)
                    .map((exponent, columnIndex) => {
                      const isSpawn =
                        spawn?.type === 'spawn' &&
                        spawn.row === rowIndex &&
                        spawn.column === columnIndex;
                      return (
                        <Tile
                          exponent={exponent}
                          gutter={renderedGutter}
                          key={`cell-${rowIndex}-${columnIndex}`}
                          size={tileSize * zoom}
                          style={
                            sliding &&
                            incomingCells.has(`${rowIndex}:${columnIndex}`)
                              ? { opacity: 0 }
                              : isSpawn && moveResult !== null && !reduceMotion
                                ? {
                                    opacity: spawnProgress,
                                    transform: [
                                      {
                                        scale: spawnProgress.interpolate({
                                          inputRange: [0, 1],
                                          outputRange: [0.7, 1],
                                        }),
                                      },
                                    ],
                                  }
                                : undefined
                          }
                        />
                      );
                    })}
                </View>
              ))}
            {sliding
              ? motions.map((motion) => (
                  <Animated.View
                    key={motion.key}
                    style={[
                      styles.motionTile,
                      {
                        height: tileSize * zoom,
                        left: 0,
                        top: 0,
                        transform: [
                          {
                            translateX: progress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [motion.fromX, motion.toX],
                            }),
                          },
                          {
                            translateY: progress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [motion.fromY, motion.toY],
                            }),
                          },
                        ],
                        width: tileSize * zoom,
                      },
                    ]}
                  >
                    <Tile
                      exponent={motion.exponent}
                      gutter={0}
                      size={tileSize * zoom}
                    />
                  </Animated.View>
                ))
              : null}
          </View>
        ) : null}
      </View>

      <Modal
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={onCloseControls}
        transparent
        visible={controlsOpen}
      >
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.modalCard}>
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
              <Text style={styles.hint}>
                One finger moves tiles. Two fingers pan or pinch an enlarged
                board.
              </Text>
              <View style={styles.controlRow}>
                <BoardButton
                  disabled={zoom <= FIT_ZOOM}
                  label="Zoom board out"
                  onPress={() => applyViewport(zoom - 0.25, position)}
                  text="Zoom −"
                />
                <BoardButton
                  disabled={zoom >= maximumZoom(game.sideLength, viewportSize)}
                  label="Zoom board in"
                  onPress={() => applyViewport(zoom + 0.25, position)}
                  text="Zoom +"
                />
                <BoardButton
                  label="Fit entire board"
                  onPress={() => applyViewport(FIT_ZOOM, { x: 0, y: 0 })}
                  text="Fit board"
                />
                <BoardButton
                  label="Use touch-friendly board scale"
                  onPress={() =>
                    applyViewport(
                      touchFriendlyZoom(game.sideLength, viewportSize),
                      { x: 0, y: 0 },
                    )
                  }
                  text="Touch scale"
                />
              </View>
              <Text accessibilityRole="header" style={styles.inspectorTitle}>
                Move tiles
              </Text>
              <View style={styles.controlRow}>
                {(['up', 'left', 'down', 'right'] as const).map((direction) => (
                  <BoardButton
                    key={direction}
                    label={`Move ${direction}`}
                    onPress={() => onMove(direction)}
                    text={direction}
                  />
                ))}
              </View>
              <Text accessibilityRole="header" style={styles.inspectorTitle}>
                Board inspector
              </Text>
              <Text style={styles.inspectorValue}>
                {cellDescription(game.board[row][column], row, column)}
              </Text>
              <View style={styles.controlRow}>
                <BoardButton
                  disabled={row === 0}
                  label="Previous board row"
                  onPress={() => setInspectorRow(row - 1)}
                  text="Row −"
                />
                <BoardButton
                  disabled={row === game.sideLength - 1}
                  label="Next board row"
                  onPress={() => setInspectorRow(row + 1)}
                  text="Row +"
                />
                <BoardButton
                  disabled={column === 0}
                  label="Previous board column"
                  onPress={() => setInspectorColumn(column - 1)}
                  text="Column −"
                />
                <BoardButton
                  disabled={column === game.sideLength - 1}
                  label="Next board column"
                  onPress={() => setInspectorColumn(column + 1)}
                  text="Column +"
                />
              </View>
              <Text accessibilityRole="header" style={styles.inspectorTitle}>
                Next game setting
              </Text>
              <Text style={styles.hint}>
                Choose k for the next game. This run stays at k={game.activeK}.
              </Text>
              <View style={styles.controlRow}>
                <BoardButton
                  disabled={pendingK === 1}
                  label="Decrease k for next game"
                  onPress={() => onPendingKChange(pendingK - 1)}
                  text="k −"
                />
                <Text
                  accessible
                  accessibilityLabel={`Next game k ${pendingK}`}
                  style={styles.kValue}
                >
                  k = {pendingK}
                </Text>
                <BoardButton
                  disabled={pendingK === 10}
                  label="Increase k for next game"
                  onPress={() => onPendingKChange(pendingK + 1)}
                  text="k +"
                />
              </View>
              {pendingK >= 5 ? (
                <Text style={styles.hint}>
                  Higher k grows less often. With current 2/4 tile spawns, k
                  values 5–10 cannot grow beyond 2×2.
                </Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Tile({
  exponent,
  gutter,
  size,
  style,
}: {
  exponent: number | null;
  gutter: number;
  size: number;
  style?: object;
}) {
  const value = exponent === null ? null : tileValue(exponent).toString();
  return (
    <Animated.View
      style={[
        styles.cell,
        {
          backgroundColor:
            exponent === null ? colors.empty : tileBackground(exponent),
          height: size,
          margin: gutter / 2,
          width: size,
        },
        style,
      ]}
    >
      {value === null ? null : (
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.35}
          numberOfLines={1}
          style={[
            styles.tileValue,
            {
              color:
                exponent !== null && exponent > 5 ? colors.white : colors.ink,
              fontSize: Math.max(8, Math.min(30, size / 3)),
            },
          ]}
        >
          {value}
        </Text>
      )}
    </Animated.View>
  );
}

function BoardButton({
  disabled = false,
  label,
  onPress,
  text,
}: {
  disabled?: boolean;
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
  section: { flexShrink: 1, gap: 4, width: '100%' },
  modeText: { color: colors.mutedInk, fontSize: 12, fontWeight: '700' },
  viewport: {
    aspectRatio: 1,
    borderColor: colors.ink,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    width: '100%',
  },
  board: { backgroundColor: colors.board, borderRadius: 10 },
  row: { flexDirection: 'row' },
  cell: {
    alignItems: 'center',
    borderColor: 'rgba(39, 35, 31, 0.2)',
    borderRadius: 5,
    borderWidth: 1,
    justifyContent: 'center',
  },
  motionTile: { position: 'absolute' },
  tileValue: {
    fontWeight: '800',
    paddingHorizontal: 1,
    textAlign: 'center',
    width: '100%',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(39,35,31,0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '78%',
    padding: spacing.medium,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalTitle: { color: colors.ink, fontSize: 24, fontWeight: '900' },
  modalContent: { gap: 12, paddingBottom: 24, paddingTop: 12 },
  edgeText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  hint: { color: colors.mutedInk, fontSize: 14, lineHeight: 20 },
  controlRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small },
  controlButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  controlText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  disabledButton: { backgroundColor: '#d2cec7', borderWidth: 1 },
  disabledText: { color: '#706b64' },
  pressed: { backgroundColor: colors.primaryPressed, opacity: 0.9 },
  inspectorTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  inspectorValue: { color: colors.ink, fontSize: 16 },
  kValue: { color: colors.ink, fontSize: 18, fontWeight: '800', padding: 10 },
});
