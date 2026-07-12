import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Menu, ChevronRight, TrendingUp, TrendingDown, Receipt } from 'lucide-react-native';
import { format } from 'date-fns';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import IconTile from '../../components/IconTile';
import AmountText from '../../components/AmountText';
import CategoryIcon from '../../components/CategoryIcon';
import IncomeExpenseChart from '../../components/IncomeExpenseChart';
import Pill from '../../components/Pill';
import StreakCalendar from '../../components/StreakCalendar';
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
  const { summary } = useGlobalSummary();
  const { transactions } = useTransactions({ limit: 4 });
  const [trendRange, setTrendRange] = useState('7d');
  const { data: trendData } = useSpendingTrend(trendRange);
  const { avatarUrl } = useProfile();
  const { openAdd } = useAddTransactionSheet();
  const { openMenu } = useMenuSheet();
  const { activeAccount } = useAccount();
  const { openAccountSwitcher } = useAccountSwitcherSheet();
  const { openAlerts } = useAlertsSheet();
  const { count: alertCount } = useAlerts();
  const { bills } = useBills();
  const { openPayBill } = usePayBillSheet();

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
          <AmountText
            value={summary.in_hand_balance}
            type="neutral"
            dark
            muteCurrency
            size={fontSize.amountLg}
            style={styles.heroBalance}
          />
          <View style={styles.heroStatsRow}>
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
          </View>
        </Card>

        <StreakCalendar />

        <Card style={styles.chartCard}>
          <IncomeExpenseChart
            data={trendData}
            range={trendRange}
            onRangeChange={setTrendRange}
            defaultVisible={{ expense: true, income: false }}
          />
        </Card>

        {upcomingBills.length > 0 && (
          <>
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
          </>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <Pressable onPress={() => router.push('/transactions')}>
            <Text style={styles.sectionAction}>See all</Text>
          </Pressable>
        </View>

        {transactions.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>No transactions yet. Tap + to add one.</Text>
          </Card>
        ) : (
          <Card style={styles.listCard}>
            {transactions.map((tx, idx) => (
              <Pressable
                key={tx.id}
                style={[styles.row, idx < transactions.length - 1 && styles.rowBorder]}
                onPress={() => openAdd(tx)}
              >
                <IconTile tone={tx.type === 'income' ? 'income' : 'neutral'}>
                  <CategoryIcon icon={tx.category?.icon} size={20} color={tx.type === 'income' ? colors.incomeAccent : colors.ink} />
                </IconTile>
                <View style={styles.rowMid}>
                  <Text style={styles.rowTitle}>{tx.category?.name ?? 'Uncategorized'}</Text>
                  <Text style={styles.rowSub}>
                    {format(new Date(tx.occurred_at), 'd MMM')} · {tx.category?.name ?? (tx.type === 'income' ? 'Income' : 'Expense')}
                  </Text>
                </View>
                <AmountText value={tx.amount} type={tx.type} signed />
              </Pressable>
            ))}
          </Card>
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
    top: 11,
    right: 12,
    width: 7,
    height: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
    borderWidth: 1.5,
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
  rowTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
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
