import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { X, Trash2, ChevronDown } from 'lucide-react-native';
import { format, isToday, isYesterday } from 'date-fns';
import CategoryIcon from './CategoryIcon';
import Button from './Button';
import { colors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';
import { useAccountSwitcherSheet } from './AccountSwitcherSheet';
import { useToast } from './Toast';
import useCategories from '../hooks/useCategories';
import usePlans from '../hooks/usePlans';
import { budgetToastForSave, planToastForSave } from '../lib/alerts';

const AddTransactionSheetContext = createContext(null);

export function AddTransactionSheetProvider({ children }) {
  const sheetRef = useRef(null);
  const openAdd = useCallback((payload) => sheetRef.current?.open(payload ?? null), []);

  return (
    <AddTransactionSheetContext.Provider value={{ openAdd }}>
      {children}
      <AddTransactionSheet ref={sheetRef} />
    </AddTransactionSheetContext.Provider>
  );
}

export function useAddTransactionSheet() {
  const ctx = useContext(AddTransactionSheetContext);
  if (!ctx) throw new Error('useAddTransactionSheet must be used within AddTransactionSheetProvider');
  return ctx;
}

function formatDateLabel(date) {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'd MMM yyyy');
}

const AddTransactionSheet = forwardRef(function AddTransactionSheet(_props, ref) {
  const modalRef = useRef(null);
  const { notifyChanged } = useDataRefresh();
  const { activeAccountId, activeAccount } = useAccount();
  const { openAccountSwitcher } = useAccountSwitcherSheet();
  const { showToast } = useToast();
  const { expenseCategories, incomeCategories } = useCategories();
  const { activePlans } = usePlans();

  const [editingId, setEditingId] = useState(null);
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [planId, setPlanId] = useState(null);
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const categories = type === 'expense' ? expenseCategories : incomeCategories;
  const selectedPlan = activePlans.find((p) => p.id === planId);

  useImperativeHandle(ref, () => ({
    open(payload) {
      setError(null);
      setPlanPickerOpen(false);
      if (payload?.id) {
        const tx = payload;
        setEditingId(tx.id);
        setType(tx.type);
        setAmount(String(Math.round(tx.amount)));
        setCategoryId(tx.category_id);
        setPlanId(tx.plan_id);
        setDate(new Date(tx.occurred_at));
        setNote(tx.note ?? '');
      } else {
        const prefillType = payload?.type ?? 'expense';
        setEditingId(null);
        setType(prefillType);
        setAmount(payload?.amount ? String(Math.round(payload.amount)) : '');
        const prefillList = prefillType === 'expense' ? expenseCategories : incomeCategories;
        setCategoryId(prefillList[0]?.id ?? null);
        setPlanId(payload?.plan_id ?? null);
        setDate(new Date());
        setNote(payload?.note ?? '');
      }
      modalRef.current?.present();
    },
  }));

  function handleTypeChange(nextType) {
    setType(nextType);
    const list = nextType === 'expense' ? expenseCategories : incomeCategories;
    setCategoryId(list[0]?.id ?? null);
  }

  async function handleSave() {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError('Enter an amount');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      type,
      amount: numericAmount,
      category_id: categoryId,
      plan_id: planId,
      occurred_at: format(date, 'yyyy-MM-dd'),
      note: note.trim() || null,
    };

    const { error: saveError } = editingId
      ? await supabase.from('transactions').update(payload).eq('id', editingId)
      : await supabase.from('transactions').insert({ ...payload, account_id: activeAccountId });

    setSaving(false);
    if (saveError) {
      showToast({ message: saveError.message, variant: 'error' });
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: editingId ? 'Transaction updated' : 'Transaction saved', variant: 'success' });

    if (!editingId && type === 'expense') {
      const budgetMsg = await budgetToastForSave({ categoryId, accountId: activeAccountId });
      const planMsg = planId ? await planToastForSave({ planId }) : null;
      if (budgetMsg) showToast({ message: budgetMsg, variant: 'warn' });
      if (planMsg) showToast({ message: planMsg, variant: 'warn' });
    }
  }

  async function handleDelete() {
    if (!editingId) return;
    setSaving(true);
    const { error: deleteError } = await supabase.from('transactions').delete().eq('id', editingId);
    setSaving(false);
    if (deleteError) {
      showToast({ message: deleteError.message, variant: 'error' });
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: 'Transaction deleted', variant: 'success' });
  }

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    []
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={useMemo(() => ['92%'], [])}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.bg, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
      handleIndicatorStyle={{ backgroundColor: '#DADCD4', width: 44 }}
    >
      <BottomSheetScrollView style={{ flex: 1 }} contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{editingId ? 'Edit Transaction' : 'Add Transaction'}</Text>
          <Pressable style={styles.closeButton} onPress={() => modalRef.current?.dismiss()}>
            <X size={16} color={colors.ink} strokeWidth={2.6} />
          </Pressable>
        </View>

        {activeAccount && (
          <Pressable
            style={styles.accountRow}
            onPress={() => {
              modalRef.current?.dismiss();
              openAccountSwitcher();
            }}
          >
            <View style={[styles.accountDot, { backgroundColor: activeAccount.color }]} />
            <Text style={styles.accountText}>
              Adding to <Text style={styles.accountName}>{activeAccount.name}</Text>
            </Text>
          </Pressable>
        )}

        <View style={styles.segmentWrap}>
          <Pressable
            style={[styles.segment, type === 'expense' && styles.segmentActive]}
            onPress={() => handleTypeChange('expense')}
          >
            <Text style={[styles.segmentText, type === 'expense' && styles.segmentTextActive]}>Expense</Text>
          </Pressable>
          <Pressable
            style={[styles.segment, type === 'income' && styles.segmentActive]}
            onPress={() => handleTypeChange('income')}
          >
            <Text style={[styles.segmentText, type === 'income' && styles.segmentTextActive]}>Income</Text>
          </Pressable>
        </View>

        <View style={styles.amountWrap}>
          <Text style={styles.amountLabel}>Amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountCurrency}>₹</Text>
            <TextInput
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
              placeholder="0"
              placeholderTextColor={colors.mutedLight}
              keyboardType="number-pad"
              style={styles.amountInput}
              autoFocus
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>CATEGORY</Text>
        <ScrollView key={type} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {categories.map((cat) => {
            const selected = cat.id === categoryId;
            return (
              <Pressable key={cat.id} style={styles.chip} onPress={() => setCategoryId(cat.id)}>
                <View style={[styles.chipIcon, selected && styles.chipIconSelected]}>
                  <CategoryIcon icon={cat.icon} size={22} color={selected ? colors.ink : colors.ink} strokeWidth={2} />
                </View>
                <Text style={[styles.chipLabel, !selected && styles.chipLabelInactive]} numberOfLines={1}>
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.dateAndPlanRow}>
          <Pressable style={[styles.dateRow, { flex: 1 }]} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.fieldLabel}>Date</Text>
            <Text style={styles.fieldValue}>{formatDateLabel(date)}</Text>
          </Pressable>
          <Pressable style={[styles.dateRow, { flex: 1 }]} onPress={() => setPlanPickerOpen((v) => !v)}>
            <View style={styles.planRowInner}>
              <View>
                <Text style={styles.fieldLabel}>Add to Plan</Text>
                <Text style={[styles.fieldValue, selectedPlan && styles.fieldValuePlan]} numberOfLines={1}>
                  {selectedPlan?.name ?? 'None'}
                </Text>
              </View>
              <ChevronDown size={16} color={colors.muted} strokeWidth={2.4} />
            </View>
          </Pressable>
        </View>
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={(_event, selected) => {
              setShowDatePicker(false);
              if (selected) setDate(selected);
            }}
          />
        )}
        {planPickerOpen && (
          <View style={styles.planPicker}>
            <Pressable
              style={[styles.planOption, planId === null && styles.planOptionSelected]}
              onPress={() => {
                setPlanId(null);
                setPlanPickerOpen(false);
              }}
            >
              <Text style={[styles.planOptionText, planId === null && styles.planOptionTextSelected]}>None</Text>
            </Pressable>
            {activePlans.map((p) => (
              <Pressable
                key={p.id}
                style={[styles.planOption, planId === p.id && styles.planOptionSelected]}
                onPress={() => {
                  setPlanId(p.id);
                  setPlanPickerOpen(false);
                }}
              >
                <Text style={[styles.planOptionText, planId === p.id && styles.planOptionTextSelected]} numberOfLines={1}>
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.noteRow}>
          <Text style={styles.fieldLabel}>Note</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a note…"
            placeholderTextColor={colors.mutedLight}
            style={styles.noteInput}
          />
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Button title="Save" onPress={handleSave} loading={saving} style={{ marginTop: spacing.md }} />
        {editingId && (
          <Pressable style={styles.deleteRow} onPress={handleDelete} disabled={saving}>
            <Trash2 size={16} color={colors.danger} strokeWidth={2} />
            <Text style={styles.deleteText}>Delete Transaction</Text>
          </Pressable>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.title,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.chipBg,
    borderRadius: radii.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginBottom: spacing.lg,
  },
  accountDot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
  },
  accountText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.mutedDarker,
  },
  accountName: {
    fontFamily: fontFamily.extrabold,
    color: colors.ink,
  },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: colors.chipBg,
    borderRadius: 14,
    padding: 4,
    marginBottom: spacing.xl,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 11,
  },
  segmentActive: {
    backgroundColor: colors.ink,
  },
  segmentText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.muted,
  },
  segmentTextActive: {
    fontFamily: fontFamily.extrabold,
    color: colors.surface,
  },
  amountWrap: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  amountLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    color: colors.mutedMid,
    marginBottom: 2,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  amountCurrency: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.amount,
    color: colors.mutedLight,
  },
  amountInput: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.amountXl,
    letterSpacing: -0.6,
    color: colors.ink,
    minWidth: 80,
    textAlign: 'center',
  },
  sectionLabel: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 14,
    paddingBottom: spacing.lg,
  },
  chip: {
    alignItems: 'center',
    gap: 6,
    width: 60,
  },
  chipIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipIconSelected: {
    backgroundColor: colors.brand,
    borderWidth: 0,
  },
  chipLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: colors.ink,
    textAlign: 'center',
  },
  chipLabelInactive: {
    fontFamily: fontFamily.semibold,
    color: colors.muted,
  },
  dateAndPlanRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dateRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  planRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldValuePlan: {
    color: colors.income,
  },
  planPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  planOption: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planOptionSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  planOptionText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  planOptionTextSelected: {
    color: colors.surface,
  },
  fieldLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.mutedMid,
  },
  fieldValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    color: colors.ink,
    marginTop: 1,
  },
  noteRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    marginBottom: spacing.md,
  },
  noteInput: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.ink,
    marginTop: 1,
    padding: 0,
  },
  errorText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.danger,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  deleteText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: colors.danger,
  },
});
