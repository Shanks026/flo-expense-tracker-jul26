import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ChevronLeft, ChevronRight, Download, Wallet, Layers, CalendarDays, Crown, Shapes } from 'lucide-react-native';
import { subDays, subWeeks, addWeeks, subMonths, addMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isAfter, isBefore, startOfDay, endOfDay, differenceInCalendarDays, format } from 'date-fns';
import { LargeTitle } from '../../components/ledger/ScreenHeader';
import HeaderIconButton from '../../components/ledger/HeaderIconButton';
import Segmented from '../../components/ledger/Segmented';
import Chip from '../../components/ledger/Chip';
import Callout from '../../components/ledger/Callout';
import SectionHeader from '../../components/ledger/SectionHeader';
import ListRow, { toneColors } from '../../components/ledger/ListRow';
import AmountText from '../../components/ledger/AmountText';
import ProgressBar from '../../components/ledger/ProgressBar';
import TransactionRow from '../../components/ledger/TransactionRow';
import SpendChart from '../../components/ledger/SpendChart';
import CategoryIcon from '../../components/CategoryIcon';
import ActivityFilterSheet from '../../components/ActivityFilterSheet';
import { useToast } from '../../components/Toast';
import { useProUpsellSheet } from '../../components/ProUpsellSheet';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, inter } from '../../theme/ledger';
import useAnalyticsData from '../../hooks/useAnalyticsData';
import useEntitlement from '../../hooks/useEntitlement';
import usePullToRefresh from '../../hooks/usePullToRefresh';
import { useAccount } from '../../lib/AccountContext';
import { buildTransactionsCsv, shareCsv } from '../../lib/export';
import { amountParts, DEFAULT_CURRENCY } from '../../lib/currency';
import { track } from '../../lib/track';
import { ymd } from '../../lib/activity';
import { spendHeadline, categoryChange, priorRange } from '../../lib/insights';
import {
  computeTrend,
  computeSavingsRate,
  computeBiggestTransaction,
  computeCategoryBreakdown,
  computeCategoryDeltas,
  computeBudgetPeriods,
  computeConsistencyFlag,
} from '../../lib/analytics';

const ALL = 'all';
// Weeks run Monday to Sunday, as budgets and the weekly recap do.
const WEEK = { weekStartsOn: 1 };

const MODES = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'custom', label: 'Custom' },
];

function periodBounds(mode, anchor, customFrom, customTo) {
  if (mode === 'week') return { from: startOfWeek(anchor, WEEK), to: endOfWeek(anchor, WEEK) };
  if (mode === 'month') return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  return { from: customFrom, to: customTo };
}

function sumByType(transactions, type) {
  return transactions.filter((tx) => tx.type === type).reduce((sum, tx) => sum + tx.amount, 0);
}

const PERIOD_NAMES = { calendar_month: 'Monthly', custom: 'Custom dates' };

// "Groceries · Monthly", without repeating a category the name already says.
function budgetSub(budget) {
  const what = budget.category_name ?? 'Overall';
  const period = PERIOD_NAMES[budget.period_type] ?? 'Weekly';
  return what.toLowerCase() === (budget.name ?? '').trim().toLowerCase() ? period : `${what} · ${period}`;
}

