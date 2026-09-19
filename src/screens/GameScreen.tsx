import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  PanResponder,
  Pressable,
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
import { gameStore } from '../storage/asyncStorageAdapter';
import {
  clearGame,
  loadGame,
  SerializedGameWriter,
  type LoadGameResult,
} from '../storage/gameStorage';

const MIN_SWIPE_DISTANCE = 32;
const CARDINAL_DOMINANCE = 1.5;

function swipeDirection(dx: number, dy: number): Direction | null {
  const horizontal = Math.abs(dx);
  const vertical = Math.abs(dy);
  if (
    horizontal >= MIN_SWIPE_DISTANCE &&
    horizontal >= vertical * CARDINAL_DOMINANCE
  ) {
    return dx > 0 ? 'right' : 'left';
  }
  if (
    vertical >= MIN_SWIPE_DISTANCE &&
    vertical >= horizontal * CARDINAL_DOMINANCE
  ) {
    return dy > 0 ? 'down' : 'up';
  }
  return null;
}

export function GameScreen() {
  const [pendingK, setPendingK] = useState(1);
  const [game, setGame] = useState<GameState | null>(null);
  const [recovery, setRecovery] = useState<LoadGameResult | null>(null);
  const [saveError, setSaveError] = useState(false);
  const gameRef = useRef<GameState | null>(null);
  const writer = useMemo(() => new SerializedGameWriter(gameStore), []);

  useEffect(() => {
    let mounted = true;
    void loadGame(gameStore).then((result) => {
      if (!mounted) return;
      if (result.kind === 'recovery') {
        setRecovery(result);
        return;
      }
      const initial =
        result.kind === 'loaded' ? result.game : createGame(1, Math.random);
      gameRef.current = initial;
      setGame(initial);
      setPendingK(initial.activeK);
      if (result.kind === 'empty') {
        void writer.save(initial).catch(() => setSaveError(true));
      }
    });
    return () => {
      mounted = false;
    };
  }, [writer]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && gameRef.current !== null) {
        void writer.save(gameRef.current).catch(() => setSaveError(true));
      }
    });
    return () => subscription.remove();
  }, [writer]);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const commitGame = useCallback(
    (next: GameState) => {
      setGame(next);
      setSaveError(false);
      void writer.save(next).catch(() => setSaveError(true));
    },
    [writer],
  );

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      swipeDirection(gesture.dx, gesture.dy) !== null,
    onPanResponderRelease: (_, gesture) => {
      const direction = swipeDirection(gesture.dx, gesture.dy);
      if (direction === null) return;
      if (game === null || game.status === 'game-over') return;
      const result = move(game, direction, Math.random);
      if (result.moved) commitGame(result.state);
    },
  });

  const discardSavedGame = () => {
    void clearGame(gameStore)
      .then(() => {
        const initial = createGame(1, Math.random);
        setRecovery(null);
        setPendingK(1);
        commitGame(initial);
      })
      .catch(() => setSaveError(true));
  };

  if (recovery?.kind === 'recovery') {
    return (
      <View style={styles.centeredState}>
        <Text accessibilityRole="header" style={styles.settingsTitle}>
          Saved game needs attention
        </Text>
        <Text style={styles.recoveryText}>{recovery.message}</Text>
        <Text style={styles.recoveryText}>
          Discard it to start a new game. It will not be changed automatically.
        </Text>
        {saveError ? (
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>
            The saved game could not be discarded. Please try again.
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={discardSavedGame}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            Discard save and start new
          </Text>
        </Pressable>
      </View>
    );
  }

  if (game === null) {
    return (
      <View style={styles.centeredState}>
        <Text accessibilityLiveRegion="polite" style={styles.recoveryText}>
          Loading saved game…
        </Text>
      </View>
    );
  }

  const growth = deriveGrowth(game.highestCreatedExponent, game.activeK);

  const beginNewGame = () => commitGame(createGame(pendingK, Math.random));
  const requestNewGame = () => {
    if (game.status === 'game-over') {
      beginNewGame();
      return;
    }
    Alert.alert(
      'Start a new game?',
      'Your unfinished game will be discarded.',
      [
        { text: 'Keep playing', style: 'cancel' },
        { text: 'Start new game', style: 'destructive', onPress: beginNewGame },
      ],
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        {saveError ? (
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>
            Progress could not be saved. You can keep playing; saving will
            retry.
          </Text>
        ) : null}
        <View style={styles.header}>
          <Text
            accessibilityLabel="n to the power of m"
            accessibilityRole="header"
            style={styles.title}
          >
            n^m
          </Text>
          <View
            accessible
            accessibilityLabel={`Score ${game.score.toString()}`}
          >
            <Text style={styles.scoreLabel}>SCORE</Text>
            <Text style={styles.score}>{game.score.toString()}</Text>
          </View>
          <Pressable
            accessibilityLabel="Start a new game"
            accessibilityRole="button"
            onPress={requestNewGame}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>New game</Text>
          </Pressable>
        </View>

        <View style={styles.statusPanel}>
          <Text style={styles.activeSetting}>Active k: {game.activeK}</Text>
          <Text style={styles.milestone}>
            Next growth: merge {growth.nextExpansionTile.toString()} →{' '}
            {growth.sideLength + 1}×{growth.sideLength + 1}
          </Text>
        </View>

        <View
          {...panResponder.panHandlers}
          accessibilityLabel="Swipe game board"
        >
          <GameBoard game={game} />
        </View>

        {game.status === 'game-over' ? (
          <View accessibilityLiveRegion="polite" style={styles.gameOverPanel}>
            <Text accessibilityRole="header" style={styles.gameOverTitle}>
              Game over
            </Text>
            <Text style={styles.gameOverScore}>
              Final score: {game.score.toString()}
            </Text>
            <Pressable
              accessibilityLabel="Start a new game after game over"
              accessibilityRole="button"
              onPress={requestNewGame}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>New game</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.settingsPanel}>
          <Text accessibilityRole="header" style={styles.settingsTitle}>
            Next game setting
          </Text>
          <Text style={styles.settingsDescription}>
            {'Choose k for your next game. Your active game stays at k=' +
              game.activeK +
              '.'}
          </Text>
          <View style={styles.stepper}>
            <SettingButton
              disabled={pendingK === 1}
              label="Decrease k for next game"
              onPress={() => setPendingK((value) => Math.max(1, value - 1))}
              symbol="−"
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
              disabled={pendingK === 10}
              label="Increase k for next game"
              onPress={() => setPendingK((value) => Math.min(10, value + 1))}
              symbol="+"
            />
          </View>
          {pendingK >= 5 ? (
            <Text style={styles.help}>
              Higher k grows less often. With current 2/4 tile spawns, k values
              5–10 cannot grow beyond 2×2.
            </Text>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

interface SettingButtonProps {
  disabled: boolean;
  label: string;
  onPress: () => void;
  symbol: string;
}

function SettingButton({
  disabled,
  label,
  onPress,
  symbol,
}: SettingButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepperButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.stepperSymbol, disabled && styles.disabledText]}>
        {symbol}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centeredState: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.medium,
    justifyContent: 'center',
    padding: spacing.medium,
  },
  recoveryText: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 24,
    maxWidth: 440,
    textAlign: 'center',
  },
  errorText: {
    color: '#8b1e1e',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  screen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flexGrow: 1,
    paddingBottom: 40,
    paddingHorizontal: spacing.medium,
    paddingTop: 56,
  },
  content: { gap: spacing.medium, maxWidth: 440, width: '100%' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  title: { color: colors.ink, fontSize: 42, fontWeight: '900', lineHeight: 48 },
  scoreLabel: {
    color: colors.mutedInk,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  score: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  pressed: { backgroundColor: colors.primaryPressed, opacity: 0.9 },
  statusPanel: {
    backgroundColor: colors.panel,
    borderRadius: 12,
    padding: 14,
  },
  activeSetting: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  milestone: { color: colors.mutedInk, fontSize: 16, marginTop: 4 },
  gameOverPanel: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.tileDark,
    borderRadius: 14,
    borderWidth: 2,
    gap: 10,
    padding: spacing.medium,
  },
  gameOverTitle: { color: colors.ink, fontSize: 26, fontWeight: '900' },
  gameOverScore: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  settingsPanel: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: spacing.medium,
  },
  settingsTitle: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  settingsDescription: {
    color: colors.mutedInk,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 4,
  },
  stepper: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.medium,
    justifyContent: 'center',
    marginTop: 14,
  },
  stepperButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  disabledButton: {
    backgroundColor: '#d2cec7',
    borderColor: '#aaa49b',
    borderWidth: 1,
  },
  stepperSymbol: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 31,
  },
  disabledText: { color: '#706b64' },
  kValue: { alignItems: 'center', minWidth: 68 },
  kLabel: { color: colors.mutedInk, fontSize: 13, fontWeight: '700' },
  kNumber: { color: colors.ink, fontSize: 28, fontWeight: '900' },
  help: { color: colors.mutedInk, fontSize: 14, lineHeight: 20, marginTop: 14 },
});
