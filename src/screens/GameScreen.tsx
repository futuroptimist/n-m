import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AccessibilityInfo,
  Alert,
  AppState,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GameBoard, type BoardAnimation } from '../components/GameBoard';
import { selectMoveAnnouncement } from '../components/boardInteraction';
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

export function GameScreen() {
  const [pendingK, setPendingK] = useState(1);
  const [game, setGame] = useState<GameState | null>(null);
  const [boardSession, setBoardSession] = useState(0);
  const [recoveryReason, setRecoveryReason] = useState<RecoveryReason | null>(
    null,
  );
  const [storageError, setStorageError] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [animation, setAnimation] = useState<BoardAnimation | null>(null);
  const gameRef = useRef<GameState | null>(null);
  const animationId = useRef(0);
  const moving = useRef(false);

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
      moving.current = false;
      setAnimation(null);
      setGame(state);
      setBoardSession((session) => session + 1);
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
      if (current === null || current.status === 'game-over' || moving.current)
        return;
      const result = move(current, direction, Math.random);
      if (!result.moved) return;
      moving.current = true;
      animationId.current += 1;
      setAnimation({
        id: animationId.current,
        transitions: result.transitions,
      });
      gameRef.current = result.state;
      setGame(result.state);
      persist(result.state);
      const announcement = selectMoveAnnouncement(result.events);
      if (announcement !== null) {
        AccessibilityInfo.announceForAccessibility(announcement);
      }
    },
    [persist],
  );

  const finishAnimation = useCallback((id: number) => {
    setAnimation((current) => {
      if (current?.id !== id) return current;
      moving.current = false;
      return null;
    });
  }, []);

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
    <SafeAreaView style={styles.screen}>
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
          animation={animation}
          controlsVisible={controlsVisible}
          game={game}
          key={boardSession}
          onAnimationComplete={finishAnimation}
          onCloseControls={() => setControlsVisible(false)}
          onMove={performMove}
        >
          <View style={styles.movePanel}>
            <Text accessibilityRole="header" style={styles.moveTitle}>
              Move tiles
            </Text>
            <View style={styles.moveGrid}>
              <View style={styles.moveSpacer} />
              <MoveButton direction="up" onMove={performMove} symbol="↑" />
              <View style={styles.moveSpacer} />
              <MoveButton direction="left" onMove={performMove} symbol="←" />
              <MoveButton direction="down" onMove={performMove} symbol="↓" />
              <MoveButton direction="right" onMove={performMove} symbol="→" />
            </View>
          </View>

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
                Higher k grows less often. With current 2/4 tile spawns, k
                values 5–10 cannot grow beyond 2×2.
              </Text>
            ) : null}
          </View>
        </GameBoard>

        <Pressable
          accessibilityLabel="Open gameplay controls"
          accessibilityRole="button"
          onPress={() => setControlsVisible(true)}
          style={({ pressed }) => [
            styles.controlsButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Controls</Text>
        </Pressable>

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
      </View>
    </SafeAreaView>
  );
}

interface SettingButtonProps {
  disabled: boolean;
  label: string;
  onPress: () => void;
  symbol: string;
}

function MoveButton({
  direction,
  onMove,
  symbol,
}: {
  direction: Direction;
  onMove: (direction: Direction) => void;
  symbol: string;
}) {
  return (
    <Pressable
      accessibilityLabel={`Move ${direction}`}
      accessibilityRole="button"
      onPress={() => onMove(direction)}
      style={({ pressed }) => [styles.moveButton, pressed && styles.pressed]}
    >
      <Text style={styles.moveSymbol}>{symbol}</Text>
    </Pressable>
  );
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
    flex: 1,
    paddingHorizontal: spacing.medium,
    paddingTop: spacing.small,
  },
  content: { flex: 1, gap: spacing.small, maxWidth: 440, width: '100%' },
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
    padding: 10,
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
  movePanel: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: 12,
    gap: spacing.small,
    padding: 12,
  },
  controlsButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 44,
  },
  moveTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  moveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    width: 144,
  },
  moveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  moveSpacer: { height: 44, width: 44 },
  moveSymbol: {
    color: colors.white,
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 28,
  },
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
