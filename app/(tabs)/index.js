import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, CircleDollarSign, Snowflake, Receipt, Flame, ArrowLeftRight } from 'lucide-react-native';
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
import AccountHeroCarousel from '../../components/AccountHeroCarousel';
import useStreak from '../../hooks/useStreak';
import { colors as staticColors, fontFamily, fontSize, spacing, radii } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../lib/AuthContext';
import useAllAccountSummaries from '../../hooks/useAllAccountSummaries';
import useTransactions from '../../hooks/useTransactions';
import useSpendingTrend from '../../hooks/useSpendingTrend';
import useProfile from '../../hooks/useProfile';
import useBills, { billStatus } from '../../hooks/useBills';
import useEntitlement from '../../hooks/useEntitlement';
import ProBadge from '../../components/ProBadge';
import { formatMoney } from '../../lib/currency';
import useCurrency from '../../hooks/useCurrency';
import { useAddTransactionSheet } from '../../components/AddTransactionSheet';
import { useMenuSheet } from '../../components/MenuSheet';
import { usePayBillSheet } from '../../components/PayBillSheet';
import { useAccount } from '../../lib/AccountContext';
import { isTransfer, transferLabel } from '../../lib/transfers';
import { useAccountSwitcherSheet } from '../../components/AccountSwitcherSheet';
import { useAlertsSheet } from '../../components/AlertsSheet';
import useAlerts from '../../hooks/useAlerts';
import { getGreeting } from '../../lib/greetings';

const UPCOMING_BILL_STYLES = {
  overdue: { iconTone: 'danger', amountColor: staticColors.danger, pill: { label: 'Overdue', tone: 'danger' } },
  due_soon: { iconTone: 'warn', amountColor: staticColors.warn, pill: { label: 'Due Soon', tone: 'warn' } },
};
const MAX_UPCOMING_BILLS = 4;

// Structural placeholders for the gamification economy (IDEAS-gamification.md
// — coins, streak freezes). Static, not wired to any hook: there's no
// `reward_events`/`v_coin_balance` yet (see that doc's "Data model sketch"),
// this is just reserving the header's left slot and its visual shape ahead
// of the real numbers landing. Replace with a real balance hook once that
// ledger exists — don't let these linger as "temporary" past that point.
const PLACEHOLDER_COINS = 240;
const PLACEHOLDER_FREEZES = 1;

export default function Home() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useAuth();
  const router = useRouter();
  const { transactions, loading: transactionsLoading } = useTransactions({ limit: 4 });
  const [trendRange, setTrendRange] = useState('7d');
  const { data: trendData, loading: trendLoading } = useSpendingTrend(trendRange);
  const { avatarUrl } = useProfile();
  const { openAdd } = useAddTransactionSheet();
  const { openMenu } = useMenuSheet();
  const { activeAccount, accounts, setActiveAccount } = useAccount();
  const { summaries, loading: summariesLoading } = useAllAccountSummaries();
  const { openAccountSwitcher } = useAccountSwitcherSheet();
  const { openAlerts } = useAlertsSheet();
  const { count: alertCount } = useAlerts();
  const { bills, loading: billsLoading } = useBills();
  const { openPayBill } = usePayBillSheet();
  const { current: streakCurrent, loading: streakLoading } = useStreak();
  const { isPro } = useEntitlement();
  const currency = useCurrency();

  // Lit only when there IS a streak. The muted flame on a zero streak is not a
  // failure state — it's the invitation.
  const streakLit = streakCurrent > 0;

  const firstName = session?.user?.user_metadata?.full_name?.split(' ')[0] || session?.user?.email;
  const initial = firstName?.[0]?.toUpperCase() ?? '?';
  // Recomputed on every render rather than cached in state — this is a
  // pure function of the current time, and Home re-renders often enough
  // (focus, data refetches) that it never gets stuck showing a stale
  // time-of-day bucket for long. No need for a live-updating clock.
  const { title: greetingTitle, subtitle: greetingSubtitle } = getGreeting(new Date(), firstName);

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
            {/* Placeholders — see PLACEHOLDER_COINS/PLACEHOLDER_FREEZES above.
                Not pressable yet: nothing to open until a shop/economy exists. */}
            <View style={styles.gamiChip}>
              <CircleDollarSign size={16} color={colors.coinGold} fill={colors.coinGold} strokeWidth={1.5} />
              <Text style={styles.gamiChipText}>{PLACEHOLDER_COINS}</Text>
            </View>
            <View style={styles.gamiChip}>
              {/* Snowflake has no closed/fillable region (just radiating
                  strokes) — `fill` is a harmless no-op here; a bolder
                  strokeWidth is what actually reads as "filled/solid" for
                  a line-only glyph like this, vs. CircleDollarSign's real
                  fill above. */}
              <Snowflake size={16} color={colors.iceBlue} fill={colors.iceBlue} strokeWidth={2.4} />
              <Text style={styles.gamiChipText}>{PLACEHOLDER_FREEZES}</Text>
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
          </View>
        </View>

        <View style={styles.welcomeRow}>
          <Pressable onPress={openMenu} style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
            )}
            {isPro && <ProBadge variant="overlay" />}
          </Pressable>
          <View style={styles.welcomeTextGroup}>
            <Text style={styles.welcomeTitle}>{greetingTitle}</Text>
            <Text style={styles.welcomeSubtitle}>{greetingSubtitle}</Text>
          </View>
        </View>

        <AccountHeroCarousel
          accounts={accounts}
          activeAccountId={activeAccount?.id ?? null}
          onSwitchAccount={setActiveAccount}
          onOpenSwitcher={openAccountSwitcher}
          summaries={summaries}
          summariesLoading={summariesLoading}
          currency={currency}
        />

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
                currency={currency}
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
                    <AmountText value={tx.amount} type={tx.type} signed currency={currency} />
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
    marginBottom: spacing.xl,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Static placeholders — see PLACEHOLDER_COINS/PLACEHOLDER_FREEZES. Same
  // chip language as streakChip/bellButton (44-tall, bordered surface) so
  // the row reads as one consistent set of counters, not a mismatched
  // temporary widget bolted on.
  gamiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gamiChipText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  avatarWrap: {
    position: 'relative',
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
  // Sits on the theme-accent avatar bg (colors.brand) — pinned dark, same
  // assumption as Button's primary-text pin.
  avatarText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: staticColors.ink,
  },
  // Avatar lives here now, not in headerRow — freeing headerRow's left slot
  // for the gamification chips above. Carries a real headline + a subtitle
  // line (currently static; will become dynamic gamification content once
  // there's data to drive it) rather than the old fixed-size "Good morning"
  // + name pairing that had to fit avatar-height.
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  welcomeTextGroup: {
    flexShrink: 1,
  },
  welcomeTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.heading,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  welcomeSubtitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.muted,
    marginTop: 2,
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
  chartCard: {
    marginTop: spacing.lg,
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
}
