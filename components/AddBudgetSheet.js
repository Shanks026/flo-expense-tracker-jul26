import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Crown, Wallet, CalendarDays } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { addDays, format, isBefore, parseISO, startOfDay } from 'date-fns';
import CategoryIcon from './CategoryIcon';
import Sheet from './ledger/Sheet';
import Segmented from './ledger/Segmented';
import ListRow from './ledger/ListRow';
import Button from './ledger/Button';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, tabular, inter } from '../theme/ledger';
import { currencySymbol, sanitizeAmountInput } from '../lib/currency';
import { previewPeriodDates, budgetLimitReached, BUDGET_LIMIT_MESSAGE, createBudget, updateBudget, deleteBudget } from '../lib/budgets';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';
import { useToast } from './Toast';
import useCategories from '../hooks/useCategories';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import useEntitlement from '../hooks/useEntitlement';
import { useProUpsellSheet } from './ProUpsellSheet';
import useCurrency from '../hooks/useCurrency';
import { destructiveHaptic } from '../lib/haptics';

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
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const modalRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef);
  const { notifyChanged } = useDataRefresh();
  const { activeAccountId } = useAccount();
  const currency = useCurrency();
  const { showToast } = useToast();
  const { expenseCategories } = useCategories();
  const { hasPro } = useEntitlement();
  const { openProUpsell } = useProUpsellSheet();
  const [editingId, setEditingId] = useState(null);
  const [amount, setAmount] = useState('');
  const [periodType, setPeriodType] = useState('calendar_month');
  const [startDate, setStartDate] = useState(startOfDay(new Date()));
  const [endDate, setEndDate] = useState(addDays(startOfDay(new Date()), 6));
  const [showPicker, setShowPicker] = useState(null); // 'start' | 'end' | null
  const [categoryId, setCategoryId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // A new budget's account: the opener's (an Ask FLO draft names one), else
  // the active account. An edit never moves a budget between accounts.
  const [accountId, setAccountId] = useState(null);
  // Per open: `onDone({ saved })` runs once when the sheet closes (Ask FLO's
  // card turns to "Saved ✓" from it). Refs: they only matter at save and
  // dismiss time.
  const onDoneRef = useRef(null);
  const savedRef = useRef(false);

  const selectedCategory = expenseCategories.find((c) => c.id === categoryId);
  const isCustom = periodType === 'custom';

  // open(budget):
  // - an existing row (with `id`) opens it for editing;
  // - an object without `id` (Ask FLO's draft, 44-ai-assistant.md phase 4)
  //   fills the fields as a NEW budget: { amount, category_id, period_type,
  //   start_date?, end_date?, account_id?, onDone? }. The free-plan gates
  //   run at Save, since this path skips the Budgets screen's own check;
  // - nothing opens a blank new budget.
  useImperativeHandle(ref, () => ({
    open(budget) {
      setError(null);
      setShowPicker(null);
      onDoneRef.current = budget?.onDone ?? null;
      savedRef.current = false;
      setAccountId(budget?.id ? null : budget?.account_id ?? null);
      if (budget && !budget.id) {
        const today = startOfDay(new Date());
        const custom = budget.period_type === 'custom';
        setEditingId(null);
        setAmount(budget.amount ? String(budget.amount) : '');
        setPeriodType(['calendar_week', 'calendar_month', 'custom'].includes(budget.period_type) ? budget.period_type : 'calendar_month');
        setCategoryId(budget.category_id ?? null);
        setStartDate(custom && budget.start_date ? parseISO(budget.start_date) : today);
        setEndDate(custom && budget.end_date ? parseISO(budget.end_date) : addDays(today, 6));
      } else if (budget) {
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
    // The free-plan gates, for a new budget only (create-time, never on an
    // edit). The Budgets screen checks the count before opening a blank
    // sheet; a draft from Ask FLO arrives here without that, so Save checks
    // again. With FLAGS.billing off, hasPro is true and both pass.
    // Either gate closes this sheet before the upsell opens, so the two
    // sheets never stack.
    if (!editingId) {
      if (isCustom && !hasPro) {
        modalRef.current?.dismiss();
        openProUpsell('Custom periods are a Pro feature');
        return;
      }
      setSaving(true);
      const overLimit = await budgetLimitReached(hasPro);
      setSaving(false);
      if (overLimit) {
        modalRef.current?.dismiss();
        openProUpsell(BUDGET_LIMIT_MESSAGE);
        return;
      }
    }
    const targetAccountId = accountId ?? activeAccountId;
    if (!editingId && !targetAccountId) {
      setError('Still loading your account — try again in a moment');
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
      ? await updateBudget(editingId, payload)
      : await createBudget(targetAccountId, payload);

    setSaving(false);
    if (saveError) {
      showToast({ message: saveError.message, variant: 'error' });
      return;
    }
    if (!editingId) savedRef.current = true;
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: editingId ? 'Budget updated' : 'Budget created', variant: 'success' });
  }

  // Only gates the transition INTO custom while free — re-selecting an
  // already-custom period (editing an existing custom budget, e.g. after a
  // downgrade) is a no-op, not a new gate, per the create-time-only rule.
  function handleSelectPeriod(value) {
    if (value === 'custom' && !hasPro && periodType !== 'custom') {
      openProUpsell('Custom periods are a Pro feature');
      return;
    }
    setPeriodType(value);
  }

  async function handleDelete() {
    if (!editingId) return;
    destructiveHaptic();
    setSaving(true);
    const { error: deleteError } = await deleteBudget(editingId);
    setSaving(false);
    if (deleteError) {
      showToast({ message: deleteError.message, variant: 'error' });
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: 'Budget deleted', variant: 'success' });
  }

  // Hands the outcome to whoever opened the sheet, once per open.
  const handleDismiss = useCallback(() => {
    const onDone = onDoneRef.current;
    onDoneRef.current = null;
    onDone?.({ saved: savedRef.current });
  }, []);

  const periodOptions = Object.entries(PERIOD_LABELS).map(([value, label]) => ({
    value,
    label,
    // The crown marks Custom as Pro while billing is on and the person is free.
    icon: value === 'custom' && !hasPro ? Crown : undefined,
  }));
  // Overall first, then every expense category, as circles like the Add sheet.
  const categoryChoices = [{ id: null, name: 'Overall' }, ...expenseCategories];

  return (
    <Sheet
      ref={modalRef}
      title={editingId ? 'Edit budget' : 'New budget'}
      onChange={handleSheetChange}
      onDismiss={handleDismiss}
      footer={{ primary: { title: editingId ? 'Save' : 'Create budget', onPress: handleSave, loading: saving } }}
    >
      {/* The limit, centred and large, with a muted symbol. */}
      <View style={styles.amountWrap}>
        <Text style={styles.amountCurrency}>{currencySymbol(currency)}</Text>
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
          accessibilityLabel="Limit"
          style={[styles.amountInput, tabular]}
          autoFocus
        />
      </View>

      <Segmented accessibilityLabel="Period" options={periodOptions} value={periodType} onChange={handleSelectPeriod} />

      {isCustom && (
        <View style={styles.dates}>
          <ListRow icon={CalendarDays} title="Start" right={format(startDate, 'd MMM yyyy')} trailing="chevron" onPress={() => setShowPicker('start')} />
          <ListRow icon={CalendarDays} title="End" right={format(endDate, 'd MMM yyyy')} trailing="chevron" onPress={() => setShowPicker('end')} divider={false} />
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
              // Keep the range coherent rather than letting the person save an
              // inverted one and hit the validation wall: moving the start past
              // the end pushes the end along with it.
              if (isBefore(endDate, picked)) setEndDate(picked);
            } else {
              setEndDate(picked);
            }
          }}
        />
      )}

      {/* The window `spent` will really be measured over. */}
      <Text style={styles.range}>{periodRangeLabel(periodType, startDate, endDate)}</Text>

      <Text style={styles.sectionLabel}>Category</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {categoryChoices.map((cat) => {
          const selected = cat.id === categoryId;
          return (
            <Pressable
              key={cat.id ?? 'overall'}
              style={styles.chip}
              accessibilityRole="button"
              accessibilityLabel={cat.name}
              accessibilityState={{ selected }}
              onPress={() => setCategoryId(cat.id)}
            >
              <View style={[styles.chipCircle, selected && styles.chipCircleSelected]}>
                {cat.id ? (
                  <CategoryIcon icon={cat.icon} size={20} color={selected ? c.inkOnInk : c.ink} strokeWidth={1.75} />
                ) : (
                  <Wallet size={20} color={selected ? c.inkOnInk : c.ink} strokeWidth={1.75} />
                )}
              </View>
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]} numberOfLines={1}>
                {cat.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {error && <Text style={styles.error}>{error}</Text>}

      {editingId && <Button title="Delete budget" variant="danger" onPress={handleDelete} disabled={saving} style={styles.delete} />}
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
    dates: {
      marginTop: ledgerSpace.md,
    },
    range: {
      ...ledgerType.caption,
      color: c.muted,
      textAlign: 'center',
      marginTop: ledgerSpace.md,
      marginBottom: ledgerSpace.lg,
    },
    sectionLabel: {
      ...ledgerType.group,
      color: c.muted,
      marginBottom: ledgerSpace.sm,
    },
    // Bleeds to the sheet's edges so the row scrolls edge to edge; the
    // padding puts the first circle back in line with everything else.
    chipScroll: {
      marginHorizontal: -ledgerSpace.gutter,
    },
    chipRow: {
      flexDirection: 'row',
      gap: ledgerSpace.md,
      paddingHorizontal: ledgerSpace.gutter,
      paddingBottom: ledgerSpace.lg,
    },
    chip: {
      alignItems: 'center',
      gap: 6,
      width: 60,
    },
    chipCircle: {
      width: 48,
      height: 48,
      borderRadius: ledgerRadius.full,
      backgroundColor: c.surfaceSunk,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipCircleSelected: {
      backgroundColor: c.ink,
    },
    chipLabel: {
      ...ledgerType.caption,
      color: c.muted,
      textAlign: 'center',
    },
    chipLabelSelected: {
      fontFamily: inter.medium,
      color: c.ink,
    },
    error: {
      ...ledgerType.body,
      color: c.danger,
      marginBottom: ledgerSpace.md,
    },
    delete: {
      marginTop: ledgerSpace.sm,
    },
  });
}
