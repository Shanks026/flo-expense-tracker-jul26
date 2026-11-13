import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CalendarDays, CalendarCheck, Inbox } from 'lucide-react-native';
import { format } from 'date-fns';
import Sheet from './ledger/Sheet';
import Button from './ledger/Button';
import ListRow from './ledger/ListRow';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, tabular } from '../theme/ledger';
import { currencySymbol, sanitizeAmountInput } from '../lib/currency';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';
import { useToast } from './Toast';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import useCollectingPlan from '../hooks/useCollectingPlan';
import useCurrency from '../hooks/useCurrency';
import { destructiveHaptic } from '../lib/haptics';

const AddPlanSheetContext = createContext(null);

export function AddPlanSheetProvider({ children }) {
  const sheetRef = useRef(null);
  const openAddPlan = useCallback((plan) => sheetRef.current?.open(plan ?? null), []);

  return (
    <AddPlanSheetContext.Provider value={{ openAddPlan }}>
      {children}
      <AddPlanSheet ref={sheetRef} />
    </AddPlanSheetContext.Provider>
  );
}

export function useAddPlanSheet() {
  const ctx = useContext(AddPlanSheetContext);
  if (!ctx) throw new Error('useAddPlanSheet must be used within AddPlanSheetProvider');
  return ctx;
}

