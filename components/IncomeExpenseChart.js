import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { colors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';

const BAR_MAX_HEIGHT = 100;
const BAR_WIDTH = 17;
const BAR_GAP = 3;
const MIN_BAR_HEIGHT = 3;

function formatAmount(n) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export default function IncomeExpenseChart({ data }) {
  const [selectedIndex, setSelectedIndex] = useState(null);

  const maxValue = Math.max(...data.map((d) => Math.max(d.income, d.expense)), 1);
  const weekIncome = data.reduce((sum, d) => sum + d.income, 0);
  const weekExpense = data.reduce((sum, d) => sum + d.expense, 0);
  const selected = selectedIndex !== null ? data[selectedIndex] : null;

  return (
    <View>
      <View style={styles.summaryBlock}>
        <Text style={styles.summaryLabel} numberOfLines={1}>
          {selected ? format(selected.date, 'EEEE, d MMM') : 'This Week'}
        </Text>
        <View style={styles.summaryValues}>
          <View style={styles.summaryItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.income }]} />
            <Text style={[styles.summaryValue, { color: colors.income }]}>
              {formatAmount(selected ? selected.income : weekIncome)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.dangerStrong }]} />
            <Text style={[styles.summaryValue, { color: colors.dangerStrong }]}>
              {formatAmount(selected ? selected.expense : weekExpense)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.chartArea}>
        {data.map((day, index) => {
          const isSelected = index === selectedIndex;
          const incomeHeight = day.income > 0 ? Math.max((day.income / maxValue) * BAR_MAX_HEIGHT, MIN_BAR_HEIGHT) : 0;
          const expenseHeight = day.expense > 0 ? Math.max((day.expense / maxValue) * BAR_MAX_HEIGHT, MIN_BAR_HEIGHT) : 0;
          const key = format(day.date, 'yyyy-MM-dd');

          return (
            <Pressable
              key={key}
              style={styles.dayColumn}
              onPress={() => setSelectedIndex(isSelected ? null : index)}
            >
              <View style={[styles.barTrack, isSelected && styles.barTrackSelected]}>
                <View style={styles.barPair}>
                  <View style={[styles.incomeBar, { height: incomeHeight || 0 }]} />
                  <View style={[styles.expenseBar, { height: expenseHeight || 0 }]} />
                </View>
              </View>
              <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected]}>{format(day.date, 'EEE')}</Text>
            </Pressable>
          );
        })}
      </View>
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
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  dayColumn: {
    alignItems: 'center',
    flex: 1,
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
  dayLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.mutedMid,
    marginTop: spacing.sm,
  },
  dayLabelSelected: {
    fontFamily: fontFamily.extrabold,
    color: colors.ink,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
  },
});
