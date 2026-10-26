import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Snowflake, Flag } from 'lucide-react-native';
import {
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
import { StreakFlame } from '../components/StreakDays';
import useStreak from '../hooks/useStreak';
import { streakHeadline } from '../lib/koban';
import { MILESTONES, MAX_FREEZES } from '../lib/streak';

const KOBAN_STREAK = require('../assets/mascot/streak.png');
const KOBAN_STREAK_FLAME = require('../assets/general/streak.png');
import { fontFamily, fontSize, spacing } from '../theme/tokens';
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
// 34-streak-only.md cut it down to what the streak alone needs: the current
// count, the freezes held (earned and spent automatically, so there's nothing
// to press), the next milestone, and a month calendar that marks each covered
// day as logged, no-spend or frozen. The Milestones tab, its badge wall and
// reward sheet, and the manual "use a freeze" card went with the economy.
export default function StreakScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { current, loggedToday, isNewStreak, history, freezesHeld, loading } = useStreak();

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
  // null past the last milestone (365): there's nothing further to aim at.
  const nextMilestone = MILESTONES.find((d) => current < d) ?? null;
  const daysToGo = nextMilestone ? nextMilestone - current : 0;

  // history is a flat list of { date: 'yyyy-MM-dd', logged, covered, type }
  // for the last 42 days. Indexed by date so the calendar can ask about a
  // given day directly; a day outside that window is `undefined`, i.e.
  // "we don't know", not "not logged".
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
        {/* Count and label left; the cat on the right is a large top-anchored
            poster cropped by the card's bottom edge (see the HERO_CAT_*
            geometry above). */}
        <Card style={styles.hero}>
          <View style={styles.heroText}>
            <View style={styles.heroCountRow}>
              <Image source={KOBAN_STREAK_FLAME} style={styles.heroFlameIcon} resizeMode="contain" />
              <Text style={[styles.count, !lit && styles.countEmpty]}>{current}</Text>
            </View>
            {/* "day streak" regardless of count: "days streak" is not English. */}
            <Text style={[styles.caption, !lit && styles.captionEmpty]}>day streak!</Text>
          </View>
          <Image source={KOBAN_STREAK} style={styles.heroCatPoster} resizeMode="contain" />
        </Card>

        <Text style={styles.headline}>{streakHeadline({ current, loggedToday, isNewStreak })}</Text>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <IconTile tone="neutral" size={38} radius={12}>
              <Snowflake size={18} color={colors.iceBlue} strokeWidth={2.2} />
            </IconTile>
            <View>
              <Text style={styles.statValue}>
                {freezesHeld}/{MAX_FREEZES}
              </Text>
              <Text style={styles.statLabel}>Freezes</Text>
            </View>
          </Card>
          <Card style={styles.statCard}>
            <IconTile tone="streak" size={38} radius={12}>
              <Flag size={18} color={colors.streakDeep} strokeWidth={2.2} />
            </IconTile>
            <View>
              <Text style={styles.statValue}>{nextMilestone ?? '—'}</Text>
              <Text style={styles.statLabel}>Next milestone</Text>
              {nextMilestone && (
                <Text style={styles.statSub}>
                  {daysToGo} day{daysToGo === 1 ? '' : 's'} to go
                </Text>
              )}
            </View>
          </Card>
        </View>

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

          <View style={styles.legendRow}>
            {LEGEND.map(([type, label]) => (
              <View key={type} style={styles.legendItem}>
                <StreakFlame type={type} size={18} />
                <Text style={styles.legendText}>{label}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Text style={styles.footnote}>
          A day counts when you log something or mark it no-spend. Every 7 days in a row earns a freeze (you can hold{' '}
          {MAX_FREEZES}), and a freeze covers a missed day for you.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const LEGEND = [
  ['logged', 'Logged'],
  ['nospend', 'No spend'],
  ['frozen', 'Frozen'],
];

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
  statSub: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.mutedLight,
    marginTop: 1,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.mutedMid,
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
