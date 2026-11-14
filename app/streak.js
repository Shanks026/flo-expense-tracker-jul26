import { useMemo } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Flame } from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import ScreenHeader, { LargeTitle, useHeaderScroll } from '../components/ledger/ScreenHeader';
import SectionHeader from '../components/ledger/SectionHeader';
import StreakMark, { STREAK_MARK_LABELS } from '../components/ledger/StreakMark';
import useStreak from '../hooks/useStreak';
import { streakHeadline } from '../lib/koban';
import { MAX_FREEZES } from '../lib/streak';
import { streakCalendar, nextMilestone } from '../lib/streakCalendar';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, inter } from '../theme/ledger';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const LEGEND = ['logged', 'nospend', 'frozen'];
const MARK_SIZE = 32;

// The streak's own screen, behind Home's header flame (34-streak-only.md; on
// the ledger kit since spec 49, ticket 06): the count, two quiet stats (the
// freezes held, spent automatically, and the next milestone), and the
// month's calendar marking each covered day as logged, no-spend or frozen.
// No cards. lib/streakCalendar.js builds the weeks.
export default function Streak() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { scrollY, onScroll } = useHeaderScroll();
  const { current, loggedToday, isNewStreak, history, freezesHeld, loading } = useStreak();
  const today = new Date();
  const todayKey = format(today, 'yyyy-MM-dd');
  const weeks = useMemo(() => streakCalendar(history, new Date()), [history, todayKey]);

  // The flame burns only once today counts (as on Home's chip); a streak
  // still alive from yesterday shows its count in ink beside an unlit flame.
  const lit = current > 0 && loggedToday;
  const next = nextMilestone(current);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Streak" scrollY={scrollY} />
      <Animated.ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <LargeTitle title="Streak" scrollY={scrollY} />

        {loading ? (
          <>
            <View style={[styles.skeleton, { height: 96 }]} />
            <View style={[styles.skeleton, { height: 320, marginTop: ledgerSpace.section }]} />
          </>
        ) : (
          <>
            <View style={styles.hero}>
              <View style={styles.countRow}>
                <Flame size={30} color={lit ? c.streak : c.muted} fill={lit ? c.streak : 'transparent'} strokeWidth={1.75} />
                <Text style={[styles.count, current === 0 && { color: c.muted }]}>{current}</Text>
              </View>
              {/* "day streak" whatever the count: "days streak" isn't English. */}
              <Text style={styles.caption}>day streak</Text>
              <Text style={styles.headline}>{streakHeadline({ current, loggedToday, isNewStreak })}</Text>
            </View>

            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Freezes</Text>
                <Text style={styles.statValue}>
                  {freezesHeld} of {MAX_FREEZES}
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Next milestone</Text>
                {next ? (
                  <>
                    <Text style={styles.statValue}>{next.days}</Text>
                    <Text style={styles.statSub}>
                      {next.toGo} day{next.toGo === 1 ? '' : 's'} to go
                    </Text>
                  </>
                ) : (
                  <Text style={styles.statValue}>All milestones reached</Text>
                )}
              </View>
            </View>

            <SectionHeader title={format(today, 'MMMM yyyy')} style={styles.section} />
            <View style={styles.weekRow}>
              {WEEKDAYS.map((d, i) => (
                <Text key={i} style={styles.weekday}>
                  {d}
                </Text>
              ))}
            </View>
            {/* One row per week, seven flex cells each (lib/streakCalendar.js). */}
            {weeks.map((week) => (
              <View key={week[0].key} style={styles.weekRow}>
                {week.map((d) => (
                  <View key={d.key} style={styles.cell}>
                    <StreakMark type={d.mark} size={MARK_SIZE} dimmed={!d.inMonth || d.future} accessibilityLabel={dayLabel(d)} />
                    {/* Today's date on an ink pill, so it stands out even with no mark. */}
                    <View style={d.isToday && styles.todayPill}>
                      <Text style={[styles.dayNumber, (!d.inMonth || d.future) && styles.dim, d.isToday && styles.today]}>{d.day}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}

            <View style={styles.legend}>
              {LEGEND.map((type) => (
                <View key={type} style={styles.legendItem}>
                  <StreakMark type={type} size={14} />
                  <Text style={styles.legendText}>{STREAK_MARK_LABELS[type]}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.footnote}>
              A day counts when you log something or mark it no-spend. Every 7 days in a row earns a freeze (you can hold{' '}
              {MAX_FREEZES}), and a freeze covers a missed day for you.
            </Text>
          </>
        )}
      </Animated.ScrollView>
    </View>
  );
}

// What TalkBack says for a day: a mark when there is one; "Not logged" only
// for a past day of this month (a future day, or one outside the month,
// isn't known to be missed).
function dayLabel(d) {
  const date = format(parseISO(d.key), 'd MMMM');
  const prefix = d.isToday ? `Today, ${date}` : date;
  if (d.mark) return `${prefix}: ${STREAK_MARK_LABELS[d.mark]}`;
  if (d.future || !d.inMonth) return prefix;
  return `${prefix}: Not logged`;
}

function makeStyles(c) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.canvas,
    },
    flex: {
      flex: 1,
    },
    scroll: {
      paddingHorizontal: ledgerSpace.gutter,
      paddingBottom: ledgerSpace.section * 2,
    },
    hero: {
      marginTop: ledgerSpace.md,
    },
    countRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ledgerSpace.sm,
    },
    count: {
      ...ledgerType.display,
      fontVariant: ['tabular-nums'],
      color: c.ink,
    },
    caption: {
      ...ledgerType.caption,
      color: c.muted,
    },
    headline: {
      ...ledgerType.body,
      color: c.ink,
      marginTop: ledgerSpace.md,
    },
    stats: {
      flexDirection: 'row',
      gap: ledgerSpace.lg,
      marginTop: ledgerSpace.section,
    },
    stat: {
      flex: 1,
    },
    statLabel: {
      ...ledgerType.caption,
      color: c.muted,
      marginBottom: ledgerSpace.xs,
    },
    statValue: {
      ...ledgerType.rowTitle,
      fontFamily: inter.semibold,
      fontVariant: ['tabular-nums'],
      color: c.ink,
    },
    statSub: {
      ...ledgerType.caption,
      color: c.muted,
    },
    section: {
      marginTop: ledgerSpace.section,
      marginBottom: ledgerSpace.sm,
    },
    weekRow: {
      flexDirection: 'row',
      marginBottom: ledgerSpace.sm,
    },
    weekday: {
      flex: 1,
      ...ledgerType.caption,
      color: c.muted,
      textAlign: 'center',
    },
    cell: {
      flex: 1,
      alignItems: 'center',
      gap: ledgerSpace.xs,
    },
    dayNumber: {
      ...ledgerType.caption,
      color: c.muted,
      fontVariant: ['tabular-nums'],
    },
    dim: {
      opacity: 0.45,
    },
    todayPill: {
      paddingHorizontal: 6,
      borderRadius: ledgerRadius.full,
      backgroundColor: c.ink,
    },
    today: {
      fontFamily: inter.semibold,
      color: c.inkOnInk,
      opacity: 1,
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ledgerSpace.lg,
      marginTop: ledgerSpace.md,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ledgerSpace.xs,
    },
    legendText: {
      ...ledgerType.caption,
      color: c.muted,
    },
    footnote: {
      ...ledgerType.caption,
      color: c.muted,
      marginTop: ledgerSpace.lg,
    },
    skeleton: {
      borderRadius: ledgerRadius.input,
      backgroundColor: c.surfaceSunk,
      marginTop: ledgerSpace.md,
    },
  });
}
