import { View, Text, StyleSheet } from 'react-native';
import { colors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';

const BAR_MAX_HEIGHT = 90;
const MIN_BAR_HEIGHT = 3;

function formatAmount(n) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export default function DayOfWeekChart({ data }) {
  const maxValue = Math.max(...data.map((d) => d.amount), 1);
  const peak = data.reduce((max, d) => (d.amount > max.amount ? d : max), data[0]);
  const hasData = peak.amount > 0;

  return (
    <View>
      <Text style={styles.title}>Spending by Day</Text>
      <View style={styles.chartArea}>
        {data.map((d) => {
          const height = d.amount > 0 ? Math.max((d.amount / maxValue) * BAR_MAX_HEIGHT, MIN_BAR_HEIGHT) : 0;
          const isPeak = hasData && d.day === peak.day;
          return (
            <View key={d.day} style={styles.column}>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height }, isPeak && styles.barPeak]} />
              </View>
              <Text style={[styles.dayLabel, isPeak && styles.dayLabelPeak]}>{d.day[0]}</Text>
            </View>
          );
        })}
      </View>
      {hasData && (
        <Text style={styles.peakText}>
          Most spending: <Text style={styles.peakValue}>{peak.day}</Text> · {formatAmount(peak.amount)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  dayLabelPeak: {
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
