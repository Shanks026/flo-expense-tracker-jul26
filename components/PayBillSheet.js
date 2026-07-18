import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { X, SkipForward } from 'lucide-react-native';
import { format } from 'date-fns';
import Button from './Button';
import { colors as staticColors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { currencySymbol, sanitizeAmountInput } from '../lib/currency';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';
import { useToast } from './Toast';
import { markBillPaid, skipBillCycle } from '../lib/bills';
import { budgetToastForSave } from '../lib/alerts';
import useSheetBackHandler from '../hooks/useSheetBackHandler';

const PayBillSheetContext = createContext(null);

export function PayBillSheetProvider({ children }) {
  const sheetRef = useRef(null);
  const openPayBill = useCallback((bill) => sheetRef.current?.open(bill), []);

  return (
    <PayBillSheetContext.Provider value={{ openPayBill }}>
      {children}
      <PayBillSheet ref={sheetRef} />
    </PayBillSheetContext.Provider>
  );
}

export function usePayBillSheet() {
  const ctx = useContext(PayBillSheetContext);
  if (!ctx) throw new Error('usePayBillSheet must be used within PayBillSheetProvider');
  return ctx;
}

const PayBillSheet = forwardRef(function PayBillSheet(_props, ref) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const modalRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef);
  const { notifyChanged } = useDataRefresh();
  const { accounts, activeAccountId } = useAccount();
  const { showToast } = useToast();

  const [bill, setBill] = useState(null);
  const [amount, setAmount] = useState('');
  const [paidDate, setPaidDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [accountId, setAccountId] = useState(null);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const selectedAccount = accounts.find((a) => a.id === accountId);

  useImperativeHandle(ref, () => ({
    open(nextBill) {
      setError(null);
      setAccountPickerOpen(false);
      setShowDatePicker(false);
      setBill(nextBill);
      setAmount(String(nextBill.amount));
      setPaidDate(new Date());
      // Bills are global (not account-scoped) — default the pay-from account
      // to whichever is currently active, since that's the most predictable
      // guess; fully editable via the chip list below.
      setAccountId(activeAccountId);
      modalRef.current?.present();
    },
  }));

  async function handleMarkPaid() {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError('Enter an amount');
      return;
    }
    setSaving(true);
    setError(null);

    const { error: payError } = await markBillPaid(bill, { amount: numericAmount, occurredAt: paidDate, accountId });

    setSaving(false);
    if (payError) {
      showToast({ message: payError.message, variant: 'error' });
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: `${bill.name} marked paid`, variant: 'success' });

    if (bill.category_id) {
      const budgetMsg = await budgetToastForSave({ categoryId: bill.category_id, accountId });
      if (budgetMsg) showToast({ message: budgetMsg, variant: 'warn' });
    }
  }

  async function handleSkip() {
    setSaving(true);
    const { error: skipError } = await skipBillCycle(bill);
    setSaving(false);
    if (skipError) {
      showToast({ message: skipError.message, variant: 'error' });
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: `Skipped ${bill.name} this cycle`, variant: 'info' });
  }

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    []
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      onChange={handleSheetChange}
      snapPoints={useMemo(() => ['92%'], [])}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: staticColors.ink, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
      handleIndicatorStyle={{ backgroundColor: '#3a3a3a', width: 44 }}
    >
      <BottomSheetScrollView style={{ flex: 1 }} contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Pay {bill?.name ?? ''}
          </Text>
          <Pressable style={styles.closeButton} onPress={() => modalRef.current?.dismiss()}>
            <X size={16} color={staticColors.surface} strokeWidth={2.6} />
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>Amount</Text>
        <View style={styles.amountBox}>
          <Text style={styles.amountCurrency}>{currencySymbol(bill?.currency)}</Text>
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(sanitizeAmountInput(v))}
            placeholder="0"
            placeholderTextColor={staticColors.mutedDarker}
            keyboardType="number-pad"
            style={styles.amountInput}
            autoFocus
          />
        </View>

        <Pressable style={[styles.row, { marginTop: spacing.md }]} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.fieldLabelInline}>Paid On</Text>
          <Text style={styles.rowValue}>{format(paidDate, 'd MMM yyyy')}</Text>
        </Pressable>
        {showDatePicker && (
          <DateTimePicker
            value={paidDate}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={(_event, selected) => {
              setShowDatePicker(false);
              if (selected) setPaidDate(selected);
            }}
          />
        )}

        <Pressable style={[styles.row, { marginTop: spacing.md }]} onPress={() => setAccountPickerOpen((v) => !v)}>
          <Text style={styles.fieldLabelInline}>Pay From</Text>
          <View style={styles.accountValueRow}>
            {selectedAccount && <View style={[styles.accountDot, { backgroundColor: selectedAccount.color }]} />}
            <Text style={styles.rowValue}>{selectedAccount?.name ?? '—'}</Text>
          </View>
        </Pressable>

        {accountPickerOpen && (
          <View style={styles.accountList}>
            {accounts.map((account) => (
              <Pressable
                key={account.id}
                style={[styles.accountOption, account.id === accountId && styles.accountOptionSelected]}
                onPress={() => {
                  setAccountId(account.id);
                  setAccountPickerOpen(false);
                }}
              >
                <View style={[styles.accountDot, { backgroundColor: account.color }]} />
                <Text
                  style={[styles.accountOptionText, account.id === accountId && styles.accountOptionTextSelected]}
                  numberOfLines={1}
                >
                  {account.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Button title="Mark as Paid" variant="primary" onPress={handleMarkPaid} loading={saving} style={{ marginTop: spacing.lg }} />
        <Pressable style={styles.skipRow} onPress={handleSkip} disabled={saving}>
          <SkipForward size={16} color={staticColors.mutedMid} strokeWidth={2} />
          <Text style={styles.skipText}>Skip this cycle</Text>
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

function makeStyles(colors) {
  return StyleSheet.create({
  sheet: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  headerTitle: {
    flex: 1,
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: staticColors.surface,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: staticColors.inkCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: staticColors.mutedMid,
    marginBottom: spacing.sm,
  },
  amountBox: {
    backgroundColor: staticColors.inkCard,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  amountCurrency: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.title,
    color: staticColors.mutedDarker,
  },
  amountInput: {
    fontFamily: fontFamily.extrabold,
    fontSize: 26,
    letterSpacing: -0.3,
    color: staticColors.surface,
    flex: 1,
  },
  row: {
    backgroundColor: staticColors.inkCard,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabelInline: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    color: staticColors.mutedMid,
  },
  rowValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.base,
    color: staticColors.surface,
  },
  accountValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  accountDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
  },
  accountList: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: staticColors.inkCard,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  accountOptionSelected: {
    backgroundColor: colors.brand,
  },
  accountOptionText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: staticColors.surface,
    flexShrink: 1,
  },
  accountOptionTextSelected: {
    color: staticColors.ink,
  },
  errorText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: staticColors.dangerStrong,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  skipText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: staticColors.mutedMid,
  },
  });
}
