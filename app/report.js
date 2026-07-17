import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronDown, TrendingUp, TrendingDown, Download, Crown } from 'lucide-react-native';
import { format } from 'date-fns';
import Card from '../components/Card';
import IconTile from '../components/IconTile';
import AmountText from '../components/AmountText';
import CategoryIcon from '../components/CategoryIcon';
import Pill from '../components/Pill';
import ProgressBar from '../components/ProgressBar';
import DonutChart from '../components/DonutChart';
import ReportPeriodPicker from '../components/ReportPeriodPicker';
import { useToast } from '../components/Toast';
import { colors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import useAnalyticsData from '../hooks/useAnalyticsData';
import { useAccount } from '../lib/AccountContext';
import { useAuth } from '../lib/AuthContext';
import { buildTransactionsCsv, shareCsv } from '../lib/export';
import useEntitlement from '../hooks/useEntitlement';
import { useProUpsellSheet } from '../components/ProUpsellSheet';
import ProBadge from '../components/ProBadge';
import {
  computeDelta,
  computeSavingsRate,
  computeCategoryBreakdown,
  getCategoryColor,
  computeBiggestTransaction,
  computeBudgetPeriods,
  computeRangeSpentByPlan,
  computePlanPace,
} from '../lib/analytics';
import {
  getReportSettings,
  currentReportPeriod,
  formatPeriodLabel,
  setReportSeen,
  reportPeriodPresets,
  matchPeriodPreset,
} from '../lib/reports';

const STATUS_COLOR = { healthy: colors.income, warn: colors.warn, over: colors.danger };
const PACE_LABEL = { on_track: 'On track', over_pace: 'Over pace', under_pace: 'Under pace' };
const PACE_TONE = { on_track: 'income', under_pace: 'neutral', over_pace: 'danger' };

function sumByType(transactions, type) {
  return transactions.filter((tx) => tx.type === type).reduce((sum, tx) => sum + tx.amount, 0);
}

export default function Report() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { session } = useAuth();
  const { accounts, activeAccountId } = useAccount();
  const { showToast } = useToast();
  const { isPro, loading: entitlementLoading } = useEntitlement();
  const { openProUpsell } = useProUpsellSheet();
  const userId = session?.user?.id ?? null;

  const [period, setPeriod] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  // 'all' or a specific account id — a pure client-side view filter over data
  // that's already fetched for every account (allAccounts: true below), so
  // switching tabs never triggers a new query.
  const [accountFilter, setAccountFilter] = useState('all');

  // Free is active-account-only (§ report extras) — once entitlement resolves,
  // snap a free user's scope back to their active account whenever it drifts
  // (a downgrade with an "All"/other-account scope still selected, or the
  // active account itself changing elsewhere). Gated on entitlementLoading so
  // this never fires against isPro's default-false value before the real
  // entitlement is known, which would otherwise clip a genuine Pro user's
  // "All" scope for a frame on every mount.
  useEffect(() => {
    if (entitlementLoading || isPro || !activeAccountId) return;
    if (accountFilter !== activeAccountId) setAccountFilter(activeAccountId);
  }, [entitlementLoading, isPro, activeAccountId, accountFilter]);

  function handleAccountFilterSelect(id) {
    if (!isPro && id !== activeAccountId) {
      openProUpsell('Full reports are a Pro feature');
      return;
    }
    setAccountFilter(id);
  }

  // Resolve the initial period once at open time. Route params (from the Home
  // card / a future notification tap) win if present; otherwise fall back to
  // the current cadence's default period. `params` is intentionally NOT a
  // dependency — this only ever needs to run once, against whatever this
  // screen was opened with.
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const settings = await getReportSettings();
      if (cancelled) return;
      const now = new Date();
      const defaultPeriod = currentReportPeriod(settings, now);

      let initial = defaultPeriod;
      if (params.from && params.to) {
        const from = new Date(params.from);
        const to = new Date(params.to);
        initial = { from, to, label: formatPeriodLabel(from, to) };
      }
      setPeriod(initial);

      // Only mark seen when viewing the actual current default period — not
      // an arbitrary custom/past range someone deep-linked or picked into.
      const isDefaultPeriod = initial.from.getTime() === defaultPeriod.from.getTime() && initial.to.getTime() === defaultPeriod.to.getTime();
      if (isDefaultPeriod && userId) {
        await setReportSeen(userId, now.toISOString());
      }
    }
    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { current, prior, budgets, plans, loading } = useAnalyticsData({
    from: period?.from ?? new Date(),
    to: period?.to ?? new Date(),
    allAccounts: true,
  });

  // The account tabs are a view filter over the already-fetched all-accounts
  // data — never a second query. "All" passes everything through unchanged.
  const scopedCurrent = useMemo(
    () => (accountFilter === 'all' ? current : current.filter((tx) => tx.account_id === accountFilter)),
    [current, accountFilter]
  );
  const scopedPrior = useMemo(
    () => (accountFilter === 'all' ? prior : prior.filter((tx) => tx.account_id === accountFilter)),
    [prior, accountFilter]
  );
  const scopedBudgets = useMemo(
    () => (accountFilter === 'all' ? budgets : budgets.filter((b) => b.account_id === accountFilter)),
    [budgets, accountFilter]
  );
  const scopedPlans = useMemo(
    () => (accountFilter === 'all' ? plans : plans.filter((p) => p.account_id === accountFilter)),
    [plans, accountFilter]
  );
  // Account tags on each row (name/colour dot) only add information in "All"
  // mode — once scoped to one account, every row already belongs to it.
  const showAccountTags = accountFilter === 'all';

  // Export follows the account-tab scope currently on screen — "All" exports
  // every account's transactions for the period, a specific tab exports just
  // that account's, matching what the report is actually showing.
  async function handleExport() {
    if (!isPro) {
      openProUpsell('Full reports are a Pro feature');
      return;
    }
    setExporting(true);
    try {
      const csv = buildTransactionsCsv(scopedCurrent, accounts);
      const filename = `flo-report-${format(period.from, 'yyyy-MM-dd')}_${format(period.to, 'yyyy-MM-dd')}.csv`;
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

  const totalIncome = useMemo(() => sumByType(scopedCurrent, 'income'), [scopedCurrent]);
  const totalExpense = useMemo(() => sumByType(scopedCurrent, 'expense'), [scopedCurrent]);
  const netSaved = totalIncome - totalExpense;
  const priorExpense = useMemo(() => sumByType(scopedPrior, 'expense'), [scopedPrior]);
  const expenseDelta = computeDelta(totalExpense, priorExpense);
  const savingsRate = computeSavingsRate(totalIncome, totalExpense);
  const biggest = computeBiggestTransaction(scopedCurrent);

  const categoryBreakdown = useMemo(() => computeCategoryBreakdown(scopedCurrent, 'expense'), [scopedCurrent]);
  const donutSegments = useMemo(
    () => categoryBreakdown.map((entry) => ({ pct: entry.pct, color: getCategoryColor(entry.category) ?? colors.mutedLight })),
    [categoryBreakdown]
  );
  const showBreakdown = categoryBreakdown.length >= 2;

  const presets = useMemo(() => reportPeriodPresets(new Date()), []);
  const activePreset = period ? matchPeriodPreset(period, presets) : null;
  const periodTriggerLabel = activePreset ? activePreset.label : period ? 'Custom' : '';

  function accountFor(accountId) {
    return accounts.find((a) => a.id === accountId) ?? null;
  }

  if (!period) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={styles.loadingText}>Loading report…</Text>
      </SafeAreaView>
    );
  }

  const isQuiet = !loading && scopedCurrent.length === 0 && scopedPrior.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
        </Pressable>
        <Text style={[styles.headerTitle, { flex: 1 }]}>Report</Text>
        <Pressable style={styles.backButton} onPress={handleExport} disabled={exporting}>
          {exporting ? (
            <ActivityIndicator size="small" color={colors.ink} />
          ) : (
            <Download size={18} color={colors.ink} strokeWidth={2.2} />
          )}
          {!isPro && <ProBadge variant="overlay" size={16} />}
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.dateCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dateCardLabel}>Period</Text>
            <Text style={styles.dateCardRange} numberOfLines={1}>
              {formatPeriodLabel(period.from, period.to)}
            </Text>
          </View>
          <Pressable style={styles.periodSelector} onPress={() => setPickerOpen((v) => !v)}>
            <Text style={styles.periodSelectorText}>{periodTriggerLabel}</Text>
            <ChevronDown size={16} color={colors.mutedDarker} strokeWidth={2.4} />
          </Pressable>
        </Card>

        <ReportPeriodPicker open={pickerOpen} value={period} onClose={() => setPickerOpen(false)} onChange={setPeriod} />

        {accounts.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.accountTabsRow}
            style={styles.accountTabsScroll}
          >
            <Pressable style={styles.accountTab} onPress={() => handleAccountFilterSelect('all')}>
              {!isPro && <Crown size={11} color={colors.mutedDarker} strokeWidth={2.4} />}
              <Pill label="All" tone={accountFilter === 'all' ? 'dark' : 'neutral'} />
            </Pressable>
            {accounts.map((a) => (
              <Pressable key={a.id} style={styles.accountTab} onPress={() => handleAccountFilterSelect(a.id)}>
                {!isPro && a.id !== activeAccountId && <Crown size={11} color={colors.mutedDarker} strokeWidth={2.4} />}
                <Pill label={a.name} tone={accountFilter === a.id ? 'dark' : 'neutral'} />
              </Pressable>
            ))}
          </ScrollView>
        )}

        <Card dark style={styles.headlineCard}>
          <Text style={styles.headlineLabel}>Spent this period</Text>
          <AmountText value={totalExpense} type="neutral" dark size={fontSize.amountLg} />
          <View style={styles.headlineDeltaRow}>
            {isQuiet ? (
              <Text style={styles.headlineDeltaText}>A quiet period — nothing logged</Text>
            ) : expenseDelta.direction === 'flat' || expenseDelta.pct === null ? (
              <Text style={styles.headlineDeltaText}>
                {expenseDelta.pct === null ? 'No prior period to compare' : 'Same spending as the previous period'}
              </Text>
            ) : (
              <>
                {expenseDelta.direction === 'down' ? (
                  <TrendingDown size={14} color={colors.brand} strokeWidth={2.6} />
                ) : (
                  <TrendingUp size={14} color={colors.dangerStrong} strokeWidth={2.6} />
                )}
                <Text style={styles.headlineDeltaText}>
                  You spent {Math.abs(expenseDelta.pct).toFixed(0)}% {expenseDelta.direction === 'down' ? 'less' : 'more'} than
                  the previous period
                </Text>
              </>
            )}
          </View>
        </Card>

        <Card style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Received</Text>
              <AmountText value={totalIncome} type="income" size={fontSize.xl} />
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Net</Text>
              <AmountText value={netSaved} type={netSaved < 0 ? 'danger' : 'neutral'} size={fontSize.xl} />
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Savings Rate</Text>
              <Text style={styles.statValue}>{savingsRate !== null ? `${savingsRate.toFixed(0)}%` : '—'}</Text>
            </View>
          </View>
        </Card>

        {showBreakdown && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Where it went</Text>
            </View>
            <Card style={styles.chartCard}>
              <DonutChart segments={donutSegments} total={totalExpense} />
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
                  <AmountText value={entry.amount} type="neutral" />
                </View>
              ))}
            </Card>
          </>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Budgets</Text>
        </View>
        {scopedBudgets.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>No budgets yet.</Text>
          </Card>
        ) : (
          scopedBudgets.map((budget) => {
            // Categories are global, not account-scoped — so filtering to just
            // THIS budget's account before computing its periods is required,
            // not optional. Without it, a budget in Account A would silently
            // sum Account B's spending too, whenever they share a category.
            // (A no-op when already scoped to one account via the tabs above.)
            const accountTransactions = scopedCurrent.filter((tx) => tx.account_id === budget.account_id);
            const periods = computeBudgetPeriods(budget, accountTransactions, period.from, period.to);
            if (periods.length === 0) return null;
            const acc = accountFor(budget.account_id);
            return (
              <Card key={budget.id} style={styles.budgetCard}>
                <View style={styles.rowBetween}>
                  <View style={styles.nameRow}>
                    {showAccountTags && acc && <View style={[styles.accountDot, { backgroundColor: acc.color }]} />}
                    <Text style={styles.budgetName}>{budget.name}</Text>
                  </View>
                  {showAccountTags && acc && <Text style={styles.accountTag}>{acc.name}</Text>}
                </View>
                {periods.map((p) => {
                  const progress = p.limit > 0 ? p.spent / p.limit : 0;
                  return (
                    <View key={p.periodStart.toISOString()} style={styles.periodRow}>
                      <Text style={[styles.periodAmount, { color: STATUS_COLOR[p.status] }]}>
                        ₹{Math.round(p.spent).toLocaleString('en-IN')} / ₹{Math.round(p.limit).toLocaleString('en-IN')}
                      </Text>
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

        {scopedPlans.length > 0 && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Plans</Text>
            </View>
            {scopedPlans.map((plan) => {
              const acc = accountFor(plan.account_id);
              const hasTarget = plan.target_amount != null;
              const progress = hasTarget && plan.target_amount > 0 ? plan.total_spent / plan.target_amount : 0;
              const rangeSpent = computeRangeSpentByPlan(plan, scopedCurrent);
              const pace = computePlanPace(plan);
              return (
                <Card key={plan.id} style={styles.budgetCard}>
                  <View style={styles.rowBetween}>
                    <View style={styles.nameRow}>
                      {showAccountTags && acc && <View style={[styles.accountDot, { backgroundColor: acc.color }]} />}
                      <Text style={styles.budgetName}>{plan.name}</Text>
                    </View>
                    {pace && <Pill label={PACE_LABEL[pace]} tone={PACE_TONE[pace]} />}
                  </View>
                  {showAccountTags && acc && <Text style={styles.accountTag}>{acc.name}</Text>}
                  {hasTarget && (
                    <View style={{ marginTop: spacing.md }}>
                      <ProgressBar progress={progress} status="healthy" />
                    </View>
                  )}
                  <View style={styles.planRangeRow}>
                    <Text style={styles.periodLabelMuted}>Spent in this period</Text>
                    <AmountText value={rangeSpent} type="neutral" size={fontSize.md} />
                  </View>
                </Card>
              );
            })}
          </>
        )}

        {biggest && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Biggest Transaction</Text>
            </View>
            <Card style={styles.biggestCard}>
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
                  <Text style={styles.biggestDate}>
                    {format(new Date(biggest.occurred_at), 'd MMM yyyy')}
                    {showAccountTags && accountFor(biggest.account_id) ? ` · ${accountFor(biggest.account_id).name}` : ''}
                  </Text>
                </View>
                <AmountText value={biggest.amount} type={biggest.type} signed size={fontSize.lg} />
              </View>
            </Card>
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
  loadingText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xxl,
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
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  dateCardLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.mutedMid,
  },
  dateCardRange: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    letterSpacing: -0.2,
    color: colors.ink,
    marginTop: 2,
  },
  periodSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.chipBg,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.pill,
    flexShrink: 0,
  },
  periodSelectorText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  accountTabsScroll: {
    marginHorizontal: -spacing.xl,
    marginBottom: spacing.md,
  },
  accountTabsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  accountTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 60,
  },
  headlineCard: {
    borderRadius: radii.cardLg,
    paddingVertical: 22,
    paddingHorizontal: 24,
    marginBottom: spacing.md,
  },
  headlineLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.mutedMid,
  },
  headlineDeltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  headlineDeltaText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    flexShrink: 1,
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
  statLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
  },
  statValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: colors.ink,
    letterSpacing: -0.2,
  },
  sectionHeaderRow: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  chartCard: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  breakdownCard: {
    padding: 0,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  breakdownRow: {
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
  rowMid: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  rowSub: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.mutedMid,
    marginTop: 1,
  },
  emptyCard: {
    marginBottom: spacing.md,
  },
  emptyText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.muted,
    textAlign: 'center',
  },
  budgetCard: {
    marginBottom: spacing.md,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 1,
  },
  accountDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
  },
  budgetName: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    color: colors.ink,
    flexShrink: 1,
  },
  accountTag: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: colors.mutedMid,
  },
  periodRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  periodAmount: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
  },
  periodLabelMuted: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
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
  biggestCard: {
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
});
