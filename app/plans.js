import { useMemo } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { Flag, Check } from 'lucide-react-native';
import { format } from 'date-fns';
import ScreenHeader, { LargeTitle, useHeaderScroll } from '../components/ledger/ScreenHeader';
import SectionHeader from '../components/ledger/SectionHeader';
import ListRow from '../components/ledger/ListRow';
import ProgressBar from '../components/ledger/ProgressBar';
import PinnedFooter, { PINNED_FOOTER_HEIGHT } from '../components/ledger/PinnedFooter';
import EmptyState from '../components/ledger/EmptyState';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, inter } from '../theme/ledger';
import usePlans from '../hooks/usePlans';
import useCollectingPlan from '../hooks/useCollectingPlan';
import { useAddPlanSheet } from '../components/AddPlanSheet';
import { supabase } from '../lib/supabase';
import useEntitlement from '../hooks/useEntitlement';
import { useProUpsellSheet } from '../components/ProUpsellSheet';
import { FREE_LIMITS } from '../lib/pro';
import { formatMoney } from '../lib/currency';
import useCurrency from '../hooks/useCurrency';
import { FLAGS } from '../lib/flags';

function dateRangeLabel(plan) {
  if (!plan.start_date && !plan.end_date) return null;
  if (plan.start_date && plan.end_date) {
    return `${format(new Date(plan.start_date), 'MMM d')} – ${format(new Date(plan.end_date), 'd')}`;
  }
  return format(new Date(plan.start_date ?? plan.end_date), 'MMM d, yyyy');
}

// Plans flagged off (lib/flags.js): a deep link here lands on Home.
export default function Plans() {
  if (!FLAGS.plans) return <Redirect href="/" />;
  return <PlansScreen />;
}

// Plans on the ledger kit (spec 48, ticket 10), still behind FLAGS.plans: the
// Budgets pattern. Active plans as rows (a ProgressBar under those with a
// target), then a muted Done group. New plan is pinned, gated as before.
function PlansScreen() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { scrollY, onScroll } = useHeaderScroll();
  const router = useRouter();
  const { plans, loading } = usePlans();
  const { plan: collectingPlan } = useCollectingPlan();
  const { openAddPlan } = useAddPlanSheet();
  const { hasPro } = useEntitlement();
  const { openProUpsell } = useProUpsellSheet();
  const currency = useCurrency();

  async function handleNewPlan() {
    if (!hasPro) {
      const { count } = await supabase.from('plans').select('id', { count: 'exact', head: true });
      if ((count ?? 0) >= FREE_LIMITS.plans) {
        openProUpsell('Free includes 1 plan');
        return;
      }
    }
    openAddPlan();
  }

  const active = plans.filter((p) => p.status !== 'completed');
  const done = plans.filter((p) => p.status === 'completed');

  function row(plan, i, list) {
    const completed = plan.status === 'completed';
    const hasTarget = plan.target_amount != null;
    const dateLabel = dateRangeLabel(plan);
    const collecting = plan.id === collectingPlan?.id;
    const sub = [completed ? 'Completed' : collecting ? 'Collecting' : hasTarget ? null : 'No target', dateLabel].filter(Boolean).join(' · ');
    return (
      <ListRow
        key={plan.id}
        icon={completed ? Check : Flag}
        title={plan.name}
        sub={sub || undefined}
        right={<Text style={[styles.money, completed && { color: c.muted }]}>{formatMoney(plan.total_spent, currency)}</Text>}
        rightSub={hasTarget ? (completed ? `of ${formatMoney(plan.target_amount, currency)}` : `${formatMoney(plan.remaining, currency)} left`) : undefined}
        trailing="chevron"
        onPress={() => router.push(`/plan/${plan.id}`)}
        divider={i < list.length - 1}
      >
        {hasTarget && !completed && (
          <ProgressBar value={plan.target_amount > 0 ? plan.total_spent / plan.target_amount : 0} accessibilityLabel={`${plan.name} plan`} />
        )}
      </ListRow>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Plans" scrollY={scrollY} />
      <Animated.ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <LargeTitle title="Plans" scrollY={scrollY} />
        {loading ? (
          [0, 1].map((i) => <View key={i} style={styles.rowSkeleton} />)
        ) : plans.length === 0 ? (
          <EmptyState illustration="calendar" title="No plans yet" body="Group the spending for a trip or an event and see it add up." actionTitle="New plan" onAction={handleNewPlan} />
        ) : (
          <>
            {active.map((p, i, list) => row(p, i, list))}
            {done.length > 0 && (
              <View style={styles.group}>
                <SectionHeader title="Done" titleColor={c.muted} />
                {done.map((p, i, list) => row(p, i, list))}
              </View>
            )}
          </>
        )}
      </Animated.ScrollView>

      <PinnedFooter primary={{ title: 'New plan', onPress: handleNewPlan }} />
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
    scroll: {
      paddingHorizontal: ledgerSpace.gutter,
      paddingBottom: PINNED_FOOTER_HEIGHT + ledgerSpace.section,
    },
    group: {
      marginTop: ledgerSpace.lg,
    },
    money: {
      ...ledgerType.rowTitle,
      fontFamily: inter.semibold,
      fontVariant: ['tabular-nums'],
      color: c.ink,
    },
    rowSkeleton: {
      height: 64,
      borderRadius: ledgerRadius.input,
      backgroundColor: c.surfaceSunk,
      marginTop: ledgerSpace.md,
    },
  });
}
