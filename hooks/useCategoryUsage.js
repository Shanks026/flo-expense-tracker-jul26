import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAuth } from '../lib/AuthContext';

// Recent expense and income rows across all of the user's accounts, for the
// Add sheet's default category and grid order (lib/categoryDefaults.js).
// Categories are global, so this isn't account-scoped either. The newest 500
// rows cover the 30-day window and give the all-time fallback plenty to go on
// without reading a long history on every refresh.
const LIMIT = 500;

export default function useCategoryUsage() {
  const { version } = useDataRefresh();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('transactions')
      .select('category_id, type, created_at')
      .in('type', ['expense', 'income'])
      .not('category_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(LIMIT);
    if (!error) setRows(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  const expenseHistory = useMemo(() => rows.filter((r) => r.type === 'expense'), [rows]);
  const incomeHistory = useMemo(() => rows.filter((r) => r.type === 'income'), [rows]);

  return { expenseHistory, incomeHistory, loading, refetch };
}
