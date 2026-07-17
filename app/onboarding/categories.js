import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import OnboardingScreen from '../../components/OnboardingScreen';
import CategoryIcon from '../../components/CategoryIcon';
import { useToast } from '../../components/Toast';
import useCategories from '../../hooks/useCategories';
import { colors, radii, spacing, fontFamily, fontSize } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import { useDataRefresh } from '../../lib/DataRefreshContext';
import { getNextRoute, getStepPosition } from '../../lib/onboarding';
import { CATEGORY_BANK } from '../../lib/categoryBank';

// 13-ai-features.md Phase 2 (category-onboarding revamp — replaces the earlier
// blur-triggered AI categorisation plan, which tested poorly and added a live
// model call to a moment that should be fast and reliable). Sits right after
// account.js and before balance.js/expense.js — by the time the user logs
// anything, their category list already reflects what they'll actually use.
//
// handle_new_user already seeded the small ABSOLUTE set (Food/Shopping/Bills/
// Other expense, Salary/Other income) by the time this screen mounts — this
// screen shows those as locked "already included" chips and offers the rest of
// CATEGORY_BANK as toggleable extras. Existing-name dedup (not a draft flag)
// guards re-mounts: anything already in `categories` renders locked, so
// revisiting this screen after already picking some never double-inserts —
// it just shows more chips as "already included".
function ChipGrid({ items, selected, locked, onToggle }) {
  return (
    <View style={styles.chipGrid}>
      {items.map((item) => {
        const isLocked = locked.has(item.name);
        const isSelected = isLocked || selected.has(item.name);
        return (
          <Pressable
            key={item.name}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => !isLocked && onToggle(item.name)}
            disabled={isLocked}
          >
            <View style={[styles.chipIcon, isSelected && styles.chipIconSelected]}>
              <CategoryIcon icon={item.icon} size={15} color={isSelected ? colors.ink : colors.muted} strokeWidth={2.2} />
            </View>
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]} numberOfLines={1}>
              {item.name}
            </Text>
            {isLocked && (
              <View style={styles.lockedCheck}>
                <Check size={10} color={colors.surface} strokeWidth={3.5} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function OnboardingCategories() {
  const router = useRouter();
  const { expenseCategories, incomeCategories, loading } = useCategories();
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();

  const [selectedExpense, setSelectedExpense] = useState(new Set());
  const [selectedIncome, setSelectedIncome] = useState(new Set());
  const [saving, setSaving] = useState(false);

  const pos = getStepPosition('categories');
  const next = getNextRoute('categories');

  const lockedExpense = new Set(expenseCategories.map((c) => c.name));
  const lockedIncome = new Set(incomeCategories.map((c) => c.name));
  const bankExpense = CATEGORY_BANK.expense.filter((item) => !lockedExpense.has(item.name));
  const bankIncome = CATEGORY_BANK.income.filter((item) => !lockedIncome.has(item.name));

  function toggle(setFn, name) {
    setFn((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function handleContinue() {
    const rows = [
      ...bankExpense.filter((i) => selectedExpense.has(i.name)).map((i) => ({ ...i, type: 'expense', is_default: true })),
      ...bankIncome.filter((i) => selectedIncome.has(i.name)).map((i) => ({ ...i, type: 'income', is_default: true })),
    ];

    if (!rows.length) {
      router.replace(next);
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('categories').insert(rows);
    setSaving(false);
    if (error) {
      showToast({ message: error.message, variant: 'error' });
      return;
    }
    notifyChanged();
    router.replace(next);
  }

  if (loading) return null;

  return (
    <OnboardingScreen
      bg="light"
      progress={pos ? pos.index / pos.total : undefined}
      scrollable
      title="Which categories fit you?"
      subtitle="We've already added the basics. Pick any others you'll actually use — you can always add more later from Settings."
      primaryLabel="Continue"
      onPrimary={handleContinue}
      primaryLoading={saving}
      secondaryLabel="Just the basics for now"
      onSecondary={() => router.replace(next)}
    >
      <Text style={styles.sectionLabel}>EXPENSE</Text>
      <ChipGrid items={[...expenseCategories, ...bankExpense]} selected={selectedExpense} locked={lockedExpense} onToggle={(n) => toggle(setSelectedExpense, n)} />

      <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>INCOME</Text>
      <ChipGrid items={[...incomeCategories, ...bankIncome]} selected={selectedIncome} locked={lockedIncome} onToggle={(n) => toggle(setSelectedIncome, n)} />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginBottom: spacing.sm,
  },
  sectionLabelSpaced: {
    marginTop: spacing.xl,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipSelected: {
    backgroundColor: colors.incomeBg,
    borderColor: colors.income,
  },
  chipIcon: {
    width: 22,
    height: 22,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipIconSelected: {
    backgroundColor: 'transparent',
  },
  chipText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  chipTextSelected: {
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  lockedCheck: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.income,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
});
