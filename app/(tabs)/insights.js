import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { TrendingUp, TrendingDown, Download, Crown } from 'lucide-react-native';
import { subDays, differenceInCalendarDays, isAfter, format } from 'date-fns';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import IconTile from '../../components/IconTile';
import AmountText from '../../components/AmountText';
import CategoryIcon from '../../components/CategoryIcon';
import Pill from '../../components/Pill';
import ProgressBar from '../../components/ProgressBar';
import ProBadge from '../../components/ProBadge';
import InsightsPeriodControl, { periodBounds } from '../../components/InsightsPeriodControl';
import IncomeExpenseChart from '../../components/IncomeExpenseChart';
import DonutChart from '../../components/DonutChart';
import CategoryBreakdownAccordion from '../../components/CategoryBreakdownAccordion';
import Skeleton from '../../components/Skeleton';
import FadeIn from '../../components/FadeIn';
import { useToast } from '../../components/Toast';
import { useProUpsellSheet } from '../../components/ProUpsellSheet';
// Static palette (theme/tokens) only for danger/warn, which are the same in both modes.
import { colors as staticColors, fontFamily, fontSize, spacing, radii, hitTarget } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import useAnalyticsData from '../../hooks/useAnalyticsData';
import useEntitlement from '../../hooks/useEntitlement';
import usePullToRefresh from '../../hooks/usePullToRefresh';
import { useAddTransactionSheet } from '../../components/AddTransactionSheet';
import { useAccount } from '../../lib/AccountContext';
import { buildTransactionsCsv, shareCsv } from '../../lib/export';
import { formatMoney } from '../../lib/currency';
import { track } from '../../lib/track';
import EmptyState from '../../components/EmptyState';
import {
  computeTrend,
  computeDelta,
  computeSavingsRate,
  computeBiggestTransaction,
  computeCategoryBreakdown,
  computeCategoryDeltas,
  getCategoryColor,
  computeBudgetPeriods,
  computeConsistencyFlag,
} from '../../lib/analytics';

const ALL = 'all';

function sumByType(transactions, type) {
  return transactions.filter((tx) => tx.type === type).reduce((sum, tx) => sum + tx.amount, 0);
}