const AddPlanSheet = forwardRef(function AddPlanSheet(_props, ref) {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const modalRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef);
  const { notifyChanged } = useDataRefresh();
  const { activeAccountId } = useAccount();
  const { showToast } = useToast();
  const { plan: collectingPlan } = useCollectingPlan();
  const currency = useCurrency();

  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [datePickerFor, setDatePickerFor] = useState(null);
  const [isCollecting, setIsCollecting] = useState(false);
  const [accountId, setAccountId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useImperativeHandle(ref, () => ({
    open(plan) {
      setError(null);
      setDatePickerFor(null);
      if (plan) {
        setEditingId(plan.id);
        setName(plan.name);
        setTargetAmount(plan.target_amount ? String(plan.target_amount) : '');
        setStartDate(plan.start_date ? new Date(plan.start_date) : null);
        setEndDate(plan.end_date ? new Date(plan.end_date) : null);
        setAccountId(plan.account_id ?? activeAccountId);
        // is_collecting isn't carried on the plan row (v_plans_with_totals omits
        // it) — derive the switch's initial state from the active account's
        // collecting plan instead.
        setIsCollecting(collectingPlan?.id === plan.id);
      } else {
        setEditingId(null);
        setName('');
        setTargetAmount('');
        setStartDate(null);
        setEndDate(null);
        setAccountId(activeAccountId);
        setIsCollecting(false);
      }
      modalRef.current?.present();
    },
  }));

  async function handleSave() {
    if (!name.trim()) {
      setError('Enter a plan name');
      return;
    }
    setSaving(true);
    setError(null);

    // "At most one collecting plan per account" is DB-enforced (partial unique
    // index). If we're arming this plan, clear whatever is armed in this account
    // FIRST, or the insert/update violates the index. Same ordering rule as
    // lib/plans.js's setPlanCollecting, used by the Plan Detail toggle.
    if (isCollecting) {
      const { error: clearError } = await supabase
        .from('plans')
        .update({ is_collecting: false })
        .eq('account_id', accountId)
        .eq('is_collecting', true);
      if (clearError) {
        setSaving(false);
        showToast({ message: clearError.message, variant: 'error' });
        return;
      }
    }

    const payload = {
      name: name.trim(),
      target_amount: targetAmount ? Number(targetAmount) : null,
      start_date: startDate ? format(startDate, 'yyyy-MM-dd') : null,
      end_date: endDate ? format(endDate, 'yyyy-MM-dd') : null,
      is_collecting: isCollecting,
    };

    const { error: saveError } = editingId
      ? await supabase.from('plans').update(payload).eq('id', editingId)
      : await supabase.from('plans').insert({ ...payload, account_id: activeAccountId });

    setSaving(false);
    if (saveError) {
      showToast({ message: saveError.message, variant: 'error' });
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: editingId ? 'Plan updated' : 'Plan created', variant: 'success' });
  }

  async function handleDelete() {
    if (!editingId) return;
    destructiveHaptic();
    setSaving(true);
    const { error: deleteError } = await supabase.from('plans').delete().eq('id', editingId);
    setSaving(false);
    if (deleteError) {
      showToast({ message: deleteError.message, variant: 'error' });
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: 'Plan deleted', variant: 'success' });
  }

  return (
    <Sheet
      ref={modalRef}
      title={editingId ? 'Edit plan' : 'New plan'}
      onChange={handleSheetChange}
      footer={{ primary: { title: editingId ? 'Save' : 'Create plan', onPress: handleSave, loading: saving } }}
    >
      <Text style={styles.label}>Name</Text>
      <BottomSheetTextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Goa Trip"
        placeholderTextColor={c.muted}
        cursorColor={c.accent}
        selectionColor={c.accent}
        accessibilityLabel="Plan name"
        style={styles.field}
      />

      <Text style={styles.label}>Target amount (optional)</Text>
      <View style={styles.amountWrap}>
        <Text style={styles.amountCurrency}>{currencySymbol(currency)}</Text>
        <BottomSheetTextInput
          value={targetAmount}
          onChangeText={(v) => setTargetAmount(sanitizeAmountInput(v))}
          placeholder="No target"
          placeholderTextColor={c.inkFaint}
          cursorColor={c.accent}
          selectionColor={c.accent}
          keyboardType="number-pad"
          accessibilityLabel="Target amount"
          style={[styles.amountInput, tabular]}
        />
      </View>

      <ListRow icon={CalendarDays} title="Start date" right={startDate ? format(startDate, 'd MMM yyyy') : 'None'} trailing="chevron" onPress={() => setDatePickerFor('start')} />
      <ListRow icon={CalendarCheck} title="End date" right={endDate ? format(endDate, 'd MMM yyyy') : 'None'} trailing="chevron" onPress={() => setDatePickerFor('end')} />

      {datePickerFor && (
        <DateTimePicker
          value={(datePickerFor === 'start' ? startDate : endDate) ?? new Date()}
          mode="date"
          display="default"
          onChange={(_event, selected) => {
            setDatePickerFor(null);
            if (!selected) return;
            if (datePickerFor === 'start') setStartDate(selected);
            else setEndDate(selected);
          }}
        />
      )}

      <ListRow
        icon={Inbox}
        title="Collect new transactions"
        sub="New expenses default into this plan until you turn it off"
        subLines={2}
        switchValue={isCollecting}
        onSwitchChange={setIsCollecting}
        divider={false}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      {editingId && <Button title="Delete plan" variant="danger" onPress={handleDelete} disabled={saving} style={styles.delete} />}
    </Sheet>
  );
});

function makeStyles(c) {
  return StyleSheet.create({
    label: {
      ...ledgerType.group,
      color: c.muted,
      marginBottom: ledgerSpace.sm,
    },
    // A single-line input: a full capsule (ledgerRadius.field).
    field: {
      height: 48,
      paddingHorizontal: ledgerSpace.lg,
      paddingVertical: 0,
      borderRadius: ledgerRadius.field,
      backgroundColor: c.surfaceSunk,
      ...ledgerType.body,
      color: c.ink,
      marginBottom: ledgerSpace.lg,
    },
    amountWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 48,
      paddingHorizontal: ledgerSpace.lg,
      borderRadius: ledgerRadius.field,
      backgroundColor: c.surfaceSunk,
      marginBottom: ledgerSpace.md,
    },
    amountCurrency: {
      ...ledgerType.body,
      color: c.muted,
      marginRight: 4,
    },
    amountInput: {
      ...ledgerType.body,
      color: c.ink,
      flex: 1,
      padding: 0,
    },
    error: {
      ...ledgerType.body,
      color: c.danger,
      marginTop: ledgerSpace.md,
    },
    delete: {
      marginTop: ledgerSpace.lg,
    },
  });
}
