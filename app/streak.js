import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Trophy, Unlink, Flame } from 'lucide-react-native';
import { Pressable } from 'react-native';
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
import StreakFlameIcon from '../components/StreakFlameIcon';
import { StreakFlame } from '../components/StreakDays';
import useStreak from '../hooks/useStreak';
import { streakHeadline } from '../lib/koban';
import { milestoneRoad } from '../lib/rewards';
import { getTheme } from '../lib/cardThemes';
import { fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

const BADGE_SIZE = 92;
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// 21-achievement-rewards-and-milestone-road.md Phase 1 — composes one road
// row's reward text from whatever milestoneRoad() reports for that day
// (coins/freezes lump, a theme grant, a bonus spin) into a single short
// subtitle line, matching this screen's existing one-line-per-row grammar.
function roadRewardText(entry) {
  const parts = [];
  if (entry.coins > 0) parts.push(`${entry.coins.toLocaleString('en-IN')} coins`);
  if (entry.freezes > 0) parts.push(`${entry.freezes} freeze${entry.freezes === 1 ? '' : 's'}`);
  let text = parts.join(' · ') || 'Bonus reward';
  if (entry.themeId) text += ` · + ${getTheme(entry.themeId).name}`;
  if (entry.hasWheel) text += ' · + bonus spin';
  return text;
}

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
        {/* Number and label left, flame right — the reference's layout. The
            count led with the flame before, which buried the one number the
            screen exists to show. */}
        <Card style={styles.hero}>
          <View style={styles.heroText}>
            <Text style={[styles.count, !lit && styles.countEmpty]}>{current}</Text>
            {/* "day streak" regardless of count, as in the reference — "days
                streak" is not English, and "1 day streak" reads fine. */}
            <Text style={[styles.caption, !lit && styles.captionEmpty]}>day streak!</Text>
          </View>
          <StreakFlameIcon size={BADGE_SIZE} lit={lit} />
        </Card>

        <Text style={styles.headline}>
          {streakHeadline({ current, loggedToday, isNewStreak })}
        </Text>

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

        {/* 21-achievement-rewards-and-milestone-road.md Phase 1 — a plain row
            list, deliberately: the pure milestoneRoad() data is what needs to
            be solid this phase, not a path/line graphic (deferred). Mirrors
            app/trophies.js's Rank ladder row grammar (icon left, title+sub
            stacked, trailing state) so the three states (earned/current/
            locked) read the same way that screen's own three-state rows do. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Milestone Road</Text>
          <Card style={styles.listCard}>
            {road.map((entry, idx) => (
              <View key={entry.day} style={[styles.row, idx < road.length - 1 && styles.rowBorder]}>
                <IconTile tone={entry.state === 'locked' ? 'neutral' : 'streak'} size={44} radius={radii.iconTile}>
                  <Flame
                    size={20}
                    color={entry.state === 'locked' ? colors.mutedLight : colors.streakDeep}
                    strokeWidth={2}
                  />
                </IconTile>
                <View style={styles.rowMid}>
                  <Text style={[styles.rowTitle, entry.state === 'locked' && styles.rowTitleLocked]}>
                    Day {entry.day}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={2}>
                    {roadRewardText(entry)}
                  </Text>
                </View>
                {entry.state === 'earned' ? (
                  <Text style={[styles.rowEarned, { color: colors.streakDeep }]}>Earned</Text>
                ) : entry.state === 'current' ? (
                  <Text style={[styles.rowEarned, { color: colors.streak }]}>{entry.day - current} to go</Text>
                ) : null}
              </View>
            ))}
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
        </Card>

        <Text style={styles.footnote}>
          A day counts when you log a transaction. Miss a day and the streak resets.
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
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
  },
  heroText: {
    flex: 1,
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
  // Milestone Road (21-achievement-rewards-and-milestone-road.md Phase 1) —
  // same row grammar as app/trophies.js's trophy/rank rows (icon left,
  // title+subtitle stacked, trailing state right), reused verbatim here.
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  listCard: {
    padding: 0,
    paddingHorizontal: spacing.lg,
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
  rowEarned: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
    letterSpacing: -0.1,
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
