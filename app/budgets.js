import { useEffect, useMemo } from 'react';
import { View, Text, Animated, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Wallet } from 'lucide-react-native';
import ScreenHeader, { LargeTitle, useHeaderScroll } from '../components/ledger/ScreenHeader';
import ListRow from '../components/ledger/ListRow';
import ProgressBar from '../components/ledger/ProgressBar';
import PinnedFooter, { PINNED_FOOTER_HEIGHT } from '../components/ledger/PinnedFooter';
import EmptyState from '../components/ledger/EmptyState';
import CategoryIcon from '../components/CategoryIcon';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, inter } from '../theme/ledger';
import useBudgets from '../hooks/useBudgets';
import usePullToRefresh from '../hooks/usePullToRefresh';
import useEntitlement from '../hooks/useEntitlement';
import useCurrency from '../hooks/useCurrency';
import { useAddBudgetSheet } from '../components/AddBudgetSheet';
import { useProUpsellSheet } from '../components/ProUpsellSheet';
import { formatPeriodLabel, budgetLimitReached, BUDGET_LIMIT_MESSAGE } from '../lib/budgets';
import { budgetRowStatus } from '../lib/budgetRow';
import { track } from '../lib/track';

// Budgets on the ledger kit (spec 48, ticket 02): one flat row per budget,
// a thin bar under its name, "₹5,910 left" (or "₹104.50 over") on the right
// and the status as a coloured caption under it. A tap opens the detail;
// New budget is pinned, behind the free-plan gate as before.
export default function Budgets() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Which secondary features earn their place (38-home-insights-more.md).
  useEffect(() => {
    track('feature_opened', { feature: 'budgets' });
  }, []);
  const router = useRouter();
  const { scrollY, onScroll } = useHeaderScroll();
  const { refreshing, onRefresh } = usePullToRefresh();
  const { budgets, loading } = useBudgets();
  const { openAddBudget } = useAddBudgetSheet();
  const { hasPro } = useEntitlement();
  const { openProUpsell } = useProUpsellSheet();
  const currency = useCurrency();

  async function handleNewBudget() {
    if (await budgetLimitReached(hasPro)) {
      openProUpsell(BUDGET_LIMIT_MESSAGE);
      return;
    }
    openAddBudget();
  }

  const captionColor = { warn: c.warn, danger: c.danger, muted: c.muted };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Budgets" scrollY={scrollY} />
      <Animated.ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.ink} colors={[c.ink]} />}
      >
        <LargeTitle title="Budgets" scrollY={scrollY} />

        {loading ? (
          [0, 1, 2].map((i) => <View key={i} style={styles.rowSkeleton} />)
        ) : budgets.length === 0 ? (
          <EmptyState
            illustration="coins"
            title="No budgets yet"
            body="Set a spending limit for a week, a month or your own dates."
            actionTitle="New budget"
            onAction={handleNewBudget}
          />
        ) : (
          budgets.map((b, i) => {
            const row = budgetRowStatus(b, { currency });
            return (
              <ListRow
                key={b.id}
                tone={b.category_color ?? undefined}
                icon={b.category_id ? undefined : Wallet}
                renderIcon={b.category_id ? (tint) => <CategoryIcon icon={b.category_icon} size={18} color={tint} strokeWidth={1.75} /> : undefined}
                title={b.name}
                // The actual window `spent` is computed over ("November 2026",
                // "9 – 15 Nov"), never a vague "This week".
                sub={formatPeriodLabel(b)}
                right={<Text style={[styles.money, row.rightTone === 'danger' && { color: c.danger }]}>{row.rightText}</Text>}
                rightSub={row.caption ?? undefined}
                rightSubColor={captionColor[row.captionTone]}
                onPress={() => router.push(`/budget/${b.id}`)}
                divider={i < budgets.length - 1}
              >
                <ProgressBar value={row.ratio} accessibilityLabel={`${b.name} budget`} />
              </ListRow>
            );
          })
        )}
      </Animated.ScrollView>

      <PinnedFooter primary={{ title: 'New budget', onPress: handleNewBudget }} />
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
    money: {
      ...ledgerType.rowTitle,
      fontFamily: inter.semibold,
      fontVariant: ['tabular-nums'],
      color: c.ink,
    },
    rowSkeleton: {
      height: 72,
      borderRadius: ledgerRadius.input,
      backgroundColor: c.surfaceSunk,
      marginTop: ledgerSpace.md,
    },
  });
}
