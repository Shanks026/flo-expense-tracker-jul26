import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, Receipt } from 'lucide-react-native';
import { format } from 'date-fns';
import Card from '../components/Card';
import IconTile from '../components/IconTile';
import Pill from '../components/Pill';
import CategoryIcon from '../components/CategoryIcon';
import Skeleton from '../components/Skeleton';
import FadeIn from '../components/FadeIn';
import { colors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import useBills, { billStatus } from '../hooks/useBills';
import { useAddBillSheet } from '../components/AddBillSheet';
import { usePayBillSheet } from '../components/PayBillSheet';
import { formatMoney } from '../lib/currency';

const CADENCE_LABELS = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };

const STATUS_STYLES = {
  overdue: { iconTone: 'danger', amountColor: colors.danger, pill: { label: 'Overdue', tone: 'danger' } },
  due_soon: { iconTone: 'warn', amountColor: colors.warn, pill: { label: 'Due Soon', tone: 'warn' } },
  scheduled: { iconTone: 'neutral', amountColor: colors.ink, pill: null },
  // A paused bill isn't being tracked for payment, so it shouldn't show
  // overdue/due-soon styling even if its stored next_due_date has passed.
  paused: { iconTone: 'neutral', amountColor: colors.muted, pill: { label: 'Paused', tone: 'neutral' } },
};

export default function Bills() {
  const router = useRouter();
  const { bills, loading } = useBills();
  const { openAddBill } = useAddBillSheet();
  const { openPayBill } = usePayBillSheet();

  return (
    // Pushed from the menu sheet now, not a tab — so it needs its own back
    // button and SafeAreaView, the same shape as Settings and Analytics.
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.title}>Bills</Text>
        </View>
        <Pressable style={styles.newButton} onPress={() => openAddBill()}>
          <Plus size={15} color={colors.brand} strokeWidth={3} />
          <Text style={styles.newButtonText}>New Bill</Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <>
            {[0, 1, 2].map((i) => (
              <Card key={i} style={styles.billCard}>
                <View style={styles.rowBetween}>
                  <View style={styles.rowLeft}>
                    <Skeleton width={42} height={42} radius={13} />
                    <View>
                      <Skeleton width={140} height={16} radius={6} style={{ marginBottom: 6 }} />
                      <Skeleton width={100} height={12} radius={6} />
                    </View>
                  </View>
                </View>
              </Card>
            ))}
          </>
        ) : bills.length === 0 ? (
          <FadeIn>
            <Card style={{ marginTop: spacing.lg }}>
              <Text style={styles.emptyText}>No bills yet. Tap "New Bill" to add a recurring bill or subscription.</Text>
            </Card>
          </FadeIn>
        ) : (
          <FadeIn>
          {bills.map((bill) => {
            const status = bill.is_active ? billStatus(bill.next_due_date) : 'paused';
            const s = STATUS_STYLES[status];

            return (
              <Pressable key={bill.id} onPress={() => openAddBill(bill)}>
                <Card style={styles.billCard}>
                  <View style={styles.rowBetween}>
                    <View style={styles.rowLeft}>
                      <IconTile tone={s.iconTone} size={42} radius={13}>
                        {bill.category?.icon ? (
                          <CategoryIcon icon={bill.category.icon} size={20} color={s.amountColor} />
                        ) : (
                          <Receipt size={20} color={s.amountColor} strokeWidth={2} />
                        )}
                      </IconTile>
                      <View style={{ flexShrink: 1 }}>
                        <Text style={styles.billName} numberOfLines={1}>
                          {bill.name}
                        </Text>
                        <Text style={styles.billMeta}>
                          {CADENCE_LABELS[bill.cadence]} · Due {format(new Date(bill.next_due_date), 'd MMM')}
                        </Text>
                      </View>
                    </View>
                    {s.pill && <Pill label={s.pill.label} tone={s.pill.tone} />}
                  </View>

                  <View style={styles.rowBetween}>
                    <Text style={styles.lastPaidText}>
                      {bill.last_paid_date ? `Last paid ${format(new Date(bill.last_paid_date), 'd MMM')}` : 'Not paid yet'}
                    </Text>
                    <View style={styles.actionsRow}>
                      <Text style={[styles.amountText, { color: s.amountColor }]}>
                        {formatMoney(bill.amount, bill.currency)}
                      </Text>
                      {bill.is_active && (
                        <Pressable style={styles.payButton} onPress={() => openPayBill(bill)}>
                          <Text style={styles.payButtonText}>Mark Paid</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          })}
          </FadeIn>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.display,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.ink,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: radii.pill,
  },
  newButtonText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: colors.surface,
  },
  scroll: {
    // Screen used to supply the horizontal padding; a bare SafeAreaView
    // doesn't. The 120 bottom pad existed to clear the tab bar — as a pushed
    // screen there isn't one.
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: 60,
    gap: spacing.md,
  },
  emptyText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.muted,
    textAlign: 'center',
  },
  billCard: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flexShrink: 1,
    paddingRight: spacing.sm,
  },
  billName: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  billMeta: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginTop: 1,
  },
  lastPaidText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.muted,
  },
  amountText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  payButton: {
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  payButtonText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xs,
    color: colors.surface,
  },
});
