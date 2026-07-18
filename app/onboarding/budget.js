import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingScreen from '../../components/OnboardingScreen';
import CategoryIcon from '../../components/CategoryIcon';
import ProgressBar from '../../components/ProgressBar';
import { useToast } from '../../components/Toast';
import useCategories from '../../hooks/useCategories';
import { colors, radii, spacing, fontFamily, fontSize } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import { useAccount } from '../../lib/AccountContext';
import { useDataRefresh } from '../../lib/DataRefreshContext';
import { getNextRoute, getStepPosition } from '../../lib/onboarding';
import { getDraft, setDraftAnswer } from '../../lib/onboardingDraft';
import { formatMoney } from '../../lib/currency';
import useCurrency from '../../hooks/useCurrency';

// 12-personal-onboarding.md Phase 2, screen 17 — the receipt. The leak answer
// (intro screen 10) pre-creates a REAL budget here; this is what makes the
// reflection screen's promise true rather than a compliment. Both mappings are
// deterministic from draft fields that live until finish() clears them
// (Phase 3), so a re-mount never needs to re-derive anything beyond the
// `budgetCreated` guard against a double insert.
const LEAK_TO_CATEGORY_NAME = {
  food: 'Food',
  shopping: 'Shopping',
  subscriptions: 'Bills', // no "Subscriptions" default category — Bills is the closest
};
const LEAK_LABEL = {
  food: 'Food & eating out',
  shopping: 'Shopping',
  subscriptions: 'Subscriptions',
};
const BAND_TO_BUDGET = {
  lt_30k: 2000,
  '30_75k': 5000,
  '75_150k': 9000,
  gt_150k: 15000,
};
const DEFAULT_BUDGET_AMOUNT = 5000;

export default function OnboardingBudget() {
  const router = useRouter();
  const { activeAccountId } = useAccount();
  const { categories, loading: categoriesLoading } = useCategories();
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();
  const currency = useCurrency();

  const [phase, setPhase] = useState('loading'); // loading | created | unknown | error
  const [leak, setLeak] = useState(null);
  const [created, setCreated] = useState(null); // { category, amount }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const draft = await getDraft();
      const leakKey = draft.leak_category;
      setLeak(leakKey);

      if (!leakKey || leakKey === 'dont_know') {
        setPhase('unknown');
        return;
      }
      if (categoriesLoading || !activeAccountId) return; // wait for prerequisites

      const categoryName = LEAK_TO_CATEGORY_NAME[leakKey];
      const category = categories.find((c) => c.type === 'expense' && c.name === categoryName);
      if (!category) {
        setPhase('unknown'); // defensive: seeded categories missing is not this screen's problem to solve
        return;
      }

      const amount = BAND_TO_BUDGET[draft.income_band] ?? DEFAULT_BUDGET_AMOUNT;

      // Keyed by WHICH category the budget was created for, not a bare
      // boolean — a bare flag left over from an earlier leak answer (e.g.
      // during testing: pick "Food", get a budget, go back, pick
      // "Subscriptions") would silently skip the insert for the new category
      // and just display a fake "created" card with nothing behind it in the
      // DB. Only skip the insert when it was created for THIS exact category.
      if (draft.budgetCreatedFor === categoryName) {
        if (!cancelled) {
          setCreated({ category, amount });
          setPhase('created');
        }
        return;
      }

      const { error } = await supabase.from('budgets').insert({
        name: `${categoryName} budget`,
        amount,
        period_type: 'calendar_month',
        category_id: category.id,
        account_id: activeAccountId,
      });

      if (cancelled) return;
      if (error) {
        showToast({ message: error.message, variant: 'error' });
        setPhase('error');
        return;
      }
      notifyChanged();
      await setDraftAnswer('budgetCreatedFor', categoryName);
      setCreated({ category, amount });
      setPhase('created');
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [categories, categoriesLoading, activeAccountId]);

  const pos = getStepPosition('budget');
  const next = getNextRoute('budget');
  const leakLabel = LEAK_LABEL[leak] ?? 'that';

  if (phase === 'loading') {
    return (
      <OnboardingScreen bg="light" progress={pos ? pos.index / pos.total : undefined}>
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.ink} />
        </View>
      </OnboardingScreen>
    );
  }

  if (phase === 'created' && created) {
    return (
      <OnboardingScreen
        bg="light"
        progress={pos ? pos.index / pos.total : undefined}
        title={
          <>
            You said <Text style={styles.emphasis}>{leakLabel}</Text> was the leak.
          </>
        }
        subtitle="So we've set up a budget. It's already on your Budgets tab."
        primaryLabel="Nice"
        onPrimary={() => router.replace(next)}
      >
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={[styles.iconTile, { backgroundColor: created.category.color + '22' }]}>
              <CategoryIcon icon={created.category.icon} size={22} color={created.category.color} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{created.category.name} budget</Text>
              <Text style={styles.cardPeriod}>This month</Text>
            </View>
            <Text style={styles.cardAmount}>{formatMoney(created.amount, currency)}</Text>
          </View>
          <ProgressBar progress={0} status="healthy" />
          <Text style={styles.cardSpent}>{formatMoney(0, currency)} spent so far</Text>
        </View>
      </OnboardingScreen>
    );
  }

  if (phase === 'error') {
    return (
      <OnboardingScreen
        bg="light"
        progress={pos ? pos.index / pos.total : undefined}
        title="We couldn't set this up just now"
        subtitle="No worries. You can add a budget any time from the Budgets tab."
        primaryLabel="Continue"
        onPrimary={() => router.replace(next)}
      />
    );
  }

  // 'unknown' — the leak answer was "I don't know" (or missing/defensive fallback)
  return (
    <OnboardingScreen
      bg="light"
      progress={pos ? pos.index / pos.total : undefined}
      title="We'll help you find it."
      subtitle="No budget to show yet, but once you start logging, we'll point out exactly where it's going."
      primaryLabel="Sounds good"
      onPrimary={() => router.replace(next)}
    />
  );
}

const styles = StyleSheet.create({
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emphasis: {
    color: colors.income,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.xl,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radii.iconTile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  cardPeriod: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: 2,
  },
  cardAmount: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: colors.ink,
  },
  cardSpent: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: spacing.sm,
  },
});
