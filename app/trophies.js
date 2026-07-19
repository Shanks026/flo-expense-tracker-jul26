import { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Flame,
  NotebookPen,
  CalendarCheck2,
  Target,
  Leaf,
  Compass,
  Tags,
  RotateCcw,
  Sparkles,
  Award,
} from 'lucide-react-native';
import Card from '../components/Card';
import IconTile from '../components/IconTile';
import useTrophies from '../hooks/useTrophies';
import useRewards from '../hooks/useRewards';
import { TROPHY_GROUPS, TROPHY_GROUP_ORDER } from '../lib/trophies';
import { RANKS, rankFromXp } from '../lib/rewards';
import { fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

// String keys in lib/trophies.js map to these — kept local to this screen
// rather than CategoryIcon.js, which is specifically the category icon
// registry, not a general-purpose one.
const ICONS = { Flame, NotebookPen, CalendarCheck2, Target, Leaf, Compass, Tags, RotateCcw, Sparkles };

// The Trophy Room — 18-gamification-ritual-and-ledger.md Phase 1. Every tile
// here is derived live from existing streak/transaction/plan data (via
// useTrophies → lib/trophies.js); nothing is stored except which trophies
// have already been "seen" (clears the Menu sheet's unseen dot).
export default function TrophiesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { trophies, earnedCount, totalCount, markAllSeen, loading } = useTrophies();
  const { xp } = useRewards();
  const { current: currentRank } = rankFromXp(xp);

  // Clears the unseen dot the moment the room is actually viewed, not on
  // first data arrival — matches the Menu sheet's own "seen" semantics.
  // Wrapped in useCallback: react-navigation's useFocusEffect re-runs its
  // internal effect whenever the callback's identity changes, so an inline
  // arrow here would get a new identity every render — combined with any
  // state update inside markAllSeen, that's an infinite loop (caught via a
  // real "Maximum update depth exceeded" crash; see markAllSeen's own
  // idempotency guard in useTrophies.js for the other half of the fix).
  const handleFocus = useCallback(() => {
    markAllSeen();
  }, [markAllSeen]);
  useFocusEffect(handleFocus);

  const toneColor = {
    streak: colors.streakDeep,
    income: colors.incomeAccent,
    brand: colors.brand,
    neutral: colors.mutedDarker,
  };

  // The closest not-yet-earned trophy (excluding budget_keeper's permanent
  // "Coming soon" lock) — turns the header card into a live nudge ("3 to go
  // for Fresh Start") instead of a flat earned/total tally.
  const nextTrophy = useMemo(() => {
    const candidates = trophies.filter((t) => !t.earned && !t.locked);
    if (!candidates.length) return null;
    return candidates.reduce((best, t) => (t.progress > best.progress ? t : best), candidates[0]);
  }, [trophies]);

  const subtitle = nextTrophy
    ? `${nextTrophy.threshold - nextTrophy.current} to go for "${nextTrophy.label}"`
    : earnedCount > 0
      ? "Every trophy unlocked — that's the whole wall."
      : 'Log a transaction to earn your first one.';

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.ink} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.headerTitle}>Trophies</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.summary}>
          <View style={styles.summaryText}>
            <Text style={styles.summaryTitle}>Trophy Wall</Text>
            <Text style={styles.summarySubtitle}>{subtitle}</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryCount}>{earnedCount}</Text>
            <Text style={styles.summaryTotal}>/ {totalCount}</Text>
          </View>
        </Card>

        {/* Rank ladder (18-gamification-ritual-and-ledger.md Phase 5) —
            reuses the exact trophy-row grammar (icon left, title+subtitle
            stacked, trailing state) rather than a bespoke layout, per the
            doc's own "reuse the trophy-room tile grammar; no new infra".
            Every rank you've already passed shows "Earned"; the one you're
            actually AT shows "Current"; anything ahead shows XP progress —
            same three-state shape the trophy rows already use, just applied
            to a fixed, ordered ladder instead of independent achievements. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rank</Text>
          <Card style={styles.listCard}>
            {RANKS.map((rank, idx) => {
              const reached = xp >= rank.minXp;
              const isCurrent = rank.id === currentRank.id;
              return (
                <View key={rank.id} style={[styles.row, idx < RANKS.length - 1 && styles.rowBorder]}>
                  <View
                    style={[
                      styles.rankIconTile,
                      { backgroundColor: reached ? `${rank.badgeColor}29` : colors.iconTileBg },
                    ]}
                  >
                    <Award size={20} color={reached ? rank.badgeColor : colors.mutedLight} strokeWidth={2} />
                  </View>
                  <View style={styles.rowMid}>
                    <Text style={[styles.rowTitle, !reached && styles.rowTitleLocked]}>{rank.title}</Text>
                    <Text style={styles.rowSub}>{rank.minXp.toLocaleString('en-IN')} XP</Text>
                  </View>
                  {isCurrent ? (
                    <Text style={[styles.rowEarned, { color: rank.badgeColor }]}>Current</Text>
                  ) : reached ? (
                    <Text style={[styles.rowEarned, { color: colors.mutedLight }]}>Earned</Text>
                  ) : (
                    <Text style={styles.rowProgress}>
                      {Math.min(xp, rank.minXp).toLocaleString('en-IN')}/{rank.minXp.toLocaleString('en-IN')}
                    </Text>
                  )}
                </View>
              );
            })}
          </Card>
        </View>

        {TROPHY_GROUP_ORDER.map((groupId) => {
          const group = TROPHY_GROUPS[groupId];
          const Icon = ICONS[group.icon];
          const tiles = trophies.filter((t) => t.groupId === groupId);

          return (
            <View key={groupId} style={styles.section}>
              <Text style={styles.sectionTitle}>{group.name}</Text>
              <Card style={styles.listCard}>
                {tiles.map((t, idx) => (
                  <View key={t.id} style={[styles.row, idx < tiles.length - 1 && styles.rowBorder]}>
                    <IconTile tone={t.earned ? group.tone : 'neutral'} size={44} radius={radii.iconTile}>
                      <Icon
                        size={20}
                        color={t.earned ? toneColor[group.tone] : colors.mutedLight}
                        strokeWidth={2}
                      />
                    </IconTile>
                    <View style={styles.rowMid}>
                      <Text style={[styles.rowTitle, !t.earned && styles.rowTitleLocked]}>{t.label}</Text>
                      <Text style={styles.rowSub} numberOfLines={2}>
                        {t.locked ? 'Coming soon' : t.hint}
                      </Text>
                    </View>
                    {t.earned ? (
                      <Text style={[styles.rowEarned, { color: toneColor[group.tone] }]}>Earned</Text>
                    ) : (
                      !t.locked && (
                        <Text style={styles.rowProgress}>
                          {t.current}/{t.threshold}
                        </Text>
                      )
                    )}
                  </View>
                ))}
              </Card>
            </View>
          );
        })}

        <Text style={styles.footnote}>
          Trophies are earned automatically as you use FLO — nothing to buy, nothing to lose.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.title,
      letterSpacing: -0.3,
      color: colors.ink,
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingBottom: 60,
    },
    // Mirrors app/streak.js's hero card grammar (text one side, a big stat
    // the other) but mirrored — engaging title+copy on the left, the big
    // earned/total tally on the right.
    summary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.xl,
      marginBottom: spacing.lg,
    },
    summaryText: {
      flex: 1,
      paddingRight: spacing.md,
    },
    summaryTitle: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.heading,
      letterSpacing: -0.3,
      color: colors.ink,
    },
    summarySubtitle: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      marginTop: 3,
      lineHeight: 16,
    },
    summaryStat: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    summaryCount: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.amountLg,
      letterSpacing: -1,
      color: colors.ink,
    },
    summaryTotal: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.xl,
      color: colors.mutedLight,
      marginLeft: 2,
    },
    section: {
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.lg,
      color: colors.ink,
      marginBottom: spacing.sm,
    },
    // Same grammar as Home's Recent Transactions / Upcoming Bills lists —
    // icon left, title+subtitle stacked right, optional trailing value.
    listCard: {
      padding: 0,
      paddingHorizontal: spacing.lg,
    },
    // Hand-rolled, not IconTile — a rank badge needs a per-rank colour
    // (lib/rewards.js's `badgeColor`), and IconTile's background is fixed by
    // its `tone` lookup with no override escape hatch. Same 44/iconTile
    // dimensions as every IconTile on this screen, for visual consistency.
    rankIconTile: {
      width: 44,
      height: 44,
      borderRadius: radii.iconTile,
      alignItems: 'center',
      justifyContent: 'center',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 13,
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    rowMid: {
      flex: 1,
    },
    rowTitle: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.lg,
      color: colors.ink,
    },
    rowTitleLocked: {
      color: colors.mutedMid,
    },
    rowSub: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      marginTop: 1,
    },
    rowProgress: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.sm,
      color: colors.mutedLight,
      fontVariant: ['tabular-nums'],
    },
    rowEarned: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.sm,
      letterSpacing: -0.1,
    },
    footnote: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.sm,
      lineHeight: 18,
      color: colors.muted,
      textAlign: 'center',
      marginTop: spacing.lg,
    },
  });
}
