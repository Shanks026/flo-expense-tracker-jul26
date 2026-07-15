import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, ArrowLeftRight } from 'lucide-react-native';
import { addMonths, subMonths, format, isToday, isYesterday } from 'date-fns';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import IconTile from '../../components/IconTile';
import AmountText from '../../components/AmountText';
import Pill from '../../components/Pill';
import CategoryIcon from '../../components/CategoryIcon';
import Skeleton from '../../components/Skeleton';
import FadeIn from '../../components/FadeIn';
import { colors, fontFamily, fontSize, spacing, radii } from '../../theme/tokens';
import useTransactions from '../../hooks/useTransactions';
import { useAddTransactionSheet } from '../../components/AddTransactionSheet';
import { useAccount } from '../../lib/AccountContext';
import { isTransfer, transferLabel } from '../../lib/transfers';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'expense', label: 'Expense' },
  { key: 'income', label: 'Income' },
];

function dayLabel(dateStr) {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'd MMMM');
}

function groupByDay(transactions) {
  const groups = [];
  const byLabel = new Map();
  for (const tx of transactions) {
    const label = dayLabel(tx.occurred_at);
    if (!byLabel.has(label)) {
      const group = { label, items: [], income: 0, expense: 0 };
      byLabel.set(label, group);
      groups.push(group);
    }
    const group = byLabel.get(label);
    group.items.push(tx);
    // Only income/expense feed the day-header totals; transfers are neither and
    // must not land in a bucket (they'd create a NaN key and misstate the day).
    if (tx.type === 'income' || tx.type === 'expense') group[tx.type] += tx.amount;
  }
  return groups;
}

