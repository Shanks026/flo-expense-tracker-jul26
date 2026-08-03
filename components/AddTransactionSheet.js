import { forwardRef, useImperativeHandle, useRef, useState, useEffect, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { X, Trash2, ChevronDown, ArrowLeftRight, Wallet, Crown } from 'lucide-react-native';
import { format, isToday, isYesterday } from 'date-fns';
import CategoryIcon from './CategoryIcon';
import Button from './Button';
import { colors as staticColors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { currencySymbol, sanitizeAmountInput } from '../lib/currency';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';
import { useToast } from './Toast';
import useCategories from '../hooks/useCategories';
import usePlans from '../hooks/usePlans';
import useCollectingPlan from '../hooks/useCollectingPlan';
import { budgetToastForSave, planToastForSave } from '../lib/alerts';
import { isTransfer, logTransfer, updateTransfer, deleteTransfer } from '../lib/transfers';
import { claimDailyLog } from '../lib/rewardsMutations';
import { useRewardBurst } from './RewardBurst';
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
        <ChevronDown size={16} color={staticColors.muted} strokeWidth={2.4} />
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
  const handleSheetChange = useSheetBackHandler(modalRef);
  const { notifyChanged } = useDataRefresh();
  const { activeAccountId, activeAccount, accounts } = useAccount();
  const { showToast } = useToast();
  const { showRewardBurst } = useRewardBurst();
  const { expenseCategories, incomeCategories } = useCategories();
  const { activePlans } = usePlans();
  const { plan: collectingPlan } = useCollectingPlan();
  const { isPro } = useEntitlement();
  const { openProUpsell } = useProUpsellSheet();
  const { openAddAccount } = useAddAccountSheet();

  const [editingId, setEditingId] = useState(null);
  const [editingTransferId, setEditingTransferId] = useState(null);
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [planId, setPlanId] = useState(null);
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
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

  const categories = type === 'expense' ? expenseCategories : incomeCategories;
  const selectedPlan = activePlans.find((p) => p.id === planId);
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

  useImperativeHandle(ref, () => ({
    open(payload) {
      setError(null);
      setPlanPickerOpen(false);
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
        setAmount(payload?.amount ? String(Math.round(payload.amount)) : '');
        const prefillList = prefillType === 'expense' ? expenseCategories : incomeCategories;
        setCategoryId(prefillList[0]?.id ?? null);
        // Defaults to the active account, same as before — now changeable
        // via the inline dropdown before saving, instead of fixed.
        setAccountId(activeAccountId);
        // Transfer From/To seed: From = the account you're in, To = unset.
        setFromAccountId(activeAccountId);
        setToAccountId(null);
        // An explicit plan_id in the payload (Plan Detail's "Add Expense")
        // always wins. Otherwise a new entry defaults into the active account's
        // collecting plan, if one is armed — the whole point of Phase 2. This is
        // the `else` branch (a brand-new entry): editing an existing transaction
        // takes the `payload?.id` branch above and its plan is NEVER touched here.
        // The plan lands in the visible "Add to Plan" field, so it can be seen
        // and cleared before saving — not a hidden default.
        setPlanId(payload?.plan_id ?? collectingPlan?.id ?? null);
        setDate(new Date());
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

  function handleTypeChange(nextType) {
    setError(null);
    setType(nextType);
    if (nextType === 'transfer') return; // transfers have no category
    const list = nextType === 'expense' ? expenseCategories : incomeCategories;
    setCategoryId(list[0]?.id ?? null);
  }

  // Transfer's empty state (< 2 accounts) — same isPro gate shape as
  // handleScanReceipt used to have (13-ai-features.md, removed 2026-07-22):
  // free users hit the upsell, Pro users go straight to Add Account.
  // Dismisses this sheet first, same as the existing "Adding to <account>"
  // row's handoff to the account switcher — a second account needs a real
  // trip to another sheet, not a stack of two.
  function handleAddAccountForTransfer() {
    modalRef.current?.dismiss();
    if (!isPro) {
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

    let saveError;
    let isNewEntry = false;
    if (editingId) {
      ({ error: saveError } = await supabase.from('transactions').update(payload).eq('id', editingId));
    } else {
      ({ error: saveError } = await supabase.from('transactions').insert({ ...payload, account_id: accountId }));
      isNewEntry = !saveError;
    }

    setSaving(false);
    if (saveError) {
      showToast({ message: saveError.message, variant: 'error' });
      return;
    }

    // Gamification (18-gamification-ritual-and-ledger.md Phase 2) — the daily
    // coin+XP earn, claimed once per LOCAL day regardless of how many
    // transactions get logged today (an idempotent upsert on reward_events;
    // see lib/rewardsMutations.js). Only on a genuine NEW entry, never an
    // edit — editing an old transaction isn't "showing up today". Uses
    // `new Date()` (today, real device clock), not the `date` field state,
    // which may be backdated — same created_at-not-occurred_at discipline
    // lib/streak.js's own streak already follows, for the same reason: a
    // backfilled past-dated entry still counts as logging TODAY. Never fails
    // the save if the claim errors — the transaction itself already
    // succeeded by this point.
    if (isNewEntry) {
      const { error: rewardError, isNewClaim, coins: earnedCoins, xp: earnedXp } = await claimDailyLog(
        format(new Date(), 'yyyy-MM-dd')
      );
      if (rewardError) console.error('claimDailyLog failed:', rewardError.message);
      // Only the FIRST log of the day is a genuine new claim (the daily coin/
      // XP earn is flat per day, not per transaction) — the celebration is
      // for that moment, not for every subsequent transaction logged the same
      // day, which would cheapen it into background noise.
      else if (isNewClaim) showRewardBurst({ coins: earnedCoins, xp: earnedXp });
    }

    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: editingId ? 'Transaction updated' : 'Transaction saved', variant: 'success' });

    if (!editingId && type === 'expense') {
      const budgetMsg = await budgetToastForSave({ categoryId, accountId });
      const planMsg = planId ? await planToastForSave({ planId }) : null;
      if (budgetMsg) showToast({ message: budgetMsg, variant: 'warn' });
      if (planMsg) showToast({ message: planMsg, variant: 'warn' });
    }
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
      backgroundStyle={{ backgroundColor: staticColors.bg, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
      handleIndicatorStyle={{ backgroundColor: '#DADCD4', width: 44 }}
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
              <X size={16} color={staticColors.ink} strokeWidth={2.6} />
            </Pressable>
          </View>
        </View>

        {selectedAccount && type !== 'transfer' && (
          <>
            <Pressable
              style={styles.accountRow}
              disabled={!!editingId || accounts.length < 2}
              onPress={() => setAccountPickerOpen((v) => !v)}
            >
              <View style={[styles.accountDot, { backgroundColor: selectedAccount.color }]} />
              <Text style={styles.accountText}>
                Adding to <Text style={styles.accountName}>{selectedAccount.name}</Text>
              </Text>
              {/* Editing never changes an entry's account (see handleSave),
                  and there's nothing to pick among with only one account —
                  the chevron only appears when this row is actually
                  interactive. */}
              {!editingId && accounts.length >= 2 && (
                <ChevronDown size={14} color={staticColors.mutedDarker} strokeWidth={2.4} />
              )}
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
          <Pressable
            style={[styles.segment, type === 'transfer' && styles.segmentActive]}
            onPress={() => handleTypeChange('transfer')}
          >
            <Text style={[styles.segmentText, type === 'transfer' && styles.segmentTextActive]}>Transfer</Text>
          </Pressable>
        </View>

        <View style={styles.amountWrap}>
          <Text style={styles.amountLabel}>Amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountCurrency}>{currencySymbol(selectedAccount?.currency)}</Text>
            <TextInput
              ref={amountInputRef}
              value={amount}
              onChangeText={(v) => setAmount(sanitizeAmountInput(v))}
              placeholder="0"
              placeholderTextColor={staticColors.mutedLight}
              keyboardType="number-pad"
              style={styles.amountInput}
            />
          </View>
        </View>

        {type === 'transfer' ? (
          hasSecondAccount ? (
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
                  <ArrowLeftRight size={16} color={staticColors.ink} strokeWidth={2.4} />
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
            </>
          ) : (
            // < 2 accounts — a transfer is structurally impossible, so instead
            // of showing From/To fields with nothing to pick, prompt for the
            // one thing that actually unblocks it. isPro gates WHICH sheet:
            // free → upsell (a 2nd account is a Pro feature, FREE_LIMITS.accounts
            // = 1), Pro → straight to Add Account.
            <View style={styles.transferEmptyCard}>
              <View style={styles.transferEmptyIcon}>
                <Wallet size={22} color={colors.brand} strokeWidth={2} />
              </View>
              <Text style={styles.transferEmptyTitle}>Add a second account</Text>
              <Text style={styles.transferEmptyBody}>
                Transfers move money between two of your own accounts.{' '}
                {isPro ? 'Add one to get started.' : 'Upgrade to Pro to add another.'}
              </Text>
              <Pressable style={styles.transferEmptyButton} onPress={handleAddAccountForTransfer}>
                {!isPro && <Crown size={15} color={staticColors.ink} strokeWidth={2.4} />}
                <Text style={styles.transferEmptyButtonText}>{isPro ? 'Add an account' : 'Upgrade to Pro'}</Text>
              </Pressable>
            </View>
          )
        ) : (
          <>
            <Text style={styles.sectionLabel}>CATEGORY</Text>
            <ScrollView key={type} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {categories.map((cat) => {
                const selected = cat.id === categoryId;
                return (
                  <Pressable key={cat.id} style={styles.chip} onPress={() => setCategoryId(cat.id)}>
                    <View style={[styles.chipIcon, selected && styles.chipIconSelected]}>
                      <CategoryIcon icon={cat.icon} size={22} color={selected ? colors.brandText : staticColors.ink} strokeWidth={2} />
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
                  <ChevronDown size={16} color={staticColors.muted} strokeWidth={2.4} />
                </View>
              </Pressable>
            </View>
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

        <View style={styles.noteRow}>
          <Text style={styles.fieldLabel}>Note</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a note…"
            placeholderTextColor={staticColors.mutedLight}
            style={styles.noteInput}
          />
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Button title="Save" onPress={handleSave} loading={saving} style={{ marginTop: spacing.md }} />
        {editingId && (
          <Pressable style={styles.deleteRow} onPress={handleDelete} disabled={saving}>
            <Trash2 size={16} color={staticColors.danger} strokeWidth={2} />
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
    color: staticColors.ink,
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
    backgroundColor: staticColors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: staticColors.chipBg,
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
    color: staticColors.mutedDarker,
  },
  accountName: {
    fontFamily: fontFamily.extrabold,
    color: staticColors.ink,
  },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: staticColors.chipBg,
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
    backgroundColor: staticColors.ink,
  },
  segmentText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: staticColors.muted,
  },
  segmentTextActive: {
    fontFamily: fontFamily.extrabold,
    color: staticColors.surface,
  },
  amountWrap: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  amountLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    color: staticColors.mutedMid,
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
    color: staticColors.mutedLight,
  },
  amountInput: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.amountXl,
    letterSpacing: -0.6,
    color: staticColors.ink,
    minWidth: 80,
    textAlign: 'center',
  },
  sectionLabel: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
    color: staticColors.mutedMid,
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
    backgroundColor: staticColors.surface,
    borderWidth: 1,
    borderColor: staticColors.border,
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
    color: staticColors.ink,
    textAlign: 'center',
  },
  chipLabelInactive: {
    fontFamily: fontFamily.semibold,
    color: staticColors.muted,
  },
  dateAndPlanRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dateRow: {
    backgroundColor: staticColors.surface,
    borderWidth: 1,
    borderColor: staticColors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  accountField: {
    backgroundColor: staticColors.surface,
    borderWidth: 1,
    borderColor: staticColors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  transferDate: {
    backgroundColor: staticColors.surface,
    borderWidth: 1,
    borderColor: staticColors.border,
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
    backgroundColor: staticColors.chipBg,
    borderWidth: 1,
    borderColor: staticColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transferEmptyCard: {
    alignItems: 'center',
    backgroundColor: staticColors.surface,
    borderWidth: 1,
    borderColor: staticColors.border,
    borderRadius: radii.card,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    marginBottom: spacing.md,
  },
  transferEmptyIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.iconTileLg,
    backgroundColor: staticColors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  transferEmptyTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    color: staticColors.ink,
  },
  transferEmptyBody: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: staticColors.muted,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  transferEmptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: staticColors.ink,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  transferEmptyButtonText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    color: staticColors.surface,
  },
  planRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldValuePlan: {
    color: staticColors.income,
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
    backgroundColor: staticColors.surface,
    borderWidth: 1,
    borderColor: staticColors.border,
  },
  planOptionSelected: {
    backgroundColor: staticColors.ink,
    borderColor: staticColors.ink,
  },
  planOptionText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: staticColors.muted,
  },
  planOptionTextSelected: {
    color: staticColors.surface,
  },
  fieldLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: staticColors.mutedMid,
  },
  fieldValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    color: staticColors.ink,
    marginTop: 1,
  },
  noteRow: {
    backgroundColor: staticColors.surface,
    borderWidth: 1,
    borderColor: staticColors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    marginBottom: spacing.md,
  },
  noteInput: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: staticColors.ink,
    marginTop: 1,
    padding: 0,
  },
  errorText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: staticColors.danger,
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
    color: staticColors.danger,
  },
  });
}
