import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Switch } from 'react-native';
import { BottomSheetModal, BottomSheetView, BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { X, ArrowRight } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, startOfDay } from 'date-fns';
import Button from './Button';
import CategoryIcon from './CategoryIcon';
import { radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    []
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      onChange={handleSheetChange}
      snapPoints={useMemo(() => ['86%'], [])}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.bg, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
      handleIndicatorStyle={{ backgroundColor: colors.chevron, width: 44 }}
    >
      <BottomSheetView style={styles.sheet}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Settle Up</Text>
          <Pressable style={styles.closeButton} onPress={() => modalRef.current?.dismiss()}>
            <X size={16} color={colors.ink} strokeWidth={2.6} />
          </Pressable>
        </View>

        <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.partiesRow}>
            <Text style={styles.partyName}>{ctx.from?.name ?? '—'}</Text>
            <ArrowRight size={18} color={colors.mutedMid} strokeWidth={2.4} />
            <Text style={styles.partyName}>{ctx.to?.name ?? '—'}</Text>
          </View>

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
          <Text style={styles.helpText}>
            Pay less than the full amount and the rest stays outstanding.
          </Text>

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

          <Text style={styles.fieldLabel}>Note (optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="UPI, cash…"
            placeholderTextColor={colors.mutedDarker}
            style={styles.input}
            maxLength={80}
          />

          {involvesMe ? (
            <View style={styles.ledgerBlock}>
              <View style={styles.ledgerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ledgerTitle}>Also record in FLO</Text>
                  <Text style={styles.ledgerSub}>
                    {iAmPayer
                      ? `Adds ${formatMoney(numericAmount, currency)} as an expense in ${accountName}.`
                      : `Adds ${formatMoney(numericAmount, currency)} to ${accountName}. Not counted as income — it's money you fronted coming back.`}
                  </Text>
                </View>
                <Switch
                  value={recordInFlo}
                  onValueChange={setRecordInFlo}
                  trackColor={{ true: colors.brand, false: colors.chipBg }}
                  thumbColor={colors.surface}
                />
              </View>

              {recordInFlo && iAmPayer && (
                <>
                  <Pressable style={styles.row} onPress={() => setPickerOpen((v) => !v)}>
                    <Text style={styles.fieldLabelInline}>Category (optional)</Text>
                    <Text style={styles.rowValue}>
                      {categories.find((c) => c.id === categoryId)?.name ?? 'None'}
                    </Text>
                  </Pressable>
                  {pickerOpen && (
                    <View style={styles.chipGrid}>
                      {categories.map((cat) => (
                        <Pressable
                          key={cat.id}
                          style={styles.catChip}
                          onPress={() => {
                            setCategoryId(cat.id === categoryId ? null : cat.id);
                            setPickerOpen(false);
                          }}
                        >
                          <View style={[styles.catIcon, cat.id === categoryId && styles.catIconSelected]}>
                            <CategoryIcon
                              icon={cat.icon}
                              size={20}
                              color={cat.id === categoryId ? colors.brandText : colors.ink}
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
          ) : (
            <Text style={styles.helpText}>
              This is between {ctx.from?.name} and {ctx.to?.name}, so nothing is added to your own
              transactions — it just updates who owes what here.
            </Text>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Button
            title="Record Settlement"
            variant="primary"
            onPress={handleSave}
            loading={saving}
            style={{ marginTop: spacing.lg }}
          />
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
    partiesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    partyName: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.heading,
      color: colors.ink,
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
    helpText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      marginBottom: spacing.md,
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
      marginBottom: spacing.sm,
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
    ledgerBlock: {
      marginTop: spacing.sm,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderSoft,
    },
    ledgerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    ledgerTitle: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.md,
      color: colors.ink,
    },
    ledgerSub: {
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
  });
}
