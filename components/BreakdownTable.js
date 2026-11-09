import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { format, parseISO } from 'date-fns';
import { fontFamily, spacing, radius, type } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

// A breakdown from one of Ask FLO's tool results, as a table (44-ai-assistant.md,
// "Rich answers"). Everything it shows is the tool's own output: the labels,
// the ₹ strings and the total. The numeric `value` only sizes the bars, so
// the model never types a number that lands here.

const KINDS = [
  { key: 'by_day', col: 'Day', label: (r) => format(parseISO(r.day), 'EEE d MMM') },
  { key: 'by_week', col: 'Week', label: (r) => `Week of ${format(parseISO(r.week_starting), 'd MMM')}` },
  { key: 'by_month', col: 'Month', label: (r) => format(parseISO(`${r.month}-01`), 'MMM yyyy') },
  { key: 'by_category', col: 'Category', label: (r) => r.category },
];

// tool_calls (the stored tool log) → the breakdowns worth drawing, in order:
// [{ col, rows: [{ label, total, value, count }], total, count, type, period }]
export function breakdownsFrom(toolCalls) {
  if (!Array.isArray(toolCalls)) return [];
  const out = [];
  const seen = new Set(); // the same breakdown asked twice in a turn draws once
  for (const call of toolCalls) {
    const result = call?.result;
    if (!result || typeof result !== 'object') continue;
    for (const kind of KINDS) {
      const list = result[kind.key];
      if (!Array.isArray(list) || list.length < 2) continue; // one row says nothing a sentence doesn't
      try {
        const id = JSON.stringify([kind.key, result.start, result.end, result.categories_counted, result.account, list]);
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({
          col: kind.col,
          rows: list.map((r) => ({
            // The function's own label, which the answer quotes; this
            // version's formatting only for answers stored before it had one.
            label: typeof r.label === 'string' ? r.label : kind.label(r),
            total: String(r.total ?? ''),
            value: Number(r.value) || 0,
            count: Number(r.count) || 0,
          })),
          total: String(result.total ?? ''),
          count: result.count,
          type: result.type,
          period: String(result.period ?? ''),
        });
      } catch {
        // A row in a shape this version doesn't know: skip the table, keep the answer.
      }
    }
  }
  return out;
}

export default function BreakdownTable({ table }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const max = Math.max(...table.rows.map((r) => r.value), 1);
  // Answers stored before rows carried a value have no bars to draw.
  const bars = table.rows.some((r) => r.value > 0);

  return (
    <View style={styles.table} accessibilityLabel={`${table.col} breakdown, ${table.period}`}>
      <View style={styles.headRow}>
        <Text style={[styles.head, styles.labelCol]}>{table.col}</Text>
        <Text style={[styles.head, styles.amountCol]}>{table.type === 'income' ? 'Received' : 'Spent'}</Text>
      </View>
      {table.rows.map((r, i) => (
        <View key={`${r.label}-${i}`} style={styles.row}>
          <View style={styles.labelCol}>
            <Text style={styles.label} numberOfLines={1}>
              {r.label}
            </Text>
            <Text style={styles.count}>{r.count === 1 ? '1 entry' : `${r.count} entries`}</Text>
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amount}>{r.total}</Text>
            {bars ? (
              <View style={styles.track}>
                <View style={[styles.bar, { width: `${Math.max(4, (r.value / max) * 100)}%` }]} />
              </View>
            ) : null}
          </View>
        </View>
      ))}
      <View style={styles.totalRow}>
        <Text style={[styles.totalLabel, styles.labelCol]}>Total</Text>
        <Text style={[styles.totalAmount, styles.amountCol]}>{table.total}</Text>
      </View>
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    // No outer frame: the caller puts the table on a Card.
    table: {},
    headRow: {
      flexDirection: 'row',
      paddingBottom: spacing.xs,
    },
    head: {
      fontFamily: fontFamily.bold,
      fontSize: type.caption,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: colors.muted,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    labelCol: {
      flex: 1,
      paddingRight: spacing.md,
    },
    amountCol: {
      width: 112,
      alignItems: 'flex-end',
      textAlign: 'right',
    },
    label: {
      fontFamily: fontFamily.semibold,
      fontSize: type.body,
      color: colors.ink,
    },
    count: {
      fontFamily: fontFamily.semibold,
      fontSize: type.caption,
      color: colors.muted,
      marginTop: 2,
    },
    amount: {
      fontFamily: fontFamily.bold,
      fontSize: type.body,
      color: colors.ink,
      fontVariant: ['tabular-nums'],
    },
    track: {
      width: '100%',
      height: 4,
      borderRadius: radius.full,
      backgroundColor: colors.chipBg,
      marginTop: spacing.xs,
      overflow: 'hidden',
    },
    bar: {
      height: 4,
      borderRadius: radius.full,
      backgroundColor: colors.brand,
    },
    totalRow: {
      flexDirection: 'row',
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    totalLabel: {
      fontFamily: fontFamily.extrabold,
      fontSize: type.body,
      color: colors.ink,
    },
    totalAmount: {
      fontFamily: fontFamily.extrabold,
      fontSize: type.body,
      color: colors.ink,
      fontVariant: ['tabular-nums'],
    },
  });
}
