import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAuth } from '../lib/AuthContext';

// v_global_summary is grouped by account_id, so selecting without an
// account filter returns one row per account for the current user (RLS
// already scopes it) — exactly what the account switcher cards need.
export default function useAllAccountSummaries() {
  const { version } = useDataRefresh();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [summaries, setSummaries] = useState({});
  const [loading, setLoading] = useState(true);

  // Not scoped by activeAccountId (unlike most read hooks), so it has no
  // dependency that changes once auth resolves — depend on userId directly
  // or a pre-auth empty fetch never gets revisited after sign-in. Same root
  // cause as the AccountContext bug documented in 00-index.md.
  const refetch = useCallback(async () => {
    if (!userId) {
      setSummaries({});
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.from('v_global_summary').select('*');
    if (!error && data) {
      const map = {};
      data.forEach((row) => {
        map[row.account_id] = row;
      });
      setSummaries(map);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { summaries, loading };
}
