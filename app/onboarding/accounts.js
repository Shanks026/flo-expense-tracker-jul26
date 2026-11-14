import { useEffect, useMemo, useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import SetupQuestion from '../../components/onboarding/SetupQuestion';
import Chip from '../../components/ledger/Chip';
import Button from '../../components/ledger/Button';
import { CATEGORY_COLORS } from '../../components/CategoryIcon';
import { useToast } from '../../components/Toast';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius } from '../../theme/ledger';
import { useAccount } from '../../lib/AccountContext';
import { useDataRefresh } from '../../lib/DataRefreshContext';
import { useOnboardingDraft } from '../../lib/OnboardingDraftContext';
import { createAccount, updateAccount } from '../../lib/accounts';
import { planAccounts, cleanAccountName, ACCOUNT_CHOICES, ACCOUNT_NAME_MAX, SEEDED_ACCOUNT_NAME } from '../../lib/setupPlan';
import { DEFAULT_CURRENCY } from '../../lib/currency';
import { FLAGS } from '../../lib/flags';
import useEntitlement from '../../hooks/useEntitlement';
import useProfile from '../../hooks/useProfile';

const same = (a, b) => a.toLowerCase() === b.toLowerCase();

// Set-up question 1 (spec 47): "Where does your money live?" Each pick
// becomes an account; the first renames the seeded "Personal" (while it's
// still the only, untouched account) and becomes active. lib/setupPlan.js
// decides the writes; lib/accounts.js makes them, as the Add Account sheet
// does. With billing on and no Pro, one pick only: Free includes one account.
export default function OnboardingAccounts() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { accounts, loading: accountsLoading, setActiveAccount } = useAccount();
  const { notifyChanged } = useDataRefresh();
  const { draft, setAnswer } = useOnboardingDraft();
  const { hasPro } = useEntitlement();
  const { profile } = useProfile();
  const { showToast } = useToast();

  const [picks, setPicks] = useState(draft.accounts?.picks ?? null);
  const [customs, setCustoms] = useState(draft.accounts?.customs ?? []);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  // First open this session: seed from what's saved, so a relaunch mid-flow
  // shows the accounts Next already made. A lone, untouched Personal is
  // nothing chosen yet.
  useEffect(() => {
    if (picks !== null || accountsLoading) return;
    const lonePersonal = accounts.length === 1 && accounts[0].name === SEEDED_ACCOUNT_NAME;
    const names = lonePersonal ? [] : accounts.map((a) => ACCOUNT_CHOICES.find((x) => same(x, a.name)) ?? a.name);
    setPicks(names);
    setCustoms(names.filter((n) => !ACCOUNT_CHOICES.some((x) => same(x, n))));
  }, [picks, accountsLoading, accounts]);

  useEffect(() => {
    if (picks !== null) setAnswer('accounts', { picks, customs });
  }, [picks, customs, setAnswer]);

  const chosen = picks ?? [];
  const isPicked = (name) => chosen.some((p) => same(p, name));

  function toggle(name) {
    if (isPicked(name)) setPicks(chosen.filter((p) => !same(p, name)));
    else setPicks(hasPro ? [...chosen, name] : [name]);
  }

  function addCustom() {
    const name = cleanAccountName(newName);
    if (!name) return;
    const known = [...ACCOUNT_CHOICES, ...customs].find((x) => same(x, name));
    if (!known) setCustoms([...customs, name]);
    if (!isPicked(known ?? name)) setPicks(hasPro ? [...chosen, known ?? name] : [known ?? name]);
    setNewName('');
    setAdding(false);
  }

  async function handleNext() {
    const plan = planAccounts({ picks: chosen, existing: accounts, palette: CATEGORY_COLORS, canAddMore: hasPro });
    if (!plan) return true;

    const currency = FLAGS.currencyPicker ? (profile?.currency ?? DEFAULT_CURRENCY) : DEFAULT_CURRENCY;
    const createdIds = [];
    let failure = null;
    if (plan.rename) {
      const { error } = await updateAccount(plan.rename.id, { name: plan.rename.name });
      failure = error;
    }
    for (const account of plan.create) {
      if (failure) break;
      const { data, error } = await createAccount({ ...account, currency });
      failure = error;
      if (data) createdIds.push(data.id);
    }

    // Partial writes still show; a retry plans only what's missing.
    notifyChanged();
    if (failure) {
      showToast({ message: failure.message, variant: 'error' });
      return false;
    }
    const activeId = plan.active?.id ?? createdIds[plan.active?.create];
    if (activeId) setActiveAccount(activeId);
    return true;
  }

  const chips = [...ACCOUNT_CHOICES, ...customs];

  return (
    <SetupQuestion
      stepKey="accounts"
      title="Where does your money live?"
      note={hasPro ? 'Pick every place. Each becomes an account.' : 'Free includes one account. Pick where most of your money is.'}
      nextDisabled={chosen.length === 0}
      onNext={handleNext}
    >
      <View style={styles.chips}>
        {chips.map((name) => (
          <Chip key={name} label={name} selected={isPicked(name)} onPress={() => toggle(name)} />
        ))}
        {!adding && (
          <Chip
            label="Add"
            icon={Plus}
            accessibilityLabel="Add another account"
            onPress={() => setAdding(true)}
          />
        )}
      </View>
      {adding && (
        <View style={styles.addRow}>
          <TextInput
            autoFocus
            value={newName}
            onChangeText={setNewName}
            onSubmitEditing={addCustom}
            placeholder="Account name"
            placeholderTextColor={c.muted}
            maxLength={ACCOUNT_NAME_MAX}
            returnKeyType="done"
            autoCapitalize="words"
            autoCorrect={false}
            style={styles.input}
            accessibilityLabel="Account name"
          />
          <Button title="Add" compact onPress={addCustom} disabled={!cleanAccountName(newName)} />
        </View>
      )}
    </SetupQuestion>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ledgerSpace.sm,
      marginTop: ledgerSpace.section,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ledgerSpace.sm,
      marginTop: ledgerSpace.lg,
    },
    input: {
      flex: 1,
      height: 44,
      paddingHorizontal: ledgerSpace.lg,
      paddingVertical: 0,
      borderRadius: ledgerRadius.field,
      backgroundColor: c.surfaceSunk,
      ...ledgerType.body,
      color: c.ink,
    },
  });
}
