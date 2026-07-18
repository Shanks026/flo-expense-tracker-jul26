import { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Pencil } from 'lucide-react-native';
import { format } from 'date-fns';
import Card from '../../../components/Card';
import IconTile from '../../../components/IconTile';
import ProgressBar from '../../../components/ProgressBar';
import AmountText from '../../../components/AmountText';
import Pill from '../../../components/Pill';
import Button from '../../../components/Button';
import CategoryIcon from '../../../components/CategoryIcon';
import Switch from '../../../components/Switch';
import DonutChart from '../../../components/DonutChart';
import { colors, fontFamily, fontSize, spacing, radii } from '../../../theme/tokens';
import { usePlan } from '../../../hooks/usePlans';
import useTransactions from '../../../hooks/useTransactions';
import useCollectingPlan from '../../../hooks/useCollectingPlan';
import { useAddTransactionSheet } from '../../../components/AddTransactionSheet';
import { formatMoney } from '../../../lib/currency';
import useCurrency from '../../../hooks/useCurrency';
import { useAddPlanSheet } from '../../../components/AddPlanSheet';
import { supabase } from '../../../lib/supabase';
import { setPlanCollecting } from '../../../lib/plans';
import { useDataRefresh } from '../../../lib/DataRefreshContext';
import { useToast } from '../../../components/Toast';
import { computeCategoryBreakdown, getCategoryColor } from '../../../lib/analytics';

function dateRangeLabel(plan) {
  if (!plan.start_date && !plan.end_date) return null;
  if (plan.start_date && plan.end_date) {
    return `${format(new Date(plan.start_date), 'MMM d')} – ${format(new Date(plan.end_date), 'd, yyyy')}`;
  }
  return format(new Date(plan.start_date ?? plan.end_date), 'MMM d, yyyy');
}

