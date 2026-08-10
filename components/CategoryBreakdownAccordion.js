import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { format, isToday, isYesterday } from 'date-fns';
import AmountText from './AmountText';
import { fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { getCategoryColor } from '../lib/analytics';

function dateLabel(occurredAt) {
  const date = new Date(occurredAt);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'd MMM yyyy');
}

// One category's ranked/breakdown row, expandable into the exact transactions
// behind its total. No per-row icon — every transaction inside one category's
// expansion already shares the same icon, so repeating it would be pure noise;
// each sub-row is keyed on date + note instead.
function CategorySection({ entry, transactions, currency, renderRight, onPressTransaction, accountFor, showAccountTags, isLast, styles, colors }) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <View style={!isLast && styles.rowBorder}>
      <Pressable style={styles.summaryRow} onPress={() => setOpen((v) => !v)}>
        <View style={[styles.colorDot, { backgroundColor: getCategoryColor(entry.category) ?? colors.mutedLight }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{entry.category?.name ?? 'Uncategorized'}</Text>
          <Text style={styles.pct}>{entry.pct.toFixed(0)}% of total</Text>
        </View>
        {renderRight(entry)}
        <Chevron size={16} color={colors.mutedMid} strokeWidth={2.4} />
      </Pressable>

      {open && (
        <View style={styles.subList}>
          {transactions.length === 0 ? (
            <Text style={styles.subEmpty}>No transactions.</Text>
          ) : (
            transactions.map((tx) => {
              const acc = showAccountTags ? accountFor?.(tx.account_id) : null;
              const Row = onPressTransaction ? Pressable : View;
              return (
                <Row key={tx.id} style={styles.subRow} onPress={onPressTransaction ? () => onPressTransaction(tx) : undefined}>
                  <View style={styles.subRowMid}>
                    <Text style={styles.subRowTitle}>
                      {dateLabel(tx.occurred_at)}
                      {acc ? ` · ${acc.name}` : ''}
                    </Text>
                    <Text style={styles.subRowNote} numberOfLines={1}>
                      {tx.note?.trim() || 'No note'}
                    </Text>
                  </View>
                  <AmountText value={tx.amount} type={tx.type} signed size={fontSize.sm} currency={currency} />
                </Row>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

// entries: [{ category, amount, pct, delta? }] — the same shape
// computeCategoryBreakdown/computeCategoryDeltas already return.
// transactions: the already-scoped (period/account/currency) list those
// entries were computed from; this component does its own type + category
// grouping over it rather than requiring a preshaped map.
// renderRight(entry): the amount/delta column shown before the chevron — left
// to the caller since Analytics shows a delta badge and Reports doesn't.
export default function CategoryBreakdownAccordion({
  entries,
  transactions,
  type,
  currency,
  renderRight,
  onPressTransaction,
  accountFor,
  showAccountTags = false,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const byCategory = useMemo(() => {
    const map = new Map();
    transactions
      .filter((tx) => tx.type === type)
      .forEach((tx) => {
        const key = tx.category_id ?? 'uncategorized';
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(tx);
      });
    for (const list of map.values()) {
      list.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : a.occurred_at > b.occurred_at ? -1 : 0));
    }
    return map;
  }, [transactions, type]);

  return entries.map((entry, idx) => (
    <CategorySection
      key={entry.category?.id ?? 'uncategorized'}
      entry={entry}
      transactions={byCategory.get(entry.category?.id ?? 'uncategorized') ?? []}
      currency={currency}
      renderRight={renderRight}
      onPressTransaction={onPressTransaction}
      accountFor={accountFor}
      showAccountTags={showAccountTags}
      isLast={idx === entries.length - 1}
      styles={styles}
      colors={colors}
    />
  ));
}

function makeStyles(colors) {
  return StyleSheet.create({
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 14,
    },
    colorDot: {
      width: 12,
      height: 12,
      borderRadius: radii.pill,
    },
    name: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.md,
      color: colors.ink,
    },
    pct: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xs,
      color: colors.mutedMid,
      marginTop: 1,
    },
    subList: {
      paddingBottom: spacing.sm,
    },
    subEmpty: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.sm,
      color: colors.mutedLight,
      paddingBottom: spacing.md,
    },
    subRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 9,
      paddingLeft: spacing.lg,
    },
    subRowMid: {
      flex: 1,
    },
    subRowTitle: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.sm,
      color: colors.ink,
    },
    subRowNote: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xs,
      color: colors.mutedMid,
      marginTop: 1,
    },
  });
}