// Insights on the ledger kit (spec 48, ticket 01). One answer first ("You
// spent ₹X" and how that compares), then the spending line with y-axis
// numbers, where it went, the rest of the picture as three stats, budgets
// and the biggest entry. Custom ranges, other accounts and CSV are Pro (open
// while the billing flag is off: useEntitlement's hasPro).
export default function Insights() {
  const { c, modeId } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  // A tab stays mounted, so count each visit, not the first mount.
  useFocusEffect(
    useCallback(() => {
      track('feature_opened', { feature: 'insights' });
    }, [])
  );
  const { refreshing, onRefresh } = usePullToRefresh();
  const { activeAccountId, accounts } = useAccount();
  const { showToast } = useToast();
  const { hasPro } = useEntitlement();
  const { openProUpsell } = useProUpsellSheet();
  const params = useLocalSearchParams();
  const sheetRef = useRef(null);

  const [categoryType, setCategoryType] = useState('expense');
  const [mode, setMode] = useState('month');
  const [anchor, setAnchor] = useState(new Date());
  const [customFrom, setCustomFrom] = useState(subDays(new Date(), 6));
  const [customTo, setCustomTo] = useState(new Date());
  const [picking, setPicking] = useState(null); // 'from' | 'to'
  const [scope, setScope] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Home's "Last 7 days" row opens Insights on this week (`period=week`);
  // `at` is a fresh value per tap, so a second tap still lands.
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

  const { from, to } = useMemo(() => periodBounds(mode, anchor, customFrom, customTo), [mode, anchor, customFrom, customTo]);

  // Always the all-accounts fetch; the account filter is a view over it,
  // never a second query.
  const { current, prior, budgets, loading } = useAnalyticsData({ from, to, allAccounts: true });

  const accountFor = (id) => accounts.find((a) => a.id === id) ?? null;
  const scoped = (list) => (effectiveScope === ALL ? list : list.filter((tx) => tx.account_id === effectiveScope));
  const scopedCurrent = useMemo(() => scoped(current), [current, effectiveScope]);
  const scopedPrior = useMemo(() => scoped(prior), [prior, effectiveScope]);
  const scopedBudgets = useMemo(
    () => (effectiveScope === ALL ? budgets : budgets.filter((b) => b.account_id === effectiveScope)),
    [budgets, effectiveScope]
  );

  // Summing ₹ and $ is meaningless, so in the all-accounts view with accounts
  // in more than one currency, the sums narrow to the active account's
  // currency (15-currency-going-global.md). Budget rows each use their own
  // account's currency and aren't summed.
  const isMultiCurrency = useMemo(() => new Set(accounts.map((a) => a.currency ?? DEFAULT_CURRENCY)).size > 1, [accounts]);
  const scopeCurrency = accountFor(effectiveScope === ALL ? activeAccountId : effectiveScope)?.currency ?? DEFAULT_CURRENCY;
  const narrowCurrency = effectiveScope === ALL && isMultiCurrency;
  const inScopeCurrency = (list) =>
    narrowCurrency ? list.filter((tx) => (accountFor(tx.account_id)?.currency ?? DEFAULT_CURRENCY) === scopeCurrency) : list;
  const sumCurrent = useMemo(() => inScopeCurrency(scopedCurrent), [scopedCurrent, narrowCurrency, scopeCurrency, accounts]);
  const sumPrior = useMemo(() => inScopeCurrency(scopedPrior), [scopedPrior, narrowCurrency, scopeCurrency, accounts]);

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

  // Export follows what's on screen: the period, and all accounts or one.
  async function handleExport() {
    if (!hasPro) {
      openProUpsell('CSV export is a Pro feature');
      return;
    }
    if (exporting) return;
    setExporting(true);
    try {
      const csv = buildTransactionsCsv(scopedCurrent, accounts);
      const filename = `flo-insights-${format(from, 'yyyy-MM-dd')}_${format(to, 'yyyy-MM-dd')}.csv`;
      const result = await shareCsv(filename, csv);
      if (result.unsupported) showToast({ message: 'Sharing is not available on this device', variant: 'error' });
    } catch (err) {
      showToast({ message: 'Export failed', variant: 'error' });
    } finally {
      setExporting(false);
    }
  }

  const totalIncome = useMemo(() => sumByType(sumCurrent, 'income'), [sumCurrent]);
  const totalExpense = useMemo(() => sumByType(sumCurrent, 'expense'), [sumCurrent]);
  const priorExpense = useMemo(() => sumByType(sumPrior, 'expense'), [sumPrior]);
  const netSaved = totalIncome - totalExpense;
  const savingsRate = computeSavingsRate(totalIncome, totalExpense);
  const biggest = computeBiggestTransaction(sumCurrent);
  const headline = spendHeadline({ spent: totalExpense, priorSpent: priorExpense, mode, from, to, currency: scopeCurrency });

  // The chart ends at today for a period still in progress, so the current
  // week or month doesn't trail empty future days. Totals, the period before
  // and export use the full period.
  const chartEnd = useMemo(() => (isAfter(to, new Date()) ? new Date() : to), [to]);
  const bucket = differenceInCalendarDays(chartEnd, from) + 1 <= 31 ? 'day' : 'week';
  const chartPoints = useMemo(
    () => computeTrend(sumCurrent, from, chartEnd).map((b) => ({ date: b.bucketStart, amount: b.expense })),
    [sumCurrent, from, chartEnd]
  );
  // A week always shows its seven days, so the initials line up Mon–Sun;
  // days still to come carry no amount and get no line.
  const weekPoints = useMemo(
    () =>
      mode === 'week'
        ? computeTrend(sumCurrent, from, to).map((b) => ({ date: b.bucketStart, amount: isAfter(b.bucketStart, new Date()) ? null : b.expense }))
        : null,
    [mode, sumCurrent, from, to]
  );

  const categoryEntries = useMemo(() => {
    const breakdown = computeCategoryBreakdown(sumCurrent, categoryType);
    return computeCategoryDeltas(breakdown, sumPrior, categoryType);
  }, [sumCurrent, sumPrior, categoryType]);
  const topAmount = categoryEntries[0]?.amount ?? 0;

  // Budgets over the period on screen and the one before it (both fetched), so
  // "Frequently over" can see two periods. Only periods wholly inside the
  // fetched span count: a monthly budget in the Week view would otherwise
  // count one week's spending as its month.
  const priorSpan = useMemo(() => priorRange(from, to), [from, to]);
  const budgetRows = scopedBudgets
    .map((budget) => {
      // A budget belongs to one account, so only that account's spending
      // counts toward it, even in the all-accounts view.
      const txs = [...scopedPrior, ...scopedCurrent].filter((tx) => tx.account_id === budget.account_id);
      const periods = computeBudgetPeriods(budget, txs, priorSpan.from, to).filter(
        (p) => !isBefore(p.periodStart, startOfDay(priorSpan.from)) && !isAfter(p.periodEnd, endOfDay(to))
      );
      const shown = periods.filter((p) => !isBefore(p.periodStart, startOfDay(from)));
      return { budget, periods, last: shown[shown.length - 1] };
    })
    .filter((r) => r.last);

  // A category row opens Activity on that category, period and account.
  function openCategory(entry) {
    const linkParams = {
      categoryId: entry.category?.id ?? '',
      type: categoryType,
      from: ymd(from),
      to: ymd(to),
      at: String(Date.now()),
    };
    if (effectiveScope !== activeAccountId) linkParams.accountId = effectiveScope;
    router.navigate({ pathname: '/transactions', params: linkParams });
  }

  // The period stepper: no stepping into a period that hasn't started.
  const step = mode === 'week' ? { back: subWeeks, forward: addWeeks } : { back: subMonths, forward: addMonths };
  const canGoForward = !isAfter(step.forward(from, 1), new Date());
  const periodLabel = mode === 'week' ? `${format(from, 'd MMM')} – ${format(to, 'd MMM')}` : format(anchor, 'MMMM yyyy');
  const scopeLabel = effectiveScope === ALL ? 'All accounts' : accountFor(effectiveScope)?.name ?? 'Account';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.ink} colors={[c.ink]} />}
      >
        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <LargeTitle title="Insights" />
          </View>
          <HeaderIconButton icon={Download} onPress={handleExport} accessibilityLabel={exporting ? 'Exporting CSV' : 'Export CSV'} />
        </View>

        <Segmented
          options={MODES.map((m) => (m.value === 'custom' && !hasPro ? { ...m, icon: Crown } : m))}
          value={mode}
          onChange={handleModeChange}
          accessibilityLabel="Period"
          style={styles.segmented}
        />

        {mode === 'custom' ? (
          <View style={styles.customRow}>
            <Chip icon={CalendarDays} label={`From ${format(customFrom, 'd MMM')}`} onPress={() => setPicking('from')} />
            <Chip icon={CalendarDays} label={`To ${format(customTo, 'd MMM')}`} onPress={() => setPicking('to')} />
          </View>
        ) : (
          <View style={styles.stepper}>
            <StepButton icon={ChevronLeft} label="Previous period" onPress={() => setAnchor(step.back(anchor, 1))} styles={styles} c={c} />
            <Text style={styles.periodLabel}>{periodLabel}</Text>
            <StepButton
              icon={ChevronRight}
              label="Next period"
              disabled={!canGoForward}
              onPress={() => setAnchor(step.forward(anchor, 1))}
              styles={styles}
              c={c}
            />
          </View>
        )}

        {accounts.length > 1 && (
          <View style={styles.scopeRow}>
            <Chip
              icon={effectiveScope === ALL ? Layers : Wallet}
              label={scopeLabel}
              caret
              onPress={() => sheetRef.current?.present()}
              accessibilityLabel={`Account: ${scopeLabel}`}
              accessibilityHint="Opens a sheet to change it"
            />
          </View>
        )}

        {narrowCurrency && (
          <Callout tone="info" text={`Totals are in ${scopeCurrency}; accounts in other currencies are left out.`} style={styles.callout} />
        )}

        {loading ? (
          <View style={styles.block}>
            <View style={[styles.skeleton, { width: 90, height: 16 }]} />
            <View style={[styles.skeleton, { width: 180, height: 38, marginTop: ledgerSpace.sm }]} />
            <View style={[styles.skeleton, { height: 170, marginTop: ledgerSpace.section }]} />
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.skeleton, { height: 48, marginTop: ledgerSpace.md }]} />
            ))}
          </View>
        ) : (
          <>
            {/* The answer first. */}
            <View style={styles.block} accessible accessibilityLabel={[headline.lead, headline.amount, headline.comparison].filter(Boolean).join(', ')}>
              {headline.amount ? (
                <>
                  <Text style={styles.lead}>{headline.lead}</Text>
                  <AmountText value={totalExpense} size="display" currency={scopeCurrency} />
                </>
              ) : (
                <Text style={styles.leadEmpty}>{headline.lead}</Text>
              )}
              {!!headline.comparison && <Text style={styles.comparison}>{headline.comparison}</Text>}
            </View>

            {/* No chart for an empty period: the headline already says so. */}
            {totalExpense > 0 && (
              <View style={styles.block}>
                <SpendChart points={weekPoints ?? chartPoints} bucket={mode === 'week' ? 'day' : bucket} mode={mode} currency={scopeCurrency} />
              </View>
            )}

            <View style={styles.block}>
              <SectionHeader
                title="Where it went"
                right={
                  <Segmented
                    options={[
                      { value: 'expense', label: 'Spent' },
                      { value: 'income', label: 'Received' },
                    ]}
                    value={categoryType}
                    onChange={setCategoryType}
                    accessibilityLabel="Where it went: spent or received"
                    plain
                  />
                }
              />
              {categoryEntries.length === 0 ? (
                <Text style={styles.emptyLine}>Nothing {categoryType === 'expense' ? 'spent' : 'received'} in this period.</Text>
              ) : (
                categoryEntries.map((entry, i) => {
                  // The bar takes the icon's deeper shade, so a bright category
                  // colour (lime) doesn't shout.
                  const tint = toneColors(entry.category?.color, c, modeId).fg;
                  return (
                    <ListRow
                      key={entry.category?.id ?? 'uncategorized'}
                      tone={entry.category?.color}
                      renderIcon={entry.category ? (color) => <CategoryIcon icon={entry.category.icon} size={18} color={color} strokeWidth={1.75} /> : undefined}
                      icon={entry.category ? undefined : Shapes}
                      title={entry.category?.name ?? 'Uncategorized'}
                      // One line each side, like every list row: the change under
                      // the name, the share beside the amount.
                      sub={categoryChange(entry.delta, { mode, from, to })}
                      right={
                        <View style={styles.shareLine}>
                          <Text style={styles.share}>{entry.pct.toFixed(0)} %</Text>
                          <AmountText value={entry.amount} currency={scopeCurrency} />
                        </View>
                      }
                      // Activity has no "uncategorized" filter, so that row doesn't link.
                      onPress={entry.category ? () => openCategory(entry) : undefined}
                      accessibilityHint={entry.category ? 'Opens these entries in Activity' : undefined}
                      divider={i < categoryEntries.length - 1}
                    >
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { backgroundColor: tint, width: `${topAmount > 0 ? Math.max(2, (entry.amount / topAmount) * 100) : 0}%` },
                          ]}
                        />
                      </View>
                    </ListRow>
                  );
                })
              )}
            </View>

            <View style={[styles.block, styles.stats]}>
              <Stat label="Received" styles={styles}>
                <AmountText value={totalIncome} color={totalIncome > 0 ? c.positive : undefined} style={styles.statAmount} numberOfLines={1} adjustsFontSizeToFit currency={scopeCurrency} />
              </Stat>
              <Stat label="Net saved" styles={styles}>
                <AmountText value={netSaved} style={styles.statAmount} numberOfLines={1} adjustsFontSizeToFit currency={scopeCurrency} />
              </Stat>
              <Stat label="Savings rate" styles={styles}>
                <Text style={[styles.statValue, savingsRate < 0 && { color: c.danger }]}>
                  {savingsRate === null ? '—' : `${savingsRate < 0 ? '−' : ''}${Math.abs(savingsRate).toFixed(0)} %`}
                </Text>
              </Stat>
            </View>

            {budgetRows.length > 0 && (
              <View style={styles.block}>
                <SectionHeader title="Budgets" />
                {budgetRows.map(({ budget, periods, last }, i) => {
                  const left = last.limit - last.spent;
                  const currency = accountFor(budget.account_id)?.currency ?? DEFAULT_CURRENCY;
                  const often = computeConsistencyFlag(periods);
                  return (
                    <ListRow
                      key={budget.id}
                      tone={budget.category_color ?? undefined}
                      renderIcon={budget.category_id ? (color) => <CategoryIcon icon={budget.category_icon} size={18} color={color} strokeWidth={1.75} /> : undefined}
                      icon={budget.category_id ? undefined : Wallet}
                      title={budget.name}
                      sub={budgetSub(budget)}
                      right={
                        <Text style={[styles.rowMoney, left < 0 && { color: c.danger }]}>
                          {amountParts(Math.abs(left), { currency }).text} {left < 0 ? 'over' : 'left'}
                        </Text>
                      }
                      rightSub={often ? 'Frequently over' : undefined}
                      rightSubColor={c.danger}
                      onPress={() => router.push(`/budget/${budget.id}`)}
                      divider={i < budgetRows.length - 1}
                    >
                      <ProgressBar value={last.limit > 0 ? last.spent / last.limit : 0} accessibilityLabel={`${budget.name} budget`} />
                    </ListRow>
                  );
                })}
              </View>
            )}

            {biggest && (
              <View style={styles.block}>
                <SectionHeader title="Biggest entry" />
                <TransactionRow tx={biggest} accounts={accounts} divider={false} onPress={() => router.push(`/transaction/${biggest.id}`)} />
              </View>
            )}
          </>
        )}
      </ScrollView>

      {picking && (
        <DateTimePicker
          value={picking === 'from' ? customFrom : customTo}
          mode="date"
          display="default"
          minimumDate={picking === 'to' ? customFrom : undefined}
          maximumDate={picking === 'from' ? customTo : new Date()}
          onChange={(_event, selected) => {
            const which = picking;
            setPicking(null);
            if (!selected) return;
            if (which === 'from') setCustomFrom(selected);
            else setCustomTo(selected);
          }}
        />
      )}

      <ActivityFilterSheet
        ref={sheetRef}
        kind="account"
        filters={{ accountId: effectiveScope === activeAccountId ? null : effectiveScope, range: { preset: 'this_month' }, type: 'all' }}
        accounts={accounts}
        activeAccountId={activeAccountId}
        categories={[]}
        onChange={(patch) => handleScopeSelect(patch.accountId ?? activeAccountId)}
      />
    </SafeAreaView>
  );
}

