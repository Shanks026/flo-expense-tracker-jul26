import { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import { Pencil, ListPlus, Check, RotateCcw, Inbox } from 'lucide-react-native';
import { format } from 'date-fns';
import ScreenHeader, { LargeTitle, useHeaderScroll } from '../../../components/ledger/ScreenHeader';
import SectionHeader from '../../../components/ledger/SectionHeader';
import ListRow from '../../../components/ledger/ListRow';
import AmountText from '../../../components/ledger/AmountText';
import ProgressBar from '../../../components/ledger/ProgressBar';
import PinnedFooter, { PINNED_FOOTER_HEIGHT } from '../../../components/ledger/PinnedFooter';
import CategoryIcon from '../../../components/CategoryIcon';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius } from '../../../theme/ledger';
import { usePlan } from '../../../hooks/usePlans';
import useTransactions from '../../../hooks/useTransactions';
import useCollectingPlan from '../../../hooks/useCollectingPlan';
import { useAddTransactionSheet } from '../../../components/AddTransactionSheet';
import { formatMoney } from '../../../lib/currency';
import useCurrency from '../../../hooks/useCurrency';
import { FLAGS } from '../../../lib/flags';
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

// Plans flagged off (lib/flags.js): a deep link here lands on Home.
export default function PlanDetail() {
  if (!FLAGS.plans) return <Redirect href="/" />;
  return <PlanDetailScreen />;
}

// A plan on the ledger kit (spec 48, ticket 10; still behind FLAGS.plans): the
// Budget detail pattern. A sunk band with the total (and the target's bar),
// Collecting as a switch row, where it went, the linked expenses, and Add
// expense pinned with Add from history beside it.
function PlanDetailScreen() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { scrollY, onScroll } = useHeaderScroll();
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
      <View style={styles.screen}>
        <ScreenHeader title="" />
        <View style={styles.loading}>
          <ActivityIndicator color={c.ink} />
        </View>
      </View>
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

  const dates = dateRangeLabel(plan);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={plan.name}
        scrollY={scrollY}
        actions={[{ icon: Pencil, onPress: () => openAddPlan(plan), accessibilityLabel: 'Edit plan' }]}
      />
      <Animated.ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <LargeTitle title={plan.name} scrollY={scrollY} />

        <View style={styles.band}>
          <Text style={styles.bandLabel}>Total spent</Text>
          <AmountText value={plan.total_spent} size="display" currency={currency} />
          <Text style={styles.bandSub}>
            {[isCompleted ? 'Completed' : 'Active', hasTarget ? `of ${formatMoney(plan.target_amount, currency)}` : 'No target', dates].filter(Boolean).join(' · ')}
          </Text>
          {hasTarget && (
            <>
              <ProgressBar value={progress} accessibilityLabel={`${plan.name} plan`} style={styles.bar} />
              <Text style={styles.bandSub}>
                {Math.round(progress * 100)}% of target · {formatMoney(plan.remaining, currency)} remaining
              </Text>
            </>
          )}
        </View>

        {!isCompleted && (
          <ListRow
            icon={Inbox}
            title="Collecting"
            sub="New transactions default into this plan"
            switchValue={isCollecting}
            onSwitchChange={handleToggleCollecting}
            divider={false}
          />
        )}

        {showBreakdown && (
          <>
            <SectionHeader title="Where it went" style={styles.section} />
            {categoryBreakdown.map((entry, idx) => (
              <ListRow
                key={entry.category?.id ?? 'uncategorized'}
                tone={getCategoryColor(entry.category) ?? undefined}
                renderIcon={(tint) => <CategoryIcon icon={entry.category?.icon} size={18} color={tint} strokeWidth={1.75} />}
                title={entry.category?.name ?? 'Uncategorized'}
                sub={`${entry.pct.toFixed(0)}% of total`}
                right={<AmountText value={entry.amount} currency={currency} />}
                divider={idx < categoryBreakdown.length - 1}
              />
            ))}
          </>
        )}

        <SectionHeader title="Expenses" right={<Text style={styles.count}>{transactions.length} items</Text>} style={styles.section} />
        {!isCompleted && (
          <ListRow icon={ListPlus} title="Add from history" trailing="chevron" onPress={() => router.push(`/plan/${plan.id}/history`)} divider={transactions.length > 0} />
        )}
        {transactions.length === 0 ? (
          <Text style={styles.empty}>No expenses linked yet.</Text>
        ) : (
          transactions.map((tx, idx) => (
            <ListRow
              key={tx.id}
              tone={tx.category?.color}
              renderIcon={(tint) => <CategoryIcon icon={tx.category?.icon} size={18} color={tint} strokeWidth={1.75} />}
              title={tx.category?.name ?? 'Uncategorized'}
              sub={format(new Date(tx.occurred_at), 'd MMM')}
              right={<AmountText value={tx.amount} type={tx.type} signed currency={currency} />}
              onPress={() => openAdd(tx)}
              divider={idx < transactions.length - 1}
            />
          ))
        )}

        <ListRow
          icon={isCompleted ? RotateCcw : Check}
          title={isCompleted ? 'Reactivate plan' : 'Mark as complete'}
          onPress={toggleStatus}
          divider={false}
        />
      </Animated.ScrollView>

      {!isCompleted && <PinnedFooter primary={{ title: 'Add expense', onPress: () => openAdd({ plan_id: plan.id }) }} />}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.canvas,
    },
    flex: {
      flex: 1,
    },
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: {
      paddingHorizontal: ledgerSpace.gutter,
      paddingBottom: PINNED_FOOTER_HEIGHT + ledgerSpace.section,
    },
    band: {
      backgroundColor: c.surfaceSunk,
      borderRadius: ledgerRadius.card,
      padding: ledgerSpace.lg,
      alignItems: 'center',
      gap: ledgerSpace.xs,
      marginTop: ledgerSpace.sm,
      marginBottom: ledgerSpace.md,
    },
    bandLabel: {
      ...ledgerType.caption,
      color: c.muted,
    },
    bandSub: {
      ...ledgerType.caption,
      color: c.muted,
      textAlign: 'center',
    },
    // Bars on a sunk band take a canvas track (handoff rule).
    bar: {
      alignSelf: 'stretch',
      marginTop: ledgerSpace.sm,
      backgroundColor: c.canvas,
    },
    section: {
      marginTop: ledgerSpace.section,
    },
    count: {
      ...ledgerType.caption,
      color: c.muted,
    },
    empty: {
      ...ledgerType.body,
      color: c.muted,
      marginTop: ledgerSpace.md,
    },
  });
}
