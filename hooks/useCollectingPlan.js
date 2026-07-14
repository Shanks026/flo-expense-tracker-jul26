import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';

// The active account's collecting plan, or null. Reads the `plans` table
// directly (not v_plans_with_totals — the view deliberately doesn't carry
// is_collecting; see 09-plans-that-collect.md).
//
// The activeAccountId scope is LOAD-BEARING, not a convenience: transactions.
// plan_id has no constraint tying it to the same account as the transaction, so
// a collecting plan in account A could otherwise swallow a transaction created
// while account B is active — a plan whose contents span accounts, which nothing
// else in the app expects. Scoping the hook to activeAccountId makes that
// impossible: a new transaction only ever sees its own account's collecting plan.
export default function useCollectingPlan() {
  const { version } = useDataRefresh();
  const { activeAccountId } = useAccount();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!activeAccountId) {
      setPlan(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('plans')
      .select('id, name, account_id, is_collecting')
      .eq('account_id', activeAccountId)
      .eq('is_collecting', true)
      .maybeSingle();
    setPlan(error ? null : data);
    setLoading(false);
  }, [activeAccountId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { plan, loading, refetch };
}
