import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import Animated, { ZoomIn, FadeInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Award } from 'lucide-react-native';
import Button from './Button';
import Confetti from './Confetti';
import useRewards from '../hooks/useRewards';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { RANKS, rankFromXp } from '../lib/rewards';
import { fontFamily, fontSize, spacing, radii } from '../theme/tokens';

// User-scoped, same standing rule as StreakCelebration/FreezePrompt's own
// keys (00-index.md) — stores the highest rank id ever SEEN, not a per-day
// flag, since a rank-up is a one-time-per-rank lifetime event, not something
// that resets daily.
const storageKey = (userId) => `flo.rank.lastSeen.${userId}`;

// A small, root-mounted celebration for crossing a Rank threshold
// (18-gamification-ritual-and-ledger.md Phase 5) — same light-card-on-dark-
// overlay family as FreezePrompt/DueBillsModal (theme-adaptive), not
// StreakCelebration's pinned-dark full-screen treatment: rank-ups are rare
// (the first threshold is 1500 XP, ~15 logged days minimum) and don't need
// the same full-screen production every time XP quietly ticks up within the
// same rank.
export default function RankUpCelebration() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useAuth();
  const { xp, loading } = useRewards();
  const [visible, setVisible] = useState(false);
  const contentRef = useRef(null);
  // Tracks which rank.id this component has already resolved a check for, so
  // the effect below doesn't re-run on every XP tick within the SAME rank —
  // only when rank.id itself actually changes.
  const checkedRankRef = useRef(null);

  const userId = session?.user?.id ?? null;
  const { current: rank } = rankFromXp(xp);

  useEffect(() => {
    if (!session || !userId || loading) return;
    if (checkedRankRef.current === rank.id) return;
    checkedRankRef.current = rank.id;

    const key = storageKey(userId);
    AsyncStorage.getItem(key)
      .catch(() => null)
      .then((lastSeenId) => {
        // First-ever check for this user (no stored rank at all) — everyone
        // starts at Saver by construction (minXp: 0), so this is "welcome",
        // not a rank-UP. Record it silently and move on; nothing to celebrate.
        if (!lastSeenId) {
          AsyncStorage.setItem(key, rank.id).catch(() => {});
          return;
        }
        if (lastSeenId === rank.id) return;

        const lastIndex = RANKS.findIndex((r) => r.id === lastSeenId);
        const newIndex = RANKS.findIndex((r) => r.id === rank.id);
        AsyncStorage.setItem(key, rank.id).catch(() => {});
        // XP only ever rises (it's never spent — lib/rewards.js), so a rank
        // moving backward shouldn't be reachable in practice; guarded anyway
        // rather than trusted, since this reads from AsyncStorage, not a
        // value this component fully controls.
        if (newIndex <= lastIndex) return;

        contentRef.current = rank;
        setVisible(true);
      });
  }, [session, userId, loading, rank.id]);

  if (!visible || !contentRef.current) return null;

  const shownRank = contentRef.current;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <Confetti />
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Animated.View
            entering={ZoomIn.duration(400)}
            style={[styles.iconTile, { backgroundColor: `${shownRank.badgeColor}29` }]}
          >
            <Award size={40} color={shownRank.badgeColor} strokeWidth={2} />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.eyebrow}>
            <Text style={styles.eyebrowText}>RANK UP</Text>
          </Animated.View>
          <Animated.Text entering={FadeInDown.delay(150).duration(400)} style={styles.title}>
            {shownRank.title}
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(250).duration(400)} style={styles.body}>
            Your lifetime XP just crossed into a new rank.
          </Animated.Text>
          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.buttonWrap}>
            <Button variant="primary" title="Nice" onPress={() => setVisible(false)} />
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    card: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: radii.cardLg,
      padding: spacing.xl,
      alignItems: 'center',
    },
    iconTile: {
      width: 88,
      height: 88,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    eyebrow: {
      backgroundColor: colors.chipBg,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      marginBottom: spacing.md,
    },
    eyebrowText: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.xs,
      letterSpacing: 1.2,
      color: colors.mutedDarker,
    },
    title: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.display,
      letterSpacing: -0.3,
      color: colors.ink,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    body: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.base,
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: spacing.xl,
    },
    buttonWrap: {
      width: '100%',
    },
  });
}
