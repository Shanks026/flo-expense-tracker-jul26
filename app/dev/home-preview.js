import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Modal, StyleSheet } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { Bell, Sparkles, Flame, Plus, ArrowLeftRight, Receipt, Users, CalendarCheck } from 'lucide-react-native';
import AmountText from '../../components/ledger/AmountText';
import ListRow from '../../components/ledger/ListRow';
import SectionHeader from '../../components/ledger/SectionHeader';
import Button from '../../components/ledger/Button';
import HeaderIconButton from '../../components/ledger/HeaderIconButton';
import QuickActions from '../../components/ledger/QuickActions';
import AccountCardCarousel from '../../components/ledger/AccountCardCarousel';
import WeekLine from '../../components/ledger/WeekLine';
import Illustration, { ILLUSTRATION_NAMES } from '../../components/ledger/Illustration';
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
import { useAccount } from '../../lib/AccountContext';
import { useAuth } from '../../lib/AuthContext';
import { useDataRefresh } from '../../lib/DataRefreshContext';
import { isTransfer, transferLabel } from '../../lib/transfers';
import { isSettlement, settlementLabel } from '../../lib/settlements';
import { markNoSpend } from '../../lib/streakMarks';
import { track } from '../../lib/track';
import { formatMoney } from '../../lib/currency';
import { getTheme } from '../../lib/cardThemes';
import { DAY_THEMES, DAY_PERIODS, GREETINGS, dayPeriod } from '../../lib/dayScenes';
import { FLAGS } from '../../lib/flags';
import { useTheme } from '../../theme/ThemeContext';
import { useLedger, upper, ledgerType, ledgerSpace, ledgerRadius, tabular } from '../../theme/ledger';
import { inter as fontFamily } from '../../theme/ledger';

// Development-only preview of the redesigned Home (docs/redesign-plan.md §2
// and §4 "Home"). It reads the same hooks as today's Home and opens the same
// sheets, but draws with the Quiet Ledger tokens and components/ledger/. The
// real Home is untouched; this screen exists so the design language can be
// judged on a device before the rebuild. Opened from Settings → Developer.
export default function HomePreviewRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <HomePreview />;
}

const BILL_WINDOW = ['overdue', 'due_soon'];
const MAX_BILLS = 2;
const RECENT_COUNT = 8;
// Preview-only card override, so each Day scene and Christmas can be compared
// without waiting for the clock or writing profiles.equipped_card_theme.
// "Equipped" is the real rule: the Day scene for now, unless a theme other
// than the free default is equipped.
const CARD_CHOICES = [
  { id: 'equipped', label: 'Equipped' },
  ...DAY_PERIODS.map((p) => ({ id: p, label: DAY_THEMES[p].name })),
  { id: 'christmas', label: 'Christmas' },
];

