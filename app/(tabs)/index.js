import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, CircleDollarSign, Snowflake, Receipt, Flame, ArrowLeftRight, Trophy } from 'lucide-react-native';
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
import TodayCard from '../../components/TodayCard';
import useStreak from '../../hooks/useStreak';
import { colors as staticColors, fontFamily, fontSize, spacing, radii } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../lib/AuthContext';
import useAllAccountSummaries from '../../hooks/useAllAccountSummaries';
import useTransactions from '../../hooks/useTransactions';
import useSpendingTrend from '../../hooks/useSpendingTrend';
import useProfile from '../../hooks/useProfile';
import useBills, { billStatus } from '../../hooks/useBills';
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
import useRewards from '../../hooks/useRewards';
import useTrophies from '../../hooks/useTrophies';
import { rankFromXp, RANK_BADGE_ART } from '../../lib/rewards';
import { useRewardsHistorySheet } from '../../components/RewardsHistorySheet';
import useCardThemes from '../../hooks/useCardThemes';
import usePullToRefresh from '../../hooks/usePullToRefresh';
import { useRewardBurst } from '../../components/RewardBurst';
import { takePendingLoginReward } from '../../lib/pendingLoginReward';

const UPCOMING_BILL_STYLES = {
  overdue: { iconTone: 'danger', amountColor: staticColors.danger, pill: { label: 'Overdue', tone: 'danger' } },
  due_soon: { iconTone: 'warn', amountColor: staticColors.warn, pill: { label: 'Due Soon', tone: 'warn' } },
};
const MAX_UPCOMING_BILLS = 4;

