import { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { CalendarClock } from 'lucide-react-native';
import { endOfDay, format } from 'date-fns';
import { colors as staticColors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../lib/AuthContext';
import { useAccount } from '../lib/AccountContext';
import useBills from '../hooks/useBills';
import { usePayBillSheet } from './PayBillSheet';
import { formatMoney } from '../lib/currency';
import { enqueue, PRIORITY } from '../lib/momentQueue';

// The bills-due moment (34-streak-only.md): actionable, so it wins over a
// streak celebration in the moment queue (lib/momentQueue.js).
//
// Two parts. DueBillsSource (default export) is the headless sibling of
// <Stack> in app/_layout.js that enqueues the moment once a day while bills
// are due — the queue's remembered ids replace the old
// 'flo.dueBills.lastShown' key. DueBillsMoment is what components/MomentHost.js
// renders when the moment's turn comes; it reads the bills live, so a moment
// that waited still lists what's due now.
export default function DueBillsSource() {
  const { session } = useAuth();
  const { activeAccountId } = useAccount();
  const { bills, loading } = useBills();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const hasDue = bills.some((b) => b.is_active && b.next_due_date <= todayStr);

  useEffect(() => {
    if (!session || !activeAccountId || loading || !hasDue) return;
    enqueue({
      id: `bills-due:${todayStr}`,
      kind: 'bills-due',
      priority: PRIORITY.actionable,
      // Today's reminder only: tomorrow enqueues its own.
      expiresAt: endOfDay(new Date()).getTime(),
    });
  }, [session, activeAccountId, loading, hasDue, todayStr]);

  return null;
}

export function DueBillsMoment({ onDone }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { bills, loading } = useBills();
  const { openPayBill } = usePayBillSheet();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const dueBills = bills.filter((b) => b.is_active && b.next_due_date <= todayStr);

  // Paid or deleted while the moment waited: nothing to show, and it
  // shouldn't use up the session's takeover.
  useEffect(() => {
    if (!loading && dueBills.length === 0) onDone({ skipped: true });
  }, [loading, dueBills.length]);

  function handleMarkPaid(bill) {
    onDone();
    openPayBill(bill);
  }

  if (dueBills.length === 0) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => onDone()}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <CalendarClock size={26} color={colors.warn} strokeWidth={2.2} />
          </View>
          <Text style={styles.title}>{dueBills.length === 1 ? 'Bill Due Today' : `${dueBills.length} Bills Due`}</Text>
          <Text style={styles.body}>These are due or overdue — pay now or handle them later from Bills.</Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {dueBills.map((bill) => (
              <View key={bill.id} style={styles.row}>
                <View style={{ flexShrink: 1 }}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {bill.name}
                  </Text>
                  <Text style={styles.rowAmount}>{formatMoney(bill.amount, bill.currency)}</Text>
                </View>
                <Pressable style={styles.payButton} onPress={() => handleMarkPaid(bill)}>
                  <Text style={styles.payButtonText}>Mark Paid</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>

          <Pressable style={styles.later} onPress={() => onDone()}>
            <Text style={styles.laterText}>Later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderRadius: radii.cardLg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.warnBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.title,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  list: {
    width: '100%',
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  rowName: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  rowAmount: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginTop: 1,
  },
  payButton: {
    // Permanently-emphasized chip (same role as Card's `dark` prop).
    backgroundColor: colors.emphasisBg,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  payButtonText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
    color: staticColors.surface,
  },
  later: {
    width: '100%',
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.muted,
  },
  });
}
