import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';

// The transactions a plan *could* collect: expenses in the plan's own account,
// inside a date window, optionally filtered by category. Deliberately scoped to
// the plan's own account_id (from v_plans_with_totals), NOT activeAccountId —
// this screen is keyed by an id from explicit navigation, so it must match the
// plan, same reasoning as usePlan/useBudgetDetail.
export default function usePlanCandidates(plan, { from, to, categoryId } = {}) {
  const { version } = useDataRefresh();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const accountId = plan?.account_id ?? null;
  const planId = plan?.id ?? null;

  const refetch = useCallback(async () => {
    if (!accountId || !planId || !from || !to) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    let query = supabase
      .from('transactions')
      .select('*, category:categories(id, name, icon, color), plan:plans(id, name)')
      .eq('account_id', accountId)
      .eq('type', 'expense')
      .gte('occurred_at', from)
      .lte('occurred_at', to)
      // Exclude transactions already in THIS plan, but KEEP untagged ones.
      // A bare .neq('plan_id', planId) would silently drop every NULL row
      // (Postgres `<>` is NULL for NULL) — precisely the untagged set the user
      // came here to find. The explicit is-null OR is the fix.
      .or(`plan_id.is.null,plan_id.neq.${planId}`)
      .order('occurred_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query;
    if (!error) setTransactions(data ?? []);
    setLoading(false);
  }, [accountId, planId, from, to, categoryId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { transactions, loading, refetch };
}