function DeltaBadge({ delta, goodDirection = 'up' }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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

// Insights (38-home-insights-more.md): Analytics with Reports folded in. One
// period control, then everything for that period on one scroll: the summary,
// the trend, where it went, budget progress and the biggest transaction.
// Custom ranges, the all-accounts view and CSV are Pro (open while the
// billing flag is off — useEntitlement's hasPro).
export default function Insights() {
  const { colors } = useTheme();
  // A tab stays mounted, so count each visit, not the first mount.
  useFocusEffect(
    useCallback(() => {
      track('feature_opened', { feature: 'insights' });
    }, [])
  );
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { refreshing, onRefresh } = usePullToRefresh();
  // Healthy uses the active theme's accent, matching Budgets and ProgressBar's
  // own healthy fill (colors.brand).
  const STATUS_COLOR = { healthy: colors.brand, warn: staticColors.warn, over: staticColors.danger };
  const { activeAccountId, accounts } = useAccount();
  const { showToast } = useToast();
  const { openAdd } = useAddTransactionSheet();
  const { hasPro } = useEntitlement();
  const { openProUpsell } = useProUpsellSheet();
  const params = useLocalSearchParams();
  const [categoryType, setCategoryType] = useState('expense');
  const [mode, setMode] = useState('month');
  const [anchor, setAnchor] = useState(new Date());
  const [customFrom, setCustomFrom] = useState(subDays(new Date(), 6));
  const [customTo, setCustomTo] = useState(new Date());
  const [scope, setScope] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Home's 7-day chart opens Insights on this week (`period=week`); `at` is a
  // fresh value per tap, so a second tap still lands even if the param hasn't
  // changed.
  useEffect(() => {
    if (params.period === 'week' || params.period === 'month') {
      setMode(params.period);
      setAnchor(new Date());
    }
  }, [params.period, params.at]);

  // The scope follows the active account until the person picks another one,
  // and falls back to it if that choice stops being allowed or existing.
  const effectiveScope =
    scope && (scope === activeAccountId || (hasPro && (scope === ALL || accounts.some((a) => a.id === scope))))
      ? scope
      : activeAccountId;

  const { from, to } = useMemo(
    () => periodBounds(mode, anchor, customFrom, customTo),
    [mode, anchor, customFrom, customTo]
  );

  // Always the all-accounts fetch; the account chips are a view filter over
  // it, never a second query.
  const { current, prior, budgets, loading } = useAnalyticsData({ from, to, allAccounts: true });

  function accountFor(accountId) {
    return accounts.find((a) => a.id === accountId) ?? null;
  }

  const scopedCurrent = useMemo(
    () => (effectiveScope === ALL ? current : current.filter((tx) => tx.account_id === effectiveScope)),
    [current, effectiveScope]
  );
  const scopedPrior = useMemo(
    () => (effectiveScope === ALL ? prior : prior.filter((tx) => tx.account_id === effectiveScope)),
    [prior, effectiveScope]
  );
  const scopedBudgets = useMemo(
    () => (effectiveScope === ALL ? budgets : budgets.filter((b) => b.account_id === effectiveScope)),
    [budgets, effectiveScope]
  );

  // Summing ₹ and $ is meaningless, so in the all-accounts view with accounts
  // in more than one currency, the SUMS narrow to the active account's
  // currency (15-currency-going-global.md §The all-accounts edge). Budget rows
  // each render in their own account's currency and aren't summed.
  const isMultiCurrency = useMemo(() => new Set(accounts.map((a) => a.currency ?? 'INR')).size > 1, [accounts]);
  const scopeCurrency =
    effectiveScope === ALL ? (accountFor(activeAccountId)?.currency ?? 'INR') : (accountFor(effectiveScope)?.currency ?? 'INR');
  const narrowCurrency = effectiveScope === ALL && isMultiCurrency;
  const sumCurrent = useMemo(
    () => (narrowCurrency ? scopedCurrent.filter((tx) => (accountFor(tx.account_id)?.currency ?? 'INR') === scopeCurrency) : scopedCurrent),
    [scopedCurrent, narrowCurrency, scopeCurrency, accounts]
  );
  const sumPrior = useMemo(
    () => (narrowCurrency ? scopedPrior.filter((tx) => (accountFor(tx.account_id)?.currency ?? 'INR') === scopeCurrency) : scopedPrior),
    [scopedPrior, narrowCurrency, scopeCurrency, accounts]
  );

  function handleModeChange(next) {
    if (next === 'custom' && !hasPro) {
      openProUpsell('Custom ranges are a Pro feature');
      return;
    }
    setMode(next);
  }

  function handleScopeSelect(id) {
    if (!hasPro && id !== activeAccountId) {
      openProUpsell('Full reports are a Pro feature');
      return;
    }
    setScope(id);
  }

  // Export follows the scope on screen: all accounts, or just the one chosen.
  async function handleExport() {
    if (!hasPro) {
      openProUpsell('CSV export is a Pro feature');
      return;
    }
    setExporting(true);
    try {
      const csv = buildTransactionsCsv(scopedCurrent, accounts);
      const filename = `flo-insights-${format(from, 'yyyy-MM-dd')}_${format(to, 'yyyy-MM-dd')}.csv`;
      const result = await shareCsv(filename, csv);
      if (result.unsupported) {
        showToast({ message: 'Sharing is not available on this device', variant: 'error' });
      }
    } catch (err) {
      showToast({ message: 'Export failed', variant: 'error' });
    } finally {
      setExporting(false);
    }
  }

  const totalIncome = useMemo(() => sumByType(sumCurrent, 'income'), [sumCurrent]);
  const totalExpense = useMemo(() => sumByType(sumCurrent, 'expense'), [sumCurrent]);
  const netSaved = totalIncome - totalExpense;

  const priorIncome = useMemo(() => sumByType(sumPrior, 'income'), [sumPrior]);
  const priorExpense = useMemo(() => sumByType(sumPrior, 'expense'), [sumPrior]);

  const incomeDelta = computeDelta(totalIncome, priorIncome);
  const expenseDelta = computeDelta(totalExpense, priorExpense);
  const netDelta = computeDelta(netSaved, priorIncome - priorExpense);
  const savingsRate = computeSavingsRate(totalIncome, totalExpense);
  const biggest = computeBiggestTransaction(sumCurrent);

  // The trend ends at today for a period still in progress, so the current
  // week or month doesn't trail empty future-day bars. Only the chart is
  // clamped; totals, the prior period and export use the full period.
  const chartEnd = useMemo(() => {
    const now = new Date();
    return isAfter(to, now) ? now : to;
  }, [to]);
  const granularity = differenceInCalendarDays(chartEnd, from) + 1 <= 31 ? 'day' : 'week';
  const chartData = useMemo(
    () =>
      computeTrend(sumCurrent, from, chartEnd).map((b) => ({ date: b.bucketStart, income: b.income, expense: b.expense })),
    [sumCurrent, from, chartEnd]
  );

  const categoryBreakdown = useMemo(() => computeCategoryBreakdown(sumCurrent, categoryType), [sumCurrent, categoryType]);
  const categoryDeltas = useMemo(
    () => computeCategoryDeltas(categoryBreakdown, sumPrior, categoryType),
    [categoryBreakdown, sumPrior, categoryType]
  );
  const donutSegments = useMemo(
    () =>
      categoryDeltas.map((entry) => ({
        pct: entry.pct,
        color: getCategoryColor(entry.category) ?? colors.mutedLight,
      })),
    [categoryDeltas]
  );

  const budgetRows = scopedBudgets
    // A budget belongs to one account, so only that account's spending counts
    // toward it, even in the all-accounts view.
    .map((budget) => ({
      budget,
      periods: computeBudgetPeriods(budget, scopedCurrent.filter((tx) => tx.account_id === budget.account_id), from, to),
    }))
    .filter((r) => r.periods.length > 0);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { flex: 1 }]} accessibilityRole="header">
          Insights
        </Text>
        <Pressable
          style={styles.exportButton}
          onPress={handleExport}
          disabled={exporting}
          accessibilityRole="button"
          accessibilityLabel="Export CSV"
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.ink} />
          ) : (
            <Download size={18} color={colors.ink} strokeWidth={2.2} />
          )}
          {!hasPro && <ProBadge variant="overlay" size={16} />}
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandStrong} colors={[colors.brandStrong]} />}
      >
        <InsightsPeriodControl
          mode={mode}
          onModeChange={handleModeChange}
          anchor={anchor}
          onAnchorChange={setAnchor}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
          customLocked={!hasPro}
        />

        {accounts.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scopeRow} style={styles.scopeScroll}>
            {[{ id: ALL, name: 'All accounts' }, ...accounts].map((a) => (
              <Pressable
                key={a.id}
                style={styles.scopeChip}
                onPress={() => handleScopeSelect(a.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: effectiveScope === a.id }}
              >
                {!hasPro && a.id !== activeAccountId && <Crown size={11} color={colors.mutedDarker} strokeWidth={2.4} />}
                <Pill label={a.name} tone={effectiveScope === a.id ? 'dark' : 'neutral'} />
              </Pressable>
            ))}
          </ScrollView>
        )}

        {narrowCurrency && (
          <Text style={styles.note}>Totals shown in {scopeCurrency}; accounts in other currencies are excluded.</Text>
        )}

        {loading ? (
          <View style={styles.sections}>
            <Card style={styles.card}>
              <View style={styles.heroRow}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.heroItem}>
                    <Skeleton width={60} height={12} radius={6} style={{ marginBottom: 6 }} />
                    <Skeleton width={80} height={22} radius={6} />
                  </View>
                ))}
              </View>
            </Card>
            <Card style={styles.card}>
              <Skeleton height={140} radius={radii.card} />
            </Card>
          </View>
        ) : (
          <FadeIn style={styles.sections}>
            <Card style={styles.card}>
              <View style={styles.heroRow}>
                <View style={styles.heroItem}>
                  <Text style={styles.heroLabel}>Spent</Text>
                  <AmountText value={totalExpense} type="neutral" size={fontSize.xl} currency={scopeCurrency} />
                  <DeltaBadge delta={expenseDelta} goodDirection="down" />
                </View>
                <View style={styles.heroItem}>
                  <Text style={styles.heroLabel}>Received</Text>
                  <AmountText value={totalIncome} type="income" size={fontSize.xl} currency={scopeCurrency} />
                  <DeltaBadge delta={incomeDelta} goodDirection="up" />
                </View>
                <View style={styles.heroItem}>
                  <Text style={styles.heroLabel}>Net saved</Text>
                  <AmountText value={netSaved} type={netSaved < 0 ? 'danger' : 'neutral'} size={fontSize.xl} currency={scopeCurrency} />
                  <DeltaBadge delta={netDelta} goodDirection="up" />
                </View>
              </View>
              {savingsRate !== null && (
                <View style={styles.savingsRow}>
                  <Text style={styles.savingsLabel}>Savings rate</Text>
                  <Text style={styles.savingsValue}>{savingsRate.toFixed(0)}%</Text>
                </View>
              )}
            </Card>

            <Card style={styles.card}>
              <IncomeExpenseChart
                data={chartData}
                granularity={granularity}
                showPeriodLabel
                emptyMessage="No transactions in this period."
                currency={scopeCurrency}
              />
            </Card>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Where it went</Text>
              <View style={styles.typeToggleWrap}>
                {['expense', 'income'].map((t) => (
                  <Pressable
                    key={t}
                    style={[styles.typeSegment, categoryType === t && styles.typeSegmentActive]}
                    onPress={() => setCategoryType(t)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: categoryType === t }}
                  >
                    <Text style={[styles.typeSegmentText, categoryType === t && styles.typeSegmentTextActive]}>
                      {t === 'expense' ? 'Spent' : 'Received'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {categoryDeltas.length === 0 ? (
              <EmptyState
                pose="report"
                title={`Nothing ${categoryType === 'expense' ? 'spent' : 'received'} in this period`}
                body="Try another period, or log a few days first."
                style={styles.card}
              />
            ) : (
              <>
                <Card style={styles.card}>
                  <DonutChart
                    segments={donutSegments}
                    total={categoryType === 'expense' ? totalExpense : totalIncome}
                    currency={scopeCurrency}
                  />
                </Card>
                <Card style={[styles.card, styles.rankedCard]}>
                  <CategoryBreakdownAccordion
                    entries={categoryDeltas}
                    transactions={sumCurrent}
                    type={categoryType}
                    currency={scopeCurrency}
                    onPressTransaction={openAdd}
                    renderRight={(entry) => (
                      <View style={{ alignItems: 'flex-end' }}>
                        <AmountText value={entry.amount} type="neutral" size={fontSize.md} currency={scopeCurrency} />
                        <DeltaBadge delta={entry.delta} goodDirection={categoryType === 'expense' ? 'down' : 'up'} />
                      </View>
                    )}
                  />
                </Card>
              </>
            )}

            {budgetRows.length > 0 && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Budgets</Text>
                </View>
                {budgetRows.map(({ budget, periods }) => {
                  const budgetCurrency = accountFor(budget.account_id)?.currency ?? scopeCurrency;
                  return (
                    <Card key={budget.id} style={styles.card}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.budgetName}>{budget.name}</Text>
                        {computeConsistencyFlag(periods) && <Pill label="Frequently over" tone="danger" />}
                      </View>
                      {periods.map((p) => {
                        const progress = p.limit > 0 ? p.spent / p.limit : 0;
                        const periodLabel =
                          budget.period_type === 'calendar_month'
                            ? format(p.periodStart, 'MMMM yyyy')
                            : `${format(p.periodStart, 'd MMM')} – ${format(p.periodEnd, 'd MMM')}`;
                        return (
                          <View key={p.periodStart.toISOString()} style={styles.periodRow}>
                            <View style={styles.rowBetween}>
                              <Text style={styles.periodLabel}>{periodLabel}</Text>
                              <Text style={[styles.periodAmount, { color: STATUS_COLOR[p.status] }]}>
                                {formatMoney(p.spent, budgetCurrency)} / {formatMoney(p.limit, budgetCurrency)}
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
                })}
              </>
            )}

            {biggest && (
              <Card style={styles.card}>
                <Text style={styles.cardLabel}>Biggest transaction</Text>
                <View style={styles.biggestRow}>
                  <IconTile tone={biggest.type === 'income' ? 'income' : 'neutral'} size={40} radius={12}>
                    <CategoryIcon
                      icon={biggest.category?.icon}
                      size={19}
                      color={biggest.type === 'income' ? colors.incomeAccent : colors.ink}
                    />
                  </IconTile>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.biggestName}>{biggest.note || biggest.category?.name || 'Uncategorized'}</Text>
                    <Text style={styles.biggestDate}>{format(new Date(biggest.occurred_at), 'd MMM yyyy')}</Text>
                  </View>
                  <AmountText value={biggest.amount} type={biggest.type} signed size={fontSize.lg} currency={scopeCurrency} />
                </View>
              </Card>
            )}
          </FadeIn>
        )}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  exportButton: {
    width: hitTarget,
    height: hitTarget,
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
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 120,
  },
  scopeScroll: {
    marginTop: spacing.md,
    flexGrow: 0,
  },
  scopeRow: {
    gap: spacing.sm,
  },
  scopeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: hitTarget,
  },
  note: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginTop: spacing.sm,
  },
  sections: {
    marginTop: spacing.lg,
  },
  card: {
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xxl,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  cardLabel: {
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
  typeToggleWrap: {
    flexDirection: 'row',
    backgroundColor: colors.chipBg,
    borderRadius: 14,
    padding: 4,
  },
  typeSegment: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: 11,
  },
  typeSegmentActive: {
    backgroundColor: colors.ink,
  },
  typeSegmentText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
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
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  });
}
