import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  type TileTransition,
} from '../engine';
import { colors, spacing } from '../theme';
import {
  MAX_ZOOM,
  TOUCH_TILE_SIZE,
  boardContentSize,
  boardScaleBounds,
  cellDescription,
  clampViewport,
  edgeDescription,
  normalizeViewport,
  scaleMode,
  shouldCaptureBoardGesture,
  swipeDirection,
  visibleEdges,
  type ViewportPosition,
} from './boardInteraction';

export interface BoardAnimation {
  readonly id: number;
  readonly transitions: readonly TileTransition[];
}

interface GameBoardProps {
  animation: BoardAnimation | null;
  controlsVisible: boolean;
  game: GameState;
  onAnimationComplete: (id: number) => void;
  onCloseControls: () => void;
  onMove: (direction: Direction) => void;
  children?: ReactNode;
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
  animation,
  children,
  controlsVisible,
  game,
  onAnimationComplete,
  onCloseControls,
  onMove,
}: GameBoardProps) {
  const [viewportSize, setViewportSize] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState<ViewportPosition>({ x: 0, y: 0 });
  const [inspectorRow, setInspectorRow] = useState(0);
  const [inspectorColumn, setInspectorColumn] = useState(0);
  const gestureStart = useRef({
    distance: null as number | null,
    position: { x: 0, y: 0 },
    zoom: 1,
  });
  const viewportGesture = useRef(false);
  const viewportState = useRef({ zoom: 1, position: { x: 0, y: 0 } });
  const geometry = useRef({ sideLength: game.sideLength, viewportSize: 0 });
  const onMoveRef = useRef(onMove);
  const previousSideLength = useRef(game.sideLength);
  const hasMeasuredViewport = useRef(false);
  const bounds = boardScaleBounds(game.sideLength, viewportSize);
  const tileSize = TOUCH_TILE_SIZE * zoom;
  const contentSize = boardContentSize(game.sideLength, tileSize);
  const clampedPosition = clampViewport(position, contentSize, viewportSize);
  const edges = visibleEdges(clampedPosition, contentSize, viewportSize);
  const mode = scaleMode(zoom);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    geometry.current = { sideLength: game.sideLength, viewportSize };
    const grew = game.sideLength > previousSideLength.current;
    const firstMeasurement = !hasMeasuredViewport.current && viewportSize > 0;
    if (firstMeasurement) hasMeasuredViewport.current = true;
    previousSideLength.current = game.sideLength;
    const normalized = normalizeViewport(
      grew || firstMeasurement
        ? grew
          ? bounds.fit
          : bounds.touchFriendly
        : viewportState.current.zoom,
      grew || firstMeasurement
        ? { x: 0, y: 0 }
        : viewportState.current.position,
      game.sideLength,
      viewportSize,
    );
    viewportState.current = normalized;
    setZoom(normalized.zoom);
    setPosition(normalized.position);
  }, [bounds.fit, bounds.touchFriendly, game.sideLength, viewportSize]);

  const applyViewport = (nextZoom: number, nextPosition: ViewportPosition) => {
    const current = geometry.current;
    const normalized = normalizeViewport(
      nextZoom,
      nextPosition,
      current.sideLength,
      current.viewportSize,
    );
    viewportState.current = normalized;
    setZoom(normalized.zoom);
    setPosition(normalized.position);
  };

  const viewportResponder = useMemo(() => {
    // Stable responder callbacks read current gesture refs only after render.
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onStartShouldSetPanResponder: (event) =>
        event.nativeEvent.touches.length >= 2,
      onMoveShouldSetPanResponder: (event, gesture) =>
        shouldCaptureBoardGesture(
          true,
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
    });
  }, []);

  const onLayout = (event: LayoutChangeEvent) => {
    const size = event.nativeEvent.layout.width;
    setViewportSize(size);
    geometry.current = { sideLength: game.sideLength, viewportSize: size };
  };

  const row = Math.min(inspectorRow, game.sideLength - 1);
  const column = Math.min(inspectorColumn, game.sideLength - 1);
  const inspectorDescription = cellDescription(
    game.board[row][column],
    row,
    column,
  );

  return (
    <View style={styles.section}>
      <View
        accessibilityLabel={`${game.sideLength} by ${game.sideLength} game board. ${mode === 'overview' ? 'Overview scale, all cells visible.' : 'Touch-friendly scale.'}`}
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
            <BoardCells
              game={game}
              hidden={animation !== null}
              tileSize={tileSize}
            />
            {animation === null ? null : (
              <MotionLayer
                animation={animation}
                onComplete={onAnimationComplete}
                tileSize={tileSize}
              />
            )}
          </View>
        ) : null}
      </View>
      <Text style={styles.modeText}>
        {mode === 'overview'
          ? `Overview · all ${game.sideLength}×${game.sideLength} cells visible`
          : `Touch-friendly · ${edgeDescription(edges)}`}
      </Text>

      <Modal
        animationType="slide"
        onRequestClose={onCloseControls}
        presentationStyle="pageSheet"
        visible={controlsVisible}
      >
        <View style={styles.modalScreen}>
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
            <Text style={styles.viewportHint}>
              One finger moves tiles. Two fingers pan or pinch when enlarged.
            </Text>
            <Text style={styles.modeText}>
              {mode === 'overview'
                ? 'Overview scale: whole board fits.'
                : edgeDescription(edges)}
            </Text>
            <View style={styles.controlRow}>
              <BoardButton
                disabled={zoom <= bounds.fit + 0.001}
                label="Zoom board out"
                onPress={() => applyViewport(zoom - 0.25, position)}
                text="Zoom −"
              />
              <BoardButton
                disabled={zoom >= MAX_ZOOM}
                label="Zoom board in"
                onPress={() => applyViewport(zoom + 0.25, position)}
                text="Zoom +"
              />
              <BoardButton
                label="Fit entire board"
                onPress={() => applyViewport(bounds.fit, { x: 0, y: 0 })}
                text="Fit board"
              />
            </View>
            {children}
            <View style={styles.inspector}>
              <Text accessibilityRole="header" style={styles.inspectorTitle}>
                Board inspector
              </Text>
              <Text style={styles.inspectorValue}>{inspectorDescription}</Text>
              <View style={styles.controlRow}>
                <InspectorButton
                  disabled={row === 0}
                  label="Previous board row"
                  onPress={() => setInspectorRowAndAnnounce(row - 1, column)}
                  text="Row −"
                />
                <InspectorButton
                  disabled={row === game.sideLength - 1}
                  label="Next board row"
                  onPress={() => setInspectorRowAndAnnounce(row + 1, column)}
                  text="Row +"
                />
                <InspectorButton
                  disabled={column === 0}
                  label="Previous board column"
                  onPress={() => setInspectorColumnAndAnnounce(row, column - 1)}
                  text="Column −"
                />
                <InspectorButton
                  disabled={column === game.sideLength - 1}
                  label="Next board column"
                  onPress={() => setInspectorColumnAndAnnounce(row, column + 1)}
                  text="Column +"
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );

  function setInspectorRowAndAnnounce(nextRow: number, currentColumn: number) {
    setInspectorRow(nextRow);
    AccessibilityInfo.announceForAccessibility(
      cellDescription(
        game.board[nextRow][currentColumn],
        nextRow,
        currentColumn,
      ),
    );
  }

  function setInspectorColumnAndAnnounce(
    currentRow: number,
    nextColumn: number,
  ) {
    setInspectorColumn(nextColumn);
    AccessibilityInfo.announceForAccessibility(
      cellDescription(
        game.board[currentRow][nextColumn],
        currentRow,
        nextColumn,
      ),
    );
  }
}

