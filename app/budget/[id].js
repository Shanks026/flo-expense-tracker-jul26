import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Pencil, Wallet } from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import Card from '../../components/Card';
import IconTile from '../../components/IconTile';
import ProgressBar from '../../components/ProgressBar';
import AmountText from '../../components/AmountText';
import Pill from '../../components/Pill';
import CategoryIcon from '../../components/CategoryIcon';
import { colors, fontFamily, fontSize, spacing, radii } from '../../theme/tokens';
import useBudgetDetail from '../../hooks/useBudgetDetail';
import { budgetStatus } from '../../hooks/useBudgets';
import { formatPeriodLabel, isBudgetEnded, daysLeftInPeriod, computeBudgetPace } from '../../lib/budgets';
import { useAddTransactionSheet } from '../../components/AddTransactionSheet';
import { useAddBudgetSheet } from '../../components/AddBudgetSheet';
import { formatMoney } from '../../lib/currency';
import useCurrency from '../../hooks/useCurrency';

// Same vocabulary as computePlanPace's (00-index.md) — a budget is a spending
// cap, so "ahead"/"behind" would read ambiguously.
const PACE_COPY = {
  on_track: { text: 'On track for this period', tone: 'income' },
  over_pace: { text: 'Spending too fast to last the period', tone: 'danger' },
  under_pace: { text: 'Comfortably under pace', tone: 'income' },
};

export default function BudgetDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { budget, transactions, loading } = useBudgetDetail(id);
  const { openAdd } = useAddTransactionSheet();
  const { openAddBudget } = useAddBudgetSheet();
  const currency = useCurrency();

  // Deleting the budget from the edit sheet leaves this screen pointing at a
  // dead id — the refetch returns nothing, and we'd otherwise sit on an empty
  // shell. Same guard as Plan Detail.
  useEffect(() => {
    if (!loading && !budget) router.back();
  }, [loading, budget]);

  // Real bug, not just a missing polish pass: this used to fall straight
  // through to `if (!budget) return null`, rendering a BLANK screen for the
  // whole time useBudgetDetail's fetch was in flight — worse than a wrong
  // value flash, since there was nothing on screen at all. A centred spinner
  // (matching streak.js's own loading branch) at least shows something is
  // happening.
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.ink} />
        </View>
      </SafeAreaView>
    );
  }

  if (!budget) return null;

  const status = budgetStatus(budget.spent, budget.amount);
  const progress = budget.amount > 0 ? budget.spent / budget.amount : 0;
  const ended = isBudgetEnded(budget);
  const daysLeft = daysLeftInPeriod(budget);
  const pace = computeBudgetPace(budget);
  const isOver = status === 'over';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.budgetName} numberOfLines={1}>
                {budget.name}
              </Text>
              {ended && <Pill label="Ended" tone="completed" />}
            </View>
            <Text style={styles.periodLabel}>{formatPeriodLabel(budget)}</Text>
          </View>
        </View>
        <Pressable style={styles.editButton} onPress={() => openAddBudget(budget)}>
          <Pencil size={16} color={colors.ink} strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card dark style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            {/* A LIGHT tile, deliberately, even on this dark card: the category
                palette includes charcoal and navy, which would vanish against a
                dark tile. On a light tile every swatch reads — which is exactly
                why the Budgets tab tints its icons the same way. */}
            <IconTile tone="neutral" size={44} radius={14}>
              {budget.category_icon ? (
                <CategoryIcon
                  icon={budget.category_icon}
                  size={20}
                  color={budget.category_color ?? colors.ink}
                />
              ) : (
                <Wallet size={20} color={colors.ink} strokeWidth={2} />
              )}
            </IconTile>
            <Text style={styles.summaryCategory}>{budget.category_name ?? 'Overall'}</Text>
          </View>

          <Text style={styles.summaryLabel}>{isOver ? 'Over budget by' : 'Left to spend'}</Text>
          <AmountText value={budget.remaining} type="neutral" dark size={40} muteCurrency currency={currency} />

          <View style={styles.progressWrap}>
            <ProgressBar progress={progress} dark status={status} />
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.spentText}>
              {formatMoney(budget.spent, currency)} spent of{' '}
              {formatMoney(budget.amount, currency)}
            </Text>
            <Text style={styles.daysText}>
              {ended ? 'Period ended' : daysLeft === 1 ? '1 day left' : `${daysLeft} days left`}
            </Text>
          </View>
        </Card>

        {pace && (
          <Card style={[styles.paceCard, pace === 'over_pace' && styles.paceCardOver]}>
            <Text
              style={[
                styles.paceText,
                { color: PACE_COPY[pace].tone === 'danger' ? colors.danger : colors.income },
              ]}
            >
              {PACE_COPY[pace].text}
            </Text>
          </Card>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          <Text style={styles.sectionCount}>
            {transactions.length} {transactions.length === 1 ? 'item' : 'items'}
          </Text>
        </View>

        {transactions.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>
              Nothing spent in this period yet.
            </Text>
          </Card>
        ) : (
          <Card style={styles.listCard}>
            {transactions.map((tx, idx) => (
              <Pressable
                key={tx.id}
                style={[styles.row, idx < transactions.length - 1 && styles.rowBorder]}
                onPress={() => openAdd(tx)}
              >
                <IconTile tone="neutral">
                  <CategoryIcon icon={tx.category?.icon} size={20} color={colors.ink} />
                </IconTile>
                <View style={styles.rowMid}>
                  <Text style={styles.rowTitle}>{tx.category?.name ?? 'Uncategorized'}</Text>
                  <Text style={styles.rowSub}>
                    {format(parseISO(tx.occurred_at), 'd MMM')}
                    {tx.note ? ` · ${tx.note}` : ''}
                  </Text>
                </View>
                <AmountText value={tx.amount} type="expense" currency={currency} />
              </Pressable>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    paddingRight: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetName: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.title,
    letterSpacing: -0.3,
    color: colors.ink,
    flexShrink: 1,
  },
  periodLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 60,
  },
  summaryCard: {
    borderRadius: radii.cardLg,
    padding: 22,
    marginBottom: spacing.lg,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryCategory: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.mutedMid,
  },
  summaryLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.mutedMid,
  },
  progressWrap: {
    marginVertical: spacing.lg,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spentText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.mutedMid,
  },
  daysText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.base,
    color: colors.surface,
  },
  paceCard: {
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
  },
  paceCardOver: {
    borderColor: colors.dangerBorder,
  },
  paceText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    textAlign: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: colors.ink,
  },
  sectionCount: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: colors.muted,
  },
  emptyText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.muted,
    textAlign: 'center',
  },
  listCard: {
    padding: 0,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 13,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  rowMid: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  rowSub: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginTop: 1,
  },
});
