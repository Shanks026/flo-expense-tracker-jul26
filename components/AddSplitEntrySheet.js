import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { ScrollView } from 'react-native-gesture-handler';
import { CalendarDays, Wallet, Tag } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO, startOfDay } from 'date-fns';
import Sheet from './ledger/Sheet';
import Button from './ledger/Button';
import Segmented from './ledger/Segmented';
import ListRow from './ledger/ListRow';
import CategoryIcon from './CategoryIcon';
import SplitMemberChip from './SplitMemberChip';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, tabular, inter } from '../theme/ledger';
import { currencySymbol, sanitizeAmountInput, formatMoney } from '../lib/currency';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useToast } from './Toast';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import useCurrency from '../hooks/useCurrency';
import useCategories from '../hooks/useCategories';
import { saveEntry, deleteEntry, logEntryFromPocket, linkEntryToTransaction } from '../lib/splits';
import { resolveEqualShares, sharesBalance } from '../lib/splitMath';
import { destructiveHaptic } from '../lib/haptics';

const AddSplitEntrySheetContext = createContext(null);

export function AddSplitEntrySheetProvider({ children }) {
  const sheetRef = useRef(null);
  // ctx = { split, members, hasSettlements, settledMemberIds }
  const openAddSplitEntry = useCallback((ctx, entry) => sheetRef.current?.open(ctx, entry ?? null), []);

  return (
    <AddSplitEntrySheetContext.Provider value={{ openAddSplitEntry }}>
      {children}
      <AddSplitEntrySheet ref={sheetRef} />
    </AddSplitEntrySheetContext.Provider>
  );
}

export function useAddSplitEntrySheet() {
  const ctx = useContext(AddSplitEntrySheetContext);
  if (!ctx) throw new Error('useAddSplitEntrySheet must be used within AddSplitEntrySheetProvider');
  return ctx;
}

