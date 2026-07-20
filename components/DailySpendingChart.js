import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { fontFamily, fontSize, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { formatMoney } from '../lib/currency';

const BAR_MAX_HEIGHT = 90;
const MIN_BAR_HEIGHT = 3;

// Per-date daily spending bars (see lib/analytics.js's computeDailySpending) —
// a trailing 7-day window with the current day at the right edge. Was a
// weekday aggregation (all Mondays summed etc.) with ambiguous single-letter
// labels; now each bar is one real calendar date, labelled by day-of-month.
export default function DailySpendingChart({ data, currency = 'INR' }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const maxValue = Math.max(...data.map((d) => d.amount), 1);
  // Reference-equality against the actual bucket object (not a day string) so
  // ties resolve to the first peak deterministically, same as before.
  const peak = data.reduce((max, d) => (d.amount > max.amount ? d : max), data[0]);
  const hasData = peak && peak.amount > 0;

  return (
    <View>
      <Text style={styles.title}>Spending by Day</Text>
      <View style={styles.chartArea}>
        {data.map((d) => {
          const height = d.amount > 0 ? Math.max((d.amount / maxValue) * BAR_MAX_HEIGHT, MIN_BAR_HEIGHT) : 0;
          const isPeak = hasData && d === peak;
          return (
            <View key={format(d.date, 'yyyy-MM-dd')} style={styles.column}>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height }, isPeak && styles.barPeak]} />
              </View>
              {/* Two distinct signals that don't collide: the PEAK is the dark
                  BAR, TODAY (the last bar) is the dark LABEL — so both read at
                  once even on the day they happen to coincide. */}
              <Text style={[styles.dayLabel, d.isLast && styles.dayLabelToday]}>{format(d.date, 'd')}</Text>
            </View>
          );
        })}
      </View>
      {hasData && (
        <Text style={styles.peakText}>
          Most spending: <Text style={styles.peakValue}>{format(peak.date, 'd MMM')}</Text> ·{' '}
          {formatMoney(peak.amount, currency)}
        </Text>
      )}
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    title: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      marginBottom: spacing.lg,
    },
    chartArea: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    column: {
      alignItems: 'center',
      flex: 1,
    },
    barTrack: {
      height: BAR_MAX_HEIGHT + spacing.sm,
      width: '100%',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    bar: {
      width: 18,
      backgroundColor: colors.chipBg,
      borderTopLeftRadius: 5,
      borderTopRightRadius: 5,
    },
    barPeak: {
      backgroundColor: colors.ink,
    },
    dayLabel: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xs,
      color: colors.mutedMid,
      marginTop: spacing.sm,
    },
    dayLabelToday: {
      fontFamily: fontFamily.extrabold,
      color: colors.ink,
    },
    peakText: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      marginTop: spacing.lg,
      textAlign: 'center',
    },
    peakValue: {
      fontFamily: fontFamily.extrabold,
      color: colors.ink,
    },
  });
}
