import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import CategoryIcon from '../../components/CategoryIcon';
import OnboardingScreen from '../../components/OnboardingScreen';
import { useToast } from '../../components/Toast';
import { colors, radii, spacing, fontFamily, fontSize } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import { useDataRefresh } from '../../lib/DataRefreshContext';
import { getNextRoute, getStepPosition } from '../../lib/onboarding';
import { CATEGORY_BANK } from '../../lib/categoryBank';

// Redesigned 2026-07-22 — this screen is now the SOLE source of a new
// signup's starting categories (handle_new_user no longer auto-seeds any;
// see the categories_unique_and_stop_auto_seed migration, 00-index.md). The
// old version had to live-fetch the DB trigger's own inserts back just to
// know which chips were already locked in — a real, measured 2-3s wait
// before anything interactive could render. CATEGORY_BANK is now the single
// static source (local JS, zero network cost to render): every item is
// toggleable, the ones marked `preselected` start checked (they're what the
// trigger used to insert unconditionally), and whatever's checked when the
// user hits Continue is exactly what gets written — nothing is "already
// there" to reconcile against.
//
// The insert is an upsert with ignoreDuplicates on (user_id, name, type)
// (categories_unique_and_stop_auto_seed's unique constraint) rather than a
// plain insert — idempotent if this screen is ever visited twice (e.g. a
// cold restart mid-onboarding resumes at account.js, walking back through
// this screen), without needing a live check to prevent double-inserting.
function preselectedSet(items) {
  return new Set(items.filter((i) => i.preselected).map((i) => i.name));
}

function ChipGrid({ items, selected, onToggle }) {
  return (
    <View style={styles.chipGrid}>
      {items.map((item) => {
        const isSelected = selected.has(item.name);
        return (
          <Pressable
            key={item.name}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => onToggle(item.name)}
          >
            <View style={[styles.chipIcon, isSelected && styles.chipIconSelected]}>
              <CategoryIcon icon={item.icon} size={15} color={isSelected ? colors.ink : colors.muted} strokeWidth={2.2} />
            </View>
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]} numberOfLines={1}>
              {item.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function OnboardingCategories() {
  const router = useRouter();
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();

  const [selectedExpense, setSelectedExpense] = useState(() => preselectedSet(CATEGORY_BANK.expense));
  const [selectedIncome, setSelectedIncome] = useState(() => preselectedSet(CATEGORY_BANK.income));
  const [saving, setSaving] = useState(false);

  const pos = getStepPosition('categories');
  const next = getNextRoute('categories');

  function toggle(setFn, name) {
    setFn((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(name)) nextSet.delete(name);
      else nextSet.add(name);
      return nextSet;
    });
  }

  async function insertAndContinue(expenseNames, incomeNames) {
    // Picks only the DB-relevant fields — `preselected` is UI-only (which
    // chips start checked) and must never reach the insert.
    const toRow = (type) => ({ name, icon, color }) => ({ name, icon, color, type, is_default: true });
    const rows = [
      ...CATEGORY_BANK.expense.filter((i) => expenseNames.has(i.name)).map(toRow('expense')),
      ...CATEGORY_BANK.income.filter((i) => incomeNames.has(i.name)).map(toRow('income')),
    ];

    if (!rows.length) {
      router.replace(next);
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('categories')
      .upsert(rows, { onConflict: 'user_id,name,type', ignoreDuplicates: true });
    setSaving(false);
    if (error) {
      showToast({ message: error.message, variant: 'error' });
      return;
    }
    notifyChanged();
    router.replace(next);
  }

  return (
    <OnboardingScreen
      bg="light"
      progress={pos ? pos.index / pos.total : undefined}
      scrollable
      title="Which categories fit you?"
      subtitle="We've pre-picked the basics. Toggle any others you'll actually use — you can always add more later from Settings."
      primaryLabel="Continue"
      onPrimary={() => insertAndContinue(selectedExpense, selectedIncome)}
      primaryLoading={saving}
      secondaryLabel="Just the basics for now"
      onSecondary={() => insertAndContinue(preselectedSet(CATEGORY_BANK.expense), preselectedSet(CATEGORY_BANK.income))}
    >
      <Text style={styles.sectionLabel}>EXPENSE</Text>
      <ChipGrid items={CATEGORY_BANK.expense} selected={selectedExpense} onToggle={(n) => toggle(setSelectedExpense, n)} />

      <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>INCOME</Text>
      <ChipGrid items={CATEGORY_BANK.income} selected={selectedIncome} onToggle={(n) => toggle(setSelectedIncome, n)} />
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
});
