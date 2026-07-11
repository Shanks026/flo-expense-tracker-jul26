import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { format } from 'date-fns';
import { colors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';

const BAR_MAX_HEIGHT = 100;
const BAR_WIDTH = 14;
const BAR_GAP = 3;
const COLUMN_WIDTH = 34;
const MIN_BAR_HEIGHT = 3;

function formatAmount(n) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function columnLabel(bucketStart, granularity) {
  return granularity === 'day' ? format(bucketStart, 'EEEEE') : format(bucketStart, 'd MMM');
}

function summaryLabelFor(bucket, granularity) {
  if (!bucket) return 'Selected Period';
  return granularity === 'day' ? format(bucket.bucketStart, 'EEEE, d MMM') : `Week of ${format(bucket.bucketStart, 'd MMM')}`;
}

export default function TrendChart({ data, granularity = 'day' }) {
  const [selectedIndex, setSelectedIndex] = useState(null);

  const maxValue = Math.max(...data.map((d) => Math.max(d.income, d.expense)), 1);
  const totalIncome = data.reduce((sum, d) => sum + d.income, 0);
  const totalExpense = data.reduce((sum, d) => sum + d.expense, 0);
  const selected = selectedIndex !== null ? data[selectedIndex] : null;

  return (
    <View>
      <View style={styles.summaryBlock}>
        <Text style={styles.summaryLabel} numberOfLines={1}>
          {summaryLabelFor(selected, granularity)}
        </Text>
        <View style={styles.summaryValues}>
          <View style={styles.summaryItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.income }]} />
            <Text style={[styles.summaryValue, { color: colors.income }]}>
              {formatAmount(selected ? selected.income : totalIncome)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.dangerStrong }]} />
            <Text style={[styles.summaryValue, { color: colors.dangerStrong }]}>
              {formatAmount(selected ? selected.expense : totalExpense)}
            </Text>
          </View>
        </View>
      </View>

      {data.length === 0 ? (
        <Text style={styles.emptyText}>No transactions in this period.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartArea}>
          {data.map((bucket, index) => {
            const isSelected = index === selectedIndex;
            const incomeHeight = bucket.income > 0 ? Math.max((bucket.income / maxValue) * BAR_MAX_HEIGHT, MIN_BAR_HEIGHT) : 0;
            const expenseHeight = bucket.expense > 0 ? Math.max((bucket.expense / maxValue) * BAR_MAX_HEIGHT, MIN_BAR_HEIGHT) : 0;
            const key = format(bucket.bucketStart, 'yyyy-MM-dd');

            return (
              <Pressable key={key} style={styles.column} onPress={() => setSelectedIndex(isSelected ? null : index)}>
                <View style={[styles.barTrack, isSelected && styles.barTrackSelected]}>
                  <View style={styles.barPair}>
                    <View style={[styles.incomeBar, { height: incomeHeight || 0 }]} />
                    <View style={[styles.expenseBar, { height: expenseHeight || 0 }]} />
                  </View>
                </View>
                <Text style={[styles.columnLabel, isSelected && styles.columnLabelSelected]} numberOfLines={1}>
                  {columnLabel(bucket.bucketStart, granularity)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summaryBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  summaryLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    flexShrink: 1,
  },
  summaryValues: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    letterSpacing: -0.2,
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  column: {
    width: COLUMN_WIDTH,
    alignItems: 'center',
  },
  barTrack: {
    height: BAR_MAX_HEIGHT + spacing.md * 2,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  barTrackSelected: {
    backgroundColor: colors.chipBg,
  },
  barPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: BAR_GAP,
  },
  incomeBar: {
    width: BAR_WIDTH,
    backgroundColor: colors.income,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  expenseBar: {
    width: BAR_WIDTH,
    backgroundColor: colors.dangerStrong,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  columnLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.mutedMid,
    marginTop: spacing.sm,
  },
  columnLabelSelected: {
    fontFamily: fontFamily.extrabold,
    color: colors.ink,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
  },
  emptyText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
