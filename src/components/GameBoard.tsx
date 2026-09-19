import { StyleSheet, Text, View } from 'react-native';

import { tileValue, type GameState } from '../engine';
import { colors } from '../theme';

interface GameBoardProps {
  game: GameState;
}

function tileBackground(exponent: number): string {
  if (exponent <= 2) return colors.tileLight;
  if (exponent <= 5) return colors.tileMid;
  return colors.tileDark;
}

export function GameBoard({ game }: GameBoardProps) {
  const fontSize = Math.max(10, Math.min(30, 104 / game.sideLength));

  return (
    <View
      accessibilityLabel={`${game.sideLength} by ${game.sideLength} game board`}
      style={styles.board}
    >
      {game.board.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map((exponent, columnIndex) => {
            const value =
              exponent === null ? null : tileValue(exponent).toString();
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
                      { color: darkTile ? colors.white : colors.ink, fontSize },
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
  );
}

const styles = StyleSheet.create({
  board: {
    aspectRatio: 1,
    backgroundColor: colors.board,
    borderRadius: 12,
    padding: 3,
    width: '100%',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
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
});
