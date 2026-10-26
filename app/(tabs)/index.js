import { useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Receipt, ArrowLeftRight, Users, Flame, ChevronDown } from 'lucide-react-native';
import { format } from 'date-fns';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import IconTile from '../../components/IconTile';
import AmountText from '../../components/AmountText';
import CategoryIcon from '../../components/CategoryIcon';
import IncomeExpenseChart from '../../components/IncomeExpenseChart';
import Pill from '../../components/Pill';
import Skeleton from '../../components/Skeleton';
import FadeIn from '../../components/FadeIn';
import HomeHero from '../../components/HomeHero';
import TodayStrip from '../../components/TodayStrip';
import CoachMark from '../../components/CoachMark';
import useStreak from '../../hooks/useStreak';
// Static palette (theme/tokens) only for danger/warn, which are the same in both modes.
import { colors as staticColors, fontFamily, fontSize, spacing, radii, hitTarget } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../lib/AuthContext';
import useAllAccountSummaries from '../../hooks/useAllAccountSummaries';
import useTransactions from '../../hooks/useTransactions';
import useSpendingTrend from '../../hooks/useSpendingTrend';
import useProfile from '../../hooks/useProfile';
import useBills, { billStatus } from '../../hooks/useBills';
import useBudgets from '../../hooks/useBudgets';
import { formatMoney } from '../../lib/currency';
import useCurrency from '../../hooks/useCurrency';
import { useAddTransactionSheet } from '../../components/AddTransactionSheet';
import { usePayBillSheet } from '../../components/PayBillSheet';
import { useAccount } from '../../lib/AccountContext';
import { isTransfer, transferLabel } from '../../lib/transfers';
import { isSettlement, settlementLabel } from '../../lib/settlements';
import { isBudgetEnded } from '../../lib/budgets';
import { useAccountSwitcherSheet } from '../../components/AccountSwitcherSheet';
import { useAlertsSheet } from '../../components/AlertsSheet';
import useAlerts from '../../hooks/useAlerts';
import usePullToRefresh from '../../hooks/usePullToRefresh';
import { FLAGS } from '../../lib/flags';

const UPCOMING_BILL_STYLES = {
  overdue: { iconTone: 'danger', amountColor: staticColors.danger, pill: { label: 'Overdue', tone: 'danger' } },
  due_soon: { iconTone: 'warn', amountColor: staticColors.warn, pill: { label: 'Due Soon', tone: 'warn' } },
};
const MAX_UPCOMING_BILLS = 4;
const RECENT_COUNT = 5;

// The overall budget (no category) the hero reports against: one whose window
// is still open, a monthly one first since the hero speaks in months.
function heroBudget(budgets) {
  const open = budgets.filter((b) => !b.category_id && !isBudgetEnded(b));
  return open.find((b) => b.period_type === 'calendar_month') ?? open[0] ?? null;
}

