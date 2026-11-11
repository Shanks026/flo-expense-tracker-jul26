import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CalendarDays, Wallet, ChevronDown } from 'lucide-react-native';
import { format } from 'date-fns';
import Sheet from './ledger/Sheet';
import ListRow from './ledger/ListRow';
import Chip from './ledger/Chip';
import { useLedger, ledgerType, ledgerSpace, tabular } from '../theme/ledger';
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
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
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

  return (
    <Sheet
      ref={modalRef}
      title={`Pay ${bill?.name ?? ''}`}
      onChange={handleSheetChange}
      footer={{
        primary: { title: 'Mark as paid', onPress: handleMarkPaid, loading: saving },
        // A charge that didn't happen this cycle: moves the due date on, logs nothing.
        secondary: { title: 'Skip this cycle', onPress: handleSkip, disabled: saving },
      }}
    >
      {/* The amount, centred and large, with a muted symbol. */}
      <View style={styles.amountWrap}>
        <Text style={styles.amountCurrency}>{currencySymbol(bill?.currency)}</Text>
        <BottomSheetTextInput
          value={amount}
          // The caret stays at the end, like the Add sheet's amount.
          selection={{ start: amount.length, end: amount.length }}
          onChangeText={(v) => setAmount(sanitizeAmountInput(v))}
          placeholder="0"
          placeholderTextColor={c.inkFaint}
          cursorColor={c.accent}
          selectionColor={c.accent}
          keyboardType="decimal-pad"
          accessibilityLabel="Amount paid"
          style={[styles.amountInput, tabular]}
          autoFocus
        />
      </View>

      <ListRow icon={CalendarDays} title="Paid on" right={format(paidDate, 'd MMM yyyy')} trailing="chevron" onPress={() => setShowDatePicker(true)} />
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

      <ListRow
        icon={Wallet}
        title="Pay from"
        right={selectedAccount?.name ?? '—'}
        trailing={<ChevronDown size={18} color={c.muted} strokeWidth={1.75} />}
        onPress={() => setAccountPickerOpen((v) => !v)}
        divider={accountPickerOpen}
      />
      {accountPickerOpen && (
        <View style={styles.optionRow}>
          {accounts.map((account) => (
            <Chip
              key={account.id}
              label={account.name}
              selected={account.id === accountId}
              onPress={() => {
                setAccountId(account.id);
                setAccountPickerOpen(false);
              }}
            />
          ))}
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </Sheet>
  );
});

function makeStyles(c) {
  return StyleSheet.create({
    amountWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginBottom: ledgerSpace.lg,
    },
    amountCurrency: {
      ...ledgerType.title,
      fontSize: 28,
      lineHeight: 34,
      color: c.muted,
    },
    amountInput: {
      ...ledgerType.display,
      fontSize: 44,
      lineHeight: 52,
      color: c.ink,
      minWidth: 60,
      textAlign: 'center',
      padding: 0,
    },
    error: {
      ...ledgerType.body,
      color: c.danger,
      marginTop: ledgerSpace.md,
    },
    optionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ledgerSpace.sm,
      paddingTop: ledgerSpace.md,
    },
  });
}
