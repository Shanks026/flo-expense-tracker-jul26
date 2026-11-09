import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Snowflake, Flag, Flame } from 'lucide-react-native';
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

import { fontFamily, fontSize, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';


const HERO_CARD_MIN_HEIGHT = 132;
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
  const { current, loggedToday, isNewStreak, history, freezesHeld, loading } = useStreak();

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={[]}>
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
  const gridWeeks = [];
  for (let i = 0; i < gridDays.length; i += 7) gridWeeks.push(gridDays.slice(i, i + 7));

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* The count and its label (Koban deleted, spec 46). */}
        <Card style={styles.hero}>
          <View style={styles.heroText}>
            <View style={styles.heroCountRow}>
              <Flame size={36} color={lit ? colors.streak : colors.mutedLight} fill={lit ? colors.streak : 'transparent'} strokeWidth={2.2} />
              <Text style={[styles.count, !lit && styles.countEmpty]}>{current}</Text>
            </View>
            {/* "day streak" regardless of count: "days streak" is not English. */}
            <Text style={[styles.caption, !lit && styles.captionEmpty]}>day streak!</Text>
          </View>
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

          {/* One row per week, seven flex cells each. A wrapping grid of
              100/7 % cells rounded past the row's width on Android and
              wrapped at six, putting every date under the wrong weekday. */}
          {gridWeeks.map((week) => (
            <View key={format(week[0], 'yyyy-MM-dd')} style={styles.weekRow}>
              {week.map((day) => {
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
          ))}

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
  scroll: {
    // The native header sits above; this is the gap below it.
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: 60,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
    minHeight: HERO_CARD_MIN_HEIGHT,
  },
  heroText: {
    flex: 1,
  },
  heroCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
    flex: 1,
    textAlign: 'center',
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: colors.mutedLight,
  },
  weekRow: {
    flexDirection: 'row',
  },
  gridCell: {
    flex: 1,
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
