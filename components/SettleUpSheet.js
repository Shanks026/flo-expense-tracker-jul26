import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { ScrollView } from 'react-native-gesture-handler';
import { ArrowRight, CalendarDays, BookOpen, Tag } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, startOfDay } from 'date-fns';
import Sheet from './ledger/Sheet';
import ListRow from './ledger/ListRow';
import CategoryIcon from './CategoryIcon';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, tabular, inter } from '../theme/ledger';
import { currencySymbol, sanitizeAmountInput, formatMoney } from '../lib/currency';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';
import { useToast } from './Toast';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import useCurrency from '../hooks/useCurrency';
import useCategories from '../hooks/useCategories';
import { recordSettlement } from '../lib/splits';

const SettleUpSheetContext = createContext(null);

export function SettleUpSheetProvider({ children }) {
  const sheetRef = useRef(null);
  // ctx = { split, from, to, suggestedAmount }
  const openSettleUp = useCallback((ctx) => sheetRef.current?.open(ctx), []);

  return (
    <SettleUpSheetContext.Provider value={{ openSettleUp }}>
      {children}
      <SettleUpSheet ref={sheetRef} />
    </SettleUpSheetContext.Provider>
  );
}

export function useSettleUpSheet() {
  const ctx = useContext(SettleUpSheetContext);
  if (!ctx) throw new Error('useSettleUpSheet must be used within SettleUpSheetProvider');
  return ctx;
}

