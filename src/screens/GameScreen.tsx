import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GameBoard } from '../components/GameBoard';
import {
  createGame,
  deriveGrowth,
  move,
  type Direction,
  type GameState,
} from '../engine';
import { colors, spacing } from '../theme';

const HIGH_K_HELP =
  'Higher k grows less often. With current 2/4 tile spawns, k values 5–10 cannot grow beyond 2×2.';

export function GameScreen() {
  const [pendingK, setPendingK] = useState(1);
  const [game, setGame] = useState<GameState>(() => createGame(1, Math.random));
  const growth = deriveGrowth(game.highestCreatedExponent, game.activeK);

  const swipe = useCallback((direction: Direction) => {
    setGame((current) => {
      if (current.status !== 'active') return current;
      return move(current, direction, Math.random).state;
    });
  }, []);

  function startNewGame() {
    setGame(createGame(pendingK, Math.random));
  }

  function requestNewGame() {
    if (game.status === 'game-over') {
      startNewGame();
      return;
    }

    Alert.alert(
      'Start a new game?',
      `Your current run will be discarded. The new game will use k=${pendingK}.`,
      [
        { text: 'Keep playing', style: 'cancel' },
        { text: 'Start new game', style: 'destructive', onPress: startNewGame },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
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
              <Text style={styles.tagline}>EXPANDING GRID</Text>
            </View>
            <View style={styles.headerActions}>
              <View
                accessibilityLabel={`Score ${game.score.toString()}`}
                accessible
              >
                <Text style={styles.scoreLabel}>SCORE</Text>
                <Text style={styles.score}>{game.score.toString()}</Text>
              </View>
              <Pressable
                accessibilityLabel="Start a new game"
                accessibilityRole="button"
                onPress={requestNewGame}
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.buttonText}>New game</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.statusPanel}>
            <Text style={styles.activeK}>Active k: {game.activeK}</Text>
            <Text style={styles.milestone}>
              Next growth: merge {growth.nextExpansionTile.toString()} →{' '}
              {growth.sideLength + 1}×{growth.sideLength + 1}
            </Text>
          </View>

          <GameBoard
            board={game.board}
            disabled={game.status === 'game-over'}
            onSwipe={swipe}
          />
          <Text style={styles.swipeHelp}>
            Swipe the board up, down, left, or right.
          </Text>

          {game.status === 'game-over' && (
            <View
              accessibilityLiveRegion="assertive"
              style={styles.gameOverPanel}
            >
              <Text accessibilityRole="header" style={styles.gameOverTitle}>
                Game over
              </Text>
              <Text style={styles.gameOverScore}>
                Final score: {game.score.toString()}
              </Text>
              <Pressable
                accessibilityLabel={`Start a new game with k ${pendingK}`}
                accessibilityRole="button"
                onPress={requestNewGame}
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.buttonText}>New game</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.settingsPanel}>
            <Text accessibilityRole="header" style={styles.settingsTitle}>
              Next game setting
            </Text>
            <Text style={styles.settingsDescription}>
              Choose k for your next game. The active run stays at k=
              {game.activeK}.
            </Text>
            <View style={styles.stepper}>
              <StepperButton
                disabled={pendingK === 1}
                label="Decrease k for the next game"
                onPress={() => setPendingK((value) => Math.max(1, value - 1))}
                symbol="−"
              />
              <View accessibilityLabel={`Next game k ${pendingK}`} accessible>
                <Text style={styles.kLabel}>k</Text>
                <Text style={styles.kValue}>{pendingK}</Text>
              </View>
              <StepperButton
                disabled={pendingK === 10}
                label="Increase k for the next game"
                onPress={() => setPendingK((value) => Math.min(10, value + 1))}
                symbol="+"
              />
            </View>
            {pendingK >= 5 && (
              <Text style={styles.highKHelp}>{HIGH_K_HELP}</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface StepperButtonProps {
  readonly disabled: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly symbol: string;
}

function StepperButton({
  disabled,
  label,
  onPress,
  symbol,
}: StepperButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepperButton,
        disabled && styles.stepperButtonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text
        style={[styles.stepperSymbol, disabled && styles.stepperSymbolDisabled]}
      >
        {symbol}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  scrollContent: { flexGrow: 1, padding: spacing.medium },
  content: { alignSelf: 'center', maxWidth: 520, width: '100%' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.medium,
  },
  title: {
    color: colors.text,
    fontSize: 52,
    fontWeight: '900',
    lineHeight: 56,
  },
  tagline: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  headerActions: { alignItems: 'flex-end', gap: spacing.small },
  scoreLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  score: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'right',
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.medium,
  },
  buttonPressed: { backgroundColor: colors.primaryPressed, opacity: 0.9 },
  buttonText: { color: colors.darkText, fontSize: 15, fontWeight: '800' },
  statusPanel: {
    backgroundColor: colors.panel,
    borderRadius: 10,
    marginBottom: spacing.small,
    padding: 12,
  },
  activeK: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  milestone: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 3,
  },
  swipeHelp: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  gameOverPanel: {
    alignItems: 'center',
    backgroundColor: colors.panelRaised,
    borderColor: colors.danger,
    borderRadius: 12,
    borderWidth: 2,
    gap: spacing.small,
    marginTop: spacing.medium,
    padding: spacing.medium,
  },
  gameOverTitle: { color: colors.danger, fontSize: 25, fontWeight: '900' },
  gameOverScore: { color: colors.text, fontSize: 18, fontWeight: '700' },
  settingsPanel: {
    backgroundColor: colors.panel,
    borderRadius: 12,
    marginTop: spacing.medium,
    padding: spacing.medium,
  },
  settingsTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  settingsDescription: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  stepper: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  stepperButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 64,
  },
  stepperButtonDisabled: { backgroundColor: '#49423b', opacity: 0.65 },
  stepperSymbol: {
    color: colors.darkText,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 31,
  },
  stepperSymbolDisabled: { color: colors.textMuted },
  kLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  kValue: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
    textAlign: 'center',
  },
  highKHelp: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
});
