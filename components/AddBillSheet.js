import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CalendarDays, BellRing, Minus } from 'lucide-react-native';
import { format, addWeeks, addMonths, addYears, parseISO } from 'date-fns';
import CategoryIcon from './CategoryIcon';
import Sheet from './ledger/Sheet';
import Segmented from './ledger/Segmented';
import ListRow from './ledger/ListRow';
import Button from './ledger/Button';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, tabular, inter } from '../theme/ledger';
import { currencySymbol, DEFAULT_CURRENCY, sanitizeAmountInput } from '../lib/currency';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useToast } from './Toast';
import useCategories from '../hooks/useCategories';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import useProfile from '../hooks/useProfile';
import CurrencyPicker from './CurrencyPicker';
import { destructiveHaptic } from '../lib/haptics';
import { FLAGS } from '../lib/flags';
import IconPicker from './ledger/IconPicker';
import { iconForBillName, billIconKey } from '../lib/billIcons';
import { fillBillIconFromAi, saveBill, deleteBill } from '../lib/bills';

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
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const modalRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef);
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();
  const { expenseCategories } = useCategories();
  const { profile } = useProfile();

  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [cadence, setCadence] = useState('monthly');
  const [nextDueDate, setNextDueDate] = useState(new Date());
  const [dateTouched, setDateTouched] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [categoryId, setCategoryId] = useState(null);
  const [isActive, setIsActive] = useState(true);
  // Bill icons (spec 48): `pickedIcon` is set only by the picker and sticks
  // through renames. `stored` is the saved bill's automatic icon and the name
  // it was found for, kept while the name is unchanged (Ask FLO's pick isn't
  // in the keyword map, so it can't be recomputed here).
  const [pickedIcon, setPickedIcon] = useState(null);
  const [stored, setStored] = useState(null);
  // The name as opened, so Ask FLO is asked only for a new bill or a rename.
  const [openedName, setOpenedName] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Per open: `onDone({ saved })` runs once when the sheet closes (Ask FLO's
  // card turns to "Saved ✓" from it).
  const onDoneRef = useRef(null);
  const savedRef = useRef(false);

  const selectedCategory = expenseCategories.find((c) => c.id === categoryId);

  // open(bill):
  // - an existing row (with `id`) opens it for editing;
  // - an object without `id` (Ask FLO's draft, 44-ai-assistant.md phase 4)
  //   fills the fields as a NEW bill: { name, amount, cadence,
  //   next_due_date, category_id?, onDone? }. The date counts as picked, so
  //   switching the cadence doesn't move it;
  // - nothing opens a blank new bill.
  useImperativeHandle(ref, () => ({
    open(bill) {
      setError(null);
      setShowDatePicker(false);
      setShowIconPicker(false);
      setPickedIcon(bill?.id && bill.icon_picked ? bill.icon : null);
      setStored(bill?.id && !bill.icon_picked && bill.icon ? { icon: bill.icon, name: bill.name } : null);
      setOpenedName(bill?.id ? bill.name : '');
      onDoneRef.current = bill?.onDone ?? null;
      savedRef.current = false;
      if (bill && !bill.id) {
        const due = typeof bill.next_due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(bill.next_due_date);
        setEditingId(null);
        setName(bill.name ?? '');
        setAmount(bill.amount ? String(bill.amount) : '');
        // Currency picker flagged off (lib/flags.js): new bills are INR.
        setCurrency(FLAGS.currencyPicker ? (profile?.currency ?? DEFAULT_CURRENCY) : DEFAULT_CURRENCY);
        setCadence(CADENCES.some((c) => c.key === bill.cadence) ? bill.cadence : 'monthly');
        // parseISO: a bare 'YYYY-MM-DD' is a local day, not UTC midnight.
        setNextDueDate(due ? parseISO(bill.next_due_date) : new Date());
        setDateTouched(due);
        setCategoryId(bill.category_id ?? null);
        setIsActive(true);
      } else if (bill) {
        setEditingId(bill.id);
        setName(bill.name);
        setAmount(String(bill.amount));
        setCurrency(bill.currency ?? DEFAULT_CURRENCY);
        setCadence(bill.cadence);
        setNextDueDate(new Date(bill.next_due_date));
        setDateTouched(true);
        setCategoryId(bill.category_id);
        setIsActive(bill.is_active);
      } else {
        setEditingId(null);
        setName('');
        setAmount('');
        // Currency picker flagged off (lib/flags.js): new bills are INR.
        setCurrency(FLAGS.currencyPicker ? (profile?.currency ?? DEFAULT_CURRENCY) : DEFAULT_CURRENCY);
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

  // What the bill will show: the picked icon, else the name's keyword match,
  // else the saved automatic icon while the name is unchanged, else the
  // category's icon, else a receipt. `autoIcon` is what gets stored unpicked.
  const nameMatch = iconForBillName(name);
  const autoIcon = nameMatch ?? (stored && stored.name === name.trim() ? stored.icon : null);
  const previewIcon = billIconKey({ icon: pickedIcon ?? autoIcon, category: selectedCategory });
  function iconSource() {
    if (pickedIcon) return 'Picked by you';
    if (nameMatch) return 'From the name';
    if (autoIcon) return 'Picked by Ask FLO';
    if (FLAGS.ai && name.trim()) return 'Ask FLO picks one after saving';
    return selectedCategory ? 'From the category' : 'Default';
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
      currency,
      cadence,
      next_due_date: format(nextDueDate, 'yyyy-MM-dd'),
      category_id: categoryId,
      is_active: isActive,
      icon: pickedIcon ?? autoIcon,
      icon_picked: !!pickedIcon,
    };

    const { id: savedId, error: saveError } = await saveBill(payload, editingId);

    setSaving(false);
    if (saveError) {
      showToast({ message: saveError.message, variant: 'error' });
      return;
    }
    if (!editingId) savedRef.current = true;
    notifyChanged();
    // A new or renamed bill with no pick and nothing automatic: ask Ask FLO
    // once, after the save and without waiting for it. The write is skipped
    // if the person picks an icon or renames the bill meanwhile.
    const renamed = !editingId || payload.name !== openedName;
    if (FLAGS.ai && !payload.icon && renamed && savedId) {
      fillBillIconFromAi(savedId, payload.name).then(({ icon }) => {
        if (icon) notifyChanged();
      });
    }
    modalRef.current?.dismiss();
    showToast({ message: editingId ? 'Bill updated' : 'Bill created', variant: 'success' });
  }

  // Hands the outcome to whoever opened the sheet, once per open.
  const handleDismiss = useCallback(() => {
    const onDone = onDoneRef.current;
    onDoneRef.current = null;
    onDone?.({ saved: savedRef.current });
  }, []);

  async function handleDelete() {
    if (!editingId) return;
    destructiveHaptic();
    setSaving(true);
    const { error: deleteError } = await deleteBill(editingId);
    setSaving(false);
    if (deleteError) {
      showToast({ message: deleteError.message, variant: 'error' });
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: 'Bill deleted', variant: 'success' });
  }

  // None first, then every expense category, as circles like the Add sheet.
  const categoryChoices = [{ id: null, name: 'None' }, ...expenseCategories];

  return (
    <Sheet
      ref={modalRef}
      title={editingId ? 'Edit bill' : 'New bill'}
      onChange={handleSheetChange}
      onDismiss={handleDismiss}
      footer={{ primary: { title: editingId ? 'Save' : 'Create bill', onPress: handleSave, loading: saving } }}
    >
      <Text style={styles.label}>Name</Text>
      <BottomSheetTextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Netflix, rent, electricity"
        placeholderTextColor={c.muted}
        cursorColor={c.accent}
        selectionColor={c.accent}
        accessibilityLabel="Bill name"
        maxLength={80}
        style={styles.field}
      />

      <View style={styles.block}>
        <ListRow
          tone={selectedCategory?.color ?? undefined}
          renderIcon={(tint) => <CategoryIcon icon={previewIcon} size={18} color={tint} strokeWidth={1.75} />}
          title="Icon"
          sub={iconSource()}
          right={showIconPicker ? 'Done' : 'Change'}
          onPress={() => setShowIconPicker((v) => !v)}
          divider={false}
        />
        {showIconPicker && (
          <View>
            <IconPicker
              value={pickedIcon}
              onChange={(key) => setPickedIcon(key === pickedIcon ? null : key)}
              accessibilityLabel="Bill icon"
            />
            {pickedIcon && (
              <Button title="Use the automatic icon" variant="quiet" onPress={() => setPickedIcon(null)} style={styles.autoIcon} />
            )}
          </View>
        )}
      </View>

      {/* The amount, centred and large, with a muted symbol. */}
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
          accessibilityLabel="Amount"
          style={[styles.amountInput, tabular]}
        />
      </View>

      {FLAGS.currencyPicker && <CurrencyPicker value={currency} onChange={setCurrency} style={styles.block} />}

      <Text style={styles.label}>Repeats</Text>
      <Segmented
        accessibilityLabel="Repeats"
        options={CADENCES.map((cd) => ({ value: cd.key, label: cd.label }))}
        value={cadence}
        onChange={handleCadenceChange}
      />

      <View style={styles.rows}>
        <ListRow icon={CalendarDays} title="Next due" right={format(nextDueDate, 'd MMM yyyy')} trailing="chevron" onPress={() => setShowDatePicker(true)} />
        <ListRow
          icon={BellRing}
          title="Active"
          sub={isActive ? 'Tracking this bill for payment' : 'Paused, hidden from due reminders'}
          switchValue={isActive}
          onSwitchChange={setIsActive}
          divider={false}
        />
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

      <Text style={styles.label}>Category</Text>
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
              key={cat.id ?? 'none'}
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
                  <Minus size={20} color={selected ? c.inkOnInk : c.ink} strokeWidth={1.75} />
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

      {editingId && <Button title="Delete bill" variant="danger" onPress={handleDelete} disabled={saving} style={styles.delete} />}
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
    block: {
      marginBottom: ledgerSpace.lg,
    },
    rows: {
      marginTop: ledgerSpace.md,
      marginBottom: ledgerSpace.lg,
    },
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
    // Bleeds to the sheet's edges so the row scrolls edge to edge; the
    // padding puts the first circle back in line with everything else.
    chipScroll: {
      marginHorizontal: -ledgerSpace.gutter,
    },
    chipRow: {
      flexDirection: 'row',
      gap: ledgerSpace.md,
      paddingHorizontal: ledgerSpace.gutter,
      paddingBottom: ledgerSpace.sm,
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
    delete: {
      marginTop: ledgerSpace.lg,
    },
    autoIcon: {
      alignSelf: 'center',
      marginTop: ledgerSpace.sm,
    },
  });
}
