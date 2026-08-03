import { useEffect, useState, useCallback } from 'react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';
import useLoadedFor from './useLoadedFor';

export default function useTransactions({ month, type = 'all', categoryId = null, planId = null, limit } = {}) {
  const { version } = useDataRefresh();
  const { activeAccountId, loading: accountLoading } = useAccount();
  const [transactions, setTransactions] = useState([]);
  // See hooks/useLoadedFor.js — otherwise the list reported "loaded" while the
  // real fetch was in flight, so screens rendered their "nothing here yet"
  // empty state as though it were the answer, then popped to real rows.
  const [loading, markLoaded] = useLoadedFor(activeAccountId, accountLoading);

  const refetch = useCallback(async () => {
    if (!activeAccountId) {
      setTransactions([]);
      markLoaded(null);
      return;
    }

    let query = supabase
      .from('transactions')
      .select('*, category:categories(id, name, icon, color), plan:plans(id, name)')
      .eq('account_id', activeAccountId)
      .order('occurred_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (month) {
      query = query
        .gte('occurred_at', format(startOfMonth(month), 'yyyy-MM-dd'))
        .lte('occurred_at', format(endOfMonth(month), 'yyyy-MM-dd'));
    }
    if (type !== 'all') {
      query = query.eq('type', type);
    }
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }
    if (planId) {
      query = query.eq('plan_id', planId);
    }
    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (!error) setTransactions(data ?? []);
    markLoaded(activeAccountId);
  }, [month?.getTime(), type, categoryId, planId, limit, activeAccountId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { transactions, loading, refetch };
}
