import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';

// v_global_summary is grouped by account_id, so selecting without an
// account filter returns one row per account for the current user (RLS
// already scopes it) — exactly what the account switcher cards need.
export default function useAllAccountSummaries() {
  const { version } = useDataRefresh();
  const [summaries, setSummaries] = useState({});
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase.from('v_global_summary').select('*');
    if (!error && data) {
      const map = {};
      data.forEach((row) => {
        map[row.account_id] = row;
      });
      setSummaries(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { summaries, loading };
}
