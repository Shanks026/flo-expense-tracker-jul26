import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';

export default function useCategories() {
  const { version } = useDataRefresh();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (!error) setCategories(data ?? []);
    setLoading(false);
  }, []);

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
