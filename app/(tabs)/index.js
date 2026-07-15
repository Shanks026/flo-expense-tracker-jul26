import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Menu, ChevronRight, TrendingUp, TrendingDown, Receipt, Flame, ArrowLeftRight } from 'lucide-react-native';
import { format } from 'date-fns';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import IconTile from '../../components/IconTile';
import AmountText from '../../components/AmountText';
import CategoryIcon from '../../components/CategoryIcon';
import IncomeExpenseChart from '../../components/IncomeExpenseChart';
import Pill from '../../components/Pill';
import ReportReadyCard from '../../components/ReportReadyCard';
import Skeleton from '../../components/Skeleton';
import FadeIn from '../../components/FadeIn';
import useStreak from '../../hooks/useStreak';
import { colors, fontFamily, fontSize, spacing, radii } from '../../theme/tokens';
import { useAuth } from '../../lib/AuthContext';
import useGlobalSummary from '../../hooks/useGlobalSummary';
import useTransactions from '../../hooks/useTransactions';
import useSpendingTrend from '../../hooks/useSpendingTrend';
import useProfile from '../../hooks/useProfile';
import useBills, { billStatus } from '../../hooks/useBills';
import { useAddTransactionSheet } from '../../components/AddTransactionSheet';
import { useMenuSheet } from '../../components/MenuSheet';
import { usePayBillSheet } from '../../components/PayBillSheet';
import { useAccount } from '../../lib/AccountContext';
import { isTransfer, transferLabel } from '../../lib/transfers';
import { useAccountSwitcherSheet } from '../../components/AccountSwitcherSheet';
import { useAlertsSheet } from '../../components/AlertsSheet';
import useAlerts from '../../hooks/useAlerts';

const UPCOMING_BILL_STYLES = {
  overdue: { iconTone: 'danger', amountColor: colors.danger, pill: { label: 'Overdue', tone: 'danger' } },
  due_soon: { iconTone: 'warn', amountColor: colors.warn, pill: { label: 'Due Soon', tone: 'warn' } },
};
const MAX_UPCOMING_BILLS = 4;

