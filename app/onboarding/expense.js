import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ChevronDown } from 'lucide-react-native';
import { format, isToday, isYesterday } from 'date-fns';
import OnboardingScreen from '../../components/OnboardingScreen';
import CategoryIcon from '../../components/CategoryIcon';
import { useToast } from '../../components/Toast';
import useCategories from '../../hooks/useCategories';
import usePlans from '../../hooks/usePlans';
import { colors, radii, spacing, fontFamily, fontSize } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import { useAccount } from '../../lib/AccountContext';
import { useDataRefresh } from '../../lib/DataRefreshContext';
import { getNextRoute, getStepPosition } from '../../lib/onboarding';

// Design 03, built as a real stepper screen rather than opening
// AddTransactionSheet over the flow — the user's explicit call (a modal sheet
// on top of a linear stepper breaks the stepper's reading).
//
// Field parity with AddTransactionSheet is deliberate and was also the user's
// call: type, amount, category, date, plan and note, producing an identical
// row. The only things left out are the ones that make no sense here — editing
// and deleting (there's nothing to edit yet) and the account switcher (the
// account was named on the previous step; the row below states which one this
// lands in).
//
// This is now a genuine second implementation of transaction entry. If a third
// appears, extract a shared form component rather than copying it again.
// Width of the ₹ glyph's slot, mirrored by an empty spacer on the input's
// right so the digits land dead-centre. See the amount row's comment below.
const CURRENCY_SLOT = 26;

function formatDateLabel(date) {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'd MMM yyyy');
}

