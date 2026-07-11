import { useEffect, useState, useCallback } from 'react';
import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAuth } from '../lib/AuthContext';

const DUE_SOON_DAYS = 3;

export function billStatus(nextDueDate) {
  const diff = differenceInCalendarDays(startOfDay(new Date(nextDueDate)), startOfDay(new Date()));
  if (diff < 0) return 'overdue';
  if (diff <= DUE_SOON_DAYS) return 'due_soon';
  return 'scheduled';
}

// Bills are global per-user (not account-scoped — see 04-notifications-and-
// recurring-bills.md's Phase 3 course-correction: a bill is a fact about the
// world, not tied to one account; only the payment is). Like useCategories,
// this has no activeAccountId dependency to force a refetch once auth
// resolves, so it must depend on userId directly or a pre-auth empty fetch
// never gets revisited after sign-in — same root cause documented in
// 00-index.md for the categories-not-loading bug.
export default function useBills() {
  const { version } = useDataRefresh();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) {
      setBills([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('bills')
      .select('*, category:categories(name, icon, color)')
      .order('next_due_date', { ascending: true });
    if (!error) setBills(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { bills, loading, refetch };
}