function BoardCells({
  game,
  hidden,
  tileSize,
}: {
  game: GameState;
  hidden: boolean;
  tileSize: number;
}) {
  return game.board.map((boardRow, rowIndex) => (
    <View key={`row-${rowIndex}`} style={styles.row}>
      {boardRow.map((exponent, columnIndex) => (
        <Tile
          exponent={exponent}
          key={`cell-${rowIndex}-${columnIndex}`}
          opacity={hidden && exponent !== null ? 0 : 1}
          tileSize={tileSize}
        />
      ))}
    </View>
  ));
}

function MotionLayer({
  animation,
  onComplete,
  tileSize,
}: {
  animation: BoardAnimation;
  onComplete: (id: number) => void;
  tileSize: number;
}) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!active || reduced) {
        if (active) onComplete(animation.id);
        return;
      }
      Animated.timing(progress, {
        duration: 150,
        toValue: 1,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (active && finished) onComplete(animation.id);
      });
    });
    return () => {
      active = false;
      progress.stopAnimation();
    };
  }, [animation.id, onComplete, progress]);
  const pitch = tileSize + 6;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {animation.transitions.map((transition, index) => (
        <Animated.View
          key={`${animation.id}-${transition.from.row}-${transition.from.column}-${index}`}
          style={{
            left: 3 + transition.from.column * pitch,
            position: 'absolute',
            top: 3 + transition.from.row * pitch,
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [
                    0,
                    (transition.to.column - transition.from.column) * pitch,
                  ],
                }),
              },
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [
                    0,
                    (transition.to.row - transition.from.row) * pitch,
                  ],
                }),
              },
            ],
          }}
        >
          <Tile
            exponent={transition.exponent}
            opacity={1}
            tileSize={tileSize}
          />
        </Animated.View>
      ))}
    </View>
  );
}

function Tile({
  exponent,
  opacity,
  tileSize,
}: {
  exponent: number | null;
  opacity: number;
  tileSize: number;
}) {
  const value = exponent === null ? null : tileValue(exponent).toString();
  const darkTile = exponent !== null && exponent > 5;
  return (
    <View
      style={[
        styles.cell,
        {
          backgroundColor:
            exponent === null ? colors.empty : tileBackground(exponent),
          height: tileSize,
          opacity,
          width: tileSize,
        },
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
              color: darkTile ? colors.white : colors.ink,
              fontSize: Math.max(8, Math.min(30, tileSize / 3)),
            },
          ]}
        >
          {value}
        </Text>
      )}
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
const InspectorButton = BoardButton;

const styles = StyleSheet.create({
  section: { gap: 4 },
  viewport: {
    aspectRatio: 1,
    borderColor: colors.ink,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    width: '100%',
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
  tileValue: {
    fontWeight: '800',
    paddingHorizontal: 2,
    textAlign: 'center',
    width: '100%',
  },
  modeText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  modalScreen: { backgroundColor: colors.background, flex: 1, paddingTop: 24 },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.medium,
  },
  modalTitle: { color: colors.ink, fontSize: 28, fontWeight: '900' },
  modalContent: {
    gap: spacing.medium,
    padding: spacing.medium,
    paddingBottom: 40,
  },
  viewportHint: { color: colors.mutedInk, fontSize: 15 },
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
