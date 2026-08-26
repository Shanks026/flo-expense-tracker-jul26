import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAuth } from '../lib/AuthContext';

// The user's reusable local contacts for splits. Deliberately NOT account-
// scoped — a person is global to the user, the same way `categories` are. You
// don't have a different Abishek per account.
//
// These are NOT app users and never become app users in Phase 1. RLS keeps them
// owner-only, and Phase 3 must keep it that way: joining a shared split must
// never expose your private contact list (including phone numbers) to the other
// members. See 31-split-expenses.md Decision 5.
export default function useSplitPeople() {
  const { version } = useDataRefresh();
  const { session } = useAuth();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!session) {
      setPeople([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('split_people')
      .select('id, name, phone, color')
      .order('name', { ascending: true });
    if (!error) setPeople(data ?? []);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { people, loading, refetch };
}
