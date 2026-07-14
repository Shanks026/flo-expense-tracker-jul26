import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import Switch from './Switch';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { X, Trash2 } from 'lucide-react-native';
import { format, addWeeks, addMonths, addYears } from 'date-fns';
import CategoryIcon from './CategoryIcon';
import Button from './Button';
import { colors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useToast } from './Toast';
import useCategories from '../hooks/useCategories';
import useSheetBackHandler from '../hooks/useSheetBackHandler';

const AddBillSheetContext = createContext(null);

export function AddBillSheetProvider({ children }) {
  const sheetRef = useRef(null);
  const openAddBill = useCallback((bill) => sheetRef.current?.open(bill ?? null), []);

  return (
    <AddBillSheetContext.Provider value={{ openAddBill }}>
      {children}
      <AddBillSheet ref={sheetRef} />
    </AddBillSheetContext.Provider>
  );
}

export function useAddBillSheet() {
  const ctx = useContext(AddBillSheetContext);
  if (!ctx) throw new Error('useAddBillSheet must be used within AddBillSheetProvider');
  return ctx;
}

const CADENCES = [
  { key: 'weekly', label: 'Weekly', advance: (d) => addWeeks(d, 1) },
  { key: 'monthly', label: 'Monthly', advance: (d) => addMonths(d, 1) },
  { key: 'yearly', label: 'Yearly', advance: (d) => addYears(d, 1) },
];

