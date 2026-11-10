import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Modal, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, parseISO } from 'date-fns';
import { Bell, Sparkles, Flame, Plus, ArrowLeftRight, Receipt, Users, CalendarCheck } from 'lucide-react-native';
import AmountText from '../../components/ledger/AmountText';
import ListRow from '../../components/ledger/ListRow';
import SectionHeader from '../../components/ledger/SectionHeader';
import Button from '../../components/ledger/Button';
import HeaderIconButton from '../../components/ledger/HeaderIconButton';
import QuickActions from '../../components/ledger/QuickActions';
import AccountCardCarousel from '../../components/ledger/AccountCardCarousel';
import WeekLine from '../../components/ledger/WeekLine';
import EmptyState from '../../components/ledger/EmptyState';
import CategoryIcon from '../../components/CategoryIcon';
import { useToast } from '../../components/Toast';
import { useAddTransactionSheet } from '../../components/AddTransactionSheet';
import { usePayBillSheet } from '../../components/PayBillSheet';
import { useAccountSwitcherSheet } from '../../components/AccountSwitcherSheet';
import { useAlertsSheet } from '../../components/AlertsSheet';
import useAlerts from '../../hooks/useAlerts';
import useAllAccountSummaries from '../../hooks/useAllAccountSummaries';
import useTransactions from '../../hooks/useTransactions';
import useSpendingTrend from '../../hooks/useSpendingTrend';
import useBills, { billStatus } from '../../hooks/useBills';
import useStreak from '../../hooks/useStreak';
import useCardThemes from '../../hooks/useCardThemes';
import useCurrency from '../../hooks/useCurrency';
import usePullToRefresh from '../../hooks/usePullToRefresh';
import useDailyCountUp from '../../hooks/useDailyCountUp';
import { useAccount } from '../../lib/AccountContext';
import { useAuth } from '../../lib/AuthContext';
import { useDataRefresh } from '../../lib/DataRefreshContext';
import { isTransfer, transferLabel } from '../../lib/transfers';
import { isSettlement, settlementLabel } from '../../lib/settlements';
import { markNoSpend } from '../../lib/streakMarks';
import { track } from '../../lib/track';
import { formatMoney } from '../../lib/currency';
import { resolveEquippedTheme } from '../../lib/cardThemes';
import { GREETINGS, dayPeriod } from '../../lib/dayScenes';
import { dateGroupKey, dateGroupLabel } from '../../lib/dateLabels';
import { resetPeriodPhrase } from '../../lib/periods';
import { FLAGS } from '../../lib/flags';
import { useTheme } from '../../theme/ThemeContext';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, tabular, inter } from '../../theme/ledger';

// Home on the Quiet Ledger (spec 46, ticket 08), built from the composition
// tried out in the old Home preview. Order: header → account card → balance
// → quick actions → Today prompt → This week → Upcoming bills → Recent
// activity, 24 between blocks on a 20 gutter. Existing read hooks only.
const BILL_WINDOW = ['overdue', 'due_soon'];
const MAX_BILLS = 2;
const RECENT_COUNT = 8;

