import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { format } from 'date-fns';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import IconTile from '../../components/IconTile';
import AmountText from '../../components/AmountText';
import CategoryIcon from '../../components/CategoryIcon';
import IncomeExpenseChart from '../../components/IncomeExpenseChart';
import { colors, fontFamily, fontSize, spacing, radii } from '../../theme/tokens';
import { useAuth } from '../../lib/AuthContext';
import useGlobalSummary from '../../hooks/useGlobalSummary';
import useTransactions from '../../hooks/useTransactions';
import useDailyTotals from '../../hooks/useDailyTotals';
import useProfile from '../../hooks/useProfile';
import { useAddTransactionSheet } from '../../components/AddTransactionSheet';

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
  const { data: dailyTotals } = useDailyTotals(7);
  const { profile } = useProfile();
  const { openAdd } = useAddTransactionSheet();

  const firstName = session?.user?.user_metadata?.full_name?.split(' ')[0] || session?.user?.email;
  const initial = firstName?.[0]?.toUpperCase() ?? '?';

  return (
    <Screen padded={false}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => router.push('/settings')}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
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
          <Pressable style={styles.bellButton} onPress={() => router.push('/settings')}>
            <Bell size={20} color={colors.ink} strokeWidth={2} />
            <View style={styles.bellDot} />
          </Pressable>
        </View>

        <Card dark style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroLabel}>In Hand</Text>
            <View style={styles.heroPill}>
              <View style={styles.heroPillDot} />
              <Text style={styles.heroPillText}>All accounts</Text>
            </View>
          </View>
          <AmountText value={summary.in_hand_balance} type="neutral" dark size={fontSize.amountLg} style={styles.heroBalance} />
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Income</Text>
              <AmountText value={summary.month_income} type="neutral" dark size={fontSize.xl} />
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Expenses</Text>
              <AmountText value={summary.month_expense} type="neutral" dark size={fontSize.xl} />
            </View>
          </View>
        </Card>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Last 7 Days</Text>
        </View>

        <Card>
          <IncomeExpenseChart data={dailyTotals} />
        </Card>

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
  },
  heroLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.mutedMid,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(187,220,18,0.14)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  heroPillDot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
  },
  heroPillText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: colors.brand,
  },
  heroBalance: {
    marginTop: 6,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  heroStat: {
    flex: 1,
    backgroundColor: colors.inkCard,
    borderRadius: 16,
    padding: 13,
  },
  heroStatLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.mutedMid,
    marginBottom: 6,
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
});
