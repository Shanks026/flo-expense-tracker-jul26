import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import Animated, { ZoomIn, FadeInDown } from 'react-native-reanimated';
import { Award } from 'lucide-react-native';
import Button from './Button';
import Confetti from './Confetti';
import useRewards from '../hooks/useRewards';
import useProfile from '../hooks/useProfile';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { RANKS, rankFromXp } from '../lib/rewards';
import { fontFamily, fontSize, spacing, radii } from '../theme/tokens';

// A small, root-mounted celebration for crossing a Rank threshold
// (18-gamification-ritual-and-ledger.md Phase 5) — same light-card-on-dark-
// overlay family as FreezePrompt/DueBillsModal (theme-adaptive), not
// StreakCelebration's pinned-dark full-screen treatment: rank-ups are rare
// (the first threshold is 1500 XP, ~15 logged days minimum) and don't need
// the same full-screen production every time XP quietly ticks up within the
// same rank.
//
// "Highest rank seen" lives in profiles.highest_rank_seen (DB), not
// AsyncStorage — it used to be device-local, which had two real problems: a
// fire-and-forget AsyncStorage.setItem() issued right before showing the
// dialog, never awaited, so a reload/kill shortly after a real celebration
// could lose the write and replay it next launch; and being device-local at
// all meant a reinstall (or a second device) could never remember a rank
// already celebrated. Both are closed by making this account-scoped and
// durable — the same fix already applied to theme_accent/theme_mode
// (app/_layout.js's ThemeProfileSync) for the identical class of bug.
export default function RankUpCelebration() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useAuth();
  const { xp, loading } = useRewards();
  const { profile, loading: profileLoading, updateProfile } = useProfile();
  const [visible, setVisible] = useState(false);
  const contentRef = useRef(null);
  // Tracks which rank.id this component has already resolved a check for, so
  // the effect below doesn't re-run on every XP tick within the SAME rank —
  // only when rank.id itself actually changes.
  const checkedRankRef = useRef(null);

  const userId = session?.user?.id ?? null;
  const { current: rank } = rankFromXp(xp);

  useEffect(() => {
    if (!session || !userId || loading || profileLoading || !profile) return;
    if (checkedRankRef.current === rank.id) return;
    checkedRankRef.current = rank.id;

    const lastSeenId = profile.highest_rank_seen;

    (async () => {
      // First-ever check for this user (no stored rank at all) — everyone
      // starts at Saver by construction (minXp: 0), so this is "welcome",
      // not a rank-UP. Record it silently and move on; nothing to celebrate.
      if (!lastSeenId) {
        await updateProfile({ highest_rank_seen: rank.id }, { silent: true });
        return;
      }
      if (lastSeenId === rank.id) return;

      const lastIndex = RANKS.findIndex((r) => r.id === lastSeenId);
      const newIndex = RANKS.findIndex((r) => r.id === rank.id);
      // Awaited, and written BEFORE the dialog shows — the write this
      // replaces raced showing the dialog against persisting "seen", which
      // is exactly how a rank-up could replay. Confirming the record landed
      // first closes that gap.
      await updateProfile({ highest_rank_seen: rank.id }, { silent: true });
      // XP only ever rises (it's never spent — lib/rewards.js), so a rank
      // moving backward shouldn't be reachable in practice; guarded anyway
      // rather than trusted, since this reads from the DB, not a value this
      // component fully controls.
      if (newIndex <= lastIndex) return;

      contentRef.current = rank;
      setVisible(true);
    })();
    // updateProfile is a fresh function reference every render (useProfile
    // isn't memoized) — omitted deliberately, same precedent as
    // ThemeProfileSync's reconciliation effect in app/_layout.js. The
    // checkedRankRef guard above is what actually controls re-entry, not
    // this dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, userId, loading, profileLoading, profile, rank.id]);

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
