import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { X, Trash2 } from 'lucide-react-native';
import { format } from 'date-fns';
import Button from './Button';
import { colors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';
import { useToast } from './Toast';
import useSheetBackHandler from '../hooks/useSheetBackHandler';

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
  const modalRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef);
  const { notifyChanged } = useDataRefresh();
  const { activeAccountId } = useAccount();
  const { showToast } = useToast();

  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [datePickerFor, setDatePickerFor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useImperativeHandle(ref, () => ({
    open(plan) {
      setError(null);
      setDatePickerFor(null);
      if (plan) {
        setEditingId(plan.id);
        setName(plan.name);
        setTargetAmount(plan.target_amount ? String(Math.round(plan.target_amount)) : '');
        setStartDate(plan.start_date ? new Date(plan.start_date) : null);
        setEndDate(plan.end_date ? new Date(plan.end_date) : null);
      } else {
        setEditingId(null);
        setName('');
        setTargetAmount('');
        setStartDate(null);
        setEndDate(null);
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

    const payload = {
      name: name.trim(),
      target_amount: targetAmount ? Number(targetAmount) : null,
      start_date: startDate ? format(startDate, 'yyyy-MM-dd') : null,
      end_date: endDate ? format(endDate, 'yyyy-MM-dd') : null,
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

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    []
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      onChange={handleSheetChange}
      snapPoints={useMemo(() => ['62%'], [])}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.ink, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
      handleIndicatorStyle={{ backgroundColor: '#3a3a3a', width: 44 }}
    >
      <BottomSheetScrollView style={{ flex: 1 }} contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{editingId ? 'Edit Plan' : 'New Plan'}</Text>
          <Pressable style={styles.closeButton} onPress={() => modalRef.current?.dismiss()}>
            <X size={16} color={colors.surface} strokeWidth={2.6} />
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Goa Trip"
          placeholderTextColor={colors.mutedDarker}
          style={styles.textInput}
        />

        <Text style={styles.fieldLabel}>Target amount (optional)</Text>
        <View style={styles.amountBox}>
          <Text style={styles.amountCurrency}>₹</Text>
          <TextInput
            value={targetAmount}
            onChangeText={(v) => setTargetAmount(v.replace(/[^0-9]/g, ''))}
            placeholder="No target"
            placeholderTextColor={colors.mutedDarker}
            keyboardType="number-pad"
            style={styles.amountInput}
          />
        </View>

        <View style={styles.dateRowWrap}>
          <Pressable style={styles.dateRow} onPress={() => setDatePickerFor('start')}>
            <Text style={styles.fieldLabelInline}>Start date</Text>
            <Text style={styles.dateValue}>{startDate ? format(startDate, 'd MMM yyyy') : 'None'}</Text>
          </Pressable>
          <Pressable style={styles.dateRow} onPress={() => setDatePickerFor('end')}>
            <Text style={styles.fieldLabelInline}>End date</Text>
            <Text style={styles.dateValue}>{endDate ? format(endDate, 'd MMM yyyy') : 'None'}</Text>
          </Pressable>
        </View>

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

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Button
          title={editingId ? 'Save Plan' : 'Create Plan'}
          variant="primary"
          onPress={handleSave}
          loading={saving}
          style={{ marginTop: spacing.lg }}
        />
        {editingId && (
          <Pressable style={styles.deleteRow} onPress={handleDelete} disabled={saving}>
            <Trash2 size={16} color={colors.dangerStrong} strokeWidth={2} />
            <Text style={styles.deleteText}>Delete Plan</Text>
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
    marginTop: spacing.md,
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
    fontSize: 22,
    letterSpacing: -0.3,
    color: colors.surface,
    flex: 1,
  },
  dateRowWrap: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  dateRow: {
    flex: 1,
    backgroundColor: colors.inkCard,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
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
  errorText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.dangerStrong,
    textAlign: 'center',
    marginTop: spacing.md,
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