export default function OnboardingExpense() {
  const router = useRouter();
  const { activeAccount, activeAccountId } = useAccount();
  const { expenseCategories, incomeCategories } = useCategories();
  const { activePlans } = usePlans();
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();

  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [planId, setPlanId] = useState(null);
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const categories = type === 'expense' ? expenseCategories : incomeCategories;
  const selectedPlan = activePlans.find((p) => p.id === planId);

  // Categories load a beat after mount; select the first as soon as they
  // arrive, and again when the type flips (the two lists are disjoint).
  useEffect(() => {
    if (!categories.some((c) => c.id === categoryId)) {
      setCategoryId(categories[0]?.id ?? null);
    }
  }, [categories, categoryId]);

  const pos = getStepPosition('expense');
  const next = getNextRoute('expense');
  const numericAmount = Number(amount);

  async function handleSave() {
    if (!numericAmount || numericAmount <= 0 || !categoryId || !activeAccountId) return;
    setSaving(true);

    // Identical row shape to an AddTransactionSheet-created transaction —
    // that's the contract, since every other screen reads these rows.
    const { error } = await supabase.from('transactions').insert({
      type,
      amount: numericAmount,
      category_id: categoryId,
      plan_id: planId,
      occurred_at: format(date, 'yyyy-MM-dd'),
      note: note.trim() || null,
      account_id: activeAccountId,
    });

    setSaving(false);
    if (error) {
      showToast({ message: error.message, variant: 'error' });
      return;
    }
    // Without this, Home/Budgets/the streak wouldn't see the row until some
    // later mutation happened to bump the version.
    notifyChanged();
    router.replace(next);
  }

  return (
    <OnboardingScreen
      bg="light"
      progress={pos ? pos.index / pos.total : undefined}
      title="Add a transaction"
      subtitle="Optional. Try it now to see how fast it feels."
      scrollable
      primaryLabel="Add & Continue"
      onPrimary={handleSave}
      primaryDisabled={!numericAmount || numericAmount <= 0 || !categoryId}
      primaryLoading={saving}
      secondaryLabel="I'll do this later"
      onSecondary={() => router.push(next)}
    >
      {activeAccount && (
        <View style={styles.accountRow}>
          <View style={[styles.accountDot, { backgroundColor: activeAccount.color }]} />
          <Text style={styles.accountText}>
            Adding to <Text style={styles.accountName}>{activeAccount.name}</Text>
          </Text>
        </View>
      )}

      <View style={styles.segmentWrap}>
        <Pressable
          style={[styles.segment, type === 'expense' && styles.segmentActive]}
          onPress={() => setType('expense')}
        >
          <Text style={[styles.segmentText, type === 'expense' && styles.segmentTextActive]}>Expense</Text>
        </Pressable>
        <Pressable
          style={[styles.segment, type === 'income' && styles.segmentActive]}
          onPress={() => setType('income')}
        >
          <Text style={[styles.segmentText, type === 'income' && styles.segmentTextActive]}>Income</Text>
        </Pressable>
      </View>

      <View style={styles.amountWrap}>
        <Text style={styles.amountLabel}>Amount</Text>
        <View style={styles.amountRow}>
          <Text style={styles.amountCurrency}>₹</Text>
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
            placeholder="0"
            placeholderTextColor={colors.mutedLight}
            keyboardType="number-pad"
            style={styles.amountInput}
          />
          {/* Balances the ₹ on the other side of the input. Without it the row
              centres [₹][input] as a unit, which pushes the digits right of the
              centred "Amount" label above them. Equal fixed-width slots on both
              sides put the digits exactly on the centre line. */}
          <View style={styles.currencySlot} />
        </View>
      </View>

      <Text style={styles.sectionLabel}>CATEGORY</Text>
      <ScrollView
        key={type}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chipRow}
      >
        {categories.map((cat) => {
          const selected = cat.id === categoryId;
          return (
            <Pressable key={cat.id} style={styles.chip} onPress={() => setCategoryId(cat.id)}>
              <View style={[styles.chipIcon, selected && styles.chipIconSelected]}>
                <CategoryIcon icon={cat.icon} size={22} color={colors.ink} strokeWidth={2} />
              </View>
              <Text style={[styles.chipLabel, !selected && styles.chipLabelInactive]} numberOfLines={1}>
                {cat.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.dateAndPlanRow}>
        <Pressable style={[styles.field, { flex: 1 }]} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.fieldLabel}>Date</Text>
          <Text style={styles.fieldValue}>{formatDateLabel(date)}</Text>
        </Pressable>
        <Pressable style={[styles.field, { flex: 1 }]} onPress={() => setPlanPickerOpen((v) => !v)}>
          <View style={styles.planRowInner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Add to Plan</Text>
              <Text style={[styles.fieldValue, selectedPlan && styles.fieldValuePlan]} numberOfLines={1}>
                {selectedPlan?.name ?? 'None'}
              </Text>
            </View>
            <ChevronDown size={16} color={colors.muted} strokeWidth={2.4} />
          </View>
        </Pressable>
      </View>

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
              <Text
                style={[styles.planOptionText, planId === p.id && styles.planOptionTextSelected]}
                numberOfLines={1}
              >
                {p.name}
              </Text>
            </Pressable>
          ))}
        </View>
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
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  accountDot: {
    width: 9,
    height: 9,
    borderRadius: radii.pill,
  },
  accountText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    color: colors.muted,
  },
  accountName: {
    fontFamily: fontFamily.extrabold,
    color: colors.ink,
  },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: colors.chipBg,
    borderRadius: radii.buttonSm,
    padding: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: radii.buttonSm - 3,
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
    marginTop: spacing.xl,
  },
  amountLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.mutedMid,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  amountCurrency: {
    width: CURRENCY_SLOT,
    textAlign: 'right',
    fontFamily: fontFamily.bold,
    fontSize: fontSize.amount,
    color: colors.mutedLight,
  },
  currencySlot: {
    width: CURRENCY_SLOT,
  },
  amountInput: {
    minWidth: 110,
    height: 64,
    lineHeight: 64,
    textAlign: 'center',
    // See the identical comment in onboarding/balance.js's amountInput —
    // same Android caret-centering fix, same root cause. lineHeight matching
    // the fixed height was the missing piece: without it, an empty
    // controlled value's caret still rendered off-centre ("sidelined")
    // rather than through the placeholder's middle.
    textAlignVertical: 'center',
    includeFontPadding: false,
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.amountXl,
    letterSpacing: -1.5,
    color: colors.ink,
    padding: 0,
  },
  sectionLabel: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    letterSpacing: 0.4,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  chipRow: {
    gap: 9,
    paddingRight: spacing.xxl,
  },
  chip: {
    alignItems: 'center',
    gap: 6,
    width: 60,
  },
  chipIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.iconTileLg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipIconSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  chipLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: colors.ink,
  },
  chipLabelInactive: {
    fontFamily: fontFamily.semibold,
    color: colors.muted,
  },
  dateAndPlanRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  field: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.iconTileLg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  planRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fieldLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
  },
  fieldValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    color: colors.ink,
    marginTop: 2,
  },
  fieldValuePlan: {
    color: colors.incomeAccent,
  },
  planPicker: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.iconTileLg,
    overflow: 'hidden',
  },
  planOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  planOptionSelected: {
    backgroundColor: colors.iconTileBg,
  },
  planOptionText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.mutedDarker,
  },
  planOptionTextSelected: {
    fontFamily: fontFamily.extrabold,
    color: colors.ink,
  },
  noteRow: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.iconTileLg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  noteInput: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
    padding: 0,
    marginTop: 2,
  },
});