function formatAmount(value) {
  const rounded = Math.round(Math.abs(value));
  return `${value < 0 ? '−' : ''}₹${rounded.toLocaleString('en-IN')}`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const { session } = useAuth();
  const router = useRouter();
  const { summary, loading: summaryLoading } = useGlobalSummary();
  const { transactions, loading: transactionsLoading } = useTransactions({ limit: 4 });
  const [trendRange, setTrendRange] = useState('7d');
  const { data: trendData, loading: trendLoading } = useSpendingTrend(trendRange);
  const { avatarUrl } = useProfile();
  const { openAdd } = useAddTransactionSheet();
  const { openMenu } = useMenuSheet();
  const { activeAccount, accounts } = useAccount();
  const { openAccountSwitcher } = useAccountSwitcherSheet();
  const { openAlerts } = useAlertsSheet();
  const { count: alertCount } = useAlerts();
  const { bills, loading: billsLoading } = useBills();
  const { openPayBill } = usePayBillSheet();
  const { current: streakCurrent, loading: streakLoading } = useStreak();

  // Lit only when there IS a streak. The muted flame on a zero streak is not a
  // failure state — it's the invitation.
  const streakLit = streakCurrent > 0;

  const firstName = session?.user?.user_metadata?.full_name?.split(' ')[0] || session?.user?.email;
  const initial = firstName?.[0]?.toUpperCase() ?? '?';

  // Global (not account-scoped, per useBills) — overdue/due-soon only, the
  // same billStatus() threshold the Bills tab and DueBillsModal already use,
  // not a new window invented for this section. No free dismiss: a row only
  // leaves this list when the underlying bill is actually paid or skipped
  // (openPayBill → notifyChanged() → useBills refetches), the same
  // computed-feed pattern the bell/AlertsSheet already uses app-wide — see
  // 05-koban-engagement.md's "reward the logging, never the numbers" note for
  // the same reasoning applied to a different surface. Renders nothing at all
  // when empty; unlike Recent Transactions, "no bills due" isn't worth
  // permanent scroll space.
  const upcomingBills = bills
    .filter((b) => b.is_active && ['overdue', 'due_soon'].includes(billStatus(b.next_due_date)))
    .slice(0, MAX_UPCOMING_BILLS);

  return (
    <Screen padded={false}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Pressable onPress={openMenu}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
              )}
            </Pressable>
            <View>
              <Text style={styles.greetingLabel}>{greeting()}</Text>
              <Text style={styles.greetingName}>Hi, {firstName}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {/* Duolingo's model: the streak lives in the header, always visible,
                and it is a DOOR — it opens /streak, where the calendar and the
                history live. Unlit when today hasn't been logged: that muted
                flame IS the nudge, and it costs no words. */}
            {!streakLoading && (
              <FadeIn>
                <Pressable style={styles.streakChip} onPress={() => router.push('/streak')}>
                  {/* Fire orange, not brand lime — see theme/tokens.js. Also the
                      one warm accent in this header that must NOT be confused with
                      the bell's red alert dot beside it, which is why it's a true
                      orange rather than a red. */}
                  <Flame
                    size={17}
                    color={streakLit ? colors.streak : colors.mutedLight}
                    fill={streakLit ? colors.streak : 'transparent'}
                    strokeWidth={2.2}
                  />
                  <Text style={[styles.streakCount, !streakLit && styles.streakCountEmpty]}>
                    {streakCurrent}
                  </Text>
                </Pressable>
              </FadeIn>
            )}
            <Pressable style={styles.bellButton} onPress={openAlerts}>
              <Bell size={20} color={colors.ink} strokeWidth={2} />
              {alertCount > 0 && <View style={styles.bellDot} />}
            </Pressable>
            <Pressable style={styles.menuButton} onPress={openMenu}>
              <Menu size={20} color={colors.ink} strokeWidth={2} />
            </Pressable>
          </View>
        </View>

        <Card dark style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.accountHeading}>
              <View style={[styles.accountDot, activeAccount && { backgroundColor: activeAccount.color }]} />
              <Text style={styles.accountName} numberOfLines={1}>
                {activeAccount?.name ?? '—'}
              </Text>
            </View>
            <Pressable style={styles.heroPill} onPress={openAccountSwitcher}>
              <Text style={styles.heroPillText}>Manage</Text>
              <ChevronRight size={12} color={colors.brand} strokeWidth={2.6} />
            </Pressable>
          </View>
          <Text style={styles.heroLabel}>In Hand</Text>
          {summaryLoading ? (
            <Skeleton width={160} height={fontSize.amountLg} radius={8} style={{ marginTop: spacing.xs, backgroundColor: colors.inkCard }} />
          ) : (
            <FadeIn>
              <AmountText
                value={summary.in_hand_balance}
                type="neutral"
                dark
                muteCurrency
                size={fontSize.amountLg}
                style={styles.heroBalance}
              />
            </FadeIn>
          )}
          {summaryLoading ? (
            <View style={styles.heroStatsRow}>
              <Skeleton width={90} height={fontSize.md} radius={6} style={{ backgroundColor: colors.inkCard }} />
              <Skeleton width={90} height={fontSize.md} radius={6} style={{ backgroundColor: colors.inkCard }} />
            </View>
          ) : (
            <FadeIn style={styles.heroStatsRow}>
              <View style={styles.heroStat}>
                <TrendingUp size={12} color={colors.income} strokeWidth={2.6} />
                <Text style={styles.heroStatValue}>{formatAmount(summary.month_income)}</Text>
                <Text style={styles.heroStatLabel}>Income</Text>
              </View>
              <View style={styles.heroStat}>
                <TrendingDown size={12} color={colors.dangerStrong} strokeWidth={2.6} />
                <Text style={styles.heroStatValue}>{formatAmount(summary.month_expense)}</Text>
                <Text style={styles.heroStatLabel}>Expenses</Text>
              </View>
            </FadeIn>
          )}
        </Card>

        <Card style={styles.chartCard}>
          {trendLoading ? (
            <Skeleton height={140} radius={radii.card} />
          ) : (
            <FadeIn>
              <IncomeExpenseChart
                data={trendData}
                range={trendRange}
                onRangeChange={setTrendRange}
                defaultVisible={{ expense: true, income: false }}
              />
            </FadeIn>
          )}
        </Card>

        <ReportReadyCard />

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
                        ₹{Math.round(bill.amount).toLocaleString('en-IN')}
                      </Text>
                      <Pill label={s.pill.label} tone={s.pill.tone} />
                    </View>
                  </Pressable>
                );
              })}
            </Card>
          </FadeIn>
        )}

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
                return (
                  <Pressable
                    key={tx.id}
                    style={[styles.row, idx < transactions.length - 1 && styles.rowBorder]}
                    onPress={() => openAdd(tx)}
                  >
                    <IconTile tone={tx.type === 'income' ? 'income' : 'neutral'}>
                      {transfer ? (
                        <ArrowLeftRight size={20} color={colors.mutedDarker} strokeWidth={2} />
                      ) : (
                        <CategoryIcon icon={tx.category?.icon} size={20} color={tx.type === 'income' ? colors.incomeAccent : colors.ink} />
                      )}
                    </IconTile>
                    <View style={styles.rowMid}>
                      <View style={styles.rowTitleWrap}>
                        <Text style={styles.rowTitle}>
                          {transfer ? transferLabel(tx, accounts) : tx.category?.name ?? 'Uncategorized'}
                        </Text>
                        {!transfer && tx.plan?.name && <Pill label={tx.plan.name} tone="income" style={styles.planPill} />}
                      </View>
                      <Text style={styles.rowSub}>
                        {format(new Date(tx.occurred_at), 'd MMM')} ·{' '}
                        {transfer ? 'Transfer' : tx.category?.name ?? (tx.type === 'income' ? 'Income' : 'Expense')}
                      </Text>
                    </View>
                    <AmountText value={tx.amount} type={tx.type} signed />
                  </Pressable>
                );
              })}
            </Card>
          </FadeIn>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 46,
    height: 46,
    borderRadius: 15,
  },
  avatarText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: colors.ink,
  },
  greetingLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.muted,
  },
  greetingName: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.heading,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  streakCount: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    letterSpacing: -0.2,
    color: colors.streakDeep,
  },
  streakCountEmpty: {
    color: colors.mutedLight,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 11,
    height: 11,
    borderRadius: radii.pill,
    backgroundColor: colors.rose,
    // The white ring is what keeps it legible against the bell's strokes at this
    // size — without it the dot merges into the icon rather than sitting on it.
    borderWidth: 2,
    borderColor: colors.surface,
  },
  heroCard: {
    borderRadius: radii.cardLg,
    paddingVertical: 22,
    paddingHorizontal: 24,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  accountHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 1,
    paddingRight: spacing.sm,
  },
  accountDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.mutedLight,
  },
  accountName: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg,
    letterSpacing: -0.1,
    color: colors.surface,
    flexShrink: 1,
  },
  heroLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.mutedMid,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.inkCard,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radii.pill,
    flexShrink: 0,
  },
  heroPillText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xs,
    color: colors.brand,
  },
  heroBalance: {
    marginTop: 0,
  },
  chartCard: {
    marginTop: spacing.xxl,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  heroStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  heroStatValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    letterSpacing: -0.2,
    color: colors.surface,
  },
  heroStatLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
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
