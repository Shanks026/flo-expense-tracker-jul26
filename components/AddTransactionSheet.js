import { forwardRef, useImperativeHandle, useRef, useState, useEffect, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, Pressable, StyleSheet, Keyboard } from 'react-native';
// Gesture Handler's ScrollView, not React Native's: inside the bottom sheet,
// a plain one loses the horizontal swipe to the sheet's own gesture.
import { ScrollView } from 'react-native-gesture-handler';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ChevronDown, ArrowLeftRight, Wallet, Users, CalendarDays } from 'lucide-react-native';
import { format, isToday, isYesterday, parseISO, subDays } from 'date-fns';
import CategoryIcon from './CategoryIcon';
import QuickAddField from './QuickAddField';
import Sheet from './ledger/Sheet';
import Segmented from './ledger/Segmented';
import ListRow from './ledger/ListRow';
import Chip from './ledger/Chip';
import Button from './ledger/Button';
import HeaderIconButton from './ledger/HeaderIconButton';
import EmptyState from './ledger/EmptyState';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, tabular, inter } from '../theme/ledger';
import { currencySymbol, formatMoney, sanitizeAmountInput } from '../lib/currency';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';
import { useToast } from './Toast';
import useCategories from '../hooks/useCategories';
import useCategoryUsage from '../hooks/useCategoryUsage';
import { rankCategories, defaultCategoryId } from '../lib/categoryDefaults';
import useSplits from '../hooks/useSplits';
import { createEntryFromTransaction } from '../lib/splits';
import { isTransfer, logTransfer, updateTransfer, deleteTransfer } from '../lib/transfers';
import { deleteTransaction } from '../lib/transactions';
import { entrySource } from '../lib/entrySource';
import { claimDailyLog } from '../lib/rewardsMutations';
import { track } from '../lib/track';
import { setMomentBlocker } from '../lib/momentQueue';
import * as Haptics from 'expo-haptics';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import useEntitlement from '../hooks/useEntitlement';
import { useProUpsellSheet } from './ProUpsellSheet';
import { useAddAccountSheet } from './AddAccountSheet';
import { destructiveHaptic } from '../lib/haptics';
import { FLAGS } from '../lib/flags';
import { quickParse } from '../lib/quickParse';
import { aiQuickAdd } from '../lib/ai';

const TYPE_OPTIONS = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
];

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
// same account. A row with the choice on the right; tapping it shows chips.
function AccountField({ label, value, exclude, accounts, open, onToggle, onSelect, styles }) {
  const { c } = useLedger();
  const selected = accounts.find((a) => a.id === value);
  const options = accounts.filter((a) => a.id !== exclude);
  return (
    <>
      <ListRow
        icon={Wallet}
        title={label}
        right={selected?.name ?? 'Select account'}
        trailing={<ChevronDown size={18} color={c.muted} strokeWidth={1.75} />}
        onPress={onToggle}
      />
      {open && (
        <View style={styles.optionRow}>
          {options.map((a) => (
            <Chip key={a.id} label={a.name} selected={value === a.id} onPress={() => onSelect(a.id)} />
          ))}
        </View>
      )}
    </>
  );
}

