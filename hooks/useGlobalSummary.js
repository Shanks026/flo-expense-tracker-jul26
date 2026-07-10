import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';

const EMPTY = {
  total_income: 0,
  total_expense: 0,
  in_hand_balance: 0,
  month_income: 0,
  month_expense: 0,
};

export default function useGlobalSummary() {
  const { version } = useDataRefresh();
  const [summary, setSummary] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase.from('v_global_summary').select('*').single();
    if (!error && data) setSummary(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { summary, loading, refetch };
}
