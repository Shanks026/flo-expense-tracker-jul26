import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';

// The transactions a split could pull in: expenses in the SPLIT's own account,
// inside a date window, optionally filtered by category. Mirrors
// hooks/usePlanCandidates.js almost exactly — same shape, same account-scoping
// reasoning (keyed by an id from explicit navigation, so it must follow the
// split rather than activeAccountId), same `type = 'expense'` filter.
//
// One deliberate difference from the plan version: it excludes transactions
// ALREADY linked to a split entry, via `alreadyLinkedIds` passed in by the
// caller. A plan's membership is a column on the transaction itself
// (`plan_id`), so that hook can express "not already in this plan" as a SQL
// filter. A split's membership lives on the other side of the relationship, in
// `split_entries.transaction_id`, and PostgREST can't filter a table by the
// absence of a row in another one — so the caller reads the split it already
// has hydrated and hands the ids down. Cheaper than a view, and the split
// detail screen has that data loaded anyway.
export default function useSplitCandidates(split, { from, to, categoryId, alreadyLinkedIds } = {}) {
  const { version } = useDataRefresh();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const accountId = split?.accountId ?? null;
  const splitId = split?.id ?? null;
  // Serialised so the callback's dep list compares by value, not by array
  // identity — a fresh array on every render would refetch forever.
  const linkedKey = (alreadyLinkedIds ?? []).slice().sort().join(',');

  const refetch = useCallback(async () => {
    if (!accountId || !splitId || !from || !to) {
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
      .order('occurred_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (categoryId) query = query.eq('category_id', categoryId);

    const { data, error } = await query;
    if (!error) {
      const linked = new Set(linkedKey ? linkedKey.split(',') : []);
      setTransactions((data ?? []).filter((t) => !linked.has(t.id)));
    }
    setLoading(false);
  }, [accountId, splitId, from, to, categoryId, linkedKey]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { transactions, loading, refetch };
}
