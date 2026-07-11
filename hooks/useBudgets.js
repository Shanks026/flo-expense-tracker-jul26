import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';

export function budgetStatus(spent, amount) {
  if (amount <= 0) return 'healthy';
  const ratio = spent / amount;
  if (ratio > 1) return 'over';
  if (ratio >= 0.8) return 'warn';
  return 'healthy';
}

export default function useBudgets() {
  const { version, notifyChanged } = useDataRefresh();
  const { activeAccountId } = useAccount();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!activeAccountId) {
      setBudgets([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('v_budgets_with_spent')
      .select('*')
      .eq('account_id', activeAccountId)
      .order('created_at', { ascending: false });
    if (!error) setBudgets(data ?? []);
    setLoading(false);
  }, [activeAccountId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { budgets, loading, refetch, notifyChanged };
}
