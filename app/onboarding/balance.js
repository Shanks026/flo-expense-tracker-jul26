import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import OnboardingScreen from '../../components/OnboardingScreen';
import { useToast } from '../../components/Toast';
import useCategories from '../../hooks/useCategories';
import { colors, spacing, fontFamily, fontSize } from '../../theme/tokens';
import { currencySymbol, sanitizeAmountInput } from '../../lib/currency';
import { supabase } from '../../lib/supabase';
import { useAccount } from '../../lib/AccountContext';
import { useAuth } from '../../lib/AuthContext';
import { useDataRefresh } from '../../lib/DataRefreshContext';
import { getNextRoute, getStepPosition } from '../../lib/onboarding';
import useCurrency from '../../hooks/useCurrency';
import { claimDailyLog } from '../../lib/rewardsMutations';
import { setPendingLoginReward } from '../../lib/pendingLoginReward';

// Sits between account.js and expense.js on purpose: without this, the demo
// expense the very next screen invites is the account's first-ever row, so
// Home greets a brand-new user with a negative balance. One quick "what's
// already yours" entry first means the expense lands against a real
// balance instead. Deliberately no type toggle/category chips/date/plan/note
// the way expense.js has — this isn't framed as "record a transaction," just
// a number, so it stays a single field plus Add & Continue / skip.
const CURRENCY_SLOT = 26;

export default function OnboardingBalance() {
  const router = useRouter();
  const { activeAccountId } = useAccount();
  const { session } = useAuth();
  const { incomeCategories } = useCategories();
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();
  const currency = useCurrency();

  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const pos = getStepPosition('balance');
  const next = getNextRoute('balance');
  const numericAmount = Number(amount);

  async function handleSave() {
    if (!numericAmount || numericAmount <= 0 || !activeAccountId) return;
    setSaving(true);

    const { error } = await supabase.from('transactions').insert({
      type: 'income',
      amount: numericAmount,
      category_id: incomeCategories[0]?.id ?? null,
      occurred_at: format(new Date(), 'yyyy-MM-dd'),
      note: 'Starting balance',
      account_id: activeAccountId,
    });

    setSaving(false);
    if (error) {
      showToast({ message: error.message, variant: 'error' });
      return;
    }

    // Gamification — this is a real logged transaction (same row shape as
    // AddTransactionSheet's own), so it earns the same daily coin/XP claim.
    // Found missing entirely (a brand-new account's first-ever transaction
    // is almost always logged HERE, not through AddTransactionSheet, so the
    // day-login reward was silently never claimed) — see
    // 20-milestone-spin-wheel.md's Phase 2 post-build notes. Unlike
    // AddTransactionSheet, this doesn't burst the reward immediately: per
    // direct feedback, stacking a RewardBurst into the onboarding stepper
    // (on top of the streak celebration + spin wheel, which already fire
    // here independently via useStreak reading the transactions table
    // directly) is too much at once. Persisted instead; Home shows it once,
    // the first time it mounts after onboarding.
    const { error: rewardError, isNewClaim, coins: earnedCoins, xp: earnedXp } = await claimDailyLog(
      format(new Date(), 'yyyy-MM-dd')
    );
    if (!rewardError && isNewClaim) {
      await setPendingLoginReward(session?.user?.id, { coins: earnedCoins, xp: earnedXp });
    }

    notifyChanged();
    router.replace(next);
  }

  return (
    <OnboardingScreen
      bg="light"
      progress={pos ? pos.index / pos.total : undefined}
      title="Let's fill your wallet"
      subtitle="Optional. Add what's yours. Let's not start from zero."
      primaryLabel="Add & Continue"
      onPrimary={handleSave}
      primaryDisabled={!numericAmount || numericAmount <= 0}
      primaryLoading={saving}
      secondaryLabel="I'll do this later"
      onSecondary={() => router.push(next)}
    >
      <View style={styles.amountWrap}>
        <Text style={styles.amountLabel}>Current balance</Text>
        <View style={styles.amountRow}>
          <Text style={styles.amountCurrency}>{currencySymbol(currency)}</Text>
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(sanitizeAmountInput(v))}
            placeholder="0"
            placeholderTextColor={colors.mutedLight}
            keyboardType="number-pad"
            autoFocus
            style={styles.amountInput}
          />
          {/* Balances the ₹ on the other side, same reasoning as expense.js's
              identical spacer — keeps the digits centred under the label. */}
          <View style={styles.currencySlot} />
        </View>
        <Text style={styles.hint}>This becomes your starting point - we'll track everything from here.</Text>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
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
    // Android centers the *text* fine via textAlign, but with an EMPTY
    // controlled value (just the placeholder showing) the blinking caret's
    // position is computed from font metrics, not the box's own centering —
    // no explicit lineHeight left it up to Android's default line-height
    // guess, which put the caret off to one side ("sidelined") rather than
    // through the middle of the placeholder. lineHeight matching the fixed
    // height, plus textAlignVertical + includeFontPadding (which also
    // removes the extra ascender/descender padding Android reserves for a
    // custom font), together pin both axes. Harmless no-op on iOS.
    textAlignVertical: 'center',
    includeFontPadding: false,
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.amountXl,
    letterSpacing: -1.5,
    color: colors.ink,
    padding: 0,
  },
  hint: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedLight,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
});
