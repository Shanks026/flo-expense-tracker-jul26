import { forwardRef, useImperativeHandle, useRef, useState, useEffect, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Image, ActivityIndicator, Alert } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { X, Trash2, ChevronDown, Camera } from 'lucide-react-native';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
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
import useCollectingPlan from '../hooks/useCollectingPlan';
import { budgetToastForSave, planToastForSave } from '../lib/alerts';
import { isTransfer, logTransfer, updateTransfer, deleteTransfer } from '../lib/transfers';
import { scanReceipt } from '../lib/ai';
import { uploadReceipt, receiptSignedUrl } from '../lib/receipts';
import useSheetBackHandler from '../hooks/useSheetBackHandler';

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

// Receipt scan (13-ai-features.md Phase 3) — downscale before sending to
// Gemini. A raw phone-camera photo (often 3000-4000px on the long edge) made
// the model call take 84+ seconds in testing, well past whatever the client's
// own network stack tolerates before treating the request as failed. Capping
// the long edge at 1600px (plenty for a receipt to stay legible) keeps the
// base64 payload — and Gemini's per-call image-token cost — small.
const RECEIPT_MAX_DIMENSION = 1600;

async function prepareReceiptImage(asset) {
  const isLandscape = asset.width > asset.height;
  const size = isLandscape
    ? { width: Math.min(asset.width, RECEIPT_MAX_DIMENSION) }
    : { height: Math.min(asset.height, RECEIPT_MAX_DIMENSION) };

  const rendered = await ImageManipulator.manipulate(asset.uri).resize(size).renderAsync();
  return rendered.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
}