const AddSplitEntrySheet = forwardRef(function AddSplitEntrySheet(_props, ref) {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const modalRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef);
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();
  const currency = useCurrency();
  const { expenseCategories } = useCategories();

  const [ctx, setCtx] = useState({ split: null, members: [], hasSettlements: false, settledMemberIds: [] });
  const [editingId, setEditingId] = useState(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(startOfDay(new Date()));
  const [showPicker, setShowPicker] = useState(false);
  const [payerMemberId, setPayerMemberId] = useState(null);
  const [participantIds, setParticipantIds] = useState([]);
  const [strategy, setStrategy] = useState('equal');
  // Only used when strategy === 'exact': { [memberId]: '123.45' } as typed.
  const [exactShares, setExactShares] = useState({});
  const [fromPocket, setFromPocket] = useState(false);
  const [pocketCategoryId, setPocketCategoryId] = useState(null);
  const [pocketPickerOpen, setPocketPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const numericAmount = Number(amount) || 0;
  const self = ctx.members.find((m) => m.isSelf) ?? null;
  const payerIsMe = payerMemberId != null && payerMemberId === self?.id;

  const equalShares = useMemo(
    () => (participantIds.length ? resolveEqualShares(numericAmount, participantIds) : {}),
    [numericAmount, participantIds]
  );

  const shares = useMemo(() => {
    if (strategy === 'equal') return equalShares;
    return Object.fromEntries(participantIds.map((id) => [id, Number(exactShares[id]) || 0]));
  }, [strategy, equalShares, participantIds, exactShares]);

  // The client mirror of save_split_entry's server-side check. Same rule, said
  // in a friendlier place — Save stays blocked until the remainder is zero, so
  // the RPC's exception is a backstop rather than the user's error message.
  const { balanced, remaining } = sharesBalance(numericAmount, shares);

  useImperativeHandle(ref, () => ({
    open(nextCtx, entry) {
      setError(null);
      setShowPicker(false);
      setPocketPickerOpen(false);
      setCtx(nextCtx);
      const allIds = nextCtx.members.map((m) => m.id);
      const me = nextCtx.members.find((m) => m.isSelf) ?? null;

      if (entry) {
        setEditingId(entry.id);
        setDescription(entry.description ?? '');
        setAmount(String(entry.amount ?? ''));
        setDate(entry.occurredOn ? parseISO(entry.occurredOn) : startOfDay(new Date()));
        setPayerMemberId(entry.payerMemberId);
        // A member with a ₹0 share IS a participant (they were there, they just
        // owe nothing for this item) — only members with no share row at all
        // are absent. Round-tripping an edit must not quietly drop them.
        setParticipantIds((entry.shares ?? []).map((s) => s.memberId));
        setStrategy(entry.strategy ?? 'equal');
        setExactShares(
          Object.fromEntries((entry.shares ?? []).map((s) => [s.memberId, String(s.amount)]))
        );
      } else {
        setEditingId(null);
        setDescription('');
        setAmount('');
        setDate(nextCtx.split?.occurredOn ? parseISO(nextCtx.split.occurredOn) : startOfDay(new Date()));
        // Default to whoever paid last. On the trip this was built for that's
        // the same person ten entries running — a real keystroke saving.
        setPayerMemberId(nextCtx.lastPayerMemberId ?? me?.id ?? allIds[0] ?? null);
        setParticipantIds(allIds);
        setStrategy('equal');
        setExactShares({});
      }
      // Always off on open, every time (Decision: the user's instinct is that
      // nothing hits the ledger until settlement; this is the opt-in escape
      // hatch, never a sticky preference).
      setFromPocket(false);
      setPocketCategoryId(null);
      modalRef.current?.present();
    },
  }));

  function toggleParticipant(memberId) {
    setParticipantIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  }

  // Switching INTO exact seeds the inputs from the current equal split, so the
  // user nudges numbers rather than typing five of them from scratch.
  function handleSelectStrategy(next) {
    if (next === 'exact' && strategy !== 'exact') {
      setExactShares(
        Object.fromEntries(Object.entries(equalShares).map(([id, v]) => [id, String(v)]))
      );
    }
    setStrategy(next);
  }

  // Anyone who's already handed money over and would be affected by this edit.
  // Naming them (and the consequence) is what replaces locking a settled split
  // — see the doc's Decision 7.
  function affectedSettledMembers() {
    if (!editingId) return [];
    return ctx.members.filter(
      (m) => ctx.settledMemberIds?.includes(m.id) && participantIds.includes(m.id)
    );
  }

  async function persist() {
    setSaving(true);
    setError(null);

    const occurredOn = format(date, 'yyyy-MM-dd');
    const { id: savedEntryId, error: saveError } = await saveEntry({
      entryId: editingId,
      splitId: ctx.split.id,
      description,
      amount: numericAmount,
      occurredOn,
      payerMemberId,
      strategy,
      shares,
    });

    if (saveError) {
      setSaving(false);
      showToast({ message: saveError.message, variant: 'error' });
      return;
    }

    // Separate write, deliberately not folded into saveEntry: this is a real
    // transaction in the user's own ledger, and it must be obvious in the code
    // that it only ever happens when they asked for it.
    if (!editingId && fromPocket && payerIsMe) {
      const { transactionId, error: pocketError } = await logEntryFromPocket({
        amount: numericAmount,
        accountId: ctx.split.accountId,
        categoryId: pocketCategoryId,
        planId: ctx.split.planId,
        occurredOn,
        note: `${ctx.split.name} — ${description.trim()}`,
      });
      // Phase 2 closed the gap noted in the doc's 1.6: the entry now points at
      // the transaction it produced, so the row shows "in your ledger" and the
      // add-from-history screen won't offer the same expense back again.
      if (transactionId && savedEntryId) {
        await linkEntryToTransaction(savedEntryId, transactionId);
      }
      if (pocketError) {
        // The entry saved; only the ledger write failed. Say so precisely
        // rather than implying the whole thing was lost.
        setSaving(false);
        notifyChanged();
        modalRef.current?.dismiss();
        showToast({ message: `Entry saved, but the expense didn't log: ${pocketError.message}`, variant: 'error' });
        return;
      }
    }

    setSaving(false);
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: editingId ? 'Entry updated' : 'Entry added', variant: 'success' });
  }

  function handleSave() {
    if (!description.trim()) {
      setError('What was it for?');
      return;
    }
    if (!numericAmount || numericAmount <= 0) {
      setError('Enter an amount');
      return;
    }
    if (!payerMemberId) {
      setError('Who paid?');
      return;
    }
    if (participantIds.length === 0) {
      setError('Pick at least one person to split between');
      return;
    }
    if (!balanced) {
      setError(
        remaining > 0
          ? `${formatMoney(remaining, currency)} still to assign`
          : `${formatMoney(Math.abs(remaining), currency)} over the total`
      );
      return;
    }
    if (fromPocket && payerIsMe && !pocketCategoryId) {
      setError('Pick a category for the expense');
      return;
    }

    const affected = affectedSettledMembers();
    if (affected.length) {
      Alert.alert(
        'This changes what they owe',
        `${affected.map((m) => (m.isSelf ? 'You' : m.name)).join(', ')} ${
          affected.length === 1 && !affected[0].isSelf ? 'has' : 'have'
        } already settled. Their balance will change.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save anyway', onPress: persist },
        ]
      );
      return;
    }
    persist();
  }

  function handleDelete() {
    if (!editingId) return;
    Alert.alert(
      'Delete this entry?',
      ctx.hasSettlements
        ? "It's kept in the split's history because money has already been settled here, but it stops counting."
        : 'It will be removed from the split.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            destructiveHaptic();
            setSaving(true);
            const { error: deleteError } = await deleteEntry(editingId, { hasSettlements: ctx.hasSettlements });
            setSaving(false);
            if (deleteError) {
              showToast({ message: deleteError.message, variant: 'error' });
              return;
            }
            notifyChanged();
            modalRef.current?.dismiss();
            showToast({ message: 'Entry deleted', variant: 'success' });
          },
        },
      ]
    );
  }

  const perHead = participantIds.length ? numericAmount / participantIds.length : 0;

  return (
    <Sheet
      ref={modalRef}
      title={editingId ? 'Edit entry' : 'Add entry'}
      onChange={handleSheetChange}
      footer={{ primary: { title: editingId ? 'Save' : 'Add entry', onPress: handleSave, loading: saving } }}
    >
      <Text style={styles.label}>What for</Text>
      <BottomSheetTextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Lunch"
        placeholderTextColor={c.muted}
        cursorColor={c.accent}
        selectionColor={c.accent}
        accessibilityLabel="What for"
        style={styles.field}
        maxLength={80}
      />

      {/* The amount, centred and large, with a muted symbol (the Add sheet's). */}
      <View style={styles.amountWrap}>
        <Text style={styles.amountCurrency}>{currencySymbol(currency)}</Text>
        <BottomSheetTextInput
          value={amount}
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

      <ListRow icon={CalendarDays} title="Date" right={format(date, 'd MMM yyyy')} trailing="chevron" onPress={() => setShowPicker(true)} divider={false} />

      {showPicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={(_event, selected) => {
            setShowPicker(false);
            if (selected) setDate(startOfDay(selected));
          }}
        />
      )}

      {/* One payer per entry, deliberately: two people paying for one thing
          is two entries. */}
      <Text style={[styles.label, styles.spaced]}>Paid by</Text>
      <View style={styles.chipWrap}>
        {ctx.members.map((m) => (
          <SplitMemberChip key={m.id} member={m} selected={payerMemberId === m.id} onPress={() => setPayerMemberId(m.id)} />
        ))}
      </View>

      {/* Per-entry participants: four of five people sharing a ticket is
          normal on a real trip. */}
      <Text style={[styles.label, styles.spaced]}>Split between</Text>
      <View style={styles.chipWrap}>
        {ctx.members.map((m) => (
          <SplitMemberChip
            key={m.id}
            member={m}
            selected={participantIds.includes(m.id)}
            showCheck
            dimmed={!participantIds.includes(m.id)}
            onPress={() => toggleParticipant(m.id)}
          />
        ))}
      </View>

      <Segmented
        accessibilityLabel="How to split"
        options={[
          { value: 'equal', label: 'Equally' },
          { value: 'exact', label: 'Exact amounts' },
        ]}
        value={strategy}
        onChange={handleSelectStrategy}
        style={styles.spacedSmall}
      />

      {strategy === 'equal' ? (
        <Text style={styles.help}>
          {participantIds.length
            ? `${formatMoney(perHead, currency)} each · ${participantIds.length} ${participantIds.length === 1 ? 'person' : 'people'}`
            : 'Pick who this splits between'}
        </Text>
      ) : (
        <View style={styles.exactWrap}>
          {participantIds.map((id) => {
            const m = ctx.members.find((mm) => mm.id === id);
            return (
              <View key={id} style={styles.exactRow}>
                <Text style={styles.exactName} numberOfLines={1}>
                  {m?.name ?? 'Unknown'}
                </Text>
                <View style={styles.exactField}>
                  <Text style={styles.exactCurrency}>{currencySymbol(currency)}</Text>
                  <BottomSheetTextInput
                    value={exactShares[id] ?? ''}
                    onChangeText={(v) => setExactShares((prev) => ({ ...prev, [id]: sanitizeAmountInput(v) }))}
                    placeholder="0"
                    placeholderTextColor={c.muted}
                    cursorColor={c.accent}
                    selectionColor={c.accent}
                    keyboardType="decimal-pad"
                    accessibilityLabel={`${m?.name ?? 'Their'} share`}
                    style={[styles.exactInput, tabular]}
                  />
                </View>
              </View>
            );
          })}
          <Text style={[styles.help, { color: balanced ? c.positive : c.danger }]}>
            {balanced
              ? 'Adds up exactly'
              : remaining > 0
                ? `${formatMoney(remaining, currency)} left to assign`
                : `${formatMoney(Math.abs(remaining), currency)} over the total`}
          </Text>
        </View>
      )}

      {/* Default off: nothing enters the ledger until a settlement, unless
          you fronted the money. Only on a NEW entry you paid for. */}
      {!editingId && payerIsMe && (
        <>
          <ListRow
            icon={Wallet}
            title="I paid this from my pocket"
            sub={`Logs the full ${formatMoney(numericAmount, currency)} as an expense now. Leave it off if you'll settle up later.`}
            subLines={3}
            switchValue={fromPocket}
            onSwitchChange={setFromPocket}
            divider={fromPocket}
          />
          {fromPocket && (
            <>
              <ListRow
                icon={Tag}
                title="Category"
                right={expenseCategories.find((cat) => cat.id === pocketCategoryId)?.name ?? 'Pick one'}
                trailing="chevron"
                onPress={() => setPocketPickerOpen((v) => !v)}
                divider={false}
              />
              {pocketPickerOpen && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  style={styles.chipScroll}
                  contentContainerStyle={styles.chipRow}
                >
                  {expenseCategories.map((cat) => {
                    const selected = cat.id === pocketCategoryId;
                    return (
                      <Pressable
                        key={cat.id}
                        style={styles.chip}
                        accessibilityRole="button"
                        accessibilityLabel={cat.name}
                        accessibilityState={{ selected }}
                        onPress={() => {
                          setPocketCategoryId(cat.id);
                          setPocketPickerOpen(false);
                        }}
                      >
                        <View style={[styles.chipCircle, selected && { backgroundColor: c.ink }]}>
                          <CategoryIcon icon={cat.icon} size={20} color={selected ? c.inkOnInk : c.ink} strokeWidth={1.75} />
                        </View>
                        <Text style={[styles.chipLabel, selected && { color: c.ink, fontFamily: inter.medium }]} numberOfLines={1}>
                          {cat.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </>
          )}
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {editingId && <Button title="Delete entry" variant="danger" onPress={handleDelete} disabled={saving} style={styles.delete} />}
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
    spaced: {
      marginTop: ledgerSpace.lg,
    },
    spacedSmall: {
      marginTop: ledgerSpace.md,
    },
    help: {
      ...ledgerType.caption,
      color: c.muted,
      marginTop: ledgerSpace.sm,
      marginBottom: ledgerSpace.md,
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
    amountWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginBottom: ledgerSpace.md,
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
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ledgerSpace.sm,
    },
    exactWrap: {
      marginTop: ledgerSpace.md,
      gap: ledgerSpace.sm,
    },
    exactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ledgerSpace.md,
    },
    exactName: {
      ...ledgerType.rowTitle,
      color: c.ink,
      flex: 1,
    },
    exactField: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 48,
      minWidth: 120,
      paddingHorizontal: ledgerSpace.lg,
      borderRadius: ledgerRadius.field,
      backgroundColor: c.surfaceSunk,
    },
    exactCurrency: {
      ...ledgerType.body,
      color: c.muted,
      marginRight: 4,
    },
    exactInput: {
      ...ledgerType.body,
      color: c.ink,
      flex: 1,
      padding: 0,
      textAlign: 'right',
    },
    // Bleeds to the sheet's edges (the bill sheet's category row).
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
    chipLabel: {
      ...ledgerType.caption,
      color: c.muted,
      textAlign: 'center',
    },
    error: {
      ...ledgerType.body,
      color: c.danger,
      marginTop: ledgerSpace.md,
    },
    delete: {
      marginTop: ledgerSpace.lg,
    },
  });
}
