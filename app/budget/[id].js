import { useEffect, useMemo } from 'react';
import { View, Text, Animated, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pencil, Wallet, TrendingUp, Check } from 'lucide-react-native';
import ScreenHeader, { LargeTitle, useHeaderScroll } from '../../components/ledger/ScreenHeader';
import SectionHeader from '../../components/ledger/SectionHeader';
import ProgressBar from '../../components/ledger/ProgressBar';
import AmountText from '../../components/ledger/AmountText';
import Callout from '../../components/ledger/Callout';
import Button from '../../components/ledger/Button';
import TransactionRow from '../../components/ledger/TransactionRow';
import { toneColors } from '../../components/ledger/ListRow';
import CategoryIcon from '../../components/CategoryIcon';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, ledgerSize } from '../../theme/ledger';
import useBudgetDetail from '../../hooks/useBudgetDetail';
import { useAccount } from '../../lib/AccountContext';
import { formatPeriodLabel, daysLeftInPeriod, computeBudgetPace } from '../../lib/budgets';
import { budgetRowStatus } from '../../lib/budgetRow';
import { amountParts, DEFAULT_CURRENCY } from '../../lib/currency';
import { groupEntries } from '../../lib/activity';
import { dateGroupLabel } from '../../lib/dateLabels';
import { useAddTransactionSheet } from '../../components/AddTransactionSheet';
import { useAddBudgetSheet } from '../../components/AddBudgetSheet';

// Same vocabulary as computePlanPace's (00-index.md): a budget is a spending
// cap, so "ahead"/"behind" would read ambiguously.
const PACE_COPY = {
  on_track: { text: 'On track for this period', tone: 'info', icon: Check },
  over_pace: { text: 'Spending too fast to last the period', tone: 'warn', icon: TrendingUp },
  under_pace: { text: 'Comfortably under pace', tone: 'info', icon: Check },
};