const AddTransactionSheet = forwardRef(function AddTransactionSheet(_props, ref) {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const modalRef = useRef(null);
  const amountInputRef = useRef(null);
  const quickInputRef = useRef(null);
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
  // For transactions.source (spec 46, ticket 07; lib/entrySource.js): an
  // opener's `origin` when the analytics source can't tell it (auto-detect),
  // and whether the quick-add line was filled by voice.
  const originRef = useRef(null);
  const spokenRef = useRef(false);
  // For the rest of `expense_logged` (36-add-sheet-3-tap.md): when this open
  // began, for seconds_to_save, and which category the sheet chose by itself,
  // for category_was_prefilled.
  const openedAtRef = useRef(0);
  const prefilledCategoryRef = useRef(null);
  const onDoneRef = useRef(null);
  const savedRef = useRef(false);
  // The quick-add line (44-ai-assistant.md, Phase 1): shown only for the ⊕
  // tab's blank entry, and only with FLAGS.ai on. `quickKey` clears it per
  // open so it starts empty. `categoryTappedRef` records a chip tap since
  // the last parse, so re-parsing never overrides a category the person
  // picked after seeing the parsed one.
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  // A line over the sheet's fields for one opener: onboarding's first
  // expense ("Log your first expense: type it or hold to say it", spec 47).
  const [intro, setIntro] = useState(null);
  const [quickKey, setQuickKey] = useState(0);
  // Set (non-zero) to make the quick-add line start listening (long-press ⊕).
  const [listenKey, setListenKey] = useState(0);
  const categoryTappedRef = useRef(false);
  // Bumped by every hand edit (amount, category, type, date, note). A model
  // answer that started before the latest edit is dropped, so a slow reply
  // never overwrites something the person typed or tapped while it thought.
  const editEpochRef = useRef(0);
  const markEdited = () => {
    editEpochRef.current += 1;
  };

  const categories = type === 'expense' ? expenseCategories : incomeCategories;
  // The smart default and the row's order (36-add-sheet-3-tap.md), from the
  // user's own recent logs. The category picked for this open leads the row,
  // fixed until the next open or type switch, so a tap never reshuffles it.
  const [leadCategoryId, setLeadCategoryId] = useState(null);
  const rankedCategories = useMemo(
    () => rankCategories(categories, type === 'income' ? incomeHistory : expenseHistory, type),
    [categories, type, incomeHistory, expenseHistory]
  );
  const rowCategories = useMemo(() => {
    const lead = rankedCategories.find((c) => c.id === leadCategoryId);
    return lead ? [lead, ...rankedCategories.filter((c) => c.id !== lead.id)] : rankedCategories;
  }, [rankedCategories, leadCategoryId]);
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

  // Save stays disabled until there's an amount above zero.
  const canSave = Number(amount) > 0;

  useImperativeHandle(ref, () => ({
    open(payload) {
      sourceRef.current = payload?.source ?? 'manual';
      originRef.current = payload?.origin ?? null;
      spokenRef.current = false;
      openedAtRef.current = Date.now();
      prefilledCategoryRef.current = null;
      onDoneRef.current = payload?.onDone ?? null;
      savedRef.current = false;
      categoryTappedRef.current = false;
      setError(null);
      // Never sticky: a split chosen for one expense must not silently apply to
      // the next one logged from the same sheet.
      setSplitId(null);
      setSplitPickerOpen(false);
      setFromPickerOpen(false);
      setToPickerOpen(false);
      setAccountPickerOpen(false);
      // Autofocus the amount field ONLY for a genuinely blank entry (the ⊕
      // tab, no payload at all) — that's the one case where typing the amount
      // is obviously the user's next move. Every other path already has an
      // amount sitting in the field: editing an existing transaction, or a
      // payload prefilled by share-intent/notification/auto-detect. Popping
      // the keyboard over an already-correct value just obstructs the
      // category chips below it, and is especially jarring right after a
      // notification tap, before the user has even seen the sheet.
      const isBlankEntry = !payload?.id && !payload?.amount;
      // The quick-add line is for the ⊕ tab alone, which asks for it with
      // `quickAdd: true`. Every other opener (an edit, share, a notification,
      // auto-detect, onboarding) gets the sheet as it was.
      const quickAdd = FLAGS.ai && !!payload?.quickAdd && isBlankEntry;
      setShowQuickAdd(quickAdd);
      setIntro(payload?.intro ?? null);
      if (quickAdd) setQuickKey((k) => k + 1);

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
        setLeadCategoryId(tx.category_id);
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
        setLeadCategoryId(initialCategory);
        // The opener's account if it names one, else the active account —
        // changeable via the inline dropdown before saving.
        setAccountId(payload?.accountId ?? activeAccountId);
        // Transfer From/To seed: From = the account the transfer was started
        // from (Accounts screen), else the account you're in; To = unset.
        setFromAccountId(payload?.fromAccountId ?? activeAccountId);
        setToAccountId(null);
        // Plans are flagged off (36-add-sheet-3-tap.md), so the sheet no longer
        // shows a Plan control or defaults into a collecting plan. An explicit
        // plan_id from the opener (Plan Detail's "Add Expense") still lands,
        // and an edit keeps its plan (the branch above).
        setPlanId(payload?.plan_id ?? null);
        // A bare 'YYYY-MM-DD' (Ask FLO's drafts) is a local day: new Date()
        // would read it as UTC midnight, the day before west of Greenwich.
        setDate(
          !payload?.date
            ? new Date()
            : typeof payload.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(payload.date)
              ? parseISO(payload.date)
              : new Date(payload.date)
        );
        setNote(payload?.note ?? '');
      }
      modalRef.current?.present();

      // Imperative, not the TextInput's `autoFocus` prop — this sheet is a
      // single persistent instance (mounted once at the root), never
      // remounted between opens, so a static prop can't express "sometimes".
      // The short delay lets the sheet's present() animation settle first;
      // focusing mid-animation is a known source of jank/no-ops with
      // bottom-sheet + keyboard interactions.
      // With the quick-add line showing, the keyboard opens there instead;
      // tapping the amount still works as before.
      // A long-press on ⊕ (`listen: true`) opens it listening instead.
      // The sheet's content remounts on each open, so every other open
      // clears the request; otherwise the line would listen again on mount.
      setListenKey(0);
      if (isBlankEntry) {
        if (quickAdd && payload?.listen) {
          setTimeout(() => setListenKey(Date.now()), 300);
        } else {
          const target = quickAdd ? quickInputRef : amountInputRef;
          setTimeout(() => target.current?.focus(), 300);
        }
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
    setLeadCategoryId(initialCategory);
  }, [categoryId, editingId, type, categories.length]);

  // Fills the open sheet from a parsed quick-add line. Only what the line
  // says changes; Save stays the person's tap. The parsed category counts as
  // the sheet's own choice for category_was_prefilled, so a chip tapped
  // afterwards reads as a change. A chip tapped after a parse survives a
  // re-parse of the same type; one tapped before any parse gives way.
  function parseQuickLine(text) {
    return quickParse(text, {
      categories: [...expenseCategories, ...incomeCategories],
      accounts,
      today: format(new Date(), 'yyyy-MM-dd'),
    });
  }

  // The line the phone isn't sure about goes to the ai-assistant function
  // (ticket 02). It answers with the same prefill shape, or a reason.
  async function askQuickLine(text) {
    const epoch = editEpochRef.current;
    const result = await aiQuickAdd(text, { categories: [...expenseCategories, ...incomeCategories], accounts });
    if (result.prefill && epoch !== editEpochRef.current) return { prefill: null, reason: 'stale' };
    return result;
  }

  // source: 'quick_local' (the phone's parser) or 'quick_ai' (the model);
  // spoken: the line came from the mic.
  function handleQuickParsed(prefill, source, spoken = false) {
    setError(null);
    sourceRef.current = source;
    spokenRef.current = spoken;
    const keepTapped = categoryTappedRef.current && prefill.type === type && categoryId;
    // Still protected on the next parse if kept; otherwise the parse took over.
    if (!keepTapped) categoryTappedRef.current = false;
    setType(prefill.type);
    // A split takes expenses only; its row hides for income.
    if (prefill.type !== 'expense') setSplitId(null);
    setAmount(String(prefill.amount));
    if (!keepTapped) {
      // The model may find no category that fits; the smart default stands in.
      const nextCategory = prefill.categoryId ?? defaultCategoryFor(prefill.type);
      prefilledCategoryRef.current = nextCategory;
      setCategoryId(nextCategory);
      setLeadCategoryId(nextCategory);
    }
    setAccountId(prefill.accountId ?? activeAccountId);
    setAccountPickerOpen(false);
    // parseISO, not new Date('YYYY-MM-DD'): that reads as UTC midnight.
    setDate(parseISO(prefill.date));
    setNote(prefill.note ?? '');
    Keyboard.dismiss();
  }

  function handleTypeChange(nextType) {
    markEdited();
    setError(null);
    setType(nextType);
    if (nextType === 'transfer') return; // transfers have no category
    const initialCategory = defaultCategoryFor(nextType);
    prefilledCategoryRef.current = initialCategory;
    setCategoryId(initialCategory);
    setLeadCategoryId(initialCategory);
  }

  // Transfer's empty state (< 2 accounts), behind a hasPro gate: free users
  // hit the upsell, Pro users go straight to Add Account.
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
        // Only a new entry gets a source; an edit (above) never changes it.
        .insert({
          ...payload,
          account_id: targetAccountId,
          source: entrySource({ source: sourceRef.current, origin: originRef.current, spoken: spokenRef.current }),
        })
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
    if (editingId || editingTransferId) destructiveHaptic();
    setSaving(true);
    // A transfer is two rows — delete the whole pair by transfer_id, never one leg.
    const { error: deleteError } = editingTransferId
      ? await deleteTransfer(editingTransferId)
      : editingId
        ? await deleteTransaction({ id: editingId })
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

  // The Account row: only with 2+ accounts, never on an edit. The split row
  // below takes the gap above it when this one isn't there.
  const showAccountRow = !editingId && hasSecondAccount && !!selectedAccount;

  const title =
    type === 'transfer'
      ? editingId
        ? 'Edit transfer'
        : 'Transfer'
      : editingId
        ? 'Edit transaction'
        : 'Add transaction';

  // A field with a label above and a value or input under it, on a hairline
  // box. Note, and the transfer's Date.
  const noteField = (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Note</Text>
      <BottomSheetTextInput
        value={note}
        onChangeText={(v) => {
          markEdited();
          setNote(v);
        }}
        placeholder="Add a note…"
        placeholderTextColor={c.muted}
        cursorColor={c.accent}
        accessibilityLabel="Note"
        style={styles.noteInput}
      />
    </View>
  );

  return (
    <Sheet
      ref={modalRef}
      title={title}
      onChange={handleSheetChange}
      onDismiss={handleDismiss}
      // Save, pinned above the keyboard, so saving never means dismissing the
      // keyboard first (36-add-sheet-3-tap.md).
      footer={{ primary: { title: 'Save', onPress: handleSave, loading: saving, disabled: !canSave } }}
    >
      {/* Order (spec 46): quick-add line, Expense | Income, amount, category,
          date, note, account (2+ accounts), split (open splits). Transfers
          have no type toggle; they start from Home's Transfer tile or
          Accounts. The quick-add line is mounted whenever the flag is on and
          hidden for other openers, so the + tab's focus() lands on an input
          that's already there. */}
      {!!intro && <Text style={styles.intro}>{intro}</Text>}
      {FLAGS.ai && (
        <QuickAddField
          ref={quickInputRef}
          resetKey={quickKey}
          listenKey={listenKey}
          onCantListen={() => quickInputRef.current?.focus()}
          hidden={!showQuickAdd}
          parse={parseQuickLine}
          ask={askQuickLine}
          onParsed={handleQuickParsed}
        />
      )}

      {type !== 'transfer' && (
        <Segmented
          accessibilityLabel="Type"
          options={TYPE_OPTIONS}
          value={type}
          onChange={handleTypeChange}
          style={styles.block}
        />
      )}

      {/* The amount, centred and large, with a muted symbol. */}
      <View style={styles.amountWrap}>
        <Text style={styles.amountCurrency}>{currencySymbol(selectedAccount?.currency)}</Text>
        <BottomSheetTextInput
          ref={amountInputRef}
          value={amount}
          // The caret stays at the end, like a calculator: a tap on a big
          // centred number otherwise drops it mid-number (often first), so
          // digits went in front and Backspace had nothing to delete.
          selection={{ start: amount.length, end: amount.length }}
          onChangeText={(v) => {
            markEdited();
            setAmount(sanitizeAmountInput(v));
          }}
          placeholder="0"
          placeholderTextColor={c.inkFaint}
          cursorColor={c.accent}
          selectionColor={c.accent}
          keyboardType="decimal-pad"
          accessibilityLabel="Amount"
          style={[styles.amountInput, tabular]}
        />
      </View>

      {type === 'transfer' ? (
        hasSecondAccount ? (
          <View style={styles.block}>
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
              <HeaderIconButton icon={ArrowLeftRight} onPress={handleSwapAccounts} accessibilityLabel="Swap From and To" />
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
            <ListRow
              icon={CalendarDays}
              title="Date"
              right={formatDateLabel(date)}
              trailing="chevron"
              onPress={() => setShowDatePicker(true)}
            />
            <View style={styles.gapTop}>{noteField}</View>
          </View>
        ) : (
          // < 2 accounts: only reachable when editing an old transfer whose
          // other account is gone, since every Transfer opener needs 2+.
          <EmptyState
            illustration="coins"
            title="Add a second account"
            body={`Transfers move money between two of your own accounts. ${hasPro ? 'Add one to get started.' : 'Upgrade to Pro to add another.'}`}
            actionTitle={hasPro ? 'Add an account' : 'Upgrade to Pro'}
            onAction={handleAddAccountForTransfer}
          />
        )
      ) : (
        <>
          {/* Every category in one swipeable row (the person's call,
              2026-10-27), in usage order with the pre-selected one first so
              it's always in view. Selected is an ink circle, white icon. */}
          <Text style={styles.sectionLabel}>Category</Text>
          <ScrollView
            key={type}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.chipScroll}
            contentContainerStyle={styles.chipRow}
          >
            {rowCategories.map((cat) => {
              const selected = cat.id === categoryId;
              return (
                <Pressable
                  key={cat.id}
                  style={styles.chip}
                  accessibilityRole="button"
                  accessibilityLabel={cat.name}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    categoryTappedRef.current = true;
                    markEdited();
                    setCategoryId(cat.id);
                  }}
                >
                  <View style={[styles.chipCircle, selected && styles.chipCircleSelected]}>
                    <CategoryIcon icon={cat.icon} size={20} color={selected ? c.inkOnInk : c.ink} strokeWidth={1.75} />
                  </View>
                  <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]} numberOfLines={1}>
                    {cat.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.dateChipRow}>
            <Chip
              label="Today"
              selected={isToday(date)}
              onPress={() => {
                markEdited();
                setDate(new Date());
              }}
            />
            <Chip
              label="Yesterday"
              selected={isYesterday(date)}
              onPress={() => {
                markEdited();
                setDate(subDays(new Date(), 1));
              }}
            />
            <Chip
              label={isToday(date) || isYesterday(date) ? 'Pick a date' : formatDateLabel(date)}
              selected={!isToday(date) && !isYesterday(date)}
              onPress={() => setShowDatePicker(true)}
            />
          </View>

          {noteField}

          {/* Only with 2+ accounts, and never on an edit (editing never
              changes an entry's account; see handleSave). */}
          {showAccountRow && (
            <View style={styles.gapTop}>
              <ListRow
                icon={Wallet}
                title="Account"
                right={selectedAccount.name}
                trailing={<ChevronDown size={18} color={c.muted} strokeWidth={1.75} />}
                onPress={() => setAccountPickerOpen((v) => !v)}
                divider={accountPickerOpen}
              />
              {accountPickerOpen && (
                <View style={styles.optionRow}>
                  {accounts.map((a) => (
                    <Chip
                      key={a.id}
                      label={a.name}
                      selected={accountId === a.id}
                      onPress={() => {
                        setAccountId(a.id);
                        setAccountPickerOpen(false);
                      }}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* "Add to Split" (31-split-expenses.md Phase 2): log the expense
              once and have it show up in the split too. Expenses only, new
              ones only (an edit can't tell whether an entry already exists),
              and only once there's an open split. */}
          {type === 'expense' && !editingId && openSplits.length > 0 && (
            <View style={!showAccountRow && styles.gapTop}>
              <ListRow
                icon={Users}
                title="Add to split"
                right={selectedSplit?.name ?? 'None'}
                trailing={<ChevronDown size={18} color={c.muted} strokeWidth={1.75} />}
                onPress={() => setSplitPickerOpen((v) => !v)}
                divider={splitPickerOpen}
              />
              {splitPickerOpen && (
                <View style={styles.optionRow}>
                  <Chip
                    label="None"
                    selected={splitId === null}
                    onPress={() => {
                      setSplitId(null);
                      setSplitPickerOpen(false);
                    }}
                  />
                  {openSplits.map((s) => (
                    <Chip
                      key={s.id}
                      label={s.name}
                      selected={splitId === s.id}
                      onPress={() => {
                        setSplitId(s.id);
                        setSplitPickerOpen(false);
                      }}
                    />
                  ))}
                </View>
              )}
              {selectedSplit && (
                <Text style={styles.hint}>
                  Added to {selectedSplit.name} as an entry you paid, split {selectedSplit.memberCount} ways.
                </Text>
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
            if (selected) {
              markEdited();
              setDate(selected);
            }
          }}
        />
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      {editingId && (
        <Button
          variant="danger"
          title={editingTransferId ? 'Delete transfer' : 'Delete transaction'}
          onPress={handleDelete}
          disabled={saving}
          style={styles.deleteButton}
        />
      )}
    </Sheet>
  );
});

function makeStyles(c) {
  return StyleSheet.create({
    block: {
      marginBottom: ledgerSpace.lg,
    },
    gapTop: {
      marginTop: ledgerSpace.md,
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
    intro: {
      ...ledgerType.body,
      color: c.muted,
      marginBottom: ledgerSpace.md,
    },
    sectionLabel: {
      ...ledgerType.group,
      color: c.muted,
      marginBottom: ledgerSpace.sm,
    },
    // Bleeds to the sheet's edges so the row scrolls edge to edge; the
    // padding puts the first chip back in line with everything else.
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
    dateChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ledgerSpace.sm,
      marginBottom: ledgerSpace.lg,
    },
    field: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      borderRadius: ledgerRadius.input,
      paddingHorizontal: ledgerSpace.md,
      paddingVertical: ledgerSpace.sm + 2,
    },
    fieldLabel: {
      ...ledgerType.caption,
      color: c.muted,
    },
    noteInput: {
      ...ledgerType.body,
      color: c.ink,
      marginTop: 2,
      padding: 0,
    },
    optionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ledgerSpace.sm,
      paddingVertical: ledgerSpace.sm,
    },
    swapRow: {
      alignItems: 'center',
      marginVertical: -ledgerSpace.xs,
      zIndex: 1,
    },
    hint: {
      ...ledgerType.caption,
      color: c.muted,
      marginTop: ledgerSpace.xs,
    },
    errorText: {
      ...ledgerType.body,
      color: c.danger,
      textAlign: 'center',
      marginTop: ledgerSpace.md,
    },
    deleteButton: {
      marginTop: ledgerSpace.gutter,
    },
  });
}
