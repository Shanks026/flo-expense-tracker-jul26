import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Switch, Alert } from 'react-native';
import { BottomSheetModal, BottomSheetView, BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { X, Trash2 } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO, startOfDay } from 'date-fns';
import Button from './Button';
import CategoryIcon from './CategoryIcon';
import SplitMemberChip from './SplitMemberChip';
import { radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { currencySymbol, sanitizeAmountInput, formatMoney } from '../lib/currency';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useToast } from './Toast';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import useCurrency from '../hooks/useCurrency';
import useCategories from '../hooks/useCategories';
import { saveEntry, deleteEntry, logEntryFromPocket, linkEntryToTransaction } from '../lib/splits';
import { resolveEqualShares, sharesBalance } from '../lib/splitMath';

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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    []
  );

  const perHead = participantIds.length ? numericAmount / participantIds.length : 0;

  return (
    <BottomSheetModal
      ref={modalRef}
      onChange={handleSheetChange}
      snapPoints={useMemo(() => ['92%'], [])}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.bg, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
      handleIndicatorStyle={{ backgroundColor: colors.chevron, width: 44 }}
    >
      <BottomSheetView style={styles.sheet}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{editingId ? 'Edit Entry' : 'Add Entry'}</Text>
          <Pressable style={styles.closeButton} onPress={() => modalRef.current?.dismiss()}>
            <X size={16} color={colors.ink} strokeWidth={2.6} />
          </Pressable>
        </View>

        <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Text style={styles.fieldLabel}>What for</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Lunch"
            placeholderTextColor={colors.mutedDarker}
            style={styles.input}
            maxLength={80}
          />

          <Text style={styles.fieldLabel}>Amount</Text>
          <View style={styles.amountBox}>
            <Text style={styles.amountCurrency}>{currencySymbol(currency)}</Text>
            <TextInput
              value={amount}
              onChangeText={(v) => setAmount(sanitizeAmountInput(v))}
              placeholder="0"
              placeholderTextColor={colors.mutedDarker}
              keyboardType="decimal-pad"
              style={styles.amountInput}
            />
          </View>

          <Pressable style={styles.row} onPress={() => setShowPicker(true)}>
            <Text style={styles.fieldLabelInline}>Date</Text>
            <Text style={styles.rowValue}>{format(date, 'd MMM yyyy')}</Text>
          </Pressable>

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

          {/* One payer per entry, deliberately. Two people paying for one thing
              is two entries — which is what two autos for five people actually
              was on the trip this feature was built for. */}
          <Text style={styles.fieldLabel}>Paid by</Text>
          <View style={styles.chipWrap}>
            {ctx.members.map((m) => (
              <SplitMemberChip
                key={m.id}
                member={m}
                selected={payerMemberId === m.id}
                onPress={() => setPayerMemberId(m.id)}
              />
            ))}
          </View>

          {/* Per-entry participants. The ticket only four of you used splits
              four ways, not five — without this the feature is wrong for real
              trips. */}
          <Text style={styles.fieldLabel}>Split between</Text>
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

          <View style={styles.segmentWrap}>
            {[
              ['equal', 'Equally'],
              ['exact', 'Exact amounts'],
            ].map(([value, label]) => (
              <Pressable
                key={value}
                style={[styles.segment, strategy === value && styles.segmentActive]}
                onPress={() => handleSelectStrategy(value)}
              >
                <Text style={[styles.segmentText, strategy === value && styles.segmentTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {strategy === 'equal' ? (
            <Text style={styles.perHeadText}>
              {participantIds.length
                ? `${formatMoney(perHead, currency)} each · ${participantIds.length} ${
                    participantIds.length === 1 ? 'person' : 'people'
                  }`
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
                    <View style={styles.exactInputBox}>
                      <Text style={styles.exactCurrency}>{currencySymbol(currency)}</Text>
                      <TextInput
                        value={exactShares[id] ?? ''}
                        onChangeText={(v) =>
                          setExactShares((prev) => ({ ...prev, [id]: sanitizeAmountInput(v) }))
                        }
                        placeholder="0"
                        placeholderTextColor={colors.mutedDarker}
                        keyboardType="decimal-pad"
                        style={styles.exactInput}
                      />
                    </View>
                  </View>
                );
              })}
              <Text style={[styles.remainingText, balanced && styles.remainingTextOk]}>
                {balanced
                  ? 'Adds up exactly'
                  : remaining > 0
                    ? `${formatMoney(remaining, currency)} left to assign`
                    : `${formatMoney(Math.abs(remaining), currency)} over the total`}
              </Text>
            </View>
          )}

          {/* The Abishek case. Default OFF: the user's rule is that nothing
              enters the ledger until a settlement, which is exactly right when
              you paid nothing — and progressively wrong the more you fronted.
              Only offered on a NEW entry you paid for, because Phase 1 has
              nowhere to store the link (see the doc's 1.6), so an edit can't
              tell whether it already logged one. */}
          {!editingId && payerIsMe && (
            <View style={styles.pocketBlock}>
              <View style={styles.pocketRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pocketTitle}>I paid this from my pocket</Text>
                  <Text style={styles.pocketSub}>
                    Logs the full {formatMoney(numericAmount, currency)} as an expense now. Leave it off if
                    you'll settle up later.
                  </Text>
                </View>
                <Switch
                  value={fromPocket}
                  onValueChange={setFromPocket}
                  trackColor={{ true: colors.brand, false: colors.chipBg }}
                  thumbColor={colors.surface}
                />
              </View>

              {fromPocket && (
                <>
                  <Pressable style={styles.row} onPress={() => setPocketPickerOpen((v) => !v)}>
                    <Text style={styles.fieldLabelInline}>Category</Text>
                    <Text style={styles.rowValue}>
                      {expenseCategories.find((c) => c.id === pocketCategoryId)?.name ?? 'Pick one'}
                    </Text>
                  </Pressable>
                  {pocketPickerOpen && (
                    <View style={styles.chipGrid}>
                      {expenseCategories.map((cat) => (
                        <Pressable
                          key={cat.id}
                          style={styles.catChip}
                          onPress={() => {
                            setPocketCategoryId(cat.id);
                            setPocketPickerOpen(false);
                          }}
                        >
                          <View style={[styles.catIcon, cat.id === pocketCategoryId && styles.catIconSelected]}>
                            <CategoryIcon
                              icon={cat.icon}
                              size={20}
                              color={cat.id === pocketCategoryId ? colors.brandText : colors.ink}
                              strokeWidth={2}
                            />
                          </View>
                          <Text style={styles.catLabel} numberOfLines={1}>
                            {cat.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Button
            title={editingId ? 'Save Entry' : 'Add Entry'}
            variant="primary"
            onPress={handleSave}
            loading={saving}
            style={{ marginTop: spacing.lg }}
          />
          {editingId && (
            <Pressable style={styles.deleteRow} onPress={handleDelete} disabled={saving}>
              <Trash2 size={16} color={colors.dangerStrong} strokeWidth={2} />
              <Text style={styles.deleteText}>Delete Entry</Text>
            </Pressable>
          )}
        </BottomSheetScrollView>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

function makeStyles(colors) {
  return StyleSheet.create({
    sheet: {
      flex: 1,
      paddingHorizontal: spacing.xl,
    },
    scroll: {
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
      color: colors.ink,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      backgroundColor: colors.chipBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fieldLabel: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      marginBottom: spacing.sm,
    },
    fieldLabelInline: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.base,
      color: colors.mutedMid,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontFamily: fontFamily.bold,
      fontSize: fontSize.xl,
      color: colors.ink,
      marginBottom: spacing.lg,
    },
    amountBox: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.ink,
      flex: 1,
    },
    row: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    rowValue: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.base,
      color: colors.ink,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    segmentWrap: {
      flexDirection: 'row',
      backgroundColor: colors.chipBg,
      borderRadius: 12,
      padding: 4,
      marginBottom: spacing.sm,
    },
    segment: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
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
      color: colors.brandText,
    },
    perHeadText: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.md,
      color: colors.mutedMid,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    exactWrap: {
      marginTop: spacing.md,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    exactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    exactName: {
      flex: 1,
      fontFamily: fontFamily.bold,
      fontSize: fontSize.md,
      color: colors.ink,
    },
    exactInputBox: {
      width: 120,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    exactCurrency: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.md,
      color: colors.mutedDarker,
    },
    exactInput: {
      flex: 1,
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.xl,
      color: colors.ink,
      padding: 0,
    },
    remainingText: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.base,
      color: colors.dangerStrong,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    remainingTextOk: {
      color: colors.income,
    },
    pocketBlock: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderSoft,
    },
    pocketRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    pocketTitle: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.md,
      color: colors.ink,
    },
    pocketSub: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      marginTop: 2,
    },
    chipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
      marginBottom: spacing.md,
    },
    catChip: {
      alignItems: 'center',
      gap: 6,
      width: 56,
    },
    catIcon: {
      width: 48,
      height: 48,
      borderRadius: 15,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catIconSelected: {
      backgroundColor: colors.brand,
      borderWidth: 0,
    },
    catLabel: {
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
}
