import { useMemo, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Trophy, Unlink, Star, Snowflake, Gift } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import CardThemeSurface from '../components/CardThemeSurface';
import {
  parseISO,
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isAfter,
} from 'date-fns';
import Card from '../components/Card';
import IconTile from '../components/IconTile';
import Button from '../components/Button';
import { StreakFlame } from '../components/StreakDays';
import useStreak from '../hooks/useStreak';
import useFreezeRecovery from '../hooks/useFreezeRecovery';
import { streakHeadline } from '../lib/koban';
import { milestoneRoad } from '../lib/rewards';
import { STREAK_BADGE_ART, STREAK_BADGE_ART_LOCKED } from '../lib/trophies';
import { getTheme } from '../lib/cardThemes';

const KOBAN_STREAK = require('../assets/mascot/streak.png');
const KOBAN_STREAK_LOCKED = require('../assets/general/streak-locked.png');
const KOBAN_COIN = require('../assets/general/coin.png');
const KOBAN_STREAK_FLAME = require('../assets/general/streak.png');
import { colors as staticColors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

// Same fill-ratio correction as StreakDays.js/StreakFlameIcon.js for this
// same flame asset.
const HERO_FLAME_FILL_RATIO = 0.825;

// Hero mascot geometry — the cat is a POSTER on the card's right edge: large,
// anchored to the top, and deliberately CROPPED by the card's bottom edge
// (`hero` sets `overflow: 'hidden'`) so only its top half shows, exactly like
// a poster whose bottom runs off the frame. Everything below is derived from
// KOBAN_STREAK's own alpha-bbox — measured, not eyeballed: within its square
// canvas the art occupies 21.3%→84.7% vertically and 22.1%→78.5%
// horizontally, so a frame offset has to account for that transparent margin
// or the visible cat lands nowhere near where the numbers say.
const HERO_CARD_MIN_HEIGHT = 132;
const HERO_CAT_FRAME = 276;
const HERO_CAT_CONTENT_TOP = 0.213;
const HERO_CAT_CONTENT_RIGHT = 0.785;
// Start the visible art ~6px below the card's top edge; whatever falls past
// the card's bottom (the cat's legs + the lower flame) gets cropped away.
const HERO_CAT_TOP = 6 - HERO_CAT_CONTENT_TOP * HERO_CAT_FRAME;
// Land the flame's right tip ~14px inside the card's right edge.
const HERO_CAT_RIGHT = 14 - (1 - HERO_CAT_CONTENT_RIGHT) * HERO_CAT_FRAME;
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// The streak's own screen — the destination behind Home's header flame.
//
// Everything the old Home card carried lives here now (the count, the headline,
// the day-by-day history), plus the things a card had no room for: longest
// streak, and a real month calendar. A header chip with nowhere to go would be
// decoration; this is what makes it a door.
export default function StreakScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { current, longest, breaks, loggedToday, isNewStreak, history, loading } = useStreak();
  // Same mechanic FreezePrompt's once-a-day auto-popup uses, exposed here as
  // a persistent action — a user who dismissed today's popup with "Start
  // fresh" (which commits nothing; see that component) can still come back
  // and use a freeze later, as long as the gap it would cover still exists.
  const { missedDates, freezes, coverCount, isPartial, canUse: canUseFreeze, using: usingFreeze, useFreeze } = useFreezeRecovery();
  // Streak vs Milestones — two tabs, not one long scroll. The streak calendar
  // is getting its own dedicated space so the planned calendar skins have room
  // to live (they'd have nowhere to go crammed below the milestone road), and
  // "what's next" (the road) reads as its own distinct view.
  const [tab, setTab] = useState('streak');
  // Reward detail sheet — tapping any milestone badge opens it with that day's
  // coins/XP/freezes shown as icons (the celebration screen's own reward
  // grammar) plus a real CardThemeSurface preview when the day grants a theme,
  // instead of the cramped text line the grid used to carry under each badge.
  const insets = useSafeAreaInsets();
  const rewardSheetRef = useRef(null);
  const [rewardEntry, setRewardEntry] = useState(null);

  const openReward = useCallback((entry) => {
    setRewardEntry(entry);
    rewardSheetRef.current?.present();
  }, []);

  const renderSheetBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    []
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.ink} />
        </View>
      </SafeAreaView>
    );
  }

  const lit = current > 0;
  const road = milestoneRoad(current);

  // history is a flat list of { date: 'yyyy-MM-dd', logged, covered, type }
  // for the last 42 days (18-gamification-ritual-and-ledger.md Phase 3 added
  // covered/type — a declared no-spend day counts for the streak but must
  // render distinctly, never as a fake logged flame). Indexed by date so the
  // calendar can ask about a given day directly — and so a day *outside* that
  // window is `undefined` rather than a real type, which is the difference
  // between "not logged" and "we don't know", and is rendered as such.
  const typeByDate = new Map(history.map((d) => [d.date, d.type]));

  const today = new Date();
  const monthStart = startOfMonth(today);
  const gridDays = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(today), { weekStartsOn: 1 }),
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.headerTitle}>Streak</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* A real segmented control, same treatment as Analytics'
            Month/Custom toggle (AnalyticsFilterBar) — a full-width track with
            the active tab as a filled ink pill, not standalone filter chips
            (which read as "filters", not "tabs"). */}
        <View style={styles.segmentWrap}>
          <Pressable
            style={[styles.segment, tab === 'streak' && styles.segmentActive]}
            onPress={() => setTab('streak')}
          >
            <Text style={[styles.segmentText, tab === 'streak' && styles.segmentTextActive]}>Streak</Text>
          </Pressable>
          <Pressable
            style={[styles.segment, tab === 'milestones' && styles.segmentActive]}
            onPress={() => setTab('milestones')}
          >
            <Text style={[styles.segmentText, tab === 'milestones' && styles.segmentTextActive]}>Milestones</Text>
          </Pressable>
        </View>

        {tab === 'streak' ? (
          <>
            {/* Number and label left (flame icon beside the count, not
                leading it — burying the one number the screen exists to show
                was the earlier mistake). The cat mascot on the right is now a
                large top-anchored POSTER on the card's right edge, cropped by
                the card's own bottom edge so only its top half shows — per
                the reference screenshot. Not a small contained badge. */}
            <Card style={styles.hero}>
              <View style={styles.heroText}>
                <View style={styles.heroCountRow}>
                  <Image source={KOBAN_STREAK_FLAME} style={styles.heroFlameIcon} resizeMode="contain" />
                  <Text style={[styles.count, !lit && styles.countEmpty]}>{current}</Text>
                </View>
                {/* "day streak" regardless of count, as in the reference — "days
                    streak" is not English, and "1 day streak" reads fine. */}
                <Text style={[styles.caption, !lit && styles.captionEmpty]}>day streak!</Text>
              </View>
              <Image source={KOBAN_STREAK} style={styles.heroCatPoster} resizeMode="contain" />
            </Card>

            <Text style={styles.headline}>
              {streakHeadline({ current, loggedToday, isNewStreak })}
            </Text>

            {/* Persistent freeze-recovery action (only rendered when there's an
                actual gap to cover AND at least one freeze to spend — same gate
                FreezePrompt's own popup uses). This is the only OTHER place a
                freeze can be spent; previously the once-a-day modal was the
                sole entry point. */}
            {canUseFreeze && (
              <Card style={styles.freezeCard}>
                <View style={styles.freezeRow}>
                  <View style={styles.freezeIcon}>
                    <Snowflake size={18} color={colors.iceBlue} strokeWidth={2.2} />
                  </View>
                  <View style={styles.freezeText}>
                    <Text style={styles.freezeTitle}>
                      You missed {missedDates.length} day{missedDates.length === 1 ? '' : 's'}
                    </Text>
                    <Text style={styles.freezeBody}>
                      {isPartial
                        ? `${freezes} freeze${freezes === 1 ? '' : 's'} covers ${coverCount} of ${missedDates.length}.`
                        : `Use ${coverCount} freeze${coverCount === 1 ? '' : 's'} to keep it going.`}
                    </Text>
                  </View>
                </View>
                <Button
                  title={`Use ${coverCount} freeze${coverCount === 1 ? '' : 's'}`}
                  onPress={useFreeze}
                  loading={usingFreeze}
                  style={styles.freezeButton}
                />
              </Card>
            )}

            {/* Longest and Breaks — NOT "Current", which is already the enormous
                number at the top of this screen. Breaks is the gaps between streaks:
                how many times you've let one go. One missed week is one break, not
                seven. */}
            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <IconTile tone="streak" size={38} radius={12}>
                  <Trophy size={18} color={colors.streakDeep} strokeWidth={2.2} />
                </IconTile>
                <View>
                  <Text style={styles.statValue}>{longest}</Text>
                  <Text style={styles.statLabel}>Longest</Text>
                </View>
              </Card>
              <Card style={styles.statCard}>
                <IconTile tone="neutral" size={38} radius={12}>
                  <Unlink size={18} color={colors.muted} strokeWidth={2.2} />
                </IconTile>
                <View>
                  <Text style={styles.statValue}>{breaks}</Text>
                  <Text style={styles.statLabel}>Breaks</Text>
                </View>
              </Card>
            </View>

            {/* The calendar lives here, in the streak tab's own space — this is
                where the planned calendar skins will hang. */}
            <Card style={styles.calendarCard}>
              <Text style={styles.monthLabel}>{format(today, 'MMMM yyyy')}</Text>

              <View style={styles.weekdayRow}>
                {WEEKDAYS.map((d, i) => (
                  <Text key={i} style={styles.weekday}>
                    {d}
                  </Text>
                ))}
              </View>

              <View style={styles.grid}>
                {gridDays.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const inMonth = isSameMonth(day, today);
                  const future = isAfter(day, today);
                  const type = typeByDate.get(key);

                  return (
                    <View key={key} style={styles.gridCell}>
                      <StreakFlame type={type} size={34} dimmed={!inMonth || future} />
                      <Text
                        style={[
                          styles.dayNumber,
                          isToday(day) && styles.dayNumberToday,
                          (!inMonth || future) && styles.dayNumberDim,
                        ]}
                      >
                        {format(day, 'd')}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Card>

            <Text style={styles.footnote}>
              A day counts when you log a transaction. Miss a day and the streak resets.
            </Text>
          </>
        ) : (
          /* Milestone badge wall — mirrors app/trophies.js's trophy-case grid
             (3 per row, illustrated badge as the main visual, color art when
             reached / pre-baked grayscale when not) rather than the old
             flame-icon row list. These are the SAME STREAK_BADGE_ART PNGs the
             Trophy Room's Streak Keeper group renders, so the two surfaces
             agree. Unlike a trophy tile (which carries a Claim button), a
             milestone road is purely informational, so each badge keeps its
             day + reward as sub-lines. STREAK_BADGE_ART covers every MILESTONES
             day; the IconTile/Flame fallback only fires if a future day lacks
             art (same graceful-degrade pattern trophies uses). */
          <>
            <Text style={styles.milestoneHint}>Tap a badge to see its reward</Text>
            <View style={styles.badgeGrid}>
              {road.map((entry) => {
                const reached = entry.state === 'earned';
                const art = reached ? STREAK_BADGE_ART[entry.day] : STREAK_BADGE_ART_LOCKED[entry.day];
                return (
                  <Pressable
                    key={entry.day}
                    style={({ pressed }) => [styles.badgeGridItem, pressed && styles.badgeGridItemPressed]}
                    onPress={() => openReward(entry)}
                  >
                    {art ? (
                      <Image source={art} style={styles.badgeGridImage} resizeMode="contain" />
                    ) : reached ? (
                      // A reached-but-no-specific-art tier (shouldn't normally
                      // happen — STREAK_BADGE_ART covers every MILESTONES day —
                      // but future-proofs a new milestone added without its
                      // own badge yet) falls to the illustrated streak mascot
                      // rather than a generic glyph, same "art if it exists"
                      // rule as everywhere else this mascot fills a fallback.
                      <Image source={KOBAN_STREAK} style={styles.badgeGridImage} resizeMode="contain" />
                    ) : (
                      // Not-yet-reached tier — the pre-baked grayscale twin of
                      // the same illustrated flame, matching the "reached"
                      // fallback right above it, and the same earned-color/
                      // locked-grayscale convention STREAK_BADGE_ART/
                      // STREAK_BADGE_ART_LOCKED already use.
                      <Image source={KOBAN_STREAK_LOCKED} style={styles.badgeGridImage} resizeMode="contain" />
                    )}
                    <Text style={styles.badgeGridTitle} numberOfLines={1}>
                      Day {entry.day}
                    </Text>
                    {/* Completed milestones keep the "Earned" label; the rest
                        show neutral current/target progress, same grammar as the
                        Trophy Room's tiles. */}
                    {entry.state === 'earned' ? (
                      <Text style={[styles.badgeGridSub, { color: colors.streakDeep }]}>Earned</Text>
                    ) : (
                      <Text style={styles.badgeGridSub}>
                        {Math.min(current, entry.day).toLocaleString('en-IN')}/{entry.day.toLocaleString('en-IN')}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* Reward detail sheet — dark like the celebration screen, reusing its
          coin/XP/freeze icon grammar plus a real CardThemeSurface card preview
          (the same one the Shop and spin-wheel reveal use) when the milestone
          grants a theme. Dynamic-sized: content is short and has no
          pinned/scroll conflict, so it sizes to its own height cleanly. */}
      <BottomSheetModal
        ref={rewardSheetRef}
        enableDynamicSizing
        backdropComponent={renderSheetBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetView style={[styles.sheetContent, { paddingBottom: insets.bottom + spacing.xl }]}>
          {rewardEntry && (
            <>
              <Image
                source={
                  rewardEntry.state === 'earned'
                    ? STREAK_BADGE_ART[rewardEntry.day]
                    : STREAK_BADGE_ART_LOCKED[rewardEntry.day]
                }
                style={styles.sheetBadge}
                resizeMode="contain"
              />
              <Text style={styles.sheetTitle}>Day {rewardEntry.day}</Text>
              <Text style={styles.sheetSub}>
                {rewardEntry.state === 'earned' ? 'You earned' : 'Reach this streak to earn'}
              </Text>

              <View style={styles.sheetRewardRow}>
                {rewardEntry.coins > 0 && (
                  <View style={styles.sheetRewardEntry}>
                    <Image source={KOBAN_COIN} style={styles.sheetCoinIcon} resizeMode="contain" />
                    <Text style={styles.sheetRewardAmount}>+{rewardEntry.coins.toLocaleString('en-IN')}</Text>
                    <Text style={styles.sheetRewardUnit}>coins</Text>
                  </View>
                )}
                {rewardEntry.xp > 0 && (
                  <View style={styles.sheetRewardEntry}>
                    <Star size={22} color={staticColors.brand} fill={staticColors.brand} strokeWidth={1.5} />
                    <Text style={styles.sheetRewardAmount}>+{rewardEntry.xp.toLocaleString('en-IN')}</Text>
                    <Text style={styles.sheetRewardUnit}>XP</Text>
                  </View>
                )}
                {rewardEntry.freezes > 0 && (
                  <View style={styles.sheetRewardEntry}>
                    <Snowflake size={22} color={staticColors.iceBlue} fill={staticColors.iceBlue} strokeWidth={2.2} />
                    <Text style={styles.sheetRewardAmount}>+{rewardEntry.freezes}</Text>
                    <Text style={styles.sheetRewardUnit}>freeze{rewardEntry.freezes === 1 ? '' : 's'}</Text>
                  </View>
                )}
              </View>

              {rewardEntry.themeId && (
                <View style={styles.sheetThemeWrap}>
                  <Text style={styles.sheetThemeLabel}>Card theme</Text>
                  <CardThemeSurface theme={getTheme(rewardEntry.themeId)} style={styles.sheetThemeCard}>
                    <View style={styles.sheetThemeContent}>
                      <Text style={[styles.sheetThemeName, { color: getTheme(rewardEntry.themeId).textColor }]}>
                        {getTheme(rewardEntry.themeId).name}
                      </Text>
                    </View>
                  </CardThemeSurface>
                </View>
              )}

              {rewardEntry.hasWheel && (
                <View style={styles.sheetSpinRow}>
                  <Gift size={16} color={staticColors.brand} strokeWidth={2.2} />
                  <Text style={styles.sheetSpinText}>Includes a bonus spin</Text>
                </View>
              )}
            </>
          )}
        </BottomSheetView>
      </BottomSheetModal>
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
  // Segmented control — same treatment as AnalyticsFilterBar's Month/Custom
  // toggle (full-width chipBg track, active segment a filled ink pill), so it
  // reads as tabs rather than filter chips.
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: colors.chipBg,
    borderRadius: 14,
    padding: 4,
    marginBottom: spacing.lg,
    width: '100%',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
    borderRadius: 11,
  },
  segmentActive: {
    backgroundColor: colors.ink,
  },
  segmentText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: colors.muted,
  },
  segmentTextActive: {
    fontFamily: fontFamily.extrabold,
    color: colors.surface,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 60,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
    minHeight: HERO_CARD_MIN_HEIGHT,
    // The whole point of the poster treatment — crops the oversized mascot at
    // the card's own rounded edges so only its top half shows.
    overflow: 'hidden',
  },
  heroText: {
    flex: 1,
    // The mascot is absolutely positioned (out of flow), so the text needs its
    // own right inset or the count/caption would run underneath it.
    paddingRight: HERO_CAT_FRAME * (HERO_CAT_CONTENT_RIGHT - 0.35),
  },
  heroCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroFlameIcon: {
    width: 40 / HERO_FLAME_FILL_RATIO,
    height: 40 / HERO_FLAME_FILL_RATIO,
  },
  // See the HERO_CAT_* geometry block at the top of this file — top-anchored
  // and oversized on purpose so the card's bottom edge slices through the cat,
  // leaving only its top half on the card like a cropped poster.
  heroCatPoster: {
    position: 'absolute',
    top: HERO_CAT_TOP,
    right: HERO_CAT_RIGHT,
    width: HERO_CAT_FRAME,
    height: HERO_CAT_FRAME,
  },
  count: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.amountLg,
    letterSpacing: -1.2,
    // The deep orange reads on white, which the brand lime never did — the
    // count no longer has to compromise on a colour it isn't.
    color: colors.streakDeep,
  },
  countEmpty: {
    color: colors.mutedLight,
  },
  caption: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    color: colors.streakDeep,
    marginTop: -2,
  },
  captionEmpty: {
    color: colors.mutedMid,
  },
  headline: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.heading,
    letterSpacing: -0.3,
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  freezeCard: {
    marginBottom: spacing.lg,
  },
  freezeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  freezeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.iceBlueBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freezeText: {
    flex: 1,
  },
  freezeTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  freezeBody: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginTop: 1,
  },
  freezeButton: {
    height: 48,
    backgroundColor: colors.iceBlue,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  statValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.display,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  statLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginTop: 2,
  },
  // Milestone badge grid — the same trophy-case grid grammar as
  // app/trophies.js (3 per row, illustrated badge as the main visual, no Card
  // wrapper), so the Milestones tab and the Trophy Room's Streak Keeper group
  // read as one system. 12 milestones fill exactly four rows of three.
  // Earned/locked is conveyed by which art (color vs pre-baked grayscale) is
  // passed in — no tint/opacity override here, same as trophies.
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
  // Neutral progress line, same as the Trophy Room's badgeGridSub — no colored
  // state, just current/target in muted grey.
  badgeGridSub: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.mutedLight,
    marginTop: 2,
    textAlign: 'center',
  },
  badgeGridItemPressed: {
    opacity: 0.6,
  },
  milestoneHint: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  // Reward detail sheet — dark (staticColors.ink) so the coin/XP/freeze icons
  // and the card preview read the same way they do on the celebration screen.
  sheetBg: {
    backgroundColor: staticColors.ink,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
  },
  sheetHandle: {
    backgroundColor: '#3a3a3a',
    width: 44,
  },
  sheetContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  sheetBadge: {
    width: 96,
    height: 96,
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.display,
    color: staticColors.surface,
  },
  sheetSub: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: staticColors.mutedMid,
    marginTop: 2,
    marginBottom: spacing.xl,
  },
  sheetRewardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  sheetRewardEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // 22 / 0.693 (the illustrated coin's measured ~69.3% canvas fill) — matches
  // the 22px Star/Snowflake icons in the sibling reward entries beside it.
  sheetCoinIcon: {
    width: 32,
    height: 32,
  },
  // includeFontPadding/textAlignVertical — Android's default extra font
  // padding otherwise makes this sit low against the coin/Star/Snowflake
  // icon beside it despite `alignItems: 'center'` on sheetRewardEntry.
  sheetRewardAmount: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    color: staticColors.surface,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  sheetRewardUnit: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: staticColors.mutedMid,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  sheetThemeWrap: {
    width: '100%',
    marginTop: spacing.xl,
  },
  sheetThemeLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: staticColors.mutedMid,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  sheetThemeCard: {
    width: '100%',
    height: 140,
    borderRadius: radii.card,
  },
  sheetThemeContent: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'flex-end',
  },
  sheetThemeName: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
  },
  sheetSpinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.lg,
  },
  sheetSpinText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: staticColors.surface,
  },
  calendarCard: {
    paddingVertical: spacing.lg,
  },
  monthLabel: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: colors.mutedLight,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 5,
    gap: 2,
  },
  dayNumber: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.mutedDarker,
  },
  dayNumberToday: {
    fontFamily: fontFamily.extrabold,
    color: colors.ink,
  },
  dayNumberDim: {
    color: colors.mutedLight,
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