export default function PlanDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { plan, loading } = usePlan(id);
  const { transactions } = useTransactions({ planId: id });
  const { plan: collectingPlan } = useCollectingPlan();
  const { openAdd } = useAddTransactionSheet();
  const { openAddPlan } = useAddPlanSheet();
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();
  const currency = useCurrency();

  // Pure client-side compute from the transactions the screen already holds —
  // no new query. A one-slice donut is a circle, not information (same reason
  // the budget detail screen has no chart at all), so hide below 2 categories.
  // Hooks must run unconditionally every render, so this sits ABOVE the
  // `if (!plan) return null` guard below — it doesn't depend on `plan` anyway,
  // only on `transactions`.
  const categoryBreakdown = useMemo(() => computeCategoryBreakdown(transactions, 'expense'), [transactions]);
  const donutSegments = useMemo(
    () => categoryBreakdown.map((entry) => ({ pct: entry.pct, color: getCategoryColor(entry.category) ?? colors.mutedLight })),
    [categoryBreakdown]
  );

  useEffect(() => {
    if (!loading && !plan) {
      router.back();
    }
  }, [loading, plan]);

  // Real bug fix (same class as budget/[id].js): this fell straight through to
  // `if (!plan) return null`, rendering a BLANK screen for the whole time
  // usePlan's fetch was in flight, not just a wrong-value flash. Centred
  // spinner instead, matching streak.js's own loading branch.
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.ink} />
        </View>
      </SafeAreaView>
    );
  }

  if (!plan) return null;

  const hasTarget = plan.target_amount != null;
  const progress = hasTarget && plan.target_amount > 0 ? plan.total_spent / plan.target_amount : 0;
  const isCompleted = plan.status === 'completed';
  const isCollecting = collectingPlan?.id === plan.id;
  const showBreakdown = categoryBreakdown.length >= 2;

  async function toggleStatus() {
    // Completing a plan clears its collecting flag — a finished trip must not
    // keep swallowing new transactions. Reactivating does NOT re-arm it (the
    // user opts back in deliberately via the switch).
    const update = isCompleted ? { status: 'active' } : { status: 'completed', is_collecting: false };
    await supabase.from('plans').update(update).eq('id', plan.id);
    notifyChanged();
  }

  async function handleToggleCollecting(next) {
    const { error } = await setPlanCollecting({ planId: plan.id, accountId: plan.account_id, collecting: next });
    if (error) {
      showToast({ message: error.message, variant: 'error' });
      return;
    }
    notifyChanged();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.planName} numberOfLines={1}>
                {plan.name}
              </Text>
              <Pill label={isCompleted ? 'Completed' : 'Active'} tone={isCompleted ? 'completed' : 'income'} />
            </View>
            {dateRangeLabel(plan) && <Text style={styles.planDate}>{dateRangeLabel(plan)}</Text>}
          </View>
        </View>
        <Pressable style={styles.editButton} onPress={() => openAddPlan(plan)}>
          <Pencil size={16} color={colors.ink} strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {!isCompleted && (
          <View style={styles.collectRow}>
            <View style={styles.collectText}>
              <Text style={styles.collectTitle}>Collecting</Text>
              <Text style={styles.collectSub}>New transactions default into this plan</Text>
            </View>
            <Switch value={isCollecting} onValueChange={handleToggleCollecting} />
          </View>
        )}

        <Card dark style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total spent</Text>
          <View style={styles.summaryAmountRow}>
            <AmountText value={plan.total_spent} type="neutral" dark size={40} currency={currency} />
            {hasTarget && <Text style={styles.targetText}> / {formatMoney(plan.target_amount, currency)}</Text>}
          </View>
          {hasTarget && (
            <>
              <View style={styles.progressWrap}>
                <ProgressBar progress={progress} dark status="healthy" />
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.progressPercent}>{Math.round(progress * 100)}% of target</Text>
                <Text style={styles.remainingText}>{formatMoney(plan.remaining, currency)} remaining</Text>
              </View>
            </>
          )}
        </Card>

        {showBreakdown && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Where it went</Text>
            </View>
            <Card style={styles.chartCard}>
              <DonutChart segments={donutSegments} total={plan.total_spent} currency={currency} />
            </Card>
            <Card style={styles.breakdownCard}>
              {categoryBreakdown.map((entry, idx) => (
                <View
                  key={entry.category?.id ?? 'uncategorized'}
                  style={[styles.breakdownRow, idx < categoryBreakdown.length - 1 && styles.rowBorder]}
                >
                  <View style={[styles.colorDot, { backgroundColor: getCategoryColor(entry.category) ?? colors.mutedLight }]} />
                  <View style={styles.rowMid}>
                    <Text style={styles.rowTitle}>{entry.category?.name ?? 'Uncategorized'}</Text>
                    <Text style={styles.rowSub}>{entry.pct.toFixed(0)}% of total</Text>
                  </View>
                  <AmountText value={entry.amount} type="neutral" currency={currency} />
                </View>
              ))}
            </Card>
          </>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Expenses</Text>
          <Text style={styles.sectionCount}>{transactions.length} items</Text>
        </View>

        {transactions.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>No expenses linked yet.</Text>
          </Card>
        ) : (
          <Card style={styles.listCard}>
            {transactions.map((tx, idx) => (
              <Pressable
                key={tx.id}
                style={[styles.row, idx < transactions.length - 1 && styles.rowBorder]}
                onPress={() => openAdd(tx)}
              >
                <IconTile tone={tx.type === 'income' ? 'income' : 'neutral'}>
                  <CategoryIcon icon={tx.category?.icon} size={20} color={tx.type === 'income' ? colors.incomeAccent : colors.ink} />
                </IconTile>
                <View style={styles.rowMid}>
                  <Text style={styles.rowTitle}>{tx.category?.name ?? 'Uncategorized'}</Text>
                  <Text style={styles.rowSub}>{format(new Date(tx.occurred_at), 'd MMM')}</Text>
                </View>
                <AmountText value={tx.amount} type={tx.type} signed currency={currency} />
              </Pressable>
            ))}
          </Card>
        )}

        <View style={styles.actionRow}>
          <Button
            title="Add Expense"
            onPress={() => openAdd({ plan_id: plan.id })}
            style={styles.actionButton}
          />
          <Button
            title="Add from history"
            variant="outline"
            onPress={() => router.push(`/plan/${plan.id}/history`)}
            style={styles.actionButton}
          />
        </View>

        <Pressable style={styles.toggleStatusRow} onPress={toggleStatus}>
          <Text style={styles.toggleStatusText}>{isCompleted ? 'Reactivate Plan' : 'Mark as Complete'}</Text>
        </Pressable>
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
  planName: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.title,
    letterSpacing: -0.3,
    color: colors.ink,
    flexShrink: 1,
  },
  planDate: {
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
    marginBottom: spacing.xl,
  },
  summaryLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.mutedMid,
  },
  summaryAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
  },
  targetText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.mutedDarker,
  },
  progressWrap: {
    marginVertical: spacing.lg,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressPercent: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.mutedMid,
  },
  remainingText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    color: colors.brand,
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
  chartCard: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  breakdownCard: {
    padding: 0,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  breakdownRow: {
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
  actionRow: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  actionButton: {
    width: '100%',
  },
  collectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
  },
  collectText: {
    flex: 1,
  },
  collectTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  collectSub: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginTop: 2,
  },
  toggleStatusRow: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  toggleStatusText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: colors.muted,
  },
});
