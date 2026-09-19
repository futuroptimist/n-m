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
import { colors } from '../theme/colors';

const SWIPE_DISTANCE = 36;
const CARDINAL_DOMINANCE = 1.35;

function directionForSwipe(dx: number, dy: number): Direction | null {
  const horizontal = Math.abs(dx);
  const vertical = Math.abs(dy);

  if (
    horizontal >= SWIPE_DISTANCE &&
    horizontal >= vertical * CARDINAL_DOMINANCE
  ) {
    return dx > 0 ? 'right' : 'left';
  }
  if (
    vertical >= SWIPE_DISTANCE &&
    vertical >= horizontal * CARDINAL_DOMINANCE
  ) {
    return dy > 0 ? 'down' : 'up';
  }
  return null;
}

function tileBackground(exponent: number): string {
  if (exponent <= 2) return colors.tileLight;
  if (exponent <= 5) return colors.tileMid;
  return colors.tileDark;
}

function tileForeground(exponent: number): string {
  return exponent >= 6 ? colors.white : colors.ink;
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
      'Your unfinished game will be discarded.',
      [
        { text: 'Keep playing', style: 'cancel' },
        { text: 'Start new game', style: 'destructive', onPress: replaceGame },
      ],
    );
  }, [game.status, pendingK]);

  const performMove = useCallback((direction: Direction) => {
    setGame((current) => {
      if (current.status === 'game-over') return current;
      const result = move(current, direction, Math.random);
      return result.moved ? result.state : current;
    });
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.max(Math.abs(gesture.dx), Math.abs(gesture.dy)) >= 12,
        onPanResponderRelease: (_, gesture) => {
          const direction = directionForSwipe(gesture.dx, gesture.dy);
          if (direction !== null) performMove(direction);
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [performMove],
  );

  const growth = deriveGrowth(game.highestCreatedExponent, game.activeK);
  const decrementDisabled = pendingK === 1;
  const incrementDisabled = pendingK === 10;
  const tileFontSize = Math.max(11, Math.min(34, 96 / game.sideLength));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text
              accessibilityLabel="n to the power of m"
              accessibilityRole="header"
              style={styles.title}
            >
              n^m
            </Text>
            <View style={styles.scoreBlock}>
              <Text style={styles.scoreLabel}>Score</Text>
              <Text
                accessibilityLabel={`Score ${game.score.toString()}`}
                style={styles.score}
              >
                {game.score.toString()}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={`Start a new game with k ${pendingK}`}
              accessibilityRole="button"
              onPress={startNewGame}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.headerButtonText}>New game</Text>
            </Pressable>
          </View>

          <View style={styles.statusPanel}>
            <Text style={styles.activeK}>Active k: {game.activeK}</Text>
            <Text style={styles.growthStatus}>
              Next growth: merge {growth.nextExpansionTile.toString()} →{' '}
              {growth.sideLength + 1}×{growth.sideLength + 1}
            </Text>
          </View>

          <View
            accessibilityLabel={`${game.sideLength} by ${game.sideLength} game board`}
            style={styles.board}
            {...panResponder.panHandlers}
          >
            {game.board.map((row, rowIndex) =>
              row.map((cell, columnIndex) => {
                const value = cell === null ? null : tileValue(cell).toString();
                return (
                  <View
                    accessibilityLabel={
                      value === null
                        ? `Empty cell, row ${rowIndex + 1}, column ${columnIndex + 1}`
                        : `Tile ${value}, row ${rowIndex + 1}, column ${columnIndex + 1}`
                    }
                    accessible
                    key={`${rowIndex}-${columnIndex}`}
                    style={[
                      styles.cell,
                      { width: `${100 / game.sideLength}%` },
                      cell === null
                        ? styles.emptyCell
                        : { backgroundColor: tileBackground(cell) },
                    ]}
                  >
                    {cell !== null && value !== null && (
                      <Text
                        adjustsFontSizeToFit
                        minimumFontScale={0.55}
                        numberOfLines={1}
                        style={[
                          styles.tileLabel,
                          {
                            color: tileForeground(cell),
                            fontSize: tileFontSize,
                          },
                        ]}
                      >
                        {value}
                      </Text>
                    )}
                  </View>
                );
              }),
            )}
          </View>

          {game.status === 'game-over' && (
            <View accessibilityLiveRegion="polite" style={styles.gameOver}>
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
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>New game</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.settings}>
            <Text accessibilityRole="header" style={styles.settingsTitle}>
              Next game setting
            </Text>
            <Text style={styles.settingsLabel}>Growth interval (k)</Text>
            <View style={styles.stepper}>
              <Pressable
                accessibilityLabel="Decrease k for the next game"
                accessibilityRole="button"
                accessibilityState={{ disabled: decrementDisabled }}
                disabled={decrementDisabled}
                onPress={() => setPendingK((value) => Math.max(1, value - 1))}
                style={({ pressed }) => [
                  styles.stepButton,
                  decrementDisabled && styles.disabledButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.stepButtonText}>−</Text>
              </Pressable>
              <Text
                accessibilityLabel={`Next game k ${pendingK}`}
                style={styles.kValue}
              >
                {pendingK}
              </Text>
              <Pressable
                accessibilityLabel="Increase k for the next game"
                accessibilityRole="button"
                accessibilityState={{ disabled: incrementDisabled }}
                disabled={incrementDisabled}
                onPress={() => setPendingK((value) => Math.min(10, value + 1))}
                style={({ pressed }) => [
                  styles.stepButton,
                  incrementDisabled && styles.disabledButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.stepButtonText}>+</Text>
              </Pressable>
            </View>
            <Text style={styles.settingHelp}>
              Changes apply when you start a new game. Your active k stays
              fixed.
            </Text>
            {pendingK >= 5 && (
              <Text style={styles.warningHelp}>
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

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  screen: { alignItems: 'center', padding: 18, paddingBottom: 36 },
  content: { maxWidth: 480, width: '100%' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: { color: colors.ink, fontSize: 42, fontWeight: '800', lineHeight: 50 },
  scoreBlock: { alignItems: 'center', flex: 1 },
  scoreLabel: {
    color: colors.mutedInk,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  score: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
    maxWidth: '100%',
  },
  headerButton: {
    backgroundColor: colors.button,
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  headerButtonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.72 },
  statusPanel: {
    backgroundColor: colors.panel,
    borderRadius: 12,
    marginVertical: 14,
    padding: 12,
  },
  activeK: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  growthStatus: { color: colors.mutedInk, fontSize: 15, marginTop: 3 },
  board: {
    aspectRatio: 1,
    backgroundColor: colors.board,
    borderRadius: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
    padding: 4,
    width: '100%',
  },
  cell: {
    alignItems: 'center',
    aspectRatio: 1,
    borderColor: colors.board,
    borderRadius: 7,
    borderWidth: 4,
    justifyContent: 'center',
  },
  emptyCell: { backgroundColor: colors.empty },
  tileLabel: {
    fontWeight: '900',
    paddingHorizontal: 2,
    textAlign: 'center',
    width: '100%',
  },
  gameOver: {
    alignItems: 'center',
    backgroundColor: '#f3dfc1',
    borderRadius: 12,
    marginTop: 14,
    padding: 16,
  },
  gameOverTitle: { color: colors.ink, fontSize: 25, fontWeight: '900' },
  gameOverScore: { color: colors.ink, fontSize: 17, marginVertical: 8 },
  primaryButton: {
    backgroundColor: colors.button,
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 22,
    justifyContent: 'center',
  },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  settings: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    marginTop: 14,
    padding: 16,
  },
  settingsTitle: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  settingsLabel: { color: colors.mutedInk, fontSize: 15, marginTop: 4 },
  stepper: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  stepButton: {
    alignItems: 'center',
    backgroundColor: colors.button,
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    width: 56,
  },
  disabledButton: { backgroundColor: colors.buttonDisabled },
  stepButtonText: {
    color: colors.white,
    fontSize: 30,
    fontWeight: '600',
    lineHeight: 34,
  },
  kValue: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
    minWidth: 72,
    textAlign: 'center',
  },
  settingHelp: {
    color: colors.mutedInk,
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  warningHelp: {
    color: '#793f24',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
});
