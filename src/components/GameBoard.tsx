import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { tileValue, type GameState } from '../engine';
import { colors } from '../theme';

interface GameBoardProps {
  game: GameState;
}

const MIN_CELL_SIZE = 48;

function tileBackground(exponent: number): string {
  if (exponent <= 2) return colors.tileLight;
  if (exponent <= 5) return colors.tileMid;
  return colors.tileDark;
}

export function GameBoard({ game }: GameBoardProps) {
  const [viewportSize, setViewportSize] = useState(0);
  const [fitBoard, setFitBoard] = useState(false);
  const readableBoardSize = game.sideLength * MIN_CELL_SIZE;
  const boardSize =
    fitBoard || viewportSize === 0
      ? viewportSize
      : Math.max(viewportSize, readableBoardSize);
  const needsViewport = viewportSize > 0 && readableBoardSize > viewportSize;
  const fontSize = fitBoard
    ? Math.max(10, Math.min(30, 104 / game.sideLength))
    : Math.min(30, MIN_CELL_SIZE * 0.42);

  return (
    <View>
      <View
        onLayout={(event) => setViewportSize(event.nativeEvent.layout.width)}
        style={styles.viewport}
      >
        {viewportSize > 0 ? (
          <ScrollView
            contentContainerStyle={{ width: boardSize }}
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={needsViewport && !fitBoard}
          >
            <ScrollView
              contentContainerStyle={{ height: boardSize }}
              nestedScrollEnabled
              showsVerticalScrollIndicator={needsViewport && !fitBoard}
              style={{ height: viewportSize, width: boardSize }}
            >
              <View
                accessibilityLabel={`${game.sideLength} by ${game.sideLength} game board`}
                style={[styles.board, { height: boardSize, width: boardSize }]}
              >
                {game.board.map((row, rowIndex) => (
                  <View key={`row-${rowIndex}`} style={styles.row}>
                    {row.map((exponent, columnIndex) => {
                      const value =
                        exponent === null
                          ? null
                          : tileValue(exponent).toString();
                      const darkTile = exponent !== null && exponent > 5;
                      return (
                        <View
                          accessibilityLabel={
                            value === null
                              ? `Row ${rowIndex + 1}, column ${columnIndex + 1}, empty`
                              : `Row ${rowIndex + 1}, column ${columnIndex + 1}, tile ${value}`
                          }
                          accessible
                          key={`cell-${rowIndex}-${columnIndex}`}
                          style={[
                            styles.cell,
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
                                  fontSize,
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
            </ScrollView>
          </ScrollView>
        ) : null}
      </View>
      {needsViewport ? (
        <View style={styles.viewportHelp}>
          <Text style={styles.viewportHelpText}>
            Scroll to inspect the full board, or fit it to this view.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setFitBoard((current) => !current)}
            style={styles.fitButton}
          >
            <Text style={styles.fitButtonText}>
              {fitBoard ? 'Reset size' : 'Fit board'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: colors.board,
    borderRadius: 12,
    padding: 3,
  },
  viewport: {
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
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
  viewportHelp: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  viewportHelpText: { color: colors.mutedInk, flex: 1, fontSize: 13 },
  fitButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  fitButtonText: { color: colors.white, fontSize: 14, fontWeight: '700' },
});
