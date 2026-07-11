import { useEffect, useState, useCallback } from 'react';
import { format, differenceInCalendarDays, subDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';

export default function useAnalyticsData({ from, to }) {
  const { version } = useDataRefresh();
  const { activeAccountId } = useAccount();
  const [current, setCurrent] = useState([]);
  const [prior, setPrior] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!activeAccountId) {
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

    const [currentRes, priorRes, budgetsRes, plansRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, category:categories(*), plan:plans(*)')
        .eq('account_id', activeAccountId)
        .gte('occurred_at', format(from, 'yyyy-MM-dd'))
        .lte('occurred_at', format(to, 'yyyy-MM-dd')),
      supabase
        .from('transactions')
        .select('*, category:categories(*), plan:plans(*)')
        .eq('account_id', activeAccountId)
        .gte('occurred_at', format(priorFrom, 'yyyy-MM-dd'))
        .lte('occurred_at', format(priorTo, 'yyyy-MM-dd')),
      supabase.from('v_budgets_with_spent').select('*').eq('account_id', activeAccountId),
      supabase.from('v_plans_with_totals').select('*').eq('account_id', activeAccountId),
    ]);

    setCurrent(currentRes.data ?? []);
    setPrior(priorRes.data ?? []);
    setBudgets(budgetsRes.data ?? []);
    setPlans(plansRes.data ?? []);
    setLoading(false);
  }, [from?.getTime(), to?.getTime(), activeAccountId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { current, prior, budgets, plans, loading };
}
