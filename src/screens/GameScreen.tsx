import { useEffect, useMemo, useState } from 'react';
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
import { gameStorage } from '../storage/asyncStorage';
import type { LoadResult } from '../storage';

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
  const [hydration, setHydration] = useState<'loading' | 'ready' | 'recovery'>(
    'loading',
  );
  const [recovery, setRecovery] = useState<LoadResult | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void gameStorage.load().then((result) => {
      if (!mounted) return;
      if (result.kind === 'loaded') {
        setGame(result.game);
        setPendingK(result.game.activeK);
        setHydration('ready');
      } else if (result.kind === 'empty') {
        setGame(createGame(1, Math.random));
        setHydration('ready');
      } else {
        setRecovery(result);
        setHydration('recovery');
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (hydration !== 'ready' || game === null) return;
    void gameStorage.save(game).then((result) => {
      if (!result.ok) setStorageError('Could not save this move.');
      else setStorageError(null);
    });
  }, [game, hydration]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if ((state === 'inactive' || state === 'background') && game !== null) {
        void gameStorage.save(game).then((result) => {
          if (!result.ok) setStorageError('Could not save this game.');
        });
      }
    });
    return () => subscription.remove();
  }, [game]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          swipeDirection(gesture.dx, gesture.dy) !== null,
        onPanResponderRelease: (_, gesture) => {
          const direction = swipeDirection(gesture.dx, gesture.dy);
          if (direction === null) return;
          setGame((current) => {
            if (current === null || current.status === 'game-over') {
              return current;
            }
            return move(current, direction, Math.random).state;
          });
        },
      }),
    [],
  );

  if (hydration === 'loading') return <LoadingScreen />;
  if (hydration === 'recovery') {
    const newer =
      recovery?.kind === 'recovery' && recovery.reason === 'newer-schema';
    return (
      <RecoveryScreen
        detail={
          newer
            ? 'This save was created by a newer app version and cannot be opened here.'
            : 'The saved game could not be read or validated. It has not been changed.'
        }
        onDiscard={() => {
          void gameStorage.clear().then((result) => {
            if (!result.ok) {
              setStorageError('Could not discard the saved game. Try again.');
              return;
            }
            setGame(createGame(1, Math.random));
            setPendingK(1);
            setStorageError(null);
            setHydration('ready');
          });
        }}
        storageError={storageError}
      />
    );
  }
  if (game === null) return <LoadingScreen />;
  const growth = deriveGrowth(game.highestCreatedExponent, game.activeK);

  const beginNewGame = () => setGame(createGame(pendingK, Math.random));
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

        {storageError === null ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.storageError}>
            {storageError} Your game remains playable.
          </Text>
        )}

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

function LoadingScreen() {
  return (
    <View style={styles.centeredScreen}>
      <Text accessibilityLiveRegion="polite" style={styles.loadingText}>
        Loading saved game…
      </Text>
    </View>
  );
}

function RecoveryScreen({
  detail,
  onDiscard,
  storageError,
}: {
  detail: string;
  onDiscard: () => void;
  storageError: string | null;
}) {
  return (
    <View style={styles.centeredScreen}>
      <View style={styles.recoveryPanel}>
        <Text accessibilityRole="header" style={styles.gameOverTitle}>
          Saved game needs attention
        </Text>
        <Text style={styles.recoveryText}>{detail}</Text>
        {storageError === null ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.storageError}>
            {storageError}
          </Text>
        )}
        <Pressable
          accessibilityLabel="Discard saved game and start a new game"
          accessibilityRole="button"
          onPress={onDiscard}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Discard and start new</Text>
        </Pressable>
      </View>
    </View>
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
  centeredScreen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.medium,
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
  loadingText: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  recoveryPanel: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    gap: spacing.medium,
    maxWidth: 440,
    padding: spacing.medium,
    width: '100%',
  },
  recoveryText: { color: colors.ink, fontSize: 16, lineHeight: 23 },
  storageError: { color: '#8b1e1e', fontSize: 14, fontWeight: '700' },
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
