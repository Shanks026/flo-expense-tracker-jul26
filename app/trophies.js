import { useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Image } from 'react-native';
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
} from 'lucide-react-native';
import Card from '../components/Card';
import IconTile from '../components/IconTile';
import useTrophies from '../hooks/useTrophies';
import useRewards from '../hooks/useRewards';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useRewardBurst } from '../components/RewardBurst';
import { useToast } from '../components/Toast';
import { claimTrophy } from '../lib/rewardsMutations';
import {
  TROPHY_GROUPS,
  TROPHY_GROUP_ORDER,
  STREAK_BADGE_ART,
  STREAK_BADGE_ART_LOCKED,
  LOGGER_BADGE_ART,
  LOGGER_BADGE_ART_LOCKED,
  PERFECT_MONTH_BADGE_ART,
  PERFECT_MONTH_BADGE_ART_LOCKED,
  CATEGORIZER_BADGE_ART,
  CATEGORIZER_BADGE_ART_LOCKED,
  COMEBACK_BADGE_ART,
  COMEBACK_BADGE_ART_LOCKED,
  PLANNER_BADGE_ART,
  PLANNER_BADGE_ART_LOCKED,
  BUDGET_BADGE_ART,
  BUDGET_BADGE_ART_LOCKED,
} from '../lib/trophies';
import { getTheme } from '../lib/cardThemes';
import { RANKS, RANK_BADGE_ART, RANK_BADGE_ART_LOCKED } from '../lib/rewards';
import { fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

// String keys in lib/trophies.js map to these — kept local to this screen
// rather than CategoryIcon.js, which is specifically the category icon
// registry, not a general-purpose one.
const ICONS = { Flame, NotebookPen, CalendarCheck2, Target, Leaf, Compass, Tags, RotateCcw, Sparkles };

// Illustrated badge art per group, where it exists — Streak/Logger are
// tier-keyed ladders (STREAK_BADGE_ART[t.tier]), Perfect Month/Categorizer
// are single binary trophies (one image, no tier key). Any group not listed
// here (or a ladder tier missing its art, e.g. Streak's day 50 for a while)
// falls back to the icon-tile placeholder — see the render below.
function trophyBadgeArt(groupId, t) {
  switch (groupId) {
    case 'streak':
      return t.earned ? STREAK_BADGE_ART[t.tier] : STREAK_BADGE_ART_LOCKED[t.tier];
    case 'logger':
      return t.earned ? LOGGER_BADGE_ART[t.tier] : LOGGER_BADGE_ART_LOCKED[t.tier];
    case 'perfect_month':
      return t.earned ? PERFECT_MONTH_BADGE_ART : PERFECT_MONTH_BADGE_ART_LOCKED;
    case 'categorizer':
      return t.earned ? CATEGORIZER_BADGE_ART : CATEGORIZER_BADGE_ART_LOCKED;
    case 'comeback':
      return t.earned ? COMEBACK_BADGE_ART : COMEBACK_BADGE_ART_LOCKED;
    case 'planner':
      return t.earned ? PLANNER_BADGE_ART[t.tier] : PLANNER_BADGE_ART_LOCKED[t.tier];
    case 'budget_keeper':
      return t.earned ? BUDGET_BADGE_ART[t.tier] : BUDGET_BADGE_ART_LOCKED[t.tier];
    default:
      return null;
  }
}

// The Claim button's headline amount — coins first (the thing most users
// value most), then freezes (Comeback's reward is freeze-only, coins:0), XP
// last (every reward has XP, so it's the only guaranteed non-zero fallback).
function claimAmountLabel(reward) {
  if (reward.coins > 0) return `+${reward.coins}`;
  if (reward.freezes > 0) return `+${reward.freezes} freeze${reward.freezes === 1 ? '' : 's'}`;
  return `+${reward.xp} XP`;
}

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
  const { notifyChanged } = useDataRefresh();
  const { showRewardBurst } = useRewardBurst();
  const { showToast } = useToast();
  // 21-achievement-rewards-and-milestone-road.md Phase 2 — tracks which
  // single tile is mid-claim so only that row's button shows a spinner,
  // rather than disabling the whole screen for one network round trip.
  const [claimingId, setClaimingId] = useState(null);

  const handleClaim = useCallback(
    async (t) => {
      setClaimingId(t.id);
      const { error, isNewClaim, coins, xp: earnedXp, freezes, themeId } = await claimTrophy(t.id);
      setClaimingId(null);
      if (error || !isNewClaim) return;
      // notifyChanged() bumps useDataRefresh's version, which useTrophies
      // already subscribes to for its own refetch (including the
      // claimedTrophyRefs query) — no separate refetch() call needed, same
      // as every other claim site in this app (claimMilestone/claimSpin's
      // callers only ever call notifyChanged()).
      notifyChanged();
      showRewardBurst({ coins, xp: earnedXp, freezes });
      // Theme grants can't ride the RewardBurst (coins/XP/freezes only), so the
      // cosmetic prize gets its own confirmation toast — the swatch in the tile
      // already showed WHAT it is; this confirms it's now unlocked in the Shop.
      // (22-coin-store-and-reward-tiering.md Phase 1.)
      if (themeId) {
        showToast({ message: `${getTheme(themeId).name} card unlocked`, variant: 'success' });
      }
    },
    [notifyChanged, showRewardBurst, showToast]
  );

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
            a game-style trophy-case grid (3 per row) rather than the list-row
            grammar every other section here uses, per direct feedback. Earned
            is conveyed by color alone — a reached rank shows its real
            illustrated badge, an unreached one shows the pre-baked grayscale
            variant (RANK_BADGE_ART_LOCKED) — no separate "Earned"/"Current"
            label needed on top of that. No reward info surfaces here (ranks
            don't carry one, unlike the trophy tiles below). */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rank</Text>
          <View style={styles.badgeGrid}>
            {RANKS.map((rank) => {
              const reached = xp >= rank.minXp;
              return (
                <View key={rank.id} style={styles.badgeGridItem}>
                  <Image
                    source={reached ? RANK_BADGE_ART[rank.id] : RANK_BADGE_ART_LOCKED[rank.id]}
                    style={styles.badgeGridImage}
                    resizeMode="contain"
                  />
                  <Text style={styles.badgeGridTitle} numberOfLines={1}>
                    {rank.title}
                  </Text>
                  <Text style={styles.badgeGridSub}>
                    {Math.min(xp, rank.minXp).toLocaleString('en-IN')}/{rank.minXp.toLocaleString('en-IN')} XP
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Trophy groups — same grid grammar as Rank above (per direct
            feedback: "same layout for all sections"). No illustrated art yet
            per group (assets/rank/BADGES.md's pattern is coming for these
            too) — a circular IconTile stands in as the placeholder badge,
            same earned/locked tone-color logic the old row layout used.
            Dropped for grid consistency: the hint description line and the
            reward theme-swatch preview (both were list-row-shaped, not
            grid-tile-shaped). KEPT: the Claim button — it's the actual
            mechanism for collecting a trophy's coin/freeze/theme reward, not
            cosmetic, so removing it would silently break claiming rather
            than just simplifying the look. */}
        {TROPHY_GROUP_ORDER.map((groupId) => {
          const group = TROPHY_GROUPS[groupId];
          const Icon = ICONS[group.icon];
          const tiles = trophies.filter((t) => t.groupId === groupId);

          return (
            <View key={groupId} style={styles.section}>
              <Text style={styles.sectionTitle}>{group.name}</Text>
              <View style={styles.badgeGrid}>
                {tiles.map((t) => {
                  const art = trophyBadgeArt(groupId, t);
                  return (
                  <View key={t.id} style={styles.badgeGridItem}>
                    {art ? (
                      <Image source={art} style={styles.badgeGridImage} resizeMode="contain" />
                    ) : (
                      <IconTile tone={t.earned ? group.tone : 'neutral'} size={64} radius={32}>
                        <Icon size={28} color={t.earned ? toneColor[group.tone] : colors.mutedLight} strokeWidth={2} />
                      </IconTile>
                    )}
                    <Text style={styles.badgeGridTitle} numberOfLines={2}>
                      {t.label}
                    </Text>
                    {t.earned && t.reward && !t.claimed ? (
                      <Pressable
                        style={[styles.claimButton, styles.badgeGridClaim, claimingId === t.id && styles.claimButtonDisabled]}
                        onPress={() => handleClaim(t)}
                        disabled={claimingId === t.id}
                      >
                        {claimingId === t.id ? (
                          <ActivityIndicator size="small" color={colors.ink} />
                        ) : (
                          <Text style={styles.claimButtonText}>Claim {claimAmountLabel(t.reward)}</Text>
                        )}
                      </Pressable>
                    ) : t.locked ? (
                      <Text style={styles.badgeGridSub}>Coming soon</Text>
                    ) : (
                      <Text style={styles.badgeGridSub}>
                        {Math.min(t.current, t.threshold).toLocaleString('en-IN')}/{t.threshold.toLocaleString('en-IN')}
                      </Text>
                    )}
                  </View>
                  );
                })}
              </View>
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
    // Trophy-case grid (3 per row) — every section on this screen (Rank AND
    // every trophy group) shares this one grid grammar now, no Card wrapper,
    // per direct feedback ("make it look like an actual game" / "same
    // layout for all sections"). Column count divides evenly for Rank (9)
    // and most groups; a partial last row (e.g. Frugal's 3 tiles fills
    // exactly, Streak's 6 fills exactly, but a group with e.g. 4 tiles
    // leaves one slot short) just left-aligns rather than stretching —
    // acceptable, matches how any real trophy-case grid handles a partial
    // row.
    badgeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    badgeGridItem: {
      width: '33.333%',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xs,
    },
    // Earned/locked is conveyed entirely by which art (color vs pre-baked
    // grayscale) is passed in as the source — no tint/opacity override here.
    badgeGridImage: {
      width: 80,
      height: 80,
    },
    badgeGridTitle: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.sm,
      color: colors.ink,
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    badgeGridSub: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xs,
      color: colors.mutedLight,
      marginTop: 2,
      textAlign: 'center',
    },
    // Trophy groups don't have illustrated art yet (assets/rank/BADGES.md's
    // pattern, upcoming) — a circular IconTile-based placeholder stands in,
    // same earned/locked color logic the old row layout used (tone color vs
    // colors.mutedLight), just resized into the grid's badge slot. Swap for
    // real per-trophy art the same way RANK_BADGE_ART was wired once it
    // exists — no other layout change needed.
    // Claim button (21-achievement-rewards-and-milestone-road.md Phase 2) —
    // a compact pill matching this app's small-action-button grammar (Shop's
    // tile actions, e.g.). badgeGridClaim adds the top spacing it needs
    // sitting under a grid tile's title instead of as a row's trailing
    // element.
    claimButton: {
      minWidth: 72,
      height: 32,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeGridClaim: {
      marginTop: 2,
    },
    claimButtonDisabled: {
      opacity: 0.6,
    },
    claimButtonText: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.xs,
      color: colors.ink,
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
