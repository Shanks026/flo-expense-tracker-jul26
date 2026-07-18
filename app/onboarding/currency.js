import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingScreen from '../../components/OnboardingScreen';
import ChoiceList from '../../components/OnboardingChoice';
import { colors } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import { useAccount } from '../../lib/AccountContext';
import { useDataRefresh } from '../../lib/DataRefreshContext';
import { useToast } from '../../components/Toast';
import { getNextRoute, getStepPosition } from '../../lib/onboarding';
import { CURRENCY_LIST, DEFAULT_CURRENCY } from '../../lib/currency';
import useProfile from '../../hooks/useProfile';

const OPTIONS = CURRENCY_LIST.map((c) => ({ key: c.code, label: `${c.symbol}  ${c.code}`, hint: c.name }));

// 15-currency-going-global.md Phase 2 §2.5 — added after the "name your
// account" screen, not before it: this UPDATEs the same auto-created Personal
// account account.js just named, matching its exact update-not-insert
// pattern. Runs before balance.js/expense.js/budget.js so those money-entry
// screens can show the symbol actually picked here, not a hardcoded ₹.
export default function OnboardingCurrency() {
  const router = useRouter();
  const { activeAccount, activeAccountId, loading: accountLoading } = useAccount();
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();
  const { updateProfile } = useProfile();

  const [value, setValue] = useState(DEFAULT_CURRENCY);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  // Seed from the account's own currency once it resolves — same
  // don't-clobber-a-touched-field guard account.js uses for name/color.
  useEffect(() => {
    if (!activeAccount || touched) return;
    setValue(activeAccount.currency ?? DEFAULT_CURRENCY);
  }, [activeAccount, touched]);

  const pos = getStepPosition('currency');
  const next = getNextRoute('currency');

  async function handleNext() {
    if (!activeAccountId) return;
    setSaving(true);

    // Sets both: this account's own currency, AND the profile default for any
    // FUTURE account — onboarding is the one moment establishing "what
    // currency do I use", so both should agree, not just the account. Without
    // the profile write, Settings' Currency row (which reads profiles.currency)
    // would keep showing INR even after picking USD here.
    const [{ error: accountError }, { error: profileError }] = await Promise.all([
      supabase.from('accounts').update({ currency: value }).eq('id', activeAccountId),
      updateProfile({ currency: value }),
    ]);

    setSaving(false);
    const error = accountError ?? profileError;
    if (error) {
      showToast({ message: error.message, variant: 'error' });
      return;
    }
    notifyChanged();
    router.replace(next);
  }

  if (accountLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  return (
    <OnboardingScreen
      bg="light"
      progress={pos ? pos.index / pos.total : undefined}
      title="What currency do you use?"
      subtitle="You can add other currencies later, one account at a time."
      scrollable
      primaryLabel="Continue"
      primaryLoading={saving}
      onPrimary={handleNext}
    >
      <ChoiceList
        options={OPTIONS}
        value={value}
        onChange={(key) => {
          setTouched(true);
          setValue(key);
        }}
      />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
});