// A From/To account picker for Transfer mode. `exclude` is the account chosen in
// the *other* field, dropped from these options so From and To can never be the
// same account. Same inline-dropdown shape as the plan picker.
function AccountField({ label, value, exclude, accounts, open, onToggle, onSelect }) {
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
  const modalRef = useRef(null);
  const amountInputRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef);
  const { notifyChanged } = useDataRefresh();
  const { activeAccountId, activeAccount, accounts } = useAccount();
  const { openAccountSwitcher } = useAccountSwitcherSheet();
  const { showToast } = useToast();
  const { expenseCategories, incomeCategories } = useCategories();
  const { activePlans } = usePlans();
  const { plan: collectingPlan } = useCollectingPlan();

  const [editingId, setEditingId] = useState(null);
  const [editingTransferId, setEditingTransferId] = useState(null);
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [planId, setPlanId] = useState(null);
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [fromAccountId, setFromAccountId] = useState(null);
  const [toAccountId, setToAccountId] = useState(null);
  const [fromPickerOpen, setFromPickerOpen] = useState(false);
  const [toPickerOpen, setToPickerOpen] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Receipt scan (13-ai-features.md Phase 3). receiptImageUri is a freshly
  // scanned image's LOCAL uri, pending upload on save — it always supersedes
  // whatever's shown from an existing row. existingReceiptPath is the
  // already-saved path when editing a transaction that already has one;
  // existingReceiptUrl is its signed-URL projection for display (private
  // bucket, same pattern as avatars). pendingReceiptDraft is the raw model
  // output, stashed for receipt_data at save time.
  const [receiptImageUri, setReceiptImageUri] = useState(null);
  const [pendingReceiptDraft, setPendingReceiptDraft] = useState(null);
  const [existingReceiptPath, setExistingReceiptPath] = useState(null);
  const [existingReceiptUrl, setExistingReceiptUrl] = useState(null);
  const [scanning, setScanning] = useState(false);

  const categories = type === 'expense' ? expenseCategories : incomeCategories;
  const selectedPlan = activePlans.find((p) => p.id === planId);
  const canTransfer = accounts.length >= 2;

  useEffect(() => {
    if (!existingReceiptPath) {
      setExistingReceiptUrl(null);
      return;
    }
    let cancelled = false;
    receiptSignedUrl(existingReceiptPath).then((url) => {
      if (!cancelled) setExistingReceiptUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [existingReceiptPath]);

  useImperativeHandle(ref, () => ({
    open(payload) {
      setError(null);
      setPlanPickerOpen(false);
      setFromPickerOpen(false);
      setToPickerOpen(false);
      // Autofocus the amount field ONLY for a genuinely blank entry (the ⊕
      // tab, no payload at all) — that's the one case where typing the amount
      // is obviously the user's next move. Every other path already has an
      // amount sitting in the field: editing an existing transaction, or a
      // payload prefilled by share-intent/notification/auto-detect. Popping
      // the keyboard over an already-correct value just obstructs the
      // category chips below it, and is especially jarring right after a
      // notification tap, before the user has even seen the sheet.
      const isBlankEntry = !payload?.id && !payload?.amount;

      // A fresh open never carries over a pending unsaved scan from a
      // previous session; existingReceiptPath is set below per-branch.
      setReceiptImageUri(null);
      setPendingReceiptDraft(null);

      if (payload?.id && isTransfer(payload)) {
        // Editing a transfer: recover From/To from whichever leg was tapped.
        // transfer_out lives in the source account (From = its own account,
        // To = its counterpart); transfer_in is the mirror.
        const tx = payload;
        setEditingId(tx.id);
        setEditingTransferId(tx.transfer_id);
        setType('transfer');
        setAmount(String(Math.round(tx.amount)));
        if (tx.type === 'transfer_out') {
          setFromAccountId(tx.account_id);
          setToAccountId(tx.transfer_account_id);
        } else {
          setFromAccountId(tx.transfer_account_id);
          setToAccountId(tx.account_id);
        }
        setDate(new Date(tx.occurred_at));
        setNote(tx.note ?? '');
        setExistingReceiptPath(null); // transfers never have receipts
      } else if (payload?.id) {
        const tx = payload;
        setEditingId(tx.id);
        setEditingTransferId(null);
        setType(tx.type);
        setAmount(String(Math.round(tx.amount)));
        setCategoryId(tx.category_id);
        setPlanId(tx.plan_id);
        setDate(new Date(tx.occurred_at));
        setNote(tx.note ?? '');
        setExistingReceiptPath(tx.receipt_path ?? null);
      } else {
        const prefillType = payload?.type ?? 'expense';
        setEditingId(null);
        setEditingTransferId(null);
        setType(prefillType);
        setAmount(payload?.amount ? String(Math.round(payload.amount)) : '');
        const prefillList = prefillType === 'expense' ? expenseCategories : incomeCategories;
        setCategoryId(prefillList[0]?.id ?? null);
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
        setExistingReceiptPath(null);
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

  // Receipt scan (13-ai-features.md Phase 3) — the cash blind spot. Never
  // blocks or replaces manual entry: on any failure the sheet is left exactly
  // as it was, ready for the user to fill in by hand.
  function handleScanReceipt() {
    Alert.alert('Scan Receipt', 'Where is the photo?', [
      { text: 'Take Photo', onPress: () => captureAndScan('camera') },
      { text: 'Choose from Gallery', onPress: () => captureAndScan('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function captureAndScan(source) {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast({ message: `${source === 'camera' ? 'Camera' : 'Photo library'} permission is required`, variant: 'error' });
      return;
    }

    // No base64 requested here — a full-resolution phone photo's base64 is
    // large enough to make the model call take a minute or more (found via a
    // real 84.5s Edge Function log during testing). prepareReceiptImage below
    // downscales first and provides the base64 for the (much smaller) result.
    const launch = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await launch({ mediaTypes: ['images'], quality: 0.6 });
    if (result.canceled || !result.assets?.[0]) return;

    setScanning(true);
    let prepared;
    try {
      prepared = await prepareReceiptImage(result.assets[0]);
    } catch (err) {
      setScanning(false);
      showToast({ message: 'Could not process that image', variant: 'error' });
      return;
    }

    // A fresh scan always supersedes whatever receipt was previously shown
    // (an existing one being edited, or nothing) — set it immediately so the
    // thumbnail appears right away, before the model call returns. Uses the
    // downscaled image's own uri (smaller, faster upload later too), not the
    // original full-resolution capture.
    setReceiptImageUri(prepared.uri);
    setExistingReceiptPath(null);

    // Receipts are almost always expenses — scan against the expense list
    // regardless of the sheet's current segment, and switch the segment to
    // match once a result comes back.
    const draft = await scanReceipt({
      imageBase64: prepared.base64,
      categories: expenseCategories.map((c) => ({ id: c.id, name: c.name, type: c.type })),
    });
    setScanning(false);

    if (!draft) {
      showToast({ message: "Couldn't read that receipt — fill it in manually", variant: 'error' });
      return;
    }

    setPendingReceiptDraft(draft);
    setType('expense');
    if (draft.amount && draft.amount > 0) setAmount(String(Math.round(draft.amount)));
    if (draft.occurred_at) {
      try {
        setDate(parseISO(draft.occurred_at));
      } catch {
        // an unparsable date from the model just leaves the existing date field alone
      }
    }
    if (draft.category_id && expenseCategories.some((c) => c.id === draft.category_id)) {
      setCategoryId(draft.category_id);
    }
    if (draft.merchant && !note.trim()) setNote(draft.merchant);

    showToast({
      message: draft.confidence >= 0.6 ? 'Receipt scanned' : 'Scanned — please double-check the details',
      variant: draft.confidence >= 0.6 ? 'success' : 'warn',
    });
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

    let savedId = editingId;
    let saveError;
    if (editingId) {
      ({ error: saveError } = await supabase.from('transactions').update(payload).eq('id', editingId));
    } else {
      // .select('id') so a freshly scanned receipt (below) has a row to attach to.
      const { data, error } = await supabase
        .from('transactions')
        .insert({ ...payload, account_id: activeAccountId })
        .select('id')
        .single();
      saveError = error;
      savedId = data?.id ?? null;
    }

    setSaving(false);
    if (saveError) {
      showToast({ message: saveError.message, variant: 'error' });
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: editingId ? 'Transaction updated' : 'Transaction saved', variant: 'success' });

    // Attach a freshly scanned receipt, if any — after the transaction row
    // exists, so receipt_path has something to point at. Never blocking: the
    // transaction is already saved by this point regardless of what happens
    // here, and a failure is surfaced as its own toast, not an error state.
    if (receiptImageUri && savedId) {
      const { path, error: uploadError } = await uploadReceipt(receiptImageUri);
      if (uploadError) {
        showToast({ message: `Saved, but the receipt image failed to attach: ${uploadError.message}`, variant: 'warn' });
      } else {
        const { error: attachError } = await supabase
          .from('transactions')
          .update({ receipt_path: path, receipt_data: pendingReceiptDraft })
          .eq('id', savedId);
        if (attachError) {
          showToast({ message: `Saved, but the receipt image failed to attach: ${attachError.message}`, variant: 'warn' });
        } else {
          notifyChanged();
        }
      }
    }

    if (!editingId && type === 'expense') {
      const budgetMsg = await budgetToastForSave({ categoryId, accountId: activeAccountId });
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
      backgroundStyle={{ backgroundColor: colors.bg, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
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
            {type !== 'transfer' && (
              <Pressable style={styles.scanButton} onPress={handleScanReceipt} disabled={scanning}>
                {scanning ? (
                  <ActivityIndicator size="small" color={colors.ink} />
                ) : (
                  <Camera size={16} color={colors.ink} strokeWidth={2.2} />
                )}
              </Pressable>
            )}
            <Pressable style={styles.closeButton} onPress={() => modalRef.current?.dismiss()}>
              <X size={16} color={colors.ink} strokeWidth={2.6} />
            </Pressable>
          </View>
        </View>

        {activeAccount && type !== 'transfer' && (
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
          {canTransfer && (
            <Pressable
              style={[styles.segment, type === 'transfer' && styles.segmentActive]}
              onPress={() => handleTypeChange('transfer')}
            >
              <Text style={[styles.segmentText, type === 'transfer' && styles.segmentTextActive]}>Transfer</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.amountWrap}>
          <Text style={styles.amountLabel}>Amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountCurrency}>₹</Text>
            <TextInput
              ref={amountInputRef}
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
              placeholder="0"
              placeholderTextColor={colors.mutedLight}
              keyboardType="number-pad"
              style={styles.amountInput}
            />
          </View>
        </View>

        {type !== 'transfer' && (receiptImageUri || existingReceiptUrl) && (
          <View style={styles.receiptRow}>
            <Image source={{ uri: receiptImageUri ?? existingReceiptUrl }} style={styles.receiptThumb} />
            <Text style={styles.receiptLabel}>Receipt attached</Text>
          </View>
        )}

        {type === 'transfer' ? (
          <>
            <AccountField
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
            <AccountField
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
          <>
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
            placeholderTextColor={colors.mutedLight}
            style={styles.noteInput}
          />
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Button title="Save" onPress={handleSave} loading={saving} style={{ marginTop: spacing.md }} />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scanButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  receiptThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  receiptLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.muted,
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
