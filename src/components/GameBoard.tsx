import { useMemo, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { tileValue, type Board, type Direction } from '../engine';
import { colors } from '../theme';

const SWIPE_DISTANCE = 36;
const CARDINAL_DOMINANCE = 1.35;

interface GameBoardProps {
  readonly board: Board;
  readonly disabled: boolean;
  readonly onSwipe: (direction: Direction) => void;
}

export function GameBoard({ board, disabled, onSwipe }: GameBoardProps) {
  const [boardWidth, setBoardWidth] = useState(0);
  const sideLength = board.length;
  const tileFontSize = Math.max(
    11,
    Math.min(32, (boardWidth / sideLength) * 0.26),
  );
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          !disabled && Math.max(Math.abs(gesture.dx), Math.abs(gesture.dy)) > 8,
        onPanResponderRelease: (_, gesture) => {
          const horizontal = Math.abs(gesture.dx);
          const vertical = Math.abs(gesture.dy);
          if (
            Math.max(horizontal, vertical) < SWIPE_DISTANCE ||
            Math.max(horizontal, vertical) <
              Math.min(horizontal, vertical) * CARDINAL_DOMINANCE
          ) {
            return;
          }

          if (horizontal > vertical) {
            onSwipe(gesture.dx > 0 ? 'right' : 'left');
          } else {
            onSwipe(gesture.dy > 0 ? 'down' : 'up');
          }
        },
      }),
    [disabled, onSwipe],
  );

  function measureBoard(event: LayoutChangeEvent) {
    setBoardWidth(event.nativeEvent.layout.width);
  }

  return (
    <View
      accessibilityLabel={`${sideLength} by ${sideLength} game board`}
      onLayout={measureBoard}
      style={styles.board}
      {...panResponder.panHandlers}
    >
      {board.flatMap((row, rowIndex) =>
        row.map((exponent, columnIndex) => {
          const value =
            exponent === null ? null : tileValue(exponent).toString();
          return (
            <View
              accessibilityLabel={
                value === null
                  ? `Row ${rowIndex + 1}, column ${columnIndex + 1}, empty`
                  : `Row ${rowIndex + 1}, column ${columnIndex + 1}, tile ${value}`
              }
              accessible
              key={`${rowIndex}-${columnIndex}`}
              style={[styles.cellSlot, { width: `${100 / sideLength}%` }]}
            >
              <View style={[styles.cell, value !== null && styles.filledCell]}>
                {value !== null && (
                  <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.45}
                    numberOfLines={1}
                    style={[styles.tileLabel, { fontSize: tileFontSize }]}
                  >
                    {value}
                  </Text>
                )}
              </View>
            </View>
          );
        }),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    aspectRatio: 1,
    backgroundColor: colors.board,
    borderRadius: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
    padding: 3,
    width: '100%',
  },
  cellSlot: {
    aspectRatio: 1,
    padding: 3,
  },
  cell: {
    alignItems: 'center',
    backgroundColor: colors.emptyCell,
    borderColor: '#806e5e',
    borderRadius: 7,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
  filledCell: {
    backgroundColor: colors.primary,
    borderColor: '#ffe0a0',
    borderWidth: 2,
  },
  tileLabel: {
    color: colors.darkText,
    fontWeight: '900',
    paddingHorizontal: 2,
    textAlign: 'center',
  },
});
