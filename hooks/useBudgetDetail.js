import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';

// The budget, plus exactly the transactions that produced its `spent` figure.
//
// Two things this deliberately does NOT do:
//
// 1. It does not recompute the period. The window comes from the view's own
//    period_start/period_end (08-budget-periods-and-detail.md Phase 1). If this
//    hook derived "this week" itself, it could disagree with the `spent` number
//    printed directly above the list it produces — and that bug would be
//    invisible, because both halves would look correct in isolation.
//
// 2. It does not filter by activeAccountId. Like usePlan(planId), it's keyed by
//    an id that came from explicit navigation, so it scopes to *that budget's*
//    account_id — which is what makes the transaction list match the budget
//    rather than whatever account happens to be active.
export default function useBudgetDetail(budgetId) {
  const { version } = useDataRefresh();
  const [budget, setBudget] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!budgetId) return;

    const { data: budgetRow, error: budgetError } = await supabase
      .from('v_budgets_with_spent')
      .select('*')
      .eq('id', budgetId)
      .maybeSingle();

    if (budgetError || !budgetRow) {
      setBudget(null);
      setTransactions([]);
      setLoading(false);
      return;
    }
    setBudget(budgetRow);

    let query = supabase
      .from('transactions')
      .select('*, category:categories(id, name, icon)')
      .eq('account_id', budgetRow.account_id)
      .eq('type', 'expense')
      .gte('occurred_at', budgetRow.period_start)
      .lte('occurred_at', budgetRow.period_end)
      .order('occurred_at', { ascending: false })
      .order('created_at', { ascending: false });

    // A null category_id is an OVERALL budget — every expense in the window
    // counts toward it, so no category filter at all. Filtering on null here
    // would return only transactions with no category, which is a different
    // (and empty) thing entirely.
    if (budgetRow.category_id) {
      query = query.eq('category_id', budgetRow.category_id);
    }

    const { data, error } = await query;
    if (!error) setTransactions(data ?? []);
    setLoading(false);
  }, [budgetId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { budget, transactions, loading, refetch };
}
