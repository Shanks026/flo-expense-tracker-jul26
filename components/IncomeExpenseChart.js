import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { format } from 'date-fns';
import { colors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';

const BAR_MAX_HEIGHT = 110;
const MIN_BAR_HEIGHT = 4;
const COLUMN_WIDTH = 40;
// Beyond this many bars, a fixed-width row would squeeze each bar too thin to
// read — switch to a fixed-width horizontally-scrolling layout instead (used
// by Analytics' Month/Custom ranges, which can be day-bucketed across a full
// month or more; Home's bounded 7D/1M/3M presets never hit this).
const SCROLL_THRESHOLD = 10;

const RANGES = [
  { key: '7d', label: '7D' },
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
];

function formatAmount(n) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

// Two call sites, two header shapes:
// - Home (range + onRangeChange given): top-left shows the 7D/1M/3M tabs,
//   since the chart owns its own period selection.
// - Analytics (showPeriodLabel given instead): top-left shows the selected
//   bar's date (or a static periodLabel when nothing's selected), since
//   Analytics' period is already chosen elsewhere (AnalyticsFilterBar) — a
//   second set of tabs here would just duplicate/conflict with that.
export default function IncomeExpenseChart({
  data,
  range,
  onRangeChange,
  granularity = 'day',
  showPeriodLabel = false,
  periodLabel = 'Selected Period',
  emptyMessage,
  // Kept as a prop, not a hardcoded default, so Home and Analytics can differ
  // without touching each other: Home wants expense-first (a personal
  // *expense* tracker's glanceable summary), Analytics is a data-exploration
  // tool where showing both by default is still the right call. The default
  // here preserves Analytics' existing behavior unchanged.
  defaultVisible = { expense: true, income: true },
}) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [visible, setVisible] = useState(defaultVisible);

  const resolvedGranularity = range ? (range === '7d' ? 'day' : 'week') : granularity;
  const dayLabelFormat = resolvedGranularity === 'day' ? 'EEE' : 'd MMM';

  // Scale bars off only the visible series — with one series hidden, the
  // remaining one should fill the chart height on its own, not stay capped
  // by the hidden series' (now-invisible) values.
  const maxValue = Math.max(
    ...data.map((d) => {
      if (visible.expense && visible.income) return Math.max(d.income, d.expense);
      if (visible.expense) return d.expense;
      if (visible.income) return d.income;
      return 0;
    }),
    1
  );
  const totalExpense = data.reduce((sum, d) => sum + d.expense, 0);
  const totalIncome = data.reduce((sum, d) => sum + d.income, 0);

  function toggleVisible(key) {
    setVisible((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Never let both go dark — an empty chart isn't a useful state, so the
      // second-to-last active series can't be switched off.
      if (!next.expense && !next.income) return prev;
      return next;
    });
  }

  // Selection resets whenever the range changes underneath it (a stale index
  // into the old bucket count/shape would point at the wrong — or a
  // nonexistent — bucket).
  const selected = selectedIndex !== null ? data[selectedIndex] : null;
  const displayExpense = selected ? selected.expense : totalExpense;
  const displayIncome = selected ? selected.income : totalIncome;
  const selectedLabel = selected
    ? resolvedGranularity === 'day'
      ? format(selected.date, 'EEEE, d MMM')
      : `Week of ${format(selected.date, 'd MMM')}`
    : periodLabel;

  function handleRangeChange(key) {
    setSelectedIndex(null);
    onRangeChange(key);
  }

  const bars = data.map((bucket, index) => {
    const isSelected = index === selectedIndex;
    const expenseHeight =
      visible.expense && bucket.expense > 0 ? Math.max((bucket.expense / maxValue) * BAR_MAX_HEIGHT, MIN_BAR_HEIGHT) : 0;
    const incomeHeight =
      visible.income && bucket.income > 0 ? Math.max((bucket.income / maxValue) * BAR_MAX_HEIGHT, MIN_BAR_HEIGHT) : 0;
    const key = format(bucket.date, 'yyyy-MM-dd');

    // Both bars share the same baseline (bottom = 0). The smaller value is
    // always drawn last (on top), so it stays visible as a segment overlaid
    // on the bottom of the taller bar — otherwise, whichever is larger would
    // completely cover the shorter one at this shared x-position. This is
    // why the top/base assignment flips with whichever of income/expense
    // happens to be bigger that bucket.
    const incomeIsSmaller = bucket.income <= bucket.expense;
    const base = incomeIsSmaller
      ? { height: expenseHeight, color: colors.brand }
      : { height: incomeHeight, color: colors.incomeAccent };
    const top = incomeIsSmaller
      ? { height: incomeHeight, color: colors.incomeAccent }
      : { height: expenseHeight, color: colors.brand };

    return (
      <Pressable
        key={key}
        style={[styles.dayColumn, data.length > SCROLL_THRESHOLD && styles.dayColumnFixed, isSelected && styles.dayColumnSelected]}
        onPress={() => setSelectedIndex(isSelected ? null : index)}
      >
        <View style={styles.barTrack}>
          <View style={[styles.barLayer, { height: base.height, backgroundColor: base.color }]} />
          <View style={[styles.barLayer, { height: top.height, backgroundColor: top.color }]} />
        </View>
        <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected]} numberOfLines={1}>
          {format(bucket.date, dayLabelFormat)}
        </Text>
      </Pressable>
    );
  });

  return (
    <View>
      <View style={styles.headerRow}>
        {range && onRangeChange ? (
          <View style={styles.rangeTabs}>
            {RANGES.map((r) => {
              const active = r.key === range;
              return (
                <Pressable key={r.key} onPress={() => handleRangeChange(r.key)} hitSlop={8}>
                  <Text style={[styles.rangeTab, active && styles.rangeTabActive]}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : showPeriodLabel ? (
          <Text style={styles.periodLabelText} numberOfLines={1}>
            {selectedLabel}
          </Text>
        ) : (
          <View />
        )}
        <View style={styles.totalsRow}>
          <Pressable style={styles.totalItem} onPress={() => toggleVisible('expense')} hitSlop={6}>
            <View style={[styles.legendDot, { backgroundColor: visible.expense ? colors.brand : colors.mutedLight }]} />
            <Text style={[styles.totalValue, !visible.expense && styles.totalValueDimmed]}>{formatAmount(displayExpense)}</Text>
          </Pressable>
          <Pressable style={styles.totalItem} onPress={() => toggleVisible('income')} hitSlop={6}>
            <View style={[styles.legendDot, { backgroundColor: visible.income ? colors.incomeAccent : colors.mutedLight }]} />
            <Text style={[styles.totalValue, !visible.income && styles.totalValueDimmed]}>{formatAmount(displayIncome)}</Text>
          </Pressable>
        </View>
      </View>

      {data.length === 0 && emptyMessage ? (
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      ) : data.length > SCROLL_THRESHOLD ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartAreaScroll}>
          {bars}
        </ScrollView>
      ) : (
        <View style={styles.chartArea}>{bars}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  rangeTabs: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rangeTab: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: colors.mutedLight,
  },
  rangeTabActive: {
    fontFamily: fontFamily.extrabold,
    color: colors.ink,
  },
  periodLabelText: {
    flexShrink: 1,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
  },
  totalsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    flexShrink: 0,
  },
  totalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  totalValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  totalValueDimmed: {
    color: colors.mutedLight,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
  },
  chartArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  chartAreaScroll: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  dayColumn: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 12,
  },
  dayColumnFixed: {
    flex: 0,
    width: COLUMN_WIDTH,
  },
  dayColumnSelected: {
    backgroundColor: colors.chipBg,
  },
  barTrack: {
    height: BAR_MAX_HEIGHT,
    width: '70%',
    justifyContent: 'flex-end',
  },
  barLayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
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
  emptyText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