export default function Home() {
  const { colors, hydrated: themeHydrated } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useAuth();
  const router = useRouter();
  const { transactions, loading: transactionsLoading } = useTransactions({ limit: 4 });
  const [trendRange, setTrendRange] = useState('7d');
  const { data: trendData, loading: trendLoading } = useSpendingTrend(trendRange);
  const { avatarUrl } = useProfile();
  const { openAdd } = useAddTransactionSheet();
  const { openMenu } = useMenuSheet();
  const { activeAccount, accounts, setActiveAccount, loading: accountsLoading } = useAccount();
  const { summaries, loading: summariesLoading } = useAllAccountSummaries();
  const { openAccountSwitcher } = useAccountSwitcherSheet();
  const { openAlerts } = useAlertsSheet();
  const { count: alertCount } = useAlerts();
  const { bills, loading: billsLoading } = useBills();
  const { openPayBill } = usePayBillSheet();
  const { current: streakCurrent, loading: streakLoading } = useStreak();
  const currency = useCurrency();
  const { coins, freezes, level, xp, loading: rewardsLoading } = useRewards();
  const { current: rank } = rankFromXp(xp);
  const { unseenCount: unseenTrophies } = useTrophies();
  const { openRewardsHistory } = useRewardsHistorySheet();
  const { equippedTheme } = useCardThemes();
  const { showRewardBurst } = useRewardBurst();
  const { refreshing, onRefresh } = usePullToRefresh();

  // Surfaces the day-login coins/XP reward when it was earned somewhere
  // that isn't AddTransactionSheet (onboarding's balance.js/expense.js, which
  // insert transactions directly and persist the claim instead of bursting
  // it immediately — see lib/pendingLoginReward.js). One-shot: the take
  // call clears the flag as it reads it, so this is a no-op on every mount
  // after the first that finds one. Deliberately NOT gated on anything else
  // finishing first (the streak celebration/spin wheel this same first
  // transaction already triggers are independent, root-mounted, and handle
  // their own RewardBurst-vs-celebration sequencing already).
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    takePendingLoginReward(userId).then((reward) => {
      if (reward) showRewardBurst(reward);
    });
  }, [session?.user?.id, showRewardBurst]);

  // Signing out while Home is the focused screen sets `session` to null on
  // this same render pass — RootNavigator's redirect to /sign-in is a
  // separate effect that only fires afterward, so there's always at least
  // one render of Home with no session before it unmounts. Every data hook
  // above already resets to a safe empty default on session→null, but the
  // greeting below reads session.user directly and had nothing to fall back
  // to — getGreeting(name: undefined) stringifies straight into the title
  // ("Tuesday, undefined"), which is the bug this was reported as. Bailing
  // out here, all hooks already called, skips deriving from a session that's
  // mid-teardown instead of papering over it with a fallback name.
  if (!session) return null;

  // Lit only when there IS a streak. The muted flame on a zero streak is not a
  // failure state — it's the invitation.
  const streakLit = streakCurrent > 0;

  // Every header chip (item stats, level, streak) and the hero carousel
  // share this same "still loading" gate — folding in !themeHydrated too, not
  // just each hook's own loading flag, so none of them paint a beat in the
  // wrong (default, pre-reconciliation) theme colors right before flipping to
  // the account's real ones. Chips render a Skeleton while true, then a
  // one-time FadeIn once false — the same pairing everywhere, rather than the
  // streak chip being the only one with an entrance animation and the others
  // just popping in with default zero values.
  const chipsLoading = rewardsLoading || !themeHydrated;
  const streakChipLoading = streakLoading || !themeHydrated;
  const heroLoading = accountsLoading || !themeHydrated;

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
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {/* Item stats — coins + freezes, "your stuff". Level moved back
                out to its own chip (18-gamification-ritual-and-ledger.md
                Phase 5) — a bare "⭐ 10" folded in here read as unclear (icon
                alone doesn't say what the number IS, unlike coins/freeze/
                streak, whose icon already carries the meaning), and adding a
                "LVL" label to disambiguate needed more room than fit as a
                third entry in this chip. */}
            {/* One chip, three counters — coins, freeze, and level (folded in
                per direct feedback, no longer its own pill). Level shows the
                user's current rank badge (the same RANK_BADGE_ART the Trophy
                Room / Menu use) + a bare level number — the badge carries the
                "this is your rank/level" meaning, so no text label is needed.
                Whole chip opens Rewards history; the fuller Rank/Level/XP card
                stays one tap away via the Menu (avatar). */}
            {chipsLoading ? (
              <Skeleton width={150} height={44} radius={14} />
            ) : (
              <FadeIn>
                <Pressable style={styles.itemStats} onPress={openRewardsHistory}>
                  <View style={styles.itemStatEntry}>
                    <CircleDollarSign size={16} color={colors.coinGold} fill={colors.coinGold} strokeWidth={1.5} />
                    <Text style={styles.itemStatText}>{coins.toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.itemStatDivider} />
                  <View style={styles.itemStatEntry}>
                    {/* Snowflake has no closed/fillable region (just radiating
                        strokes) — `fill` is a harmless no-op here; a bolder
                        strokeWidth is what actually reads as "filled/solid" for
                        a line-only glyph like this, vs. CircleDollarSign's real
                        fill above. */}
                    <Snowflake size={16} color={colors.iceBlue} fill={colors.iceBlue} strokeWidth={2.4} />
                    <Text style={styles.itemStatText}>{freezes}</Text>
                  </View>
                  <View style={styles.itemStatDivider} />
                  <View style={styles.itemStatEntry}>
                    <Image source={RANK_BADGE_ART[rank.id]} style={styles.levelRankBadge} resizeMode="contain" />
                    <Text style={styles.itemStatText}>{level}</Text>
                  </View>
                </Pressable>
              </FadeIn>
            )}
          </View>
          <View style={styles.headerRight}>
            {/* Duolingo's model: the streak lives in the header, always visible,
                and it is a DOOR — it opens /streak, where the calendar and the
                history live. Unlit when today hasn't been logged: that muted
                flame IS the nudge, and it costs no words.
                Same Skeleton-while-loading/FadeIn-once-ready pairing as the
                item-stats and level chips beside it — this was previously the
                ONLY header chip with an entrance animation (and even then, no
                skeleton — just absent, shifting headerRight's layout once it
                popped in). Now all three match. */}
            {streakChipLoading ? (
              <Skeleton width={58} height={44} radius={14} />
            ) : (
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
            {/* Trophy Room — moved out of the Menu sheet into the header (per
                direct feedback), beside the bell, carrying its own unseen-dot
                the same way the bell does its alert dot. */}
            <Pressable style={styles.headerIconButton} hitSlop={10} onPress={() => router.push('/trophies')}>
              <Trophy size={20} color={colors.ink} strokeWidth={2} />
              {unseenTrophies > 0 && <View style={styles.bellDot} />}
            </Pressable>
            <Pressable style={styles.headerIconButton} hitSlop={10} onPress={openAlerts}>
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
          cardTheme={equippedTheme}
          accountsLoading={heroLoading}
        />

        {/* Close-the-day ritual (18-gamification-ritual-and-ledger.md Phase 3) */}
        <TodayCard />

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
  // "Your stuff" — coins + freeze + level. Chip background/border removed
  // (per direct feedback, "might look more natural and have a bit more
  // space") — the dividers below are what still reads this as one grouped
  // cluster rather than three floating numbers, not a bordered surface.
  itemStats: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    // Reverted to 10 (per direct feedback) — the lg(16) bump read as too
    // loose for this cluster specifically, even though headerRight's own
    // gap stayed widened. Left as it was pre-chip-removal.
    gap: 10,
  },
  itemStatEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  itemStatDivider: {
    width: 1,
    height: 18,
    backgroundColor: colors.border,
  },
  itemStatText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  // The current rank badge shown in place of the old Star, inside the shared
  // item-stats chip's level entry (per direct feedback). A touch larger than
  // the 16px sibling icons since illustrated art reads smaller than a flat
  // glyph at the same box.
  levelRankBadge: {
    width: 20,
    height: 20,
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
  // for the item-stats/XP chips above. Subtitle is lib/greetings.js's real
  // day/time-varied voice copy — the Money Level metric that once lived
  // beneath it moved to the Menu sheet (18-gamification-ritual-and-ledger.md),
  // so this stays exactly what it looks like: the greeting, nothing else.
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
    // sm(8)→lg(16)→xl(20) (per direct feedback, in two passes) — this
    // cluster reads better looser than itemStats does.
    gap: spacing.xl,
  },
  // Chip background/border removed (per direct feedback) — same bare
  // treatment as itemStats now.
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 44,
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
  // Shared by the trophy + bell header buttons. Bare, content-sized (no
  // fixed width/background/border, per direct feedback) — same shape
  // discipline as streakChip now, so headerRight's own `gap` is the ONLY
  // thing determining spacing between streak/trophy/bell. The old fixed
  // 44-wide centered box added invisible padding around the 20px icon that
  // streakChip's intrinsic sizing didn't have, which is what made the
  // streak↔trophy gap look different from the trophy↔bell gap. `hitSlop`
  // on the Pressables (not this box) is what keeps the tap target
  // comfortable now that the visual box shrank to the icon's own size.
  headerIconButton: {
    height: 44,
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    // Retuned for headerIconButton's new content-sized (~20px) width — the
    // old right:9 assumed a 44-wide centered box; same "sits at the icon's
    // top-right corner" relationship, just recomputed for the narrower box.
    right: -2,
    width: 11,
    height: 11,
    borderRadius: radii.pill,
    backgroundColor: colors.rose,
    // The ring's color needs to MATCH WHATEVER IS BEHIND IT — it used to be
    // colors.surface because both header buttons sat on a colors.surface
    // chip; now that those chips are gone (bare icons, per direct feedback),
    // the real backdrop is the screen itself, so this is colors.bg, not
    // colors.surface (they differ — #F6F7F3 vs #FFFFFF in Brand light).
    // Getting this wrong shows a faint mismatched-color halo around the dot.
    borderWidth: 2,
    borderColor: colors.bg,
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