// A budget on the ledger kit (spec 48, ticket 02): a sunk band leading with
// "₹2,104.50 of ₹2,000" and the bar, what's left (or over) and the days
// left, a pace callout, then the period's entries date-grouped like Home and
// Activity. An entry opens its Transaction detail; editing the budget is the
// pencil in the header.
export default function BudgetDetail() {
  const { c, modeId } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { scrollY, onScroll } = useHeaderScroll();
  const { budget, transactions, loading } = useBudgetDetail(id);
  const { accounts } = useAccount();
  const { openAdd } = useAddTransactionSheet();
  const { openAddBudget } = useAddBudgetSheet();

  // Deleting the budget from the edit sheet leaves this screen on a dead id;
  // go back rather than sit on an empty shell (same guard as Plan detail).
  useEffect(() => {
    if (!loading && !budget) router.back();
  }, [loading, budget]);

  const groups = useMemo(() => groupEntries(transactions.map((tx) => ({ key: tx.id, tx }))), [transactions]);

  if (loading || !budget) {
    return (
      <View style={styles.screen}>
        <ScreenHeader />
        <View style={styles.loading}>
          <ActivityIndicator color={c.ink} />
        </View>
      </View>
    );
  }

  const currency = accounts.find((a) => a.id === budget.account_id)?.currency ?? DEFAULT_CURRENCY;
  const row = budgetRowStatus(budget, { currency });
  const daysLeft = daysLeftInPeriod(budget);
  const pace = computeBudgetPace(budget);
  const left = budget.amount - budget.spent;
  const tint = toneColors(budget.category_color, c, modeId);
  const what = budget.category_name ?? 'Overall';

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={budget.name}
        scrollY={scrollY}
        actions={[{ icon: Pencil, onPress: () => openAddBudget(budget), accessibilityLabel: 'Edit budget' }]}
      />
      <Animated.ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <LargeTitle title={budget.name} scrollY={scrollY} />

        <View style={styles.band}>
          <View style={styles.bandTop}>
            {/* Canvas unless the category has a colour: a sunk circle would vanish on the sunk band. */}
            <View style={[styles.circle, { backgroundColor: budget.category_color ? tint.bg : c.canvas }]}>
              {budget.category_id ? (
                <CategoryIcon icon={budget.category_icon} size={18} color={tint.fg} strokeWidth={1.75} />
              ) : (
                <Wallet size={18} color={c.ink} strokeWidth={1.75} />
              )}
            </View>
            <Text style={styles.bandSub} numberOfLines={1}>
              {what === budget.name ? formatPeriodLabel(budget) : `${what} · ${formatPeriodLabel(budget)}`}
            </Text>
          </View>

          <Text
            accessibilityLabel={`${amountParts(budget.spent, { currency }).text} spent of ${amountParts(budget.amount, { currency }).text}`}
          >
            <AmountText value={budget.spent} size="display" currency={currency} color={row.rightTone === 'danger' ? c.danger : c.ink} />
            <Text style={styles.of}> of {amountParts(budget.amount, { currency }).text}</Text>
          </Text>

          {/* The usual sunk track would vanish on the sunk band; canvas shows it. */}
          <ProgressBar value={row.ratio} accessibilityLabel={`${budget.name} budget`} style={[styles.bar, { backgroundColor: c.canvas }]} />

          <View style={styles.bandFoot}>
            <Text style={[styles.left, left < 0 && { color: c.danger }]}>
              {left < 0 ? 'Over budget by ' : 'Left to spend '}
              <Text style={[styles.leftAmount, row.rightTone === 'danger' && { color: c.danger }]}>{amountParts(Math.abs(left), { currency }).text}</Text>
            </Text>
            <Text style={styles.days}>
              {row.state === 'ended' ? 'Period ended' : daysLeft === 1 ? '1 day left' : `${daysLeft} days left`}
            </Text>
          </View>
        </View>

        {pace && (
          <Callout tone={PACE_COPY[pace].tone} icon={PACE_COPY[pace].icon} text={PACE_COPY[pace].text} style={styles.callout} />
        )}

        <SectionHeader
          title="Entries"
          right={<Text style={styles.count}>{transactions.length === 1 ? '1 entry' : `${transactions.length} entries`}</Text>}
          style={styles.section}
        />

        {transactions.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nothing spent in this period yet.</Text>
            <Button
              title="Add expense"
              variant="secondary"
              compact
              onPress={() => openAdd({ type: 'expense', categoryId: budget.category_id ?? undefined, accountId: budget.account_id })}
            />
          </View>
        ) : (
          groups.map((g) => (
            <View key={g.key}>
              <Text style={styles.groupLabel}>{dateGroupLabel(g.date)}</Text>
              {g.items.map((entry, i) => (
                <TransactionRow
                  key={entry.key}
                  tx={entry.tx}
                  accounts={accounts}
                  divider={i < g.items.length - 1}
                  onPress={() => router.push(`/transaction/${entry.tx.id}`)}
                />
              ))}
            </View>
          ))
        )}
      </Animated.ScrollView>
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
      paddingBottom: ledgerSpace.section * 3,
    },
    band: {
      marginTop: ledgerSpace.md,
      padding: ledgerSpace.gutter,
      borderRadius: ledgerRadius.card,
      backgroundColor: c.surfaceSunk,
    },
    bandTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ledgerSpace.md,
      marginBottom: ledgerSpace.lg,
    },
    circle: {
      width: ledgerSize.iconCircle,
      height: ledgerSize.iconCircle,
      borderRadius: ledgerRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bandSub: {
      ...ledgerType.body,
      color: c.muted,
      flex: 1,
    },
    of: {
      ...ledgerType.body,
      fontVariant: ['tabular-nums'],
      color: c.muted,
    },
    bar: {
      marginTop: ledgerSpace.md,
    },
    bandFoot: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginTop: ledgerSpace.md,
    },
    left: {
      ...ledgerType.body,
      color: c.muted,
    },
    leftAmount: {
      ...ledgerType.rowTitle,
      fontVariant: ['tabular-nums'],
      color: c.ink,
    },
    days: {
      ...ledgerType.caption,
      color: c.muted,
    },
    callout: {
      marginTop: ledgerSpace.md,
    },
    section: {
      marginTop: ledgerSpace.section,
    },
    count: {
      ...ledgerType.caption,
      color: c.muted,
    },
    groupLabel: {
      ...ledgerType.group,
      color: c.muted,
      marginTop: ledgerSpace.md,
    },
    empty: {
      alignItems: 'flex-start',
      gap: ledgerSpace.md,
      marginTop: ledgerSpace.md,
    },
    emptyText: {
      ...ledgerType.body,
      color: c.muted,
    },
  });
}
