import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';

const EMPTY = {
  total_income: 0,
  total_expense: 0,
  in_hand_balance: 0,
  month_income: 0,
  month_expense: 0,
};

export default function useGlobalSummary() {
  const { version } = useDataRefresh();
  const { activeAccountId } = useAccount();
  const [summary, setSummary] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!activeAccountId) {
      setSummary(EMPTY);
      setLoading(false);
      return;
    }

    // v_global_summary is grouped by account_id, so an account with no
    // transactions yet returns no row at all — maybeSingle + EMPTY fallback
    // handles that instead of erroring like .single() would.
    const { data, error } = await supabase
      .from('v_global_summary')
      .select('*')
      .eq('account_id', activeAccountId)
      .maybeSingle();
    setSummary(!error && data ? data : EMPTY);
    setLoading(false);
  }, [activeAccountId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { summary, loading, refetch };
}
