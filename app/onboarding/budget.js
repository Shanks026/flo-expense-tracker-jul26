import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import SetupQuestion from '../../components/onboarding/SetupQuestion';
import { useToast } from '../../components/Toast';
import { useLedger, ledgerType, ledgerSpace, tabular } from '../../theme/ledger';
import { useAccount } from '../../lib/AccountContext';
import { useDataRefresh } from '../../lib/DataRefreshContext';
import { useOnboardingDraft } from '../../lib/OnboardingDraftContext';
import { createBudget, updateBudget, budgetLimitReached, BUDGET_LIMIT_MESSAGE } from '../../lib/budgets';
import { cleanLimitAmount, planLimit, findLimitBudget } from '../../lib/setupPlan';
import { currencySymbol, sanitizeAmountInput } from '../../lib/currency';
import useBudgets from '../../hooks/useBudgets';
import useEntitlement from '../../hooks/useEntitlement';

// Set-up question 3 (spec 47): "Want a monthly spending limit?" One overall
// monthly budget on the active account, written through lib/budgets.js as the
// Add Budget sheet does. lib/setupPlan.js finds it again, so Back then Next
// updates it instead of adding a second. Skip writes nothing.
export default function OnboardingBudget() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { activeAccountId, activeAccount } = useAccount();
  const { budgets, loading: budgetsLoading } = useBudgets();
  const { notifyChanged } = useDataRefresh();
  const { draft, setAnswer } = useOnboardingDraft();
  const { hasPro } = useEntitlement();
  const { showToast } = useToast();

  const [amount, setAmount] = useState(draft.budget ?? null);

  // First open this session: seed from a limit already saved, so a relaunch
  // mid-flow shows it.
  useEffect(() => {
    if (amount !== null || budgetsLoading) return;
    const saved = findLimitBudget(budgets);
    setAmount(saved ? String(Number(saved.amount)) : '');
  }, [amount, budgetsLoading, budgets]);

  useEffect(() => {
    if (amount !== null) setAnswer('budget', amount);
  }, [amount, setAnswer]);

  const text = amount ?? '';
  const limit = cleanLimitAmount(text);
  const currency = activeAccount?.currency;

  async function handleNext() {
    const plan = planLimit({ amount: limit, budgets, saved: draft.budgetSaved, accountId: activeAccountId });
    if (!plan) return true;
    if (!activeAccountId) {
      showToast({ message: 'Still loading your account — try again in a moment', variant: 'error' });
      return false;
    }
    // The free-plan cap, create-time only, as in the Add Budget sheet. A new
    // account has no budgets, so this only bites someone resuming an older flow.
    // A toast, not the upsell sheet: a sales pitch has no place mid set-up,
    // and Skip is right there.
    if (plan.create && (await budgetLimitReached(hasPro))) {
      showToast({ message: BUDGET_LIMIT_MESSAGE, variant: 'error' });
      return false;
    }
    const { data, error } = plan.create
      ? await createBudget(activeAccountId, plan.create)
      : await updateBudget(plan.update.id, plan.update.fields);
    if (error) {
      showToast({ message: error.message, variant: 'error' });
      return false;
    }
    setAnswer('budgetSaved', data);
    notifyChanged();
    return true;
  }

  return (
    <SetupQuestion
      stepKey="budget"
      title="Want a monthly spending limit?"
      note="FLO can suggest one from your spending later"
      // Until the budgets load, a saved limit isn't known yet and Next would
      // add a second one.
      nextDisabled={limit === null || budgetsLoading}
      onNext={handleNext}
    >
      <View style={styles.amountWrap}>
        <Text style={styles.amountCurrency}>{currencySymbol(currency)}</Text>
        <TextInput
          autoFocus
          value={text}
          // The caret stays at the end, like the Add sheet's amount.
          selection={{ start: text.length, end: text.length }}
          onChangeText={(v) => setAmount(sanitizeAmountInput(v))}
          placeholder="0"
          placeholderTextColor={c.inkFaint}
          cursorColor={c.accent}
          selectionColor={c.accent}
          keyboardType="decimal-pad"
          accessibilityLabel="Monthly limit"
          style={[styles.amountInput, tabular]}
        />
      </View>
    </SetupQuestion>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    amountWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: ledgerSpace.section,
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
      flex: 1,
      padding: 0,
    },
  });
}