// The time of day, rechecked every minute so the card turns over on its own.
function useDayPeriod() {
  const [period, setPeriod] = useState(() => dayPeriod());
  useEffect(() => {
    const id = setInterval(() => setPeriod(dayPeriod()), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return period;
}

function dateGroupLabel(dayKey) {
  const d = parseISO(dayKey);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEE d MMM');
}

function HomePreview() {
  const { c } = useLedger();
  const { hydrated: themeHydrated } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();
  const currency = useCurrency();
  const { refreshing, onRefresh } = usePullToRefresh();

  const { activeAccount, accounts, setActiveAccount, loading: accountsLoading } = useAccount();
  const { summaries, loading: summariesLoading } = useAllAccountSummaries();
  const { transactions, loading: txLoading } = useTransactions({ limit: RECENT_COUNT });
  const { data: week, loading: weekLoading } = useSpendingTrend('7d');
  const { bills, loading: billsLoading } = useBills();
  const { current: streakCurrent, history, loading: streakLoading } = useStreak();
  const { equippedId, equippedTheme } = useCardThemes();
  const { count: alertCount } = useAlerts();
  const { openAdd } = useAddTransactionSheet();
  const { openPayBill } = usePayBillSheet();
  const { openAccountSwitcher } = useAccountSwitcherSheet();
  const { openAlerts } = useAlertsSheet();

  const [cardChoice, setCardChoice] = useState('equipped');
  const period = useDayPeriod();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [declaring, setDeclaring] = useState(false);

  // Same derivation as useDayState, read off the one useStreak call.
  const today = history[history.length - 1];
  const dayState = !today ? 'open' : today.logged ? 'logged' : today.type === 'nospend' ? 'nospend' : 'open';
  const todayCounts = dayState !== 'open';

  const groups = useMemo(() => {
    const out = [];
    for (const tx of transactions) {
      const key = tx.occurred_at.slice(0, 10);
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(tx);
      else out.push({ key, items: [tx] });
    }
    return out;
  }, [transactions]);

  if (!session) return null;

  const cardTheme = (() => {
    if (DAY_THEMES[cardChoice]) return DAY_THEMES[cardChoice];
    if (cardChoice === 'christmas') return getTheme('christmas');
    // Equipped: the free default (Ink) shows the Day scene for now.
    if (!FLAGS.themes || !equippedId || equippedId === 'ink') return DAY_THEMES[period];
    return equippedTheme;
  })();

  const summary = summaries[activeAccount?.id] ?? { in_hand_balance: 0, period_income: 0, period_expense: 0 };
  const heroLoading = accountsLoading || summariesLoading || !themeHydrated;
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
        // No note: the category is already the title, so it isn't repeated as the sub.
        sub={transfer ? 'Transfer' : settlement ? 'Settled up' : note ? categoryName : undefined}
        right={<AmountText value={tx.amount} type={transfer ? 'neutral' : tx.type} signed currency={currency} />}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.ink} colors={[c.ink]} />}
      >
        {/* 1. Header: a muted date, then streak, Ask FLO and the bell. */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting} accessibilityRole="header">
              {GREETINGS[period]}
            </Text>
            <Text style={styles.date}>{format(new Date(), 'EEEE, d MMMM')}</Text>
          </View>
          <View style={styles.headerRight}>
            {!streakLoading && (
              <HeaderIconButton onPress={() => router.push('/streak')} accessibilityLabel={`${streakCurrent} day streak`}>
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

        {/* 2. The signature card: art plus the account name only. */}
        <AccountCardCarousel
          accounts={accounts}
          activeAccountId={activeAccount?.id ?? null}
          onSwitchAccount={setActiveAccount}
          onOpenSwitcher={openAccountSwitcher}
          cardTheme={cardTheme}
          loading={heroLoading}
        />

        {/* The balance on the canvas, under the card. */}
        <View style={styles.balance}>
          <Text style={styles.caption}>In hand</Text>
          {heroLoading ? (
            <View style={styles.balanceSkeleton} />
          ) : (
            <AmountText
              value={summary.in_hand_balance}
              size="display"
              currency={currency}
              adjustsFontSizeToFit
              numberOfLines={1}
              minimumFontScale={0.5}
            />
          )}
          {!heroLoading && (
            <Text style={[styles.caption, tabular]}>
              {formatMoney(summary.period_income, currency)} in · {formatMoney(summary.period_expense, currency)} out this month
            </Text>
          )}
        </View>

        {/* 3. Quick actions. */}
        <QuickActions actions={quickActions} />

        {/* 4. Today prompt, only while nothing is logged today. */}
        {!streakLoading && dayState === 'open' && (
          <View style={styles.todayRow}>
            <ListRow
              icon={CalendarCheck}
              tone={c.chart}
              divider={false}
              title="Nothing logged today"
              sub="Spent nothing? Keep your streak."
              right={<Button title="No spend" variant="secondary" compact onPress={() => setConfirmOpen(true)} />}
            />
          </View>
        )}

        {/* 5. This week. */}
        <View style={styles.section}>
          {weekLoading ? <View style={styles.chartSkeleton} /> : <WeekLine data={week} currency={currency} onOpenInsights={openWeekInsights} />}
        </View>

        {/* 6. Upcoming bills: only when something is due, at most 2. */}
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

        {/* 7. Recent activity, grouped by date. */}
        <View style={styles.section}>
          <SectionHeader title="Recent activity" actionLabel="See all" onAction={() => router.push('/transactions')} />
          {txLoading ? (
            [0, 1, 2].map((i) => <View key={i} style={styles.rowSkeleton} />)
          ) : groups.length === 0 ? (
            <Text style={[styles.caption, styles.empty]}>Nothing yet. Tap Add to log your first expense.</Text>
          ) : (
            groups.map((g) => (
              <View key={g.key} style={styles.group}>
                <Text style={styles.groupLabel}>{dateGroupLabel(g.key)}</Text>
                {g.items.map((tx, i) => renderTx(tx, i === g.items.length - 1))}
              </View>
            ))
          )}
        </View>

        {/* Preview-only: compare card skins without equipping one. */}
        <View style={[styles.section, styles.previewBox]}>
          <Text style={styles.groupLabel}>{upper('Preview card (dev only)')}</Text>
          <View style={styles.choiceRow}>
            {CARD_CHOICES.map((ch) => {
              const on = cardChoice === ch.id;
              return (
                <Pressable
                  key={ch.id}
                  onPress={() => setCardChoice(ch.id)}
                  style={[styles.chip, on && { backgroundColor: c.ink, borderColor: c.ink }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.chipText, on && { color: c.inkOnInk }]}>{ch.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Preview-only (spec 46 ticket 02): every Illustration object and the
            ledger EmptyState. Moves to the kit gallery in ticket 06. */}
        <View style={[styles.section, styles.previewBox]}>
          <Text style={styles.groupLabel}>Illustration objects (dev only)</Text>
          <View style={styles.choiceRow}>
            {ILLUSTRATION_NAMES.map((n) => (
              <View key={n} style={{ alignItems: 'center', gap: 4 }}>
                <Illustration name={n} />
                <Text style={styles.chipText}>{n}</Text>
              </View>
            ))}
          </View>
          <EmptyState
            illustration="receipt"
            title="No transactions yet"
            body="Tap Add to log what you spend."
            actionTitle="Clear filters"
            onAction={() => {}}
          />
        </View>
      </ScrollView>

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
    scroll: {
      paddingHorizontal: ledgerSpace.gutter,
      paddingTop: ledgerSpace.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 48,
      marginBottom: ledgerSpace.lg,
    },
    greeting: {
      ...ledgerType.section,
      fontSize: 18,
      lineHeight: 24,
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
      fontFamily: fontFamily.semibold,
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
      height: 48,
      width: '60%',
      borderRadius: ledgerRadius.input,
      backgroundColor: c.surfaceSunk,
      marginVertical: 2,
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
    empty: {
      paddingVertical: ledgerSpace.lg,
    },
    previewBox: {
      paddingTop: ledgerSpace.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.hairline,
    },
    choiceRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ledgerSpace.sm,
      marginTop: ledgerSpace.sm,
    },
    chip: {
      height: 36,
      paddingHorizontal: 14,
      borderRadius: ledgerRadius.full,
      borderWidth: 1,
      borderColor: c.hairline,
      justifyContent: 'center',
    },
    chipText: {
      fontFamily: fontFamily.semibold,
      fontSize: 14,
      color: c.ink,
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
      ...ledgerType.rowTitle,
      fontFamily: fontFamily.bold,
      fontSize: 18,
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