function formatAmount(n) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export default function Transactions() {
  const [month, setMonth] = useState(new Date());
  const [typeFilter, setTypeFilter] = useState('all');
  const { transactions, loading } = useTransactions({ month, type: typeFilter });
  const { openAdd } = useAddTransactionSheet();
  const { accounts } = useAccount();

  const groups = useMemo(() => groupByDay(transactions), [transactions]);

  const totals = useMemo(() => {
    // Transfers move money between the user's own accounts — never counted as
    // spent or received. Only real expense/income rows feed these totals.
    return transactions.reduce(
      (acc, tx) => {
        if (tx.type === 'income') acc.received += tx.amount;
        else if (tx.type === 'expense') acc.spent += tx.amount;
        return acc;
      },
      { spent: 0, received: 0 }
    );
  }, [transactions]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
        <View style={styles.monthSelector}>
          <Pressable onPress={() => setMonth((m) => subMonths(m, 1))}>
            <ChevronLeft size={18} color={colors.ink} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.monthText}>{format(month, 'MMMM yyyy')}</Text>
          <Pressable onPress={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight size={18} color={colors.ink} strokeWidth={2.4} />
          </Pressable>
        </View>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable key={f.key} onPress={() => setTypeFilter(f.key)}>
            <Pill label={f.label} tone={typeFilter === f.key ? 'dark' : 'neutral'} />
          </Pressable>
        ))}
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryDark}>
          <Text style={styles.summaryLabelDark}>Spent</Text>
          {loading ? (
            <Skeleton width={80} height={fontSize.xxl} radius={6} style={{ marginTop: 4, backgroundColor: colors.inkCard }} />
          ) : (
            <FadeIn>
              <AmountText value={totals.spent} type="neutral" dark size={fontSize.xxl} />
            </FadeIn>
          )}
        </View>
        <View style={styles.summaryLight}>
          <Text style={styles.summaryLabelLight}>Received</Text>
          {loading ? (
            <Skeleton width={80} height={fontSize.xxl} radius={6} style={{ marginTop: 4 }} />
          ) : (
            <FadeIn>
              <AmountText value={totals.received} type="income" size={fontSize.xxl} />
            </FadeIn>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Card style={styles.dayCard}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.row, i < 2 && styles.rowBorder]}>
                <Skeleton width={40} height={40} radius={12} />
                <View style={styles.rowMid}>
                  <Skeleton width="55%" height={15} radius={6} style={{ marginBottom: 6 }} />
                  <Skeleton width="35%" height={11} radius={6} />
                </View>
              </View>
            ))}
          </Card>
        ) : groups.length === 0 ? (
          <FadeIn>
            <Card style={{ marginTop: spacing.lg }}>
              <Text style={styles.emptyText}>No transactions this month.</Text>
            </Card>
          </FadeIn>
        ) : (
          <FadeIn>
            {groups.map((group) => (
              <Card key={group.label} style={styles.dayCard}>
                <View style={styles.dayHeaderRow}>
                  <Text style={styles.dayLabel}>{group.label}</Text>
                  <View style={styles.dayTotals}>
                    {group.expense > 0 && (
                      <View style={styles.dayTotalItem}>
                        <TrendingDown size={11} color={colors.dangerStrong} strokeWidth={2.6} />
                        <Text style={styles.dayTotalValue}>{formatAmount(group.expense)}</Text>
                      </View>
                    )}
                    {group.income > 0 && (
                      <View style={styles.dayTotalItem}>
                        <TrendingUp size={11} color={colors.income} strokeWidth={2.6} />
                        <Text style={styles.dayTotalValue}>{formatAmount(group.income)}</Text>
                      </View>
                    )}
                  </View>
                </View>
                {group.items.map((tx, idx) => {
                  const transfer = isTransfer(tx);
                  return (
                    <Pressable
                      key={tx.id}
                      style={[styles.row, idx < group.items.length - 1 && styles.rowBorder]}
                      onPress={() => openAdd(tx)}
                    >
                      <IconTile tone={tx.type === 'income' ? 'income' : 'neutral'} size={40} radius={12}>
                        {transfer ? (
                          <ArrowLeftRight size={19} color={colors.mutedDarker} strokeWidth={2} />
                        ) : (
                          <CategoryIcon
                            icon={tx.category?.icon}
                            size={19}
                            color={tx.type === 'income' ? colors.incomeAccent : colors.ink}
                          />
                        )}
                      </IconTile>
                      <View style={styles.rowMid}>
                        <View style={styles.rowTitleWrap}>
                          <Text style={styles.rowTitle}>
                            {transfer ? transferLabel(tx, accounts) : tx.category?.name ?? 'Uncategorized'}
                          </Text>
                          {!transfer && tx.plan?.name && <Pill label={tx.plan.name} tone="income" style={styles.planPill} />}
                        </View>
                        <Text style={styles.rowSub}>
                          {transfer ? 'Transfer' : tx.category?.name ?? (tx.type === 'income' ? 'Income' : 'Expense')}
                        </Text>
                      </View>
                      <AmountText value={tx.amount} type={tx.type} signed size={fontSize.md} />
                    </Pressable>
                  );
                })}
              </Card>
            ))}
          </FadeIn>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.display,
    letterSpacing: -0.3,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  monthText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  summaryDark: {
    flex: 1,
    backgroundColor: colors.ink,
    borderRadius: 16,
    padding: spacing.md,
  },
  summaryLight: {
    flex: 1,
    backgroundColor: colors.incomeBg,
    borderRadius: 16,
    padding: spacing.md,
  },
  summaryLabelDark: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.mutedMid,
    marginBottom: 2,
  },
  summaryLabelLight: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.incomeAccent,
    marginBottom: 2,
  },
  scroll: {
    paddingTop: spacing.md,
    paddingBottom: 120,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  dayLabel: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.base,
    color: colors.mutedMid,
  },
  dayTotals: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dayTotalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dayTotalValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.mutedDarker,
  },
  dayCard: {
    padding: 0,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.muted,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  rowMid: {
    flex: 1,
  },
  rowTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  rowTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  planPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rowSub: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.mutedMid,
    marginTop: 1,
  },
});
