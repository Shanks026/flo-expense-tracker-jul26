import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { X, Trash2, Crown } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { addDays, format, isBefore, parseISO, startOfDay } from 'date-fns';
import CategoryIcon from './CategoryIcon';
import Button from './Button';
import { colors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { currencySymbol, sanitizeAmountInput } from '../lib/currency';
import { previewPeriodDates } from '../lib/budgets';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';
import { useToast } from './Toast';
import useCategories from '../hooks/useCategories';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import useEntitlement from '../hooks/useEntitlement';
import { useProUpsellSheet } from './ProUpsellSheet';
import useCurrency from '../hooks/useCurrency';

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

const PERIOD_LABELS = {
  calendar_week: 'Week',
  calendar_month: 'Month',
  custom: 'Custom',
};

function budgetName(periodType, categoryName) {
  if (periodType === 'custom') return categoryName ?? 'Custom Budget';
  if (!categoryName) return periodType === 'calendar_week' ? 'Weekly Budget' : 'Monthly Budget';
  return periodType === 'calendar_week' ? `${categoryName} — Weekly` : categoryName;
}

// The window this budget will actually be measured over, shown before it's
// saved. For the calendar types this comes from previewPeriodDates(), which is
// deliberately kept in lockstep with the view's own CASE (see lib/budgets.js) —
// so it always shows the same range `spent` is really computed over, never an
// approximation.
function periodRangeLabel(periodType, startDate, endDate) {
  if (periodType === 'custom') {
    return `${format(startDate, 'd MMM')} – ${format(endDate, 'd MMM yyyy')}`;
  }
  const range = previewPeriodDates(periodType);
  if (!range) return '';
  return `${format(range.start, 'd MMM')} – ${format(range.end, 'd MMM')}`;
}

const AddBudgetSheet = forwardRef(function AddBudgetSheet(_props, ref) {
  const modalRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef);
  const { notifyChanged } = useDataRefresh();
  const { activeAccountId } = useAccount();
  const currency = useCurrency();
  const { showToast } = useToast();
  const { expenseCategories } = useCategories();
  const { isPro } = useEntitlement();
  const { openProUpsell } = useProUpsellSheet();
  const [editingId, setEditingId] = useState(null);
  const [amount, setAmount] = useState('');
  const [periodType, setPeriodType] = useState('calendar_month');
  const [startDate, setStartDate] = useState(startOfDay(new Date()));
  const [endDate, setEndDate] = useState(addDays(startOfDay(new Date()), 6));
  const [showPicker, setShowPicker] = useState(null); // 'start' | 'end' | null
  const [categoryId, setCategoryId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const selectedCategory = expenseCategories.find((c) => c.id === categoryId);
  const isCustom = periodType === 'custom';

  useImperativeHandle(ref, () => ({
    open(budget) {
      setError(null);
      setPickerOpen(false);
      setShowPicker(null);
      if (budget) {
        setEditingId(budget.id);
        setAmount(String(budget.amount));
        setPeriodType(budget.period_type);
        setCategoryId(budget.category_id);
        // A calendar budget carries no dates; seed the custom fields with a
        // sane default anyway, so switching it to Custom mid-edit doesn't open
        // onto an empty or nonsensical range.
        const today = startOfDay(new Date());
        setStartDate(budget.start_date ? parseISO(budget.start_date) : today);
        setEndDate(budget.end_date ? parseISO(budget.end_date) : addDays(today, 6));
      } else {
        const today = startOfDay(new Date());
        setEditingId(null);
        setAmount('');
        setPeriodType('calendar_month');
        setCategoryId(null);
        setStartDate(today);
        setEndDate(addDays(today, 6));
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
    // Mirrors the budgets_custom_dates_ck constraint, so an invalid range gets
    // a sentence rather than a raw Postgres constraint violation.
    if (isCustom && isBefore(endDate, startDate)) {
      setError('The end date must be on or after the start date');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      name: budgetName(periodType, selectedCategory?.name),
      amount: numericAmount,
      period_type: periodType,
      category_id: categoryId,
      // The DB constraint requires calendar budgets to carry NO dates — a stale
      // start_date must never outlive a switch back from Custom.
      start_date: isCustom ? format(startDate, 'yyyy-MM-dd') : null,
      end_date: isCustom ? format(endDate, 'yyyy-MM-dd') : null,
    };

    const { error: saveError } = editingId
      ? await supabase.from('budgets').update(payload).eq('id', editingId)
      : await supabase.from('budgets').insert({ ...payload, account_id: activeAccountId });

    setSaving(false);
    if (saveError) {
      showToast({ message: saveError.message, variant: 'error' });
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: editingId ? 'Budget updated' : 'Budget created', variant: 'success' });
  }

  // Only gates the transition INTO custom while free — re-selecting an
  // already-custom period (editing an existing custom budget, e.g. after a
  // downgrade) is a no-op, not a new gate, per the create-time-only rule.
  function handleSelectPeriod(value) {
    if (value === 'custom' && !isPro && periodType !== 'custom') {
      openProUpsell('Custom periods are a Pro feature');
      return;
    }
    setPeriodType(value);
  }

  async function handleDelete() {
    if (!editingId) return;
    setSaving(true);
    const { error: deleteError } = await supabase.from('budgets').delete().eq('id', editingId);
    setSaving(false);
    if (deleteError) {
      showToast({ message: deleteError.message, variant: 'error' });
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: 'Budget deleted', variant: 'success' });
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
          <Text style={styles.amountCurrency}>{currencySymbol(currency)}</Text>
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(sanitizeAmountInput(v))}
            placeholder="0"
            placeholderTextColor={colors.mutedDarker}
            keyboardType="number-pad"
            style={styles.amountInput}
            autoFocus
          />
        </View>

        <View style={styles.segmentWrap}>
          {Object.entries(PERIOD_LABELS).map(([value, label]) => (
            <Pressable
              key={value}
              style={[styles.segment, periodType === value && styles.segmentActive]}
              onPress={() => handleSelectPeriod(value)}
            >
              {value === 'custom' && !isPro && (
                <Crown size={11} color={colors.mutedMid} strokeWidth={2.4} style={styles.segmentCrown} />
              )}
              <Text style={[styles.segmentText, periodType === value && styles.segmentTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {isCustom && (
          <View style={styles.dateRow}>
            <Pressable style={styles.dateField} onPress={() => setShowPicker('start')}>
              <Text style={styles.fieldLabelInline}>Start</Text>
              <Text style={styles.dateValue}>{format(startDate, 'd MMM yyyy')}</Text>
            </Pressable>
            <Pressable style={styles.dateField} onPress={() => setShowPicker('end')}>
              <Text style={styles.fieldLabelInline}>End</Text>
              <Text style={styles.dateValue}>{format(endDate, 'd MMM yyyy')}</Text>
            </Pressable>
          </View>
        )}

        {showPicker && (
          <DateTimePicker
            value={showPicker === 'start' ? startDate : endDate}
            mode="date"
            display="default"
            onChange={(_event, selected) => {
              setShowPicker(null);
              if (!selected) return;
              const picked = startOfDay(selected);
              if (showPicker === 'start') {
                setStartDate(picked);
                // Keep the range coherent rather than letting the user save an
                // inverted one and hit the validation wall: dragging the start
                // past the end pushes the end along with it.
                if (isBefore(endDate, picked)) setEndDate(picked);
              } else {
                setEndDate(picked);
              }
            }}
          />
        )}

        <Text style={styles.periodRangeText}>{periodRangeLabel(periodType, startDate, endDate)}</Text>

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
    marginBottom: spacing.sm,
  },
  periodRangeText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  dateField: {
    flex: 1,
    backgroundColor: colors.inkCard,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  dateValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    color: colors.surface,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 9,
  },
  segmentCrown: {
    marginRight: 4,
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