function StepButton({ icon: Icon, label, onPress, disabled = false, styles, c }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      style={styles.stepButton}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Icon size={18} color={disabled ? c.hairline : c.ink} strokeWidth={1.75} />
    </Pressable>
  );
}

function Stat({ label, children, styles }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      {children}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: c.canvas,
    },
    flex: {
      flex: 1,
    },
    scroll: {
      paddingHorizontal: ledgerSpace.gutter,
      paddingTop: ledgerSpace.sm,
      paddingBottom: 120,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ledgerSpace.md,
    },
    segmented: {
      marginTop: ledgerSpace.md,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: ledgerSpace.md,
    },
    stepButton: {
      width: 40,
      height: 40,
      borderRadius: ledgerRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceSunk,
    },
    periodLabel: {
      ...ledgerType.rowTitle,
      color: c.ink,
    },
    customRow: {
      flexDirection: 'row',
      gap: ledgerSpace.sm,
      marginTop: ledgerSpace.md,
    },
    scopeRow: {
      flexDirection: 'row',
      marginTop: ledgerSpace.md,
    },
    callout: {
      marginTop: ledgerSpace.md,
    },
    block: {
      marginTop: ledgerSpace.section,
    },
    lead: {
      ...ledgerType.body,
      color: c.muted,
    },
    leadEmpty: {
      ...ledgerType.title,
      color: c.ink,
    },
    comparison: {
      ...ledgerType.body,
      color: c.muted,
      marginTop: ledgerSpace.xs,
    },
    emptyLine: {
      ...ledgerType.body,
      color: c.muted,
      marginTop: ledgerSpace.md,
    },
    shareLine: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: ledgerSpace.sm,
    },
    share: {
      ...ledgerType.caption,
      fontVariant: ['tabular-nums'],
      color: c.muted,
    },
    barTrack: {
      height: 4,
      borderRadius: ledgerRadius.full,
      backgroundColor: c.surfaceSunk,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: ledgerRadius.full,
    },
    stats: {
      flexDirection: 'row',
      gap: ledgerSpace.md,
    },
    stat: {
      flex: 1,
    },
    statLabel: {
      ...ledgerType.caption,
      color: c.muted,
      marginBottom: ledgerSpace.xs,
    },
    // 16 rather than the 20 title: three figures share one row.
    // AmountText keeps its own tone colour (income green, negative red).
    statAmount: {
      ...ledgerType.section,
      fontVariant: ['tabular-nums'],
    },
    statValue: {
      ...ledgerType.section,
      fontVariant: ['tabular-nums'],
      color: c.ink,
    },
    rowMoney: {
      ...ledgerType.rowTitle,
      fontFamily: inter.semibold,
      fontVariant: ['tabular-nums'],
      color: c.ink,
    },
    skeleton: {
      borderRadius: ledgerRadius.input,
      backgroundColor: c.surfaceSunk,
    },
  });
}
