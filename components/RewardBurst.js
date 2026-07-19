import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, AccessibilityInfo } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { CircleDollarSign, Star } from 'lucide-react-native';
import { colors as staticColors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

// A brief "you earned this" celebration — 18-gamification-ritual-and-ledger.md
// Phase 3. Triggered from two places (AddTransactionSheet's first log of the
// day, TodayCard's no-spend declaration), so it's a global Provider + imperative
// trigger, same shape as components/Toast.js, not a prop threaded through both
// callers. Deliberately its own thing rather than a Toast variant — a reward is
// a moment worth a beat of pageantry (the pop-in), a status message isn't.
const RewardBurstContext = createContext(null);

export function RewardBurstProvider({ children }) {
  const [burst, setBurst] = useState(null);

  // Silently does nothing for a zero-value burst (e.g. a repeat/no-op claim
  // upstream already guards this, but a stray call with {coins:0, xp:0}
  // showing an empty popup would be a bug, not a celebration).
  const showRewardBurst = useCallback(({ coins = 0, xp = 0 } = {}) => {
    if (!coins && !xp) return;
    setBurst({ id: Date.now(), coins, xp });
  }, []);

  return (
    // isBursting exposed for StreakCelebration (a full-screen Modal, which
    // would otherwise render on TOP of this overlay and hide it mid-animation
    // if both fire off the same "logged a transaction" event) to defer
    // showing itself until this burst has fully finished — coins/XP first,
    // the streak takeover only once the user's acknowledged the burst. True
    // for the burst's whole lifecycle including its fade-out, since `burst`
    // only clears via onDone at the very end.
    <RewardBurstContext.Provider value={{ showRewardBurst, isBursting: burst !== null }}>
      {children}
      {burst && <RewardBurstOverlay key={burst.id} coins={burst.coins} xp={burst.xp} onDone={() => setBurst(null)} />}
    </RewardBurstContext.Provider>
  );
}

export function useRewardBurst() {
  const ctx = useContext(RewardBurstContext);
  if (!ctx) throw new Error('useRewardBurst must be used within RewardBurstProvider');
  return ctx;
}

const VISIBLE_MS = 1200;
const FADE_OUT_MS = 220;

function RewardBurstOverlay({ coins, xp, onDone }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const progress = useSharedValue(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => active && setReduceMotion(enabled))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Animate-first, snap-on-reduce (same convention as FadeIn/OnboardingReveal):
  // starts popping in immediately rather than waiting on the async
  // reduce-motion check, and only snaps to the flat final frame if that check
  // later resolves true. This still SHOWS the reward under reduce-motion — it
  // conveys real information (what you just earned), unlike Confetti's purely
  // decorative pieces, which render nothing at all in that case.
  useEffect(() => {
    progress.value = withSpring(1, { damping: 14, stiffness: 220 });
  }, []);
  useEffect(() => {
    if (reduceMotion) progress.value = 1;
  }, [reduceMotion]);

  // Two independent plain-JS timers, not chained off the reanimated
  // animation's own completion — simpler than threading a worklet callback
  // back to JS, and this component's only side effect (unmounting itself via
  // onDone) never needs to run on the UI thread anyway.
  useEffect(() => {
    const hideTimer = setTimeout(() => {
      progress.value = withTiming(0, { duration: FADE_OUT_MS });
    }, VISIBLE_MS);
    const doneTimer = setTimeout(onDone, VISIBLE_MS + FADE_OUT_MS);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.85 + progress.value * 0.15 }, { translateY: (1 - progress.value) * 10 }],
  }));

  return (
    <Animated.View style={[styles.wrap, animatedStyle]} pointerEvents="none">
      <View style={styles.card}>
        {coins > 0 && (
          <View style={styles.entry}>
            <CircleDollarSign size={20} color={colors.coinGold} fill={colors.coinGold} strokeWidth={1.5} />
            <Text style={styles.text}>+{coins}</Text>
          </View>
        )}
        {xp > 0 && (
          <View style={styles.entry}>
            <Star size={20} color={colors.brand} fill={colors.brand} strokeWidth={1.5} />
            <Text style={styles.text}>+{xp} XP</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999,
      elevation: 999,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      backgroundColor: staticColors.ink,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 14,
      elevation: 10,
    },
    entry: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    text: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.xl,
      letterSpacing: -0.2,
      color: staticColors.surface,
    },
  });
}
