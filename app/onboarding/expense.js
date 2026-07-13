import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import OnboardingScaffold from '../../components/OnboardingScaffold';
import CategoryIcon from '../../components/CategoryIcon';
import { useToast } from '../../components/Toast';
import useCategories from '../../hooks/useCategories';
import { colors, radii, spacing, fontFamily, fontSize } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import { useAccount } from '../../lib/AccountContext';
import { useDataRefresh } from '../../lib/DataRefreshContext';
import { getNextRoute } from '../../lib/onboarding';

// Design 03, built as a real stepper screen rather than opening
// AddTransactionSheet over the flow — the user's explicit call (a modal sheet
// on top of a linear stepper breaks the stepper's reading).
//
// The duplication that buys is bounded on purpose: amount, type, category.
// There is deliberately NO plan link, note, date picker, account switcher,
// edit/delete, or post-save budget-warning toast here. This step is "log one
// expense, today, in a category" and nothing more. If it starts growing
// toward parity with AddTransactionSheet, that's the signal this was the
// wrong call — raise it rather than porting features across one at a time.
export default function OnboardingExpense() {
  const router = useRouter();
  const { activeAccountId } = useAccount();
  const { expenseCategories, incomeCategories } = useCategories();
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();

  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [saving, setSaving] = useState(false);

  const categories = type === 'expense' ? expenseCategories : incomeCategories;

  // Categories load a beat after mount; select the first one as soon as they
  // arrive (and again when the type flips, since the two lists are disjoint).
  useEffect(() => {
    if (!categories.some((c) => c.id === categoryId)) {
      setCategoryId(categories[0]?.id ?? null);
    }
  }, [categories, categoryId]);

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
      plan_id: null,
      occurred_at: format(new Date(), 'yyyy-MM-dd'),
      note: null,
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
    router.push(next);
  }

  return (
    <OnboardingScaffold
      stepKey="expense"
      title="Add your first expense"
      subtitle="Optional — try it now to see how fast it feels."
      primaryLabel="Add & Continue"
      onPrimary={handleSave}
      primaryDisabled={!numericAmount || numericAmount <= 0 || !categoryId}
      primaryLoading={saving}
      secondaryLabel="I'll do this later"
      onSecondary={() => router.push(next)}
    >
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
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
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
    marginTop: spacing.xxl,
  },
  amountLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.mutedMid,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  amountCurrency: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.amount,
    color: colors.mutedLight,
  },
  amountInput: {
    minWidth: 120,
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
    marginTop: spacing.xxl,
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
});
