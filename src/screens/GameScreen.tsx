import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  AppState,
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
import { gameStorage } from '../storage/asyncStorageAdapter';
import type { RecoveryReason } from '../storage/gameStorage';
import { moveAnnouncement } from '../interaction/gameInteraction';

export function GameScreen() {
  const [pendingK, setPendingK] = useState(1);
  const [game, setGame] = useState<GameState | null>(null);
  const [recoveryReason, setRecoveryReason] = useState<RecoveryReason | null>(
    null,
  );
  const [storageError, setStorageError] = useState<string | null>(null);
  const gameRef = useRef<GameState | null>(null);

  const persist = useCallback((state: GameState) => {
    void gameStorage.save(state).then(
      () => setStorageError(null),
      () =>
        setStorageError('Your game could not be saved. You can keep playing.'),
    );
  }, []);

  const installGame = useCallback(
    (state: GameState, shouldPersist: boolean) => {
      gameRef.current = state;
      setGame(state);
      if (shouldPersist) persist(state);
    },
    [persist],
  );

  useEffect(() => {
    let active = true;
    void gameStorage.load().then((result) => {
      if (!active) return;
      if (result.type === 'recovery') {
        setRecoveryReason(result.reason);
        return;
      }
      if (result.type === 'restored') {
        setPendingK(result.game.activeK);
        installGame(result.game, false);
        return;
      }
      installGame(createGame(1, Math.random), true);
    });
    return () => {
      active = false;
    };
  }, [installGame]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' && gameRef.current !== null) {
        persist(gameRef.current);
      }
    });
    return () => subscription.remove();
  }, [persist]);

  const performMove = useCallback(
    (direction: Direction) => {
      setGame((current) => {
        if (current === null || current.status === 'game-over') return current;
        const result = move(current, direction, Math.random);
        if (!result.moved) return current;
        gameRef.current = result.state;
        persist(result.state);
        const announcement = moveAnnouncement(result.events);
        if (announcement !== null) {
          AccessibilityInfo.announceForAccessibility(announcement);
        }
        return result.state;
      });
    },
    [persist],
  );

  if (recoveryReason !== null) {
    const newer = recoveryReason === 'newer-version';
    return (
      <View style={styles.centeredState}>
        <Text accessibilityRole="header" style={styles.recoveryTitle}>
          Saved game unavailable
        </Text>
        <Text style={styles.recoveryMessage}>
          {newer
            ? 'This save was created by a newer app version and cannot be opened here.'
            : recoveryReason === 'read-error'
              ? 'The saved game could not be read.'
              : 'The saved game is invalid or incompatible.'}{' '}
          It has not been changed.
        </Text>
        {storageError === null ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>
            {storageError}
          </Text>
        )}
        <Pressable
          accessibilityLabel="Discard saved game and start a new game"
          accessibilityRole="button"
          onPress={() => {
            setStorageError(null);
            void gameStorage.clear().then(
              () => {
                const fresh = createGame(1, Math.random);
                setPendingK(1);
                setRecoveryReason(null);
                installGame(fresh, true);
              },
              () => setStorageError('The saved game could not be discarded.'),
            );
          }}
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
      <View
        accessibilityLabel="Loading saved game"
        style={styles.centeredState}
      >
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.recoveryMessage}>Loading saved game…</Text>
      </View>
    );
  }

  const growth = deriveGrowth(game.highestCreatedExponent, game.activeK);

  const beginNewGame = () =>
    installGame(createGame(pendingK, Math.random), true);
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
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>
            {storageError}
          </Text>
        )}

        <GameBoard
          game={game}
          key={`${game.activeK}-${game.sideLength}`}
          onMove={performMove}
        />

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
  recoveryTitle: { color: colors.ink, fontSize: 26, fontWeight: '900' },
  recoveryMessage: {
    color: colors.mutedInk,
    fontSize: 16,
    lineHeight: 23,
    maxWidth: 440,
    textAlign: 'center',
  },
  errorText: { color: '#8b1e1e', fontSize: 15, lineHeight: 21 },
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