const AddBillSheet = forwardRef(function AddBillSheet(_props, ref) {
  const modalRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef);
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();
  const { expenseCategories } = useCategories();

  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState('monthly');
  const [nextDueDate, setNextDueDate] = useState(new Date());
  const [dateTouched, setDateTouched] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [categoryId, setCategoryId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const selectedCategory = expenseCategories.find((c) => c.id === categoryId);

  useImperativeHandle(ref, () => ({
    open(bill) {
      setError(null);
      setPickerOpen(false);
      setShowDatePicker(false);
      if (bill) {
        setEditingId(bill.id);
        setName(bill.name);
        setAmount(String(Math.round(bill.amount)));
        setCadence(bill.cadence);
        setNextDueDate(new Date(bill.next_due_date));
        setDateTouched(true);
        setCategoryId(bill.category_id);
        setIsActive(bill.is_active);
      } else {
        setEditingId(null);
        setName('');
        setAmount('');
        setCadence('monthly');
        setNextDueDate(new Date());
        setDateTouched(false);
        setCategoryId(null);
        setIsActive(true);
      }
      modalRef.current?.present();
    },
  }));

  function handleCadenceChange(nextCadence) {
    setCadence(nextCadence);
    // Suggest a date, but never overwrite one the user already picked —
    // the picker is the source of truth for the anchor date once touched.
    if (!dateTouched) {
      const advance = CADENCES.find((c) => c.key === nextCadence)?.advance;
      if (advance) setNextDueDate(advance(new Date()));
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Enter a bill name');
      return;
    }
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError('Enter an amount');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      name: name.trim(),
      amount: numericAmount,
      cadence,
      next_due_date: format(nextDueDate, 'yyyy-MM-dd'),
      category_id: categoryId,
      is_active: isActive,
    };

    const { error: saveError } = editingId
      ? await supabase.from('bills').update(payload).eq('id', editingId)
      : await supabase.from('bills').insert(payload);

    setSaving(false);
    if (saveError) {
      showToast({ message: saveError.message, variant: 'error' });
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: editingId ? 'Bill updated' : 'Bill created', variant: 'success' });
  }

  async function handleDelete() {
    if (!editingId) return;
    setSaving(true);
    const { error: deleteError } = await supabase.from('bills').delete().eq('id', editingId);
    setSaving(false);
    if (deleteError) {
      showToast({ message: deleteError.message, variant: 'error' });
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: 'Bill deleted', variant: 'success' });
  }

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    []
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      onChange={handleSheetChange}
      snapPoints={useMemo(() => ['85%'], [])}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.ink, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
      handleIndicatorStyle={{ backgroundColor: '#3a3a3a', width: 44 }}
    >
      <BottomSheetScrollView style={{ flex: 1 }} contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{editingId ? 'Edit Bill' : 'New Bill'}</Text>
          <Pressable style={styles.closeButton} onPress={() => modalRef.current?.dismiss()}>
            <X size={16} color={colors.surface} strokeWidth={2.6} />
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Netflix"
          placeholderTextColor={colors.mutedDarker}
          style={styles.textInput}
        />

        <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Amount</Text>
        <View style={styles.amountBox}>
          <Text style={styles.amountCurrency}>₹</Text>
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
            placeholder="0"
            placeholderTextColor={colors.mutedDarker}
            keyboardType="number-pad"
            style={styles.amountInput}
          />
        </View>

        <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Repeats</Text>
        <View style={styles.segmentWrap}>
          {CADENCES.map((c) => (
            <Pressable
              key={c.key}
              style={[styles.segment, cadence === c.key && styles.segmentActive]}
              onPress={() => handleCadenceChange(c.key)}
            >
              <Text style={[styles.segmentText, cadence === c.key && styles.segmentTextActive]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.dateRow} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.fieldLabelInline}>Next Due</Text>
          <Text style={styles.dateValue}>{format(nextDueDate, 'd MMM yyyy')}</Text>
        </Pressable>

        <View style={[styles.row, { marginTop: spacing.md }]}>
          <View>
            <Text style={styles.fieldLabelInline}>Active</Text>
            <Text style={styles.rowHint}>{isActive ? 'Tracking this bill for payment' : 'Paused — hidden from due reminders'}</Text>
          </View>
          <Switch value={isActive} onValueChange={setIsActive} />
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={nextDueDate}
            mode="date"
            display="default"
            onChange={(_event, selected) => {
              setShowDatePicker(false);
              if (selected) {
                setNextDueDate(selected);
                setDateTouched(true);
              }
            }}
          />
        )}

        <Pressable style={[styles.categoryRow, { marginTop: spacing.md }]} onPress={() => setPickerOpen((v) => !v)}>
          <Text style={styles.fieldLabelInline}>Category (optional)</Text>
          <Text style={styles.categoryValue}>{selectedCategory?.name ?? 'None'}</Text>
        </Pressable>

        {pickerOpen && (
          <View style={styles.chipGrid}>
            <Pressable
              style={styles.chip}
              onPress={() => {
                setCategoryId(null);
                setPickerOpen(false);
              }}
            >
              <View style={[styles.chipIcon, categoryId === null && styles.chipIconSelected]}>
                <Text style={styles.chipOverallText}>None</Text>
              </View>
              <Text style={styles.chipLabel} numberOfLines={1}>
                None
              </Text>
            </Pressable>
            {expenseCategories.map((cat) => (
              <Pressable
                key={cat.id}
                style={styles.chip}
                onPress={() => {
                  setCategoryId(cat.id);
                  setPickerOpen(false);
                }}
              >
                <View style={[styles.chipIcon, cat.id === categoryId && styles.chipIconSelected]}>
                  <CategoryIcon icon={cat.icon} size={20} color={colors.surface} strokeWidth={2} />
                </View>
                <Text style={styles.chipLabel} numberOfLines={1}>
                  {cat.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Button
          title={editingId ? 'Save Bill' : 'Create Bill'}
          variant="primary"
          onPress={handleSave}
          loading={saving}
          style={{ marginTop: spacing.lg }}
        />
        {editingId && (
          <Pressable style={styles.deleteRow} onPress={handleDelete} disabled={saving}>
            <Trash2 size={16} color={colors.dangerStrong} strokeWidth={2} />
            <Text style={styles.deleteText}>Delete Bill</Text>
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
    fontSize: fontSize.xl,
    color: colors.surface,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.inkCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.inkCard,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.surface,
  },
  amountBox: {
    backgroundColor: colors.inkCard,
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
    color: colors.mutedDarker,
  },
  amountInput: {
    fontFamily: fontFamily.extrabold,
    fontSize: 26,
    letterSpacing: -0.3,
    color: colors.surface,
    flex: 1,
  },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: colors.inkCard,
    borderRadius: 12,
    padding: 4,
    marginBottom: spacing.md,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 9,
  },
  segmentActive: {
    backgroundColor: colors.brand,
  },
  segmentText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: colors.mutedMid,
  },
  segmentTextActive: {
    fontFamily: fontFamily.extrabold,
    color: colors.ink,
  },
  dateRow: {
    backgroundColor: colors.inkCard,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  fieldLabelInline: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.mutedMid,
  },
  dateValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.base,
    color: colors.surface,
    marginTop: 2,
  },
  row: {
    backgroundColor: colors.inkCard,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowHint: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.mutedDarker,
    marginTop: 2,
  },
  categoryRow: {
    backgroundColor: colors.inkCard,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  categoryValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.base,
    color: colors.surface,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: spacing.md,
  },
  chip: {
    alignItems: 'center',
    gap: 6,
    width: 56,
  },
  chipIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: colors.inkCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipIconSelected: {
    backgroundColor: colors.brand,
  },
  chipOverallText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xs,
    color: colors.surface,
  },
  chipLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.mutedMid,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.dangerStrong,
    textAlign: 'center',
    marginTop: spacing.sm,
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
    color: colors.dangerStrong,
  },
});
