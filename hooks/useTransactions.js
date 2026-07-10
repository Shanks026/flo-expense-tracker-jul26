import { useEffect, useState, useCallback } from 'react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';

export default function useTransactions({ month, type = 'all', categoryId = null, planId = null, limit } = {}) {
  const { version } = useDataRefresh();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    let query = supabase
      .from('transactions')
      .select('*, category:categories(id, name, icon), plan:plans(id, name)')
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
  }, [month?.getTime(), type, categoryId, planId, limit]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { transactions, loading, refetch };
}
