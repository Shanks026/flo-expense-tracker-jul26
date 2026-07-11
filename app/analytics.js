import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, TrendingUp, TrendingDown } from 'lucide-react-native';
import { startOfMonth, endOfMonth, subDays, differenceInCalendarDays, format } from 'date-fns';
import Card from '../components/Card';
import IconTile from '../components/IconTile';
import AmountText from '../components/AmountText';
import CategoryIcon from '../components/CategoryIcon';
import Pill from '../components/Pill';
import ProgressBar from '../components/ProgressBar';
import AnalyticsFilterBar from '../components/AnalyticsFilterBar';
import AnalyticsSegmentTabs from '../components/AnalyticsSegmentTabs';
import IncomeExpenseChart from '../components/IncomeExpenseChart';
import DayOfWeekChart from '../components/DayOfWeekChart';
import DonutChart from '../components/DonutChart';
import { colors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import useAnalyticsData from '../hooks/useAnalyticsData';
import { useAccount } from '../lib/AccountContext';
import {
  computeTrend,
  computeDelta,
  computeSavingsRate,
  computeBiggestTransaction,
  computeDayOfWeek,
  computeCategoryBreakdown,
  computeCategoryDeltas,
  getCategoryColor,
  computeBudgetPeriods,
  computeConsistencyFlag,
  computeRangeSpentByPlan,
  computePlanPace,
} from '../lib/analytics';

const STATUS_COLOR = { healthy: colors.income, warn: colors.warn, over: colors.danger };
const PACE_LABEL = { on_track: 'On track', over_pace: 'Over pace', under_pace: 'Under pace' };
const PACE_TONE = { on_track: 'income', under_pace: 'neutral', over_pace: 'danger' };

function sumByType(transactions, type) {
  return transactions.filter((tx) => tx.type === type).reduce((sum, tx) => sum + tx.amount, 0);
}

function DeltaBadge({ delta, goodDirection = 'up' }) {
  if (delta.direction === 'flat') {
    return <Text style={styles.deltaFlat}>No change</Text>;
  }
  if (delta.pct === null) {
    return <Text style={styles.deltaNew}>New</Text>;
  }
  const isGood = delta.direction === goodDirection;
  const color = isGood ? colors.income : colors.danger;
  const Icon = delta.direction === 'up' ? TrendingUp : TrendingDown;
  return (
    <View style={styles.deltaRow}>
      <Icon size={12} color={color} strokeWidth={2.6} />
      <Text style={[styles.deltaText, { color }]}>{Math.abs(delta.pct).toFixed(0)}%</Text>
    </View>
  );
}

export default function Analytics() {
  const router = useRouter();
  const { activeAccount } = useAccount();
  const [segment, setSegment] = useState('overview');
  const [categoryType, setCategoryType] = useState('expense');
  const [mode, setMode] = useState('month');
  const [month, setMonth] = useState(new Date());
  const [customFrom, setCustomFrom] = useState(subDays(new Date(), 6));
  const [customTo, setCustomTo] = useState(new Date());

  const { from, to } = useMemo(() => {
    if (mode === 'month') {
      return { from: startOfMonth(month), to: endOfMonth(month) };
    }
    return { from: customFrom, to: customTo };
  }, [mode, month, customFrom, customTo]);

  const { current, prior, budgets, plans } = useAnalyticsData({ from, to });

  const totalIncome = useMemo(() => sumByType(current, 'income'), [current]);
  const totalExpense = useMemo(() => sumByType(current, 'expense'), [current]);
  const netSaved = totalIncome - totalExpense;

  const priorIncome = useMemo(() => sumByType(prior, 'income'), [prior]);
  const priorExpense = useMemo(() => sumByType(prior, 'expense'), [prior]);
  const priorNet = priorIncome - priorExpense;

  const incomeDelta = computeDelta(totalIncome, priorIncome);
  const expenseDelta = computeDelta(totalExpense, priorExpense);
  const netDelta = computeDelta(netSaved, priorNet);
  const savingsRate = computeSavingsRate(totalIncome, totalExpense);
  const biggest = computeBiggestTransaction(current);

  const granularity = differenceInCalendarDays(to, from) + 1 <= 31 ? 'day' : 'week';
  const trendData = useMemo(() => computeTrend(current, from, to), [current, from, to, granularity]);
  // IncomeExpenseChart expects { date, income, expense }; computeTrend
  // returns { bucketStart, income, expense } — mapped here rather than
  // renaming computeTrend's own field, since lib/analytics.js is a shared
  // utility this screen isn't necessarily the only consumer of.
  const chartData = useMemo(
    () => trendData.map((b) => ({ date: b.bucketStart, income: b.income, expense: b.expense })),
    [trendData]
  );

  const dayOfWeekData = useMemo(() => computeDayOfWeek(current), [current]);
  const expenseCount = useMemo(() => current.filter((tx) => tx.type === 'expense').length, [current]);
  const avgExpense = expenseCount > 0 ? totalExpense / expenseCount : 0;

  const categoryBreakdown = useMemo(() => computeCategoryBreakdown(current, categoryType), [current, categoryType]);
  const categoryDeltas = useMemo(
    () => computeCategoryDeltas(categoryBreakdown, prior, categoryType),
    [categoryBreakdown, prior, categoryType]
  );
  const donutSegments = useMemo(
    () =>
      categoryDeltas.map((entry) => ({
        pct: entry.pct,
        color: getCategoryColor(entry.category) ?? colors.mutedLight,
      })),
    [categoryDeltas]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Analytics</Text>
          {activeAccount && <Text style={styles.headerSubtitle}>{activeAccount.name}</Text>}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AnalyticsFilterBar
          mode={mode}
          onModeChange={setMode}
          month={month}
          onMonthChange={setMonth}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />

        <View style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>
          <AnalyticsSegmentTabs active={segment} onChange={setSegment} />
        </View>

        {segment === 'overview' && (
          <>
            <Card style={styles.heroCard}>
              <View style={styles.heroRow}>
                <View style={styles.heroItem}>
                  <Text style={styles.heroLabel}>Income</Text>
                  <AmountText value={totalIncome} type="income" size={fontSize.xl} />
                  <DeltaBadge delta={incomeDelta} goodDirection="up" />
                </View>
                <View style={styles.heroItem}>
                  <Text style={styles.heroLabel}>Expense</Text>
                  <AmountText value={totalExpense} type="neutral" size={fontSize.xl} />
                  <DeltaBadge delta={expenseDelta} goodDirection="down" />
                </View>
                <View style={styles.heroItem}>
                  <Text style={styles.heroLabel}>Net Saved</Text>
                  <AmountText value={netSaved} type={netSaved < 0 ? 'danger' : 'neutral'} size={fontSize.xl} />
                  <DeltaBadge delta={netDelta} goodDirection="up" />
                </View>
              </View>
              {savingsRate !== null && (
                <View style={styles.savingsRow}>
                  <Text style={styles.savingsLabel}>Savings Rate</Text>
                  <Text style={styles.savingsValue}>{savingsRate.toFixed(0)}%</Text>
                </View>
              )}
            </Card>

            <Card style={styles.chartCard}>
              <IncomeExpenseChart
                data={chartData}
                granularity={granularity}
                showPeriodLabel
                emptyMessage="No transactions in this period."
              />
            </Card>

            {biggest && (
              <Card style={styles.biggestCard}>
                <Text style={styles.sectionTitle}>Biggest Transaction</Text>
                <View style={styles.biggestRow}>
                  <IconTile tone={biggest.type === 'income' ? 'income' : 'neutral'} size={40} radius={12}>
                    <CategoryIcon
                      icon={biggest.category?.icon}
                      size={19}
                      color={biggest.type === 'income' ? colors.incomeAccent : colors.ink}
                    />
                  </IconTile>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.biggestName}>{biggest.category?.name ?? 'Uncategorized'}</Text>
                    <Text style={styles.biggestDate}>{format(new Date(biggest.occurred_at), 'd MMM yyyy')}</Text>
                  </View>
                  <AmountText value={biggest.amount} type={biggest.type} signed size={fontSize.lg} />
                </View>
              </Card>
            )}
          </>
        )}

        {segment === 'transactions' && (
          <>
            <Card style={styles.chartCard}>
              <IncomeExpenseChart
                data={chartData}
                granularity={granularity}
                showPeriodLabel
                emptyMessage="No transactions in this period."
              />
            </Card>
            <Card style={styles.chartCard}>
              <DayOfWeekChart data={dayOfWeekData} />
            </Card>
            <Card style={styles.statsCard}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.heroLabel}>Avg. Expense</Text>
                  <AmountText value={avgExpense} type="neutral" size={fontSize.xl} />
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.heroLabel}>Transactions</Text>
                  <Text style={styles.statCount}>{current.length}</Text>
                </View>
              </View>
            </Card>
          </>
        )}

        {segment === 'categories' && (
          <>
            <View style={styles.typeToggleWrap}>
              <Pressable
                style={[styles.typeSegment, categoryType === 'expense' && styles.typeSegmentActive]}
                onPress={() => setCategoryType('expense')}
              >
                <Text style={[styles.typeSegmentText, categoryType === 'expense' && styles.typeSegmentTextActive]}>
                  Expense
                </Text>
              </Pressable>
              <Pressable
                style={[styles.typeSegment, categoryType === 'income' && styles.typeSegmentActive]}
                onPress={() => setCategoryType('income')}
              >
                <Text style={[styles.typeSegmentText, categoryType === 'income' && styles.typeSegmentTextActive]}>
                  Income
                </Text>
              </Pressable>
            </View>

            {categoryDeltas.length === 0 ? (
              <Card style={{ marginTop: spacing.md }}>
                <Text style={styles.emptyText}>No {categoryType} transactions in this period.</Text>
              </Card>
            ) : (
              <>
                <Card style={styles.chartCard}>
                  <DonutChart segments={donutSegments} total={categoryType === 'expense' ? totalExpense : totalIncome} />
                </Card>
                <Card style={styles.rankedCard}>
                  {categoryDeltas.map((entry, idx) => (
                    <View
                      key={entry.category?.id ?? 'uncategorized'}
                      style={[styles.rankedRow, idx < categoryDeltas.length - 1 && styles.rowBorder]}
                    >
                      <View
                        style={[styles.colorDot, { backgroundColor: getCategoryColor(entry.category) ?? colors.mutedLight }]}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rankedName}>{entry.category?.name ?? 'Uncategorized'}</Text>
                        <Text style={styles.rankedPct}>{entry.pct.toFixed(0)}% of total</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <AmountText value={entry.amount} type="neutral" size={fontSize.md} />
                        <DeltaBadge delta={entry.delta} goodDirection={categoryType === 'expense' ? 'down' : 'up'} />
                      </View>
                    </View>
                  ))}
                </Card>
              </>
            )}
          </>
        )}

        {segment === 'budgets' && (
          <>
            {budgets.length === 0 ? (
              <Card style={{ marginTop: spacing.lg }}>
                <Text style={styles.emptyText}>No budgets yet.</Text>
              </Card>
            ) : (
              budgets.map((budget) => {
                const periods = computeBudgetPeriods(budget, current, from, to);
                if (periods.length === 0) return null;
                const isConsistent = computeConsistencyFlag(periods);

                return (
                  <Card key={budget.id} style={styles.budgetCard}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.budgetName}>{budget.name}</Text>
                      {isConsistent && <Pill label="Frequently over" tone="danger" />}
                    </View>
                    {periods.map((p) => {
                      const progress = p.limit > 0 ? p.spent / p.limit : 0;
                      const periodLabel =
                        budget.period === 'month'
                          ? format(p.periodStart, 'MMMM yyyy')
                          : `${format(p.periodStart, 'd MMM')} – ${format(p.periodEnd, 'd MMM')}`;
                      return (
                        <View key={p.periodStart.toISOString()} style={styles.periodRow}>
                          <View style={styles.rowBetween}>
                            <Text style={styles.periodLabel}>{periodLabel}</Text>
                            <Text style={[styles.periodAmount, { color: STATUS_COLOR[p.status] }]}>
                              ₹{Math.round(p.spent).toLocaleString('en-IN')} / ₹{Math.round(p.limit).toLocaleString('en-IN')}
                            </Text>
                          </View>
                          <View style={{ marginTop: 6 }}>
                            <ProgressBar progress={progress} status={p.status} />
                          </View>
                        </View>
                      );
                    })}
                  </Card>
                );
              })
            )}
          </>
        )}

        {segment === 'plans' && (
          <>
            {plans.length === 0 ? (
              <Card style={{ marginTop: spacing.lg }}>
                <Text style={styles.emptyText}>No plans yet.</Text>
              </Card>
            ) : (
              plans.map((plan) => {
                const hasTarget = plan.target_amount != null;
                const progress = hasTarget && plan.target_amount > 0 ? plan.total_spent / plan.target_amount : 0;
                const rangeSpent = computeRangeSpentByPlan(plan, current);
                const pace = computePlanPace(plan);

                return (
                  <Card key={plan.id} style={styles.budgetCard}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.budgetName}>{plan.name}</Text>
                      {pace && <Pill label={PACE_LABEL[pace]} tone={PACE_TONE[pace]} />}
                    </View>
                    {hasTarget && (
                      <View style={{ marginTop: spacing.md }}>
                        <ProgressBar progress={progress} status="healthy" />
                        <View style={[styles.rowBetween, { marginTop: 6 }]}>
                          <Text style={styles.periodLabel}>{Math.round(progress * 100)}% of target</Text>
                          <Text style={styles.periodLabel}>
                            ₹{Math.round(plan.total_spent).toLocaleString('en-IN')} / ₹
                            {Math.round(plan.target_amount).toLocaleString('en-IN')}
                          </Text>
                        </View>
                      </View>
                    )}
                    <View style={styles.planRangeRow}>
                      <Text style={styles.periodLabel}>Spent in this period</Text>
                      <AmountText value={rangeSpent} type="neutral" size={fontSize.md} />
                    </View>
                  </Card>
                );
              })
            )}
          </>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
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
  headerTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.title,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  headerSubtitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginTop: 1,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 60,
  },
  heroCard: {
    marginBottom: spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroItem: {
    flex: 1,
    gap: 4,
  },
  heroLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  deltaText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
  },
  deltaFlat: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: colors.mutedLight,
  },
  deltaNew: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: colors.mutedLight,
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  savingsLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.mutedMid,
  },
  savingsValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  chartCard: {
    marginBottom: spacing.md,
  },
  biggestCard: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginBottom: spacing.md,
  },
  biggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  biggestName: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  biggestDate: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.mutedMid,
    marginTop: 1,
  },
  emptyText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.muted,
    textAlign: 'center',
  },
  statsCard: {
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    gap: 4,
  },
  statCount: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: colors.ink,
    letterSpacing: -0.4,
  },
  typeToggleWrap: {
    flexDirection: 'row',
    backgroundColor: colors.chipBg,
    borderRadius: 14,
    padding: 4,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
    minWidth: 200,
  },
  typeSegment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
    borderRadius: 11,
  },
  typeSegmentActive: {
    backgroundColor: colors.ink,
  },
  typeSegmentText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: colors.muted,
  },
  typeSegmentTextActive: {
    fontFamily: fontFamily.extrabold,
    color: colors.surface,
  },
  rankedCard: {
    padding: 0,
    paddingHorizontal: spacing.lg,
  },
  rankedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: radii.pill,
  },
  rankedName: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  rankedPct: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.mutedMid,
    marginTop: 1,
  },
  budgetCard: {
    marginBottom: spacing.md,
  },
  budgetName: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  periodRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  periodLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
  },
  periodAmount: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
  },
  planRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
});
