import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CalendarClock } from 'lucide-react-native';
import { format } from 'date-fns';
import { colors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useAuth } from '../lib/AuthContext';
import { useAccount } from '../lib/AccountContext';
import useBills from '../hooks/useBills';
import { usePayBillSheet } from './PayBillSheet';

const STORAGE_KEY = 'flo.dueBills.lastShown';

// Sibling of <Stack> in app/_layout.js (same reasoning as ShareIntentHandler):
// needs useBills/usePayBillSheet/account context, which RootNavigator itself
// can't consume since it defines those providers.
export default function DueBillsModal() {
  const { session } = useAuth();
  const { activeAccountId } = useAccount();
  const { bills, loading } = useBills();
  const { openPayBill } = usePayBillSheet();

  const [visible, setVisible] = useState(false);
  const checkedRef = useRef(false);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const dueBills = bills.filter((b) => b.is_active && b.next_due_date <= todayStr);

  useEffect(() => {
    if (!session || !activeAccountId || loading || checkedRef.current) return;
    checkedRef.current = true;

    if (dueBills.length === 0) return;

    AsyncStorage.getItem(STORAGE_KEY)
      .catch(() => null)
      .then((lastShown) => {
        if (lastShown === todayStr) return;
        AsyncStorage.setItem(STORAGE_KEY, todayStr).catch(() => {});
        setVisible(true);
      });
  }, [session, activeAccountId, loading]);

  function handleMarkPaid(bill) {
    setVisible(false);
    openPayBill(bill);
  }

  if (dueBills.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
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
                  <Text style={styles.rowAmount}>₹{Math.round(bill.amount).toLocaleString('en-IN')}</Text>
                </View>
                <Pressable style={styles.payButton} onPress={() => handleMarkPaid(bill)}>
                  <Text style={styles.payButtonText}>Mark Paid</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>

          <Pressable style={styles.later} onPress={() => setVisible(false)}>
            <Text style={styles.laterText}>Later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  payButtonText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
    color: colors.surface,
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