export default function Home() {
  const { colors, hydrated: themeHydrated } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useAuth();
  const router = useRouter();
  const { transactions, loading: transactionsLoading } = useTransactions({ limit: RECENT_COUNT });
  const { data: trendData, loading: trendLoading } = useSpendingTrend('7d');
  const { profile } = useProfile();
  const { openAdd } = useAddTransactionSheet();
  const { activeAccount, accounts, loading: accountsLoading } = useAccount();
  const { summaries, loading: summariesLoading } = useAllAccountSummaries();
  const { budgets, loading: budgetsLoading } = useBudgets();
  const { openAccountSwitcher } = useAccountSwitcherSheet();
  const { openAlerts } = useAlertsSheet();
  const { count: alertCount } = useAlerts();
  const { bills, loading: billsLoading } = useBills();
  const { openPayBill } = usePayBillSheet();
  const { current: streakCurrent, loading: streakLoading } = useStreak();
  const streakChipRef = useRef(null);
  const currency = useCurrency();
  const { refreshing, onRefresh } = usePullToRefresh();

  // Signing out while Home is the focused screen sets `session` to null on
  // this same render pass — RootNavigator's redirect to /sign-in is a
  // separate effect that only fires afterward, so there's always at least
  // one render of Home with no session before it unmounts. Bail out, all
  // hooks already called, rather than derive from a session mid-teardown.
  if (!session) return null;

  // Lit only when there IS a streak. The muted flame on a zero streak is not a
  // failure state — it's the invitation.
  const streakLit = streakCurrent > 0;
  // Every loading gate folds in !themeHydrated too, so nothing paints a beat
  // in the default theme right before flipping to the account's real one.
  const streakChipLoading = streakLoading || !themeHydrated;
  const heroLoading = accountsLoading || summariesLoading || budgetsLoading || !themeHydrated;
  const multipleAccounts = accounts.length > 1;

  // Global (not account-scoped, per useBills) — overdue/due-soon only, the
  // same billStatus() threshold the Bills tab and DueBillsModal already use.
  // No free dismiss: a row only leaves this list when the bill is actually
  // paid or skipped. Renders nothing at all when empty.
  const upcomingBills = bills
    .filter((b) => b.is_active && ['overdue', 'due_soon'].includes(billStatus(b.next_due_date)))
    .slice(0, MAX_UPCOMING_BILLS);

  // A brand-new account gets words, not empty axes.
  const weekIsEmpty = trendData.every((d) => !d.expense && !d.income);

  function openWeekInsights() {
    router.navigate({ pathname: '/insights', params: { period: 'week', at: String(Date.now()) } });
  }

  return (
    <Screen padded={false}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandStrong} colors={[colors.brandStrong]} />}
      >
        {/* The calm header (38-home-insights-more.md): which account, or the
            month when there's only one, then the streak and the bell. */}
        <View style={styles.headerRow}>
          {multipleAccounts ? (
            <Pressable
              style={styles.switcher}
              onPress={openAccountSwitcher}
              accessibilityRole="button"
              accessibilityLabel={`${activeAccount?.name ?? 'Account'}, switch account`}
            >
              <Text style={styles.headerTitle} numberOfLines={1}>
                {activeAccount?.name}
              </Text>
              <ChevronDown size={20} color={colors.ink} strokeWidth={2.4} />
            </Pressable>
          ) : (
            <Text style={styles.headerTitle} accessibilityRole="header">
              {format(new Date(), 'MMMM')}
            </Text>
          )}
          <View style={styles.headerRight}>
            {/* The streak is a DOOR — it opens /streak, where the calendar and
                freezes live. Unlit when nothing is logged yet: that muted
                flame IS the nudge, and it costs no words. */}
            {streakChipLoading ? (
              <Skeleton width={58} height={hitTarget} radius={14} />
            ) : (
              <FadeIn>
                <Pressable
                  ref={streakChipRef}
                  style={styles.streakChip}
                  onPress={() => router.push('/streak')}
                  accessibilityRole="button"
                  accessibilityLabel={`${streakCurrent} day streak`}
                >
                  {/* Fire orange, not brand lime, so it never reads as the
                      bell's red alert dot beside it. */}
                  <Flame
                    size={20}
                    color={streakLit ? colors.streak : colors.mutedLight}
                    fill={streakLit ? colors.streak : 'transparent'}
                    strokeWidth={2.2}
                  />
                  <Text style={[styles.streakCount, !streakLit && styles.streakCountEmpty]}>{streakCurrent}</Text>
                </Pressable>
              </FadeIn>
            )}
            <Pressable
              style={styles.headerIconButton}
              onPress={openAlerts}
              accessibilityRole="button"
              accessibilityLabel={alertCount > 0 ? `Alerts, ${alertCount} new` : 'Alerts'}
            >
              <Bell size={20} color={colors.ink} strokeWidth={2} />
              {alertCount > 0 && <View style={styles.bellDot} />}
            </Pressable>
          </View>
        </View>

        <HomeHero
          spent={summaries[activeAccount?.id]?.period_expense ?? 0}
          budget={heroBudget(budgets)}
          currency={currency}
          resetPeriod={profile?.reset_period}
          loading={heroLoading}
        />

        <TodayStrip />

        {/* This week at a glance: 7 days, no range toggle. The whole card
            opens Insights on Week. */}
        <Pressable onPress={openWeekInsights} accessibilityRole="button" accessibilityLabel="This week. Open Insights">
          <Card>
            {trendLoading ? (
              <Skeleton height={140} radius={radii.card} />
            ) : weekIsEmpty ? (
              <Text style={styles.emptyText}>Log a few days to see your week</Text>
            ) : (
              <FadeIn>
                <IncomeExpenseChart
                  data={trendData}
                  range="7d"
                  defaultVisible={{ expense: true, income: false }}
                  currency={currency}
                />
              </FadeIn>
            )}
          </Card>
        </Pressable>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <Pressable onPress={() => router.push('/transactions')}>
            <Text style={styles.sectionAction}>See all</Text>
          </Pressable>
        </View>

        {transactionsLoading ? (
          <Card style={styles.listCard}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.row, i < 2 && styles.rowBorder]}>
                <Skeleton width={42} height={42} radius={radii.iconTile} />
                <View style={styles.rowMid}>
                  <Skeleton width="55%" height={15} radius={6} style={{ marginBottom: 6 }} />
                  <Skeleton width="35%" height={11} radius={6} />
                </View>
              </View>
            ))}
          </Card>
        ) : transactions.length === 0 ? (
          <FadeIn>
            <Card>
              <Text style={styles.emptyText}>No transactions yet. Tap + to add one.</Text>
            </Card>
          </FadeIn>
        ) : (
          <FadeIn>
            <Card style={styles.listCard}>
              {transactions.map((tx, idx) => {
                const transfer = isTransfer(tx);
                // Same substitution transfers already get — a settlement has no
                // category, and without this it fell through to "Expense".
                const settlement = isSettlement(tx);
                const categoryName = tx.category?.name ?? (tx.type === 'income' ? 'Income' : 'Expense');
                // Titled by what it was (its note), falling back to the category.
                const note = tx.note?.trim();
                return (
                  <Pressable
                    key={tx.id}
                    style={[styles.row, idx < transactions.length - 1 && styles.rowBorder]}
                    onPress={() => openAdd(tx)}
                  >
                    <IconTile tone={tx.type === 'income' ? 'income' : 'neutral'}>
                      {transfer ? (
                        <ArrowLeftRight size={20} color={colors.mutedDarker} strokeWidth={2} />
                      ) : settlement ? (
                        <Users size={20} color={colors.mutedDarker} strokeWidth={2} />
                      ) : (
                        <CategoryIcon icon={tx.category?.icon} size={20} color={tx.type === 'income' ? colors.incomeAccent : colors.ink} />
                      )}
                    </IconTile>
                    <View style={styles.rowMid}>
                      <View style={styles.rowTitleWrap}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {transfer ? transferLabel(tx, accounts) : settlement ? settlementLabel(tx) : note || categoryName}
                        </Text>
                        {FLAGS.plans && !transfer && !settlement && tx.plan?.name && (
                          <Pill label={tx.plan.name} tone="income" style={styles.planPill} />
                        )}
                      </View>
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {transfer ? 'Transfer' : settlement ? 'Settled up' : categoryName} ·{' '}
                        {format(new Date(tx.occurred_at), 'd MMM')}
                      </Text>
                    </View>
                    <AmountText value={tx.amount} type={tx.type} signed currency={currency} />
                  </Pressable>
                );
              })}
            </Card>
          </FadeIn>
        )}

        {/* Only what's due: nothing at all when no bill is overdue or due soon. */}
        {!billsLoading && upcomingBills.length > 0 && (
          <FadeIn>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Upcoming Bills</Text>
              <Pressable onPress={() => router.push('/bills')}>
                <Text style={styles.sectionAction}>See all</Text>
              </Pressable>
            </View>
            <Card style={styles.listCard}>
              {upcomingBills.map((bill, idx) => {
                const s = UPCOMING_BILL_STYLES[billStatus(bill.next_due_date)];
                return (
                  <Pressable
                    key={bill.id}
                    style={[styles.row, idx < upcomingBills.length - 1 && styles.rowBorder]}
                    onPress={() => openPayBill(bill)}
                  >
                    <IconTile tone={s.iconTone}>
                      {bill.category?.icon ? (
                        <CategoryIcon icon={bill.category.icon} size={20} color={s.amountColor} />
                      ) : (
                        <Receipt size={20} color={s.amountColor} strokeWidth={2} />
                      )}
                    </IconTile>
                    <View style={styles.rowMid}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {bill.name}
                      </Text>
                      <Text style={styles.rowSub}>Due {format(new Date(bill.next_due_date), 'd MMM')}</Text>
                    </View>
                    <View style={styles.billRowRight}>
                      <Text style={[styles.billAmount, { color: s.amountColor }]}>
                        {formatMoney(bill.amount, bill.currency)}
                      </Text>
                      <Pill label={s.pill.label} tone={s.pill.tone} />
                    </View>
                  </Pressable>
                );
              })}
            </Card>
          </FadeIn>
        )}
      </ScrollView>
      {/* After the first log (35-onboarding-v3.md), once the + mark is done:
          a lit streak means something has been logged. */}
      <CoachMark
        id="streak"
        after="add"
        targetRef={streakChipRef}
        text="That's day one. Log every day to keep your streak going."
        active={streakLit && !streakChipLoading}
      />
    </Screen>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.heading,
    letterSpacing: -0.2,
    color: colors.ink,
    flexShrink: 1,
  },
  switcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: hitTarget,
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: hitTarget,
    height: hitTarget,
  },
  streakCount: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    letterSpacing: -0.2,
    color: colors.streakDeep,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  streakCountEmpty: {
    color: colors.mutedLight,
  },
  headerIconButton: {
    width: hitTarget,
    height: hitTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sits at the bell icon's top-right corner inside the 48dp box.
  bellDot: {
    position: 'absolute',
    top: 11,
    right: 11,
    width: 11,
    height: 11,
    borderRadius: radii.pill,
    backgroundColor: colors.rose,
    // The ring matches the screen behind it (colors.bg), so no halo shows.
    borderWidth: 2,
    borderColor: colors.bg,
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
  sectionAction: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: colors.muted,
  },
  emptyText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.muted,
    textAlign: 'center',
  },
  listCard: {
    padding: 0,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 13,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  rowMid: {
    flex: 1,
    minWidth: 0,
  },
  rowTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  rowTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
    flexShrink: 1,
  },
  planPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rowSub: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginTop: 1,
  },
  billRowRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  billAmount: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    letterSpacing: -0.2,
  },
  });
}
