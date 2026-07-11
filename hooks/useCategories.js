import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAuth } from '../lib/AuthContext';

export default function useCategories() {
  const { version } = useDataRefresh();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Categories are global (not account-scoped), so unlike useTransactions/
  // useBudgets/etc. this hook has no activeAccountId dependency to force a
  // refetch once auth resolves. Without depending on userId directly, a fetch
  // that ran before sign-in completed (correctly empty, RLS-filtered) would
  // never get revisited — same root cause as the AccountContext bug in
  // 00-index.md. Depend on userId so sign-in itself triggers a refetch.
  const refetch = useCallback(async () => {
    if (!userId) {
      setCategories([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (!error) setCategories(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return {
    categories,
    expenseCategories: categories.filter((c) => c.type === 'expense'),
    incomeCategories: categories.filter((c) => c.type === 'income'),
    loading,
    refetch,
  };
}
