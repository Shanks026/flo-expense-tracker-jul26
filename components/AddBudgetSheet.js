import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { X, Trash2 } from 'lucide-react-native';
import CategoryIcon from './CategoryIcon';
import Button from './Button';
import { colors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import useCategories from '../hooks/useCategories';

const AddBudgetSheetContext = createContext(null);

export function AddBudgetSheetProvider({ children }) {
  const sheetRef = useRef(null);
  const openAddBudget = useCallback((budget) => sheetRef.current?.open(budget ?? null), []);

  return (
    <AddBudgetSheetContext.Provider value={{ openAddBudget }}>
      {children}
      <AddBudgetSheet ref={sheetRef} />
    </AddBudgetSheetContext.Provider>
  );
}

export function useAddBudgetSheet() {
  const ctx = useContext(AddBudgetSheetContext);
  if (!ctx) throw new Error('useAddBudgetSheet must be used within AddBudgetSheetProvider');
  return ctx;
}

function budgetName(period, categoryName) {
  if (!categoryName) return period === 'week' ? 'Weekly Budget' : 'Monthly Budget';
  return period === 'week' ? `${categoryName} — Weekly` : categoryName;
}

const AddBudgetSheet = forwardRef(function AddBudgetSheet(_props, ref) {
  const modalRef = useRef(null);
  const { notifyChanged } = useDataRefresh();
  const { expenseCategories } = useCategories();
  const [editingId, setEditingId] = useState(null);
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState('month');
  const [categoryId, setCategoryId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const selectedCategory = expenseCategories.find((c) => c.id === categoryId);

  useImperativeHandle(ref, () => ({
    open(budget) {
      setError(null);
      setPickerOpen(false);
      if (budget) {
        setEditingId(budget.id);
        setAmount(String(Math.round(budget.amount)));
        setPeriod(budget.period);
        setCategoryId(budget.category_id);
      } else {
        setEditingId(null);
        setAmount('');
        setPeriod('month');
        setCategoryId(null);
      }
      modalRef.current?.present();
    },
  }));

  async function handleSave() {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError('Enter an amount');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      name: budgetName(period, selectedCategory?.name),
      amount: numericAmount,
      period,
      category_id: categoryId,
    };

    const { error: saveError } = editingId
      ? await supabase.from('budgets').update(payload).eq('id', editingId)
      : await supabase.from('budgets').insert(payload);

    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
  }

  async function handleDelete() {
    if (!editingId) return;
    setSaving(true);
    const { error: deleteError } = await supabase.from('budgets').delete().eq('id', editingId);
    setSaving(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
  }

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    []
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={useMemo(() => ['70%'], [])}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.ink, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
      handleIndicatorStyle={{ backgroundColor: '#3a3a3a', width: 44 }}
    >
      <BottomSheetView style={styles.sheet}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{editingId ? 'Edit Budget' : 'New Budget'}</Text>
          <Pressable style={styles.closeButton} onPress={() => modalRef.current?.dismiss()}>
            <X size={16} color={colors.surface} strokeWidth={2.6} />
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>Amount</Text>
        <View style={styles.amountBox}>
          <Text style={styles.amountCurrency}>₹</Text>
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
            placeholder="0"
            placeholderTextColor={colors.mutedDarker}
            keyboardType="number-pad"
            style={styles.amountInput}
            autoFocus
          />
        </View>

        <View style={styles.segmentWrap}>
          <Pressable style={[styles.segment, period === 'week' && styles.segmentActive]} onPress={() => setPeriod('week')}>
            <Text style={[styles.segmentText, period === 'week' && styles.segmentTextActive]}>Week</Text>
          </Pressable>
          <Pressable style={[styles.segment, period === 'month' && styles.segmentActive]} onPress={() => setPeriod('month')}>
            <Text style={[styles.segmentText, period === 'month' && styles.segmentTextActive]}>Month</Text>
          </Pressable>
        </View>

        <Pressable style={styles.categoryRow} onPress={() => setPickerOpen((v) => !v)}>
          <Text style={styles.fieldLabelInline}>Category (optional)</Text>
          <Text style={styles.categoryValue}>{selectedCategory?.name ?? 'Overall'}</Text>
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
                <Text style={styles.chipOverallText}>All</Text>
              </View>
              <Text style={styles.chipLabel} numberOfLines={1}>
                Overall
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
          title={editingId ? 'Save Budget' : 'Create Budget'}
          variant="primary"
          onPress={handleSave}
          loading={saving}
          style={{ marginTop: spacing.lg }}
        />
        {editingId && (
          <Pressable style={styles.deleteRow} onPress={handleDelete} disabled={saving}>
            <Trash2 size={16} color={colors.dangerStrong} strokeWidth={2} />
            <Text style={styles.deleteText}>Delete Budget</Text>
          </Pressable>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    paddingHorizontal: spacing.xl,
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
  amountBox: {
    backgroundColor: colors.inkCard,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.lg,
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
    marginBottom: spacing.lg,
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
  fieldLabelInline: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    color: colors.mutedMid,
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
    fontSize: fontSize.sm,
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
