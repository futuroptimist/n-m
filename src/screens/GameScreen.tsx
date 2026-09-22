import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AccessibilityInfo,
  Alert,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GameBoard } from '../components/GameBoard';
import { selectMoveAnnouncement } from '../components/boardInteraction';
import {
  createGame,
  deriveGrowth,
  move,
  type Direction,
  type GameState,
  type MoveResult,
} from '../engine';
import { colors, spacing } from '../theme';
import { gameStorage } from '../storage/asyncStorageAdapter';
import type { RecoveryReason } from '../storage/gameStorage';

export function GameScreen() {
  const [pendingK, setPendingK] = useState(1);
  const [game, setGame] = useState<GameState | null>(null);
  const [boardSession, setBoardSession] = useState(0);
  const [recoveryReason, setRecoveryReason] = useState<RecoveryReason | null>(
    null,
  );
  const [storageError, setStorageError] = useState<string | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [moveResult, setMoveResult] = useState<MoveResult | null>(null);
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
      setBoardSession((session) => session + 1);
      setMoveResult(null);
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
      const current = gameRef.current;
      if (
        current === null ||
        current.status === 'game-over' ||
        moveResult !== null
      )
        return;
      const result = move(current, direction, Math.random);
      if (!result.moved) return;
      gameRef.current = result.state;
      setGame(result.state);
      setMoveResult(result);
      persist(result.state);
      const announcement = selectMoveAnnouncement(result.events);
      if (announcement !== null) {
        AccessibilityInfo.announceForAccessibility(announcement);
      }
    },
    [moveResult, persist],
  );

  const finishAnimation = useCallback(() => setMoveResult(null), []);

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
    <View style={styles.screen}>
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
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.milestone}>
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
          controlsOpen={controlsOpen}
          game={game}
          key={boardSession}
          moveResult={moveResult}
          onAnimationComplete={finishAnimation}
          onCloseControls={() => setControlsOpen(false)}
          onMove={performMove}
          onPendingKChange={setPendingK}
          pendingK={pendingK}
        />
        <Pressable
          accessibilityLabel="Open game controls"
          accessibilityRole="button"
          onPress={() => setControlsOpen(true)}
          style={({ pressed }) => [
            styles.controlsButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Controls</Text>
        </Pressable>
        {moveResult === null ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.moveStatus}>
            Moving tiles…
          </Text>
        )}
        {game.status === 'game-over' ? (
          <View accessibilityLiveRegion="polite" style={styles.gameOverPanel}>
            <Text accessibilityRole="header" style={styles.gameOverTitle}>
              Game over
            </Text>
            <Text style={styles.gameOverScore}>
              Final score: {game.score.toString()}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
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
  errorText: { color: '#8b1e1e', fontSize: 13 },
  screen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    paddingHorizontal: spacing.medium,
    paddingTop: 48,
    paddingBottom: 12,
  },
  content: { flex: 1, gap: spacing.small, maxWidth: 440, width: '100%' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  title: { color: colors.ink, fontSize: 34, fontWeight: '900', lineHeight: 40 },
  scoreLabel: {
    color: colors.mutedInk,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  score: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  pressed: { backgroundColor: colors.primaryPressed, opacity: 0.9 },
  statusPanel: {
    backgroundColor: colors.panel,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  activeSetting: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  milestone: { color: colors.mutedInk, fontSize: 14, marginTop: 2 },
  controlsButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 28,
  },
  moveStatus: { color: colors.mutedInk, fontSize: 12, textAlign: 'center' },
  gameOverPanel: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    padding: 8,
  },
  gameOverTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  gameOverScore: { color: colors.ink, fontSize: 15, fontWeight: '700' },
});