// The time of day, rechecked every minute so the greeting turns over.
function useDayPeriod() {
  const [period, setPeriod] = useState(() => dayPeriod());
  useEffect(() => {
    const id = setInterval(() => setPeriod(dayPeriod()), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return period;
}

export default function Home() {
  const { c } = useLedger();
  const { hydrated: themeHydrated } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { session } = useAuth();
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();
  const currency = useCurrency();
  const { refreshing, onRefresh } = usePullToRefresh();

  const { activeAccount, accounts, setActiveAccount, loading: accountsLoading } = useAccount();
  const { summaries, period: summaryPeriod, loading: summariesLoading } = useAllAccountSummaries();
  const { transactions, loading: txLoading } = useTransactions({ limit: RECENT_COUNT });
  const { data: week, loading: weekLoading } = useSpendingTrend('7d');
  const { bills, loading: billsLoading } = useBills();
  const { current: streakCurrent, history, loading: streakLoading } = useStreak();
  const { equippedTheme } = useCardThemes();
  const { count: alertCount } = useAlerts();
  const { openAdd } = useAddTransactionSheet();
  const { openPayBill } = usePayBillSheet();
  const { openAccountSwitcher } = useAccountSwitcherSheet();
  const { openAlerts } = useAlertsSheet();

  const period = useDayPeriod();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [declaring, setDeclaring] = useState(false);

  // Today's streak state off the one useStreak call.
  const today = history[history.length - 1];
  const dayState = !today ? 'open' : today.logged ? 'logged' : today.type === 'nospend' ? 'nospend' : 'open';
  const todayCounts = dayState !== 'open';

  const groups = useMemo(() => {
    const out = [];
    for (const tx of transactions) {
      const key = dateGroupKey(tx.occurred_at);
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(tx);
      else out.push({ key, date: tx.occurred_at, items: [tx] });
    }
    return out;
  }, [transactions]);

  // Every loading gate folds in !themeHydrated, so nothing paints a beat in
  // the default mode right before flipping to the account's own.
  const heroLoading = accountsLoading || summariesLoading || !themeHydrated;
  // Loaded with no row for this account means a real zero, not loading.
  const summary = summaries[activeAccount?.id] ?? { in_hand_balance: 0, period_income: 0, period_expense: 0 };
  const balance = useDailyCountUp(summary.in_hand_balance, !heroLoading);

  // Signing out with Home focused renders it once with no session before the
  // root redirect fires. All hooks are called; bail out.
  if (!session) return null;

  // Themes off: the free default, Day.
  const cardTheme = FLAGS.themes ? equippedTheme : resolveEquippedTheme('day');
  // Never a ₹0 balance while loading.
  const balanceLoading = heroLoading || balance.pending;
  // The totals cover the profile's summary period (Settings → Summary
  // period), read with them; Monthly, the default, reads "this month".
  const periodPhrase = resetPeriodPhrase(summaryPeriod.resetPeriod, summaryPeriod.customStart);
  const dueBills = bills.filter((b) => b.is_active && BILL_WINDOW.includes(billStatus(b.next_due_date)));

  const quickActions = [
    { key: 'add', label: 'Add', icon: Plus, onPress: () => openAdd() },
    accounts.length >= 2 && {
      key: 'transfer',
      label: 'Transfer',
      icon: ArrowLeftRight,
      onPress: () => openAdd({ type: 'transfer', fromAccountId: activeAccount?.id }),
    },
    FLAGS.ai && { key: 'ask', label: 'Ask FLO', icon: Sparkles, onPress: () => router.push('/assistant') },
  ].filter(Boolean);

  async function declareNoSpend() {
    setDeclaring(true);
    const { error, isNew } = await markNoSpend(format(new Date(), 'yyyy-MM-dd'));
    setDeclaring(false);
    setConfirmOpen(false);
    if (error) {
      showToast({ message: "Couldn't mark today. Try again.", variant: 'error' });
      return;
    }
    notifyChanged();
    if (isNew) track('no_spend_marked');
    showToast({ message: 'No spend today. Your streak is safe.' });
  }

  function openWeekInsights() {
    router.navigate({ pathname: '/insights', params: { period: 'week', at: String(Date.now()) } });
  }

  function renderTx(tx, isLast) {
    const transfer = isTransfer(tx);
    const settlement = isSettlement(tx);
    const categoryName = tx.category?.name ?? (tx.type === 'income' ? 'Income' : 'Expense');
    const note = tx.note?.trim();
    // No note: the category is already the title, so it isn't repeated.
    const baseSub = transfer ? 'Transfer' : settlement ? 'Settled up' : note ? categoryName : undefined;
    const plan = FLAGS.plans && !transfer && !settlement ? tx.plan?.name : null;
    return (
      <ListRow
        key={tx.id}
        divider={!isLast}
        onPress={() => openAdd(tx)}
        tone={transfer || settlement ? undefined : tx.category?.color}
        renderIcon={(tint) =>
          transfer ? (
            <ArrowLeftRight size={18} color={tint} strokeWidth={1.75} />
          ) : settlement ? (
            <Users size={18} color={tint} strokeWidth={1.75} />
          ) : (
            <CategoryIcon icon={tx.category?.icon} size={18} color={tint} strokeWidth={1.75} />
          )
        }
        title={transfer ? transferLabel(tx, accounts) : settlement ? settlementLabel(tx) : note || categoryName}
        sub={[baseSub, plan].filter(Boolean).join(' · ') || undefined}
        right={<AmountText value={tx.amount} type={transfer ? 'neutral' : tx.type} signed currency={currency} />}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.ink} colors={[c.ink]} />}
      >
        {/* 1. Greeting and date, then streak, Ask FLO and the bell. */}
        <View style={styles.header}>
          <View style={styles.flexShrink}>
            <Text style={styles.greeting} accessibilityRole="header" numberOfLines={1}>
              {GREETINGS[period]}
            </Text>
            <Text style={styles.date}>{format(new Date(), 'EEEE, d MMMM')}</Text>
          </View>
          <View style={styles.headerRight}>
            {/* The flame fills only when today already counts. */}
            {!streakLoading && (
              <HeaderIconButton
                onPress={() => router.push('/streak')}
                accessibilityLabel={`${streakCurrent} day streak${todayCounts ? '' : ', today not logged yet'}`}
              >
                <Flame
                  size={16}
                  color={todayCounts ? c.ink : c.muted}
                  fill={todayCounts ? c.streak : 'transparent'}
                  strokeWidth={1.75}
                />
                <Text style={[styles.streakCount, !todayCounts && { color: c.muted }]}>{streakCurrent}</Text>
              </HeaderIconButton>
            )}
            {FLAGS.ai && <HeaderIconButton icon={Sparkles} onPress={() => router.push('/assistant')} accessibilityLabel="Ask FLO" />}
            <HeaderIconButton
              icon={Bell}
              onPress={openAlerts}
              dot={alertCount > 0}
              accessibilityLabel={alertCount > 0 ? `Alerts, ${alertCount} new` : 'Alerts'}
            />
          </View>
        </View>

        {/* 2. The signature card: art, the account name and last 4. */}
        <AccountCardCarousel
          accounts={accounts}
          activeAccountId={activeAccount?.id ?? null}
          onSwitchAccount={setActiveAccount}
          onOpenSwitcher={openAccountSwitcher}
          cardTheme={cardTheme}
          loading={heroLoading}
        />

        {/* 3. The balance on the canvas, under the card. */}
        <View style={styles.balance}>
          <Text style={styles.caption}>In hand</Text>
          {balanceLoading ? (
            <>
              <View style={styles.balanceSkeleton} />
              <View style={styles.captionSkeleton} />
            </>
          ) : (
            <>
              <AmountText
                value={balance.value}
                size="display"
                currency={currency}
                adjustsFontSizeToFit
                numberOfLines={1}
                minimumFontScale={0.5}
              />
              <Text style={[styles.caption, tabular]}>
                {formatMoney(summary.period_income, currency)} in · {formatMoney(summary.period_expense, currency)} out {periodPhrase}
              </Text>
            </>
          )}
        </View>

        {/* 4. Quick actions. */}
        <QuickActions actions={quickActions} />

        {/* 5. Today prompt, only while nothing is logged today. */}
        {!streakLoading && dayState === 'open' && (
          <View style={styles.todayRow}>
            <ListRow
              icon={CalendarCheck}
              tone={c.accent}
              divider={false}
              title="Nothing logged today"
              sub="Spent nothing? Keep your streak."
              right={<Button title="No spend" variant="secondary" compact onPress={() => setConfirmOpen(true)} />}
            />
          </View>
        )}

        {/* 6. This week. */}
        <View style={styles.section}>
          {weekLoading ? <View style={styles.chartSkeleton} /> : <WeekLine data={week} currency={currency} onOpenInsights={openWeekInsights} />}
        </View>

        {/* 7. Upcoming bills: only when something is due, at most 2. */}
        {!billsLoading && dueBills.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Upcoming bills" actionLabel="See all" onAction={() => router.push('/bills')} />
            {dueBills.slice(0, MAX_BILLS).map((bill, i, arr) => {
              const overdue = billStatus(bill.next_due_date) === 'overdue';
              const icon = bill.category?.icon;
              return (
                <ListRow
                  key={bill.id}
                  divider={i < arr.length - 1}
                  onPress={() => openPayBill(bill)}
                  iconColor={overdue ? c.danger : undefined}
                  tone={overdue ? c.danger : bill.category?.color}
                  renderIcon={(tint) =>
                    icon ? (
                      <CategoryIcon icon={icon} size={18} color={tint} strokeWidth={1.75} />
                    ) : (
                      <Receipt size={18} color={tint} strokeWidth={1.75} />
                    )
                  }
                  title={bill.name}
                  sub={`Due ${format(parseISO(bill.next_due_date), 'd MMM')}`}
                  right={<AmountText value={bill.amount} currency={bill.currency ?? currency} />}
                  rightSub={overdue ? 'Overdue' : 'Due soon'}
                  rightSubColor={overdue ? c.danger : undefined}
                />
              );
            })}
          </View>
        )}

        {/* 8. Recent activity, grouped by date. See all opens Activity. */}
        <View style={styles.section}>
          <SectionHeader title="Recent activity" actionLabel="See all" onAction={() => router.push('/transactions')} />
          {txLoading ? (
            [0, 1, 2].map((i) => <View key={i} style={styles.rowSkeleton} />)
          ) : groups.length === 0 ? (
            <EmptyState illustration="receipt" title="No transactions yet" body="Tap Add to log what you spend." />
          ) : (
            groups.map((g) => (
              <View key={g.key} style={styles.group}>
                <Text style={styles.groupLabel}>{dateGroupLabel(g.date)}</Text>
                {g.items.map((tx, i) => renderTx(tx, i === g.items.length - 1))}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* A conscience nudge, not a gate: the mark is a deliberate act. */}
      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setConfirmOpen(false)}>
          <Pressable style={styles.dialog} onPress={() => {}}>
            <Text style={styles.dialogTitle}>No spend today</Text>
            <Text style={styles.dialogBody}>Nothing at all today, including cash?</Text>
            <View style={styles.dialogActions}>
              <Button title="Cancel" variant="secondary" onPress={() => setConfirmOpen(false)} style={styles.flex} />
              <Button title="Confirm" onPress={declareNoSpend} loading={declaring} style={styles.flex} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.canvas },
    flex: { flex: 1 },
    flexShrink: { flexShrink: 1 },
    scroll: {
      paddingHorizontal: ledgerSpace.gutter,
      paddingTop: ledgerSpace.sm,
      // Clears the tab bar's raised +.
      paddingBottom: 40,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: ledgerSpace.md,
      minHeight: 48,
      marginBottom: ledgerSpace.lg,
    },
    greeting: {
      ...ledgerType.greeting,
      color: c.ink,
    },
    date: {
      ...ledgerType.caption,
      color: c.muted,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ledgerSpace.sm,
    },
    streakCount: {
      fontFamily: inter.semibold,
      fontSize: 13,
      color: c.ink,
      ...tabular,
    },
    balance: {
      marginTop: ledgerSpace.sm,
      marginBottom: ledgerSpace.gutter,
      gap: 2,
    },
    caption: {
      ...ledgerType.caption,
      color: c.muted,
    },
    balanceSkeleton: {
      height: 38,
      width: '60%',
      borderRadius: ledgerRadius.input,
      backgroundColor: c.surfaceSunk,
      marginVertical: 2,
    },
    captionSkeleton: {
      height: 12,
      width: '45%',
      borderRadius: ledgerRadius.input,
      backgroundColor: c.surfaceSunk,
      marginTop: 4,
    },
    todayRow: {
      marginTop: ledgerSpace.md,
      paddingHorizontal: ledgerSpace.md,
      borderRadius: ledgerRadius.input,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
    },
    section: {
      marginTop: ledgerSpace.section,
    },
    chartSkeleton: {
      height: 160,
      borderRadius: ledgerRadius.input,
      backgroundColor: c.surfaceSunk,
    },
    rowSkeleton: {
      height: 48,
      borderRadius: ledgerRadius.input,
      backgroundColor: c.surfaceSunk,
      marginTop: ledgerSpace.sm,
    },
    group: {
      marginTop: ledgerSpace.sm,
    },
    groupLabel: {
      ...ledgerType.group,
      color: c.muted,
      marginTop: ledgerSpace.sm,
    },
    overlay: {
      flex: 1,
      backgroundColor: c.scrim,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: ledgerSpace.gutter,
    },
    dialog: {
      width: '100%',
      backgroundColor: c.surface,
      borderRadius: ledgerRadius.sheet,
      padding: ledgerSpace.gutter,
    },
    dialogTitle: {
      ...ledgerType.title,
      color: c.ink,
    },
    dialogBody: {
      ...ledgerType.body,
      color: c.muted,
      marginTop: ledgerSpace.sm,
    },
    dialogActions: {
      flexDirection: 'row',
      gap: ledgerSpace.sm,
      marginTop: ledgerSpace.gutter,
    },
  });
}
