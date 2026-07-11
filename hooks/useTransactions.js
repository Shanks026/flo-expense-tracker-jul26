import { useEffect, useState, useCallback } from 'react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';

export default function useTransactions({ month, type = 'all', categoryId = null, planId = null, limit } = {}) {
  const { version } = useDataRefresh();
  const { activeAccountId } = useAccount();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!activeAccountId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    let query = supabase
      .from('transactions')
      .select('*, category:categories(id, name, icon), plan:plans(id, name)')
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
    setLoading(false);
  }, [month?.getTime(), type, categoryId, planId, limit, activeAccountId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { transactions, loading, refetch };
}
