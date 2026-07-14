import { useEffect, useState, useCallback } from 'react';
import { format, differenceInCalendarDays, subDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';
import { useAuth } from '../lib/AuthContext';

// allAccounts (11-reports.md Phase 1): when true, every query drops its
// `.eq('account_id', ...)` filter — RLS already scopes every query to the
// signed-in user, so dropping the filter is safe and returns rows from ALL of
// that user's accounts, the same move hooks/useAllAccountSummaries.js already
// makes on v_global_summary. Default false, so app/analytics.js's existing
// call is unaffected.
export default function useAnalyticsData({ from, to, allAccounts = false }) {
  const { version } = useDataRefresh();
  const { activeAccountId } = useAccount();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [current, setCurrent] = useState([]);
  const [prior, setPrior] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  // In allAccounts mode there's no single "active account" gate to wait on —
  // guard on userId instead (same reasoning as useAllAccountSummaries).
  const gate = allAccounts ? userId : activeAccountId;

  const refetch = useCallback(async () => {
    if (!gate) {
      setCurrent([]);
      setPrior([]);
      setBudgets([]);
      setPlans([]);
      setLoading(false);
      return;
    }

    const days = differenceInCalendarDays(to, from) + 1;
    const priorTo = subDays(from, 1);
    const priorFrom = subDays(priorTo, days - 1);

    let currentQuery = supabase
      .from('transactions')
      .select('*, category:categories(*), plan:plans(*)')
      .gte('occurred_at', format(from, 'yyyy-MM-dd'))
      .lte('occurred_at', format(to, 'yyyy-MM-dd'));
    let priorQuery = supabase
      .from('transactions')
      .select('*, category:categories(*), plan:plans(*)')
      .gte('occurred_at', format(priorFrom, 'yyyy-MM-dd'))
      .lte('occurred_at', format(priorTo, 'yyyy-MM-dd'));
    let budgetsQuery = supabase.from('v_budgets_with_spent').select('*');
    let plansQuery = supabase.from('v_plans_with_totals').select('*');

    if (!allAccounts) {
      currentQuery = currentQuery.eq('account_id', activeAccountId);
      priorQuery = priorQuery.eq('account_id', activeAccountId);
      budgetsQuery = budgetsQuery.eq('account_id', activeAccountId);
      plansQuery = plansQuery.eq('account_id', activeAccountId);
    }

    const [currentRes, priorRes, budgetsRes, plansRes] = await Promise.all([
      currentQuery,
      priorQuery,
      budgetsQuery,
      plansQuery,
    ]);

    setCurrent(currentRes.data ?? []);
    setPrior(priorRes.data ?? []);
    setBudgets(budgetsRes.data ?? []);
    setPlans(plansRes.data ?? []);
    setLoading(false);
  }, [from?.getTime(), to?.getTime(), allAccounts, gate, activeAccountId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { current, prior, budgets, plans, loading };
}
