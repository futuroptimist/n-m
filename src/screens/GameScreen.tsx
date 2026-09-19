import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  createGame,
  deriveGrowth,
  move,
  tileValue,
  type Direction,
  type GameState,
} from '../engine';

const MIN_SWIPE_DISTANCE = 28;
const CARDINAL_DOMINANCE_RATIO = 1.35;

function swipeDirection(dx: number, dy: number): Direction | null {
  const horizontalDistance = Math.abs(dx);
  const verticalDistance = Math.abs(dy);

  if (
    horizontalDistance >= MIN_SWIPE_DISTANCE &&
    horizontalDistance >= verticalDistance * CARDINAL_DOMINANCE_RATIO
  ) {
    return dx < 0 ? 'left' : 'right';
  }
  if (
    verticalDistance >= MIN_SWIPE_DISTANCE &&
    verticalDistance >= horizontalDistance * CARDINAL_DOMINANCE_RATIO
  ) {
    return dy < 0 ? 'up' : 'down';
  }
  return null;
}

export function GameScreen() {
  const [pendingK, setPendingK] = useState(1);
  const [game, setGame] = useState<GameState>(() => createGame(1, Math.random));

  const startNewGame = useCallback(() => {
    const replaceGame = () => setGame(createGame(pendingK, Math.random));
    if (game.status === 'game-over') {
      replaceGame();
      return;
    }

    Alert.alert(
      'Start a new game?',
      `Your current game will be discarded. The new game will use k=${pendingK}.`,
      [
        { text: 'Keep playing', style: 'cancel' },
        { text: 'New game', style: 'destructive', onPress: replaceGame },
      ],
    );
  }, [game.status, pendingK]);

  const makeMove = useCallback((direction: Direction) => {
    setGame((currentGame) => {
      if (currentGame.status === 'game-over') return currentGame;
      return move(currentGame, direction, Math.random).state;
    });
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          swipeDirection(gesture.dx, gesture.dy) !== null,
        onPanResponderRelease: (_, gesture) => {
          const direction = swipeDirection(gesture.dx, gesture.dy);
          if (direction !== null) makeMove(direction);
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [makeMove],
  );

  const growth = deriveGrowth(game.highestCreatedExponent, game.activeK);
  const tileFontSize = Math.max(8, Math.min(34, 112 / game.sideLength));

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text
                accessibilityLabel="n to the power of m"
                accessibilityRole="header"
                style={styles.title}
              >
                n^m
              </Text>
              <Text
                accessibilityLabel={`Score ${game.score.toString()}`}
                style={styles.score}
              >
                Score {game.score.toString()}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={`Start a new game with k ${pendingK}`}
              accessibilityRole="button"
              onPress={startNewGame}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>New game</Text>
            </Pressable>
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.activeSetting}>Active k: {game.activeK}</Text>
            <Text style={styles.growthStatus}>
              Next growth: merge {growth.nextExpansionTile.toString()} →{' '}
              {growth.sideLength + 1}×{growth.sideLength + 1}
            </Text>
          </View>

          {game.status === 'game-over' && (
            <View accessibilityLiveRegion="polite" style={styles.gameOverCard}>
              <Text accessibilityRole="header" style={styles.gameOverTitle}>
                Game over
              </Text>
              <Text style={styles.gameOverScore}>
                Final score: {game.score.toString()}
              </Text>
              <Pressable
                accessibilityLabel={`Start a new game with k ${pendingK}`}
                accessibilityRole="button"
                onPress={startNewGame}
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.gameOverButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>New game</Text>
              </Pressable>
            </View>
          )}

          <View
            accessibilityLabel={`${game.sideLength} by ${game.sideLength} game board`}
            style={styles.board}
            {...panResponder.panHandlers}
          >
            {game.board.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.boardRow}>
                {row.map((exponent, columnIndex) => {
                  const value =
                    exponent === null ? null : tileValue(exponent).toString();
                  return (
                    <View
                      accessible
                      accessibilityLabel={
                        value === null
                          ? `Empty cell, row ${rowIndex + 1}, column ${columnIndex + 1}`
                          : `Tile ${value}, row ${rowIndex + 1}, column ${columnIndex + 1}`
                      }
                      key={`cell-${rowIndex}-${columnIndex}`}
                      style={[
                        styles.cell,
                        value === null ? styles.emptyCell : styles.filledCell,
                      ]}
                    >
                      <Text
                        adjustsFontSizeToFit
                        minimumFontScale={0.35}
                        numberOfLines={1}
                        style={[styles.tileText, { fontSize: tileFontSize }]}
                      >
                        {value ?? ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
          <Text style={styles.swipeHint}>
            Swipe the board up, down, left, or right to move.
          </Text>

          <View style={styles.settingsCard}>
            <Text accessibilityRole="header" style={styles.settingsTitle}>
              Next game setting
            </Text>
            <Text style={styles.settingsDescription}>
              Changes to k apply when you start a new game.
            </Text>
            <View style={styles.stepper}>
              <SettingButton
                accessibilityLabel="Decrease k for the next game"
                disabled={pendingK === 1}
                label="−"
                onPress={() => setPendingK((value) => Math.max(1, value - 1))}
              />
              <View
                accessible
                accessibilityLabel={`Next game k ${pendingK}`}
                style={styles.kValue}
              >
                <Text style={styles.kLabel}>k</Text>
                <Text style={styles.kNumber}>{pendingK}</Text>
              </View>
              <SettingButton
                accessibilityLabel="Increase k for the next game"
                disabled={pendingK === 10}
                label="+"
                onPress={() => setPendingK((value) => Math.min(10, value + 1))}
              />
            </View>
            {pendingK >= 5 && (
              <Text style={styles.constraintHelp}>
                Higher k grows less often. With current 2/4 tile spawns, k
                values 5–10 cannot grow beyond 2×2.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface SettingButtonProps {
  readonly accessibilityLabel: string;
  readonly disabled: boolean;
  readonly label: string;
  readonly onPress: () => void;
}

function SettingButton({
  accessibilityLabel,
  disabled,
  label,
  onPress,
}: SettingButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingButton,
        disabled && styles.settingButtonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text
        style={[
          styles.settingButtonText,
          disabled && styles.settingButtonTextDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#f4efe4', flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 32 },
  content: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    width: '100%',
    maxWidth: 560,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: { color: '#25211d', fontSize: 42, fontWeight: '900', lineHeight: 48 },
  score: { color: '#514940', fontSize: 18, fontWeight: '700', marginTop: 2 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#6b3f23',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  buttonPressed: { opacity: 0.72 },
  statusCard: {
    backgroundColor: '#fffaf1',
    borderRadius: 14,
    marginTop: 18,
    padding: 14,
  },
  activeSetting: { color: '#25211d', fontSize: 17, fontWeight: '800' },
  growthStatus: {
    color: '#514940',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  gameOverCard: {
    alignItems: 'center',
    backgroundColor: '#f7dfc8',
    borderColor: '#6b3f23',
    borderRadius: 14,
    borderWidth: 2,
    marginTop: 16,
    padding: 16,
  },
  gameOverTitle: { color: '#3e2415', fontSize: 24, fontWeight: '900' },
  gameOverScore: { color: '#3e2415', fontSize: 17, marginTop: 4 },
  gameOverButton: { marginTop: 12 },
  board: {
    aspectRatio: 1,
    backgroundColor: '#786b5d',
    borderRadius: 12,
    gap: 5,
    marginTop: 18,
    padding: 5,
    width: '100%',
  },
  boardRow: { flex: 1, flexDirection: 'row', gap: 5 },
  cell: {
    alignItems: 'center',
    borderRadius: 7,
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  emptyCell: {
    backgroundColor: '#c9bbaa',
    borderColor: '#ddcfbd',
    borderWidth: 1,
  },
  filledCell: {
    backgroundColor: '#f2c879',
    borderColor: '#6b3f23',
    borderWidth: 2,
  },
  tileText: {
    color: '#352318',
    fontWeight: '900',
    paddingHorizontal: 2,
    textAlign: 'center',
  },
  swipeHint: {
    color: '#62594f',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  settingsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    marginTop: 20,
    padding: 18,
  },
  settingsTitle: { color: '#25211d', fontSize: 21, fontWeight: '900' },
  settingsDescription: { color: '#62594f', fontSize: 15, marginTop: 4 },
  stepper: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  settingButton: {
    alignItems: 'center',
    backgroundColor: '#6b3f23',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    width: 58,
  },
  settingButtonDisabled: {
    backgroundColor: '#d2ccc5',
    borderColor: '#aaa198',
    borderWidth: 1,
  },
  settingButtonText: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 34,
  },
  settingButtonTextDisabled: { color: '#756e67' },
  kValue: { alignItems: 'center', minWidth: 104 },
  kLabel: { color: '#62594f', fontSize: 14, fontWeight: '700' },
  kNumber: { color: '#25211d', fontSize: 30, fontWeight: '900' },
  constraintHelp: {
    color: '#5a3020',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 14,
  },
});
