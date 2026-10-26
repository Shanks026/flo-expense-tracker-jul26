import { forwardRef, useImperativeHandle, useRef, useState, useEffect, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { X, Trash2, ChevronDown, ChevronUp, MoreHorizontal, ArrowLeftRight, Wallet, Crown } from 'lucide-react-native';
import { format, isToday, isYesterday, subDays } from 'date-fns';
import CategoryIcon from './CategoryIcon';
import Button from './Button';
import { radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { currencySymbol, formatMoney, sanitizeAmountInput } from '../lib/currency';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';
import { useToast } from './Toast';
import useCategories from '../hooks/useCategories';
import useCategoryUsage from '../hooks/useCategoryUsage';
import { rankCategories, defaultCategoryId, gridCategories, GRID_SIZE } from '../lib/categoryDefaults';
import useSplits from '../hooks/useSplits';
import { createEntryFromTransaction } from '../lib/splits';
import { isTransfer, logTransfer, updateTransfer, deleteTransfer } from '../lib/transfers';
import { claimDailyLog } from '../lib/rewardsMutations';
import { track } from '../lib/track';
import { setMomentBlocker } from '../lib/momentQueue';
import * as Haptics from 'expo-haptics';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import useEntitlement from '../hooks/useEntitlement';
import { useProUpsellSheet } from './ProUpsellSheet';
import { useAddAccountSheet } from './AddAccountSheet';

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

// A From/To account picker for Transfer mode. `exclude` is the account chosen in
// the *other* field, dropped from these options so From and To can never be the
// same account. Same inline-dropdown shape as the plan picker.
function AccountField({ label, value, exclude, accounts, open, onToggle, onSelect, styles }) {
  const { colors } = useTheme();
  const selected = accounts.find((a) => a.id === value);
  const options = accounts.filter((a) => a.id !== exclude);
  return (
    <>
      <Pressable style={styles.accountField} onPress={onToggle}>
        <View>
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={[styles.fieldValue, selected && styles.fieldValuePlan]} numberOfLines={1}>
            {selected?.name ?? 'Select account'}
          </Text>
        </View>
        <ChevronDown size={16} color={colors.muted} strokeWidth={2.4} />
      </Pressable>
      {open && (
        <View style={styles.planPicker}>
          {options.map((a) => (
            <Pressable
              key={a.id}
              style={[styles.planOption, value === a.id && styles.planOptionSelected]}
              onPress={() => onSelect(a.id)}
            >
              <Text style={[styles.planOptionText, value === a.id && styles.planOptionTextSelected]} numberOfLines={1}>
                {a.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );
}

const AddTransactionSheet = forwardRef(function AddTransactionSheet(_props, ref) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const modalRef = useRef(null);
  const amountInputRef = useRef(null);
  const handleBackChange = useSheetBackHandler(modalRef);
  // The open sheet blocks the moment queue, so celebrations and coach marks
  // wait until it closes instead of interrupting entry (36-add-sheet-3-tap.md,
  // 34-streak-only.md).
  const handleSheetChange = useCallback(
    (index) => {
      handleBackChange(index);
      setMomentBlocker('add-sheet', index >= 0);
    },
    [handleBackChange]
  );
  const { notifyChanged } = useDataRefresh();
  const { activeAccountId, activeAccount, accounts } = useAccount();
  const { showToast } = useToast();
  const { expenseCategories, incomeCategories } = useCategories();
  const { expenseHistory, incomeHistory } = useCategoryUsage();
  // Only OPEN splits are offered — a closed split is frozen by definition
  // (31-split-expenses.md Decision 7), so adding to it would be a surprise.
  const { openSplits } = useSplits();
  const { hasPro } = useEntitlement();
  const { openProUpsell } = useProUpsellSheet();
  const { openAddAccount } = useAddAccountSheet();

  const [editingId, setEditingId] = useState(null);
  const [editingTransferId, setEditingTransferId] = useState(null);
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [planId, setPlanId] = useState(null);
  // Offered on NEW expenses only, never on an edit. An edit can't tell whether
  // it already produced a split entry, so allowing it there would quietly
  // create a second one every time the transaction was touched.
  const [splitId, setSplitId] = useState(null);
  const [splitPickerOpen, setSplitPickerOpen] = useState(false);
  // Which account a non-transfer entry saves into — was hardcoded to
  // activeAccountId at save time with no way to change it for THIS entry
  // (the old "Adding to X" row dismissed the whole sheet to open the real
  // account switcher, which changes the GLOBAL active account and never
  // reopens this sheet — losing whatever was already filled in, worst of all
  // for an auto-detected prefill). Now a per-transaction choice, local to
  // this sheet, same inline-dropdown shape AccountField already uses for
  // Transfer's From/To. Editing an existing transaction still never changes
  // its account (handleSave's update() below doesn't touch account_id) — this
  // just displays the transaction's REAL account correctly instead of
  // whatever happens to be globally active right now.
  const [accountId, setAccountId] = useState(null);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [fromAccountId, setFromAccountId] = useState(null);
  const [toAccountId, setToAccountId] = useState(null);
  const [fromPickerOpen, setFromPickerOpen] = useState(false);
  const [toPickerOpen, setToPickerOpen] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // Per-open, from the payload: `source` tags the `expense_logged` event
  // (33-product-analytics.md; 'manual' unless the opener says otherwise), and
  // `onDone({ saved })` runs once when the sheet closes — onboarding's first
  // expense (35-onboarding-v3.md) moves on from there. Refs, not state: they
  // only matter at save and dismiss time.
  const sourceRef = useRef('manual');
  // For the rest of `expense_logged` (36-add-sheet-3-tap.md): when this open
  // began, for seconds_to_save, and which category the sheet chose by itself,
  // for category_was_prefilled.
  const openedAtRef = useRef(0);
  const prefilledCategoryRef = useRef(null);
  const onDoneRef = useRef(null);
  const savedRef = useRef(false);

  const categories = type === 'expense' ? expenseCategories : incomeCategories;
  // The smart default and the grid's order (36-add-sheet-3-tap.md), from the
  // user's own recent logs. `showAllCategories` is the More tile's expansion.
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const rankedCategories = useMemo(
    () => rankCategories(categories, type === 'income' ? incomeHistory : expenseHistory, type),
    [categories, type, incomeHistory, expenseHistory]
  );
  function defaultCategoryFor(nextType) {
    const list = nextType === 'income' ? incomeCategories : expenseCategories;
    const history = nextType === 'income' ? incomeHistory : expenseHistory;
    return defaultCategoryId(list, history, nextType);
  }
  const selectedSplit = openSplits.find((s) => s.id === splitId);
  // Falls back to activeAccount only for the brief window before `open()`'s
  // setAccountId has run (or if accounts hasn't loaded yet) — once open,
  // accountId is always set explicitly by open() above.
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? activeAccount;
  // The Transfer tab itself is ALWAYS shown now (previously hidden entirely
  // below 2 accounts) — this just controls which UI renders INSIDE it: the
  // real From/To form, or a prompt to add a second account. FREE_LIMITS.accounts
  // is 1 (lib/pro.js), so "exactly one account" is free tier's normal steady
  // state, not an edge case — the prompt is what a free user sees every time
  // they open Transfer, by design.
  const hasSecondAccount = accounts.length >= 2;

  // The collapsed Details row's one-line summary of what's inside it.
  const detailsSummary = [
    formatDateLabel(date),
    note.trim() || null,
    !editingId && hasSecondAccount ? selectedAccount?.name : null,
    selectedSplit ? `Split: ${selectedSplit.name}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  // Save stays disabled until there's an amount above zero.
  const canSave = Number(amount) > 0;

  useImperativeHandle(ref, () => ({
    open(payload) {
      sourceRef.current = payload?.source ?? 'manual';
      openedAtRef.current = Date.now();
      prefilledCategoryRef.current = null;
      onDoneRef.current = payload?.onDone ?? null;
      savedRef.current = false;
      setError(null);
      setDetailsOpen(false);
      // Never sticky: a split chosen for one expense must not silently apply to
      // the next one logged from the same sheet.
      setSplitId(null);
      setSplitPickerOpen(false);
      setFromPickerOpen(false);
      setToPickerOpen(false);
      setAccountPickerOpen(false);
      setShowAllCategories(false);
      // Autofocus the amount field ONLY for a genuinely blank entry (the ⊕
      // tab, no payload at all) — that's the one case where typing the amount
      // is obviously the user's next move. Every other path already has an
      // amount sitting in the field: editing an existing transaction, or a
      // payload prefilled by share-intent/notification/auto-detect. Popping
      // the keyboard over an already-correct value just obstructs the
      // category chips below it, and is especially jarring right after a
      // notification tap, before the user has even seen the sheet.
      const isBlankEntry = !payload?.id && !payload?.amount;

      if (payload?.id && isTransfer(payload)) {
        // Editing a transfer: recover From/To from whichever leg was tapped.
        // transfer_out lives in the source account (From = its own account,
        // To = its counterpart); transfer_in is the mirror.
        const tx = payload;
        setEditingId(tx.id);
        setEditingTransferId(tx.transfer_id);
        setType('transfer');
        setAmount(String(tx.amount));
        if (tx.type === 'transfer_out') {
          setFromAccountId(tx.account_id);
          setToAccountId(tx.transfer_account_id);
        } else {
          setFromAccountId(tx.transfer_account_id);
          setToAccountId(tx.account_id);
        }
        // Harmless fallback — the transfer branch doesn't render the
        // accountId row, but keeps it defined in case type is switched
        // away from 'transfer' while this sheet is open.
        setAccountId(tx.account_id);
        setDate(new Date(tx.occurred_at));
        setNote(tx.note ?? '');
      } else if (payload?.id) {
        const tx = payload;
        setEditingId(tx.id);
        setEditingTransferId(null);
        setType(tx.type);
        setAmount(String(tx.amount));
        setCategoryId(tx.category_id);
        setPlanId(tx.plan_id);
        // The transaction's REAL account — editing never changes it (see
        // handleSave), this is display-only, but must reflect the actual
        // row, not whatever's currently globally active.
        setAccountId(tx.account_id);
        setDate(new Date(tx.occurred_at));
        setNote(tx.note ?? '');
      } else {
        const prefillType = payload?.type ?? 'expense';
        setEditingId(null);
        setEditingTransferId(null);
        setType(prefillType);
        // Paise are kept now that the keypad has a decimal point.
        setAmount(payload?.amount ? String(payload.amount) : '');
        // An explicit categoryId wins; otherwise the smart default.
        const initialCategory = payload?.categoryId ?? (prefillType === 'transfer' ? null : defaultCategoryFor(prefillType));
        prefilledCategoryRef.current = initialCategory;
        setCategoryId(initialCategory);
        // Defaults to the active account, same as before — now changeable
        // via the inline dropdown before saving, instead of fixed.
        setAccountId(activeAccountId);
        // Transfer From/To seed: From = the account you're in, To = unset.
        setFromAccountId(activeAccountId);
        setToAccountId(null);
        // Plans are flagged off (36-add-sheet-3-tap.md), so the sheet no longer
        // shows a Plan control or defaults into a collecting plan. An explicit
        // plan_id from the opener (Plan Detail's "Add Expense") still lands,
        // and an edit keeps its plan (the branch above).
        setPlanId(payload?.plan_id ?? null);
        setDate(payload?.date ? new Date(payload.date) : new Date());
        setNote(payload?.note ?? '');
      }
      modalRef.current?.present();

      // Imperative, not the TextInput's `autoFocus` prop — this sheet is a
      // single persistent instance (mounted once at the root), never
      // remounted between opens, so a static prop can't express "sometimes".
      // The short delay lets the sheet's present() animation settle first;
      // focusing mid-animation is a known source of jank/no-ops with
      // bottom-sheet + keyboard interactions.
      if (isBlankEntry) {
        setTimeout(() => amountInputRef.current?.focus(), 300);
      }
    },
  }));

  // open() seeds accountId from activeAccountId ONCE, but AccountContext
  // resets that to null on every userId change and only refills it after the
  // accounts fetch plus an AsyncStorage read resolve. A sheet opened inside
  // that window (the auto-detect drain on cold start is the usual way) would
  // otherwise hold null for as long as it stays open. Only ever fills a blank
  // — it never rewrites an account the user picked, and never touches an
  // existing transaction's own account while editing.
  useEffect(() => {
    if (!accountId && activeAccountId) setAccountId(activeAccountId);
  }, [accountId, activeAccountId]);

  // Same idea for the category: a sheet opened before the categories loaded
  // (the onboarding first expense, right after sign-up) gets its default once
  // they arrive. Only a blank new entry; never an edit or a transfer.
  useEffect(() => {
    if (categoryId || editingId || type === 'transfer' || !categories.length) return;
    const initialCategory = defaultCategoryFor(type);
    prefilledCategoryRef.current = initialCategory;
    setCategoryId(initialCategory);
  }, [categoryId, editingId, type, categories.length]);

  function handleTypeChange(nextType) {
    setError(null);
    setType(nextType);
    setShowAllCategories(false);
    if (nextType === 'transfer') return; // transfers have no category
    const initialCategory = defaultCategoryFor(nextType);
    prefilledCategoryRef.current = initialCategory;
    setCategoryId(initialCategory);
  }

  // Transfer's empty state (< 2 accounts) — same hasPro gate shape as
  // handleScanReceipt used to have (13-ai-features.md, removed 2026-07-22):
  // free users hit the upsell, Pro users go straight to Add Account.
  // Dismisses this sheet first, same as the existing "Adding to <account>"
  // row's handoff to the account switcher — a second account needs a real
  // trip to another sheet, not a stack of two.
  function handleAddAccountForTransfer() {
    modalRef.current?.dismiss();
    if (!hasPro) {
      openProUpsell('Multiple accounts is a Pro feature');
      return;
    }
    openAddAccount();
  }

  // Swaps From/To in place — e.g. From: A / To: B becomes From: B / To: A.
  // Closes both pickers so a swap can't leave one open against stale options
  // (AccountField's `exclude` list depends on the OTHER field's current value).
  function handleSwapAccounts() {
    setFromAccountId(toAccountId);
    setToAccountId(fromAccountId);
    setFromPickerOpen(false);
    setToPickerOpen(false);
  }

  async function handleSaveTransfer() {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError('Enter an amount');
      return;
    }
    if (!fromAccountId || !toAccountId) {
      setError('Choose both accounts');
      return;
    }
    if (fromAccountId === toAccountId) {
      setError('Choose two different accounts');
      return;
    }
    setSaving(true);
    setError(null);

    const fields = {
      fromAccountId,
      toAccountId,
      amount: numericAmount,
      occurredAt: format(date, 'yyyy-MM-dd'),
      note: note.trim() || null,
    };
    const { error: saveError } = editingTransferId
      ? await updateTransfer(editingTransferId, fields)
      : await logTransfer(fields);

    setSaving(false);
    if (saveError) {
      showToast({ message: saveError.message, variant: 'error' });
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: editingTransferId ? 'Transfer updated' : 'Transfer saved', variant: 'success' });
  }

  async function handleSave() {
    if (type === 'transfer') return handleSaveTransfer();
    // Timed at the tap, so the insert's round trip doesn't count.
    const secondsToSave = Math.round((Date.now() - openedAtRef.current) / 1000);
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError('Enter an amount');
      return;
    }
    // The DISPLAY row above falls back to activeAccount when accountId hasn't
    // resolved (`selectedAccount`), but the insert used the raw state — so a
    // sheet opened mid-hydration could read "Adding to Personal" while sending
    // account_id: null, which the DB rejects (NOT NULL) as a raw Postgres
    // message in the toast. Resolve it the same way the display does, and
    // refuse the save outright rather than round-tripping a guaranteed failure.
    const targetAccountId = accountId ?? activeAccountId;
    if (!targetAccountId) {
      setError('Still loading your account — try again in a moment');
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

    let saveError;
    let isNewEntry = false;
    // The inserted row's id, needed only to cross-reference a split entry back
    // to it (31-split-expenses.md Phase 2). `.select('id').single()` on the
    // insert is the one behavioural change here — reading your own row straight
    // back is already permitted by the table's `for all` RLS policy.
    let newTransactionId = null;
    if (editingId) {
      ({ error: saveError } = await supabase.from('transactions').update(payload).eq('id', editingId));
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('transactions')
        .insert({ ...payload, account_id: targetAccountId })
        .select('id')
        .single();
      saveError = insertError;
      newTransactionId = inserted?.id ?? null;
      isNewEntry = !saveError;
    }

    setSaving(false);
    if (saveError) {
      showToast({ message: saveError.message, variant: 'error' });
      return;
    }

    // The daily coin+XP claim (18-gamification-ritual-and-ledger.md Phase 2)
    // still records — once per LOCAL day, on a genuine new entry, using
    // today's clock rather than the possibly backdated `date` — but silently:
    // no reward burst after a save any more (36-add-sheet-3-tap.md). It never
    // fails the save; the transaction already succeeded by this point.
    if (isNewEntry) {
      savedRef.current = true;
      // Never the amount (33-product-analytics.md).
      if (type === 'expense') {
        track('expense_logged', {
          source: sourceRef.current,
          category_was_prefilled: !!categoryId && categoryId === prefilledCategoryRef.current,
          seconds_to_save: secondsToSave,
        });
      }
      const { error: rewardError } = await claimDailyLog(format(new Date(), 'yyyy-MM-dd'));
      if (rewardError) console.error('claimDailyLog failed:', rewardError.message);
    }

    // "Add to Split" (31-split-expenses.md Phase 2) — the "log it once, not
    // twice" path. The transaction is already saved and stays saved; this only
    // mirrors it into the split as an entry you paid for, split equally, all
    // editable from the split afterwards. A failure here is reported on its own
    // rather than implying the transaction didn't save, because it did.
    let splitError = null;
    const addedToSplit = !editingId && splitId && newTransactionId;
    if (addedToSplit) {
      ({ error: splitError } = await createEntryFromTransaction({
        splitId,
        transaction: {
          id: newTransactionId,
          amount: numericAmount,
          occurred_at: payload.occurred_at,
          note: payload.note,
          category: categories.find((c) => c.id === categoryId) ?? null,
        },
      }));
    }

    notifyChanged();
    modalRef.current?.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (splitError) {
      showToast({ message: `Transaction saved, but the split entry didn't: ${splitError.message}`, variant: 'error' });
      return;
    }
    if (editingId) {
      showToast({ message: 'Transaction updated', variant: 'success' });
      return;
    }

    // "Logged ₹250 · Food", with Undo for 5 s. Budget and plan warnings no
    // longer toast here; an over-budget category shows in the bell's alerts.
    // A save that also made a split entry gets no Undo: the entry is shared
    // and would outlive the deleted transaction (its FK is SET NULL).
    const categoryName = categories.find((c) => c.id === categoryId)?.name;
    const message = `Logged ${formatMoney(numericAmount, selectedAccount?.currency)}${categoryName ? ` · ${categoryName}` : ''}`;
    if (addedToSplit) {
      showToast({ message, variant: 'success' });
      return;
    }
    showToast({
      message,
      variant: 'success',
      actionLabel: 'Undo',
      duration: 5000,
      onAction: async () => {
        const { error: undoError } = await supabase.from('transactions').delete().eq('id', newTransactionId);
        if (undoError) {
          showToast({ message: undoError.message, variant: 'error' });
          return;
        }
        notifyChanged();
      },
    });
  }

  async function handleDelete() {
    setSaving(true);
    // A transfer is two rows — delete the whole pair by transfer_id, never one leg.
    const { error: deleteError } = editingTransferId
      ? await deleteTransfer(editingTransferId)
      : editingId
        ? await supabase.from('transactions').delete().eq('id', editingId)
        : { error: null };
    if (!editingTransferId && !editingId) {
      setSaving(false);
      return;
    }
    setSaving(false);
    if (deleteError) {
      showToast({ message: deleteError.message, variant: 'error' });
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: editingTransferId ? 'Transfer deleted' : 'Transaction deleted', variant: 'success' });
  }

  // Hands the outcome to whoever opened the sheet, once per open.
  const handleDismiss = useCallback(() => {
    const onDone = onDoneRef.current;
    onDoneRef.current = null;
    onDone?.({ saved: savedRef.current });
  }, []);

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    []
  );

  // Save, pinned to the bottom of the sheet: with the sheet's keyboard
  // handling below, that keeps it just above the keyboard, so saving never
  // means dismissing the keyboard first (36-add-sheet-3-tap.md).
  const renderFooter = (props) => (
    <BottomSheetFooter {...props}>
      <View style={styles.footer}>
        <Button title="Save" onPress={handleSave} loading={saving} disabled={!canSave} />
      </View>
    </BottomSheetFooter>
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      onChange={handleSheetChange}
      onDismiss={handleDismiss}
      snapPoints={useMemo(() => ['92%'], [])}
      enableDynamicSizing={false}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      footerComponent={renderFooter}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.bg, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
      handleIndicatorStyle={{ backgroundColor: colors.chevron, width: 44 }}
    >
      <BottomSheetScrollView style={{ flex: 1 }} contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>
            {type === 'transfer'
              ? editingId
                ? 'Edit Transfer'
                : 'Transfer'
              : editingId
                ? 'Edit Transaction'
                : 'Add Transaction'}
          </Text>
          <View style={styles.headerActions}>
            <Pressable style={styles.closeButton} onPress={() => modalRef.current?.dismiss()}>
              <X size={16} color={colors.ink} strokeWidth={2.6} />
            </Pressable>
          </View>
        </View>

        {/* 36-add-sheet-3-tap.md: amount first, focused on open, with a
            decimal keypad (paise allowed); Save lives in the footer, pinned
            above the keyboard. */}
        <View style={styles.amountWrap}>
          <Text style={styles.amountLabel}>Amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountCurrency}>{currencySymbol(selectedAccount?.currency)}</Text>
            <BottomSheetTextInput
              ref={amountInputRef}
              value={amount}
              onChangeText={(v) => setAmount(sanitizeAmountInput(v))}
              placeholder="0"
              placeholderTextColor={colors.mutedLight}
              keyboardType="decimal-pad"
              style={styles.amountInput}
            />
          </View>
        </View>

        {type === 'transfer' ? (
          <>
            {/* Transfer left the type toggle; until spec 38 gives it a home in
                Accounts it's reached from Details, and this goes back. */}
            {!editingId && (
              <Pressable style={styles.linkRow} onPress={() => handleTypeChange('expense')} hitSlop={8}>
                <Text style={styles.linkText}>Back to expense</Text>
              </Pressable>
            )}
            {hasSecondAccount ? (
              <>
                <AccountField
                  styles={styles}
                  label="From"
                  value={fromAccountId}
                  exclude={toAccountId}
                  accounts={accounts}
                  open={fromPickerOpen}
                  onToggle={() => {
                    setFromPickerOpen((v) => !v);
                    setToPickerOpen(false);
                  }}
                  onSelect={(id) => {
                    setFromAccountId(id);
                    setFromPickerOpen(false);
                  }}
                />
                <View style={styles.swapRow}>
                  <Pressable style={styles.swapButton} onPress={handleSwapAccounts} hitSlop={8}>
                    <ArrowLeftRight size={16} color={colors.ink} strokeWidth={2.4} />
                  </Pressable>
                </View>
                <AccountField
                  styles={styles}
                  label="To"
                  value={toAccountId}
                  exclude={fromAccountId}
                  accounts={accounts}
                  open={toPickerOpen}
                  onToggle={() => {
                    setToPickerOpen((v) => !v);
                    setFromPickerOpen(false);
                  }}
                  onSelect={(id) => {
                    setToAccountId(id);
                    setToPickerOpen(false);
                  }}
                />
                <Pressable style={styles.transferDate} onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.fieldLabel}>Date</Text>
                  <Text style={styles.fieldValue}>{formatDateLabel(date)}</Text>
                </Pressable>
                <View style={styles.noteRow}>
                  <Text style={styles.fieldLabel}>Note</Text>
                  <BottomSheetTextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Add a note…"
                    placeholderTextColor={colors.mutedLight}
                    style={styles.noteInput}
                  />
                </View>
              </>
            ) : (
              // < 2 accounts: only reachable when editing an old transfer whose
              // other account is gone, since the Details link needs 2+.
              <View style={styles.transferEmptyCard}>
                <View style={styles.transferEmptyIcon}>
                  <Wallet size={22} color={colors.brand} strokeWidth={2} />
                </View>
                <Text style={styles.transferEmptyTitle}>Add a second account</Text>
                <Text style={styles.transferEmptyBody}>
                  Transfers move money between two of your own accounts.{' '}
                  {hasPro ? 'Add one to get started.' : 'Upgrade to Pro to add another.'}
                </Text>
                <Pressable style={styles.transferEmptyButton} onPress={handleAddAccountForTransfer}>
                  {!hasPro && <Crown size={15} color={colors.ink} strokeWidth={2.4} />}
                  <Text style={styles.transferEmptyButtonText}>{hasPro ? 'Add an account' : 'Upgrade to Pro'}</Text>
                </Pressable>
              </View>
            )}
          </>
        ) : (
          <>
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

            {/* Top 8 as a 4×2 grid plus More (36-add-sheet-3-tap.md); More
                expands every category of this type in place, and picking one
                there collapses back with it swapped into the grid. */}
            <View style={styles.chipGrid}>
              {(showAllCategories ? rankedCategories : gridCategories(rankedCategories, categoryId)).map((cat) => {
                const selected = cat.id === categoryId;
                return (
                  <Pressable
                    key={cat.id}
                    style={styles.chip}
                    onPress={() => {
                      setCategoryId(cat.id);
                      setShowAllCategories(false);
                    }}
                  >
                    <View style={[styles.chipIcon, selected && styles.chipIconSelected]}>
                      <CategoryIcon icon={cat.icon} size={22} color={selected ? colors.brandText : colors.ink} strokeWidth={2} />
                    </View>
                    <Text style={[styles.chipLabel, !selected && styles.chipLabelInactive]} numberOfLines={1}>
                      {cat.name}
                    </Text>
                  </Pressable>
                );
              })}
              {rankedCategories.length > GRID_SIZE && (
                <Pressable style={styles.chip} onPress={() => setShowAllCategories((v) => !v)}>
                  <View style={styles.chipIcon}>
                    {showAllCategories ? (
                      <ChevronUp size={22} color={colors.ink} strokeWidth={2} />
                    ) : (
                      <MoreHorizontal size={22} color={colors.ink} strokeWidth={2} />
                    )}
                  </View>
                  <Text style={[styles.chipLabel, styles.chipLabelInactive]} numberOfLines={1}>
                    {showAllCategories ? 'Less' : 'More'}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Everything else, collapsed into one row: date, note, and the
                account / split / transfer controls only when they apply. */}
            <Pressable style={styles.detailsRow} onPress={() => setDetailsOpen((v) => !v)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Details</Text>
                <Text style={styles.fieldValue} numberOfLines={1}>
                  {detailsSummary}
                </Text>
              </View>
              {detailsOpen ? (
                <ChevronUp size={16} color={colors.muted} strokeWidth={2.4} />
              ) : (
                <ChevronDown size={16} color={colors.muted} strokeWidth={2.4} />
              )}
            </Pressable>

            {detailsOpen && (
              <View style={styles.detailsBody}>
                <View style={styles.dateChipRow}>
                  {[
                    { key: 'today', label: 'Today', active: isToday(date), onPress: () => setDate(new Date()) },
                    { key: 'yesterday', label: 'Yesterday', active: isYesterday(date), onPress: () => setDate(subDays(new Date(), 1)) },
                    {
                      key: 'pick',
                      label: isToday(date) || isYesterday(date) ? 'Pick a date' : formatDateLabel(date),
                      active: !isToday(date) && !isYesterday(date),
                      onPress: () => setShowDatePicker(true),
                    },
                  ].map((chip) => (
                    <Pressable
                      key={chip.key}
                      style={[styles.dateChip, chip.active && styles.dateChipActive]}
                      onPress={chip.onPress}
                    >
                      <Text style={[styles.dateChipText, chip.active && styles.dateChipTextActive]}>{chip.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.noteRow}>
                  <Text style={styles.fieldLabel}>Note</Text>
                  <BottomSheetTextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Add a note…"
                    placeholderTextColor={colors.mutedLight}
                    style={styles.noteInput}
                  />
                </View>

                {/* Only with 2+ accounts, and never on an edit (editing never
                    changes an entry's account; see handleSave). */}
                {!editingId && hasSecondAccount && selectedAccount && (
                  <>
                    <Pressable style={styles.dateRow} onPress={() => setAccountPickerOpen((v) => !v)}>
                      <View style={styles.planRowInner}>
                        <View>
                          <Text style={styles.fieldLabel}>Account</Text>
                          <Text style={[styles.fieldValue, styles.fieldValuePlan]} numberOfLines={1}>
                            {selectedAccount.name}
                          </Text>
                        </View>
                        <ChevronDown size={16} color={colors.muted} strokeWidth={2.4} />
                      </View>
                    </Pressable>
                    {accountPickerOpen && (
                      <View style={styles.planPicker}>
                        {accounts.map((a) => (
                          <Pressable
                            key={a.id}
                            style={[styles.planOption, accountId === a.id && styles.planOptionSelected]}
                            onPress={() => {
                              setAccountId(a.id);
                              setAccountPickerOpen(false);
                            }}
                          >
                            <Text
                              style={[styles.planOptionText, accountId === a.id && styles.planOptionTextSelected]}
                              numberOfLines={1}
                            >
                              {a.name}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </>
                )}

                {/* "Add to Split" (31-split-expenses.md Phase 2) — log the
                    expense once and have it show up in the split too. Expenses
                    only, new ones only (an edit can't tell whether an entry
                    already exists), and only once there's an open split. */}
                {type === 'expense' && !editingId && openSplits.length > 0 && (
                  <>
                    <Pressable style={styles.dateRow} onPress={() => setSplitPickerOpen((v) => !v)}>
                      <View style={styles.planRowInner}>
                        <View>
                          <Text style={styles.fieldLabel}>Add to Split</Text>
                          <Text style={[styles.fieldValue, selectedSplit && styles.fieldValuePlan]} numberOfLines={1}>
                            {selectedSplit?.name ?? 'None'}
                          </Text>
                        </View>
                        <ChevronDown size={16} color={colors.muted} strokeWidth={2.4} />
                      </View>
                    </Pressable>
                    {splitPickerOpen && (
                      <View style={styles.planPicker}>
                        <Pressable
                          style={[styles.planOption, splitId === null && styles.planOptionSelected]}
                          onPress={() => {
                            setSplitId(null);
                            setSplitPickerOpen(false);
                          }}
                        >
                          <Text style={[styles.planOptionText, splitId === null && styles.planOptionTextSelected]}>None</Text>
                        </Pressable>
                        {openSplits.map((s) => (
                          <Pressable
                            key={s.id}
                            style={[styles.planOption, splitId === s.id && styles.planOptionSelected]}
                            onPress={() => {
                              setSplitId(s.id);
                              setSplitPickerOpen(false);
                            }}
                          >
                            <Text
                              style={[styles.planOptionText, splitId === s.id && styles.planOptionTextSelected]}
                              numberOfLines={1}
                            >
                              {s.name}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                    {selectedSplit && (
                      <Text style={styles.splitHint}>
                        Added to {selectedSplit.name} as an entry you paid, split {selectedSplit.memberCount} ways.
                      </Text>
                    )}
                  </>
                )}

                {!editingId && hasSecondAccount && (
                  <Pressable style={styles.linkRow} onPress={() => handleTypeChange('transfer')} hitSlop={8}>
                    <ArrowLeftRight size={14} color={colors.ink} strokeWidth={2.4} />
                    <Text style={styles.linkText}>Transfer between accounts</Text>
                  </Pressable>
                )}
              </View>
            )}
          </>
        )}
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

        {error && <Text style={styles.errorText}>{error}</Text>}

        {editingId && (
          <Pressable style={styles.deleteRow} onPress={handleDelete} disabled={saving}>
            <Trash2 size={16} color={colors.danger} strokeWidth={2} />
            <Text style={styles.deleteText}>{editingTransferId ? 'Delete Transfer' : 'Delete Transaction'}</Text>
          </Pressable>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

function makeStyles(colors) {
  return StyleSheet.create({
  sheet: {
    paddingHorizontal: spacing.xl,
    // Clears the pinned Save footer.
    paddingBottom: 96,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
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
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 14,
    paddingBottom: spacing.lg,
  },
  chip: {
    alignItems: 'center',
    gap: 6,
    width: '25%',
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
  dateRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  accountField: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  transferDate: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    marginBottom: spacing.md,
  },
  // Sits between the From and To fields — negative vertical margins pull it
  // into the gap between AccountField's own marginBottom (spacing.sm) on
  // either side, so it reads as ON the seam between the two rows rather than
  // a separate third row with its own spacing.
  swapRow: {
    alignItems: 'center',
    marginTop: -spacing.sm,
    marginBottom: -2,
    zIndex: 1,
  },
  swapButton: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    backgroundColor: colors.chipBg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transferEmptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    marginBottom: spacing.md,
  },
  transferEmptyIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.iconTileLg,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  transferEmptyTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  transferEmptyBody: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  transferEmptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  transferEmptyButtonText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    color: colors.surface,
  },
  planRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldValuePlan: {
    color: colors.income,
  },
  splitHint: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.mutedMid,
    marginBottom: spacing.md,
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
    // Breathing room above, so Note doesn't sit flush against the Plan/Split
    // pickers — those are a related group of choices, Note is a separate thing.
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  noteInput: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.ink,
    marginTop: 1,
    padding: 0,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.bg,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  detailsBody: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  dateChipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  dateChipText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  dateChipTextActive: {
    color: colors.surface,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
  },
  linkText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.ink,
    textDecorationLine: 'underline',
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
}