const SettleUpSheet = forwardRef(function SettleUpSheet(_props, ref) {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const modalRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef);
  const { notifyChanged } = useDataRefresh();
  const { accounts, activeAccountId } = useAccount();
  const { showToast } = useToast();
  const currency = useCurrency();
  const { expenseCategories } = useCategories();

  const [ctx, setCtx] = useState({ split: null, from: null, to: null });
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(startOfDay(new Date()));
  const [showPicker, setShowPicker] = useState(false);
  const [note, setNote] = useState('');
  const [recordInFlo, setRecordInFlo] = useState(true);
  const [categoryId, setCategoryId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const numericAmount = Number(amount) || 0;
  const iAmPayer = !!ctx.from?.isSelf;
  const iAmPayee = !!ctx.to?.isSelf;
  const involvesMe = iAmPayer || iAmPayee;
  // Asymmetric on purpose (§2.4, option B). I pay them -> 'expense', because
  // paying my share of the lunch genuinely is spending on lunch. They pay me ->
  // 'settle_in', because getting back money I fronted for other people was
  // never income — it moves my balance and counts as earnings nowhere.
  const ledgerType = iAmPayer ? 'expense' : 'settle_in';
  // Only the expense case takes a category. A settle_in is excluded from every
  // category total by design, so offering a picker would imply it lands
  // somewhere it doesn't.
  const categories = expenseCategories;
  // The VIEWER's active account, not the split's (Phase 3 correction).
  // splits.account_id belongs to whoever CREATED the split — for a split shared
  // with me that's someone else's account, which I can't even read, let alone
  // write a transaction into. My settlement is my own money moving, so it lands
  // in the account I'm currently looking at.
  const ledgerAccountId = activeAccountId ?? ctx.split?.accountId ?? null;
  const accountName = accounts?.find((a) => a.id === ledgerAccountId)?.name ?? 'this account';

  useImperativeHandle(ref, () => ({
    open(nextCtx) {
      setError(null);
      setShowPicker(false);
      setPickerOpen(false);
      setCtx(nextCtx);
      // Pre-filled with the suggested figure but freely editable — a partial
      // payment is just a smaller settlement, and the balance recomputes.
      setAmount(nextCtx.suggestedAmount ? String(nextCtx.suggestedAmount) : '');
      setDate(startOfDay(new Date()));
      setNote('');
      setRecordInFlo(true);
      setCategoryId(null);
      modalRef.current?.present();
    },
  }));

  async function handleSave() {
    if (!numericAmount || numericAmount <= 0) {
      setError('Enter an amount');
      return;
    }
    if (involvesMe && recordInFlo && !ledgerAccountId) {
      setError('Still loading your account — try again in a moment');
      return;
    }
    setSaving(true);
    setError(null);

    const occurredOn = format(date, 'yyyy-MM-dd');
    const other = iAmPayer ? ctx.to : ctx.from;
    const { error: saveError } = await recordSettlement({
      splitId: ctx.split.id,
      fromMemberId: ctx.from.id,
      toMemberId: ctx.to.id,
      amount: numericAmount,
      occurredOn,
      note,
      // A settlement between two OTHER people is bookkeeping about them — it
      // moves the split's balances and touches nothing in the user's ledger.
      ledger:
        involvesMe && recordInFlo
          ? {
              type: ledgerType,
              accountId: ledgerAccountId,
              categoryId: iAmPayer ? categoryId : null,
              // The plan only for the expense leg. Paying your share of the
              // trip IS trip spending and belongs in the plan; money coming
              // BACK is not, and tagging it to a plan that tracks spending
              // would just put a credit in the middle of a spend list.
              planId: iAmPayer ? ctx.split.planId : null,
              note: `${ctx.split.name} — settled with ${other?.name ?? 'someone'}`,
            }
          : null,
    });

    setSaving(false);
    if (saveError) {
      showToast({ message: saveError.message, variant: 'error' });
      return;
    }
    notifyChanged();
    modalRef.current?.dismiss();
    showToast({ message: 'Settled', variant: 'success' });
  }

  return (
    <Sheet
      ref={modalRef}
      title="Settle up"
      onChange={handleSheetChange}
      footer={{ primary: { title: 'Record settlement', onPress: handleSave, loading: saving } }}
    >
      <View style={styles.parties}>
        <Text style={styles.party} numberOfLines={1}>
          {ctx.from?.name ?? '—'}
        </Text>
        <ArrowRight size={18} color={c.muted} strokeWidth={1.75} />
        <Text style={styles.party} numberOfLines={1}>
          {ctx.to?.name ?? '—'}
        </Text>
      </View>

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
      <Text style={styles.help}>Pay less than the full amount and the rest stays outstanding.</Text>

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

      <Text style={[styles.label, styles.spaced]}>Note (optional)</Text>
      <BottomSheetTextInput
        value={note}
        onChangeText={setNote}
        placeholder="UPI, cash…"
        placeholderTextColor={c.muted}
        cursorColor={c.accent}
        selectionColor={c.accent}
        accessibilityLabel="Note"
        style={styles.field}
        maxLength={80}
      />

      {involvesMe ? (
        <>
          <ListRow
            icon={BookOpen}
            title="Also record in FLO"
            sub={
              iAmPayer
                ? `Adds ${formatMoney(numericAmount, currency)} as an expense in ${accountName}.`
                : `Adds ${formatMoney(numericAmount, currency)} to ${accountName}. Not counted as income: it's money you fronted coming back.`
            }
            subLines={3}
            switchValue={recordInFlo}
            onSwitchChange={setRecordInFlo}
            divider={recordInFlo && iAmPayer}
          />

          {recordInFlo && iAmPayer && (
            <>
              <ListRow
                icon={Tag}
                title="Category (optional)"
                right={categories.find((cat) => cat.id === categoryId)?.name ?? 'None'}
                trailing="chevron"
                onPress={() => setPickerOpen((v) => !v)}
                divider={false}
              />
              {pickerOpen && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  style={styles.chipScroll}
                  contentContainerStyle={styles.chipRow}
                >
                  {categories.map((cat) => {
                    const selected = cat.id === categoryId;
                    return (
                      <Pressable
                        key={cat.id}
                        style={styles.chip}
                        accessibilityRole="button"
                        accessibilityLabel={cat.name}
                        accessibilityState={{ selected }}
                        onPress={() => {
                          setCategoryId(selected ? null : cat.id);
                          setPickerOpen(false);
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
      ) : (
        <Text style={styles.help}>
          This is between {ctx.from?.name} and {ctx.to?.name}, so nothing is added to your own transactions; it just updates who owes
          what here.
        </Text>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </Sheet>
  );
});

function makeStyles(c) {
  return StyleSheet.create({
    parties: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ledgerSpace.sm,
      marginBottom: ledgerSpace.md,
    },
    party: {
      ...ledgerType.rowTitle,
      fontFamily: inter.semibold,
      color: c.ink,
      flexShrink: 1,
    },
    amountWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginBottom: ledgerSpace.xs,
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
    label: {
      ...ledgerType.group,
      color: c.muted,
      marginBottom: ledgerSpace.sm,
    },
    spaced: {
      marginTop: ledgerSpace.md,
    },
    help: {
      ...ledgerType.caption,
      color: c.muted,
      textAlign: 'center',
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
      marginBottom: ledgerSpace.md,
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
  });
}
