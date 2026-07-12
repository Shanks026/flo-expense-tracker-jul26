import { useEffect, useState, useCallback } from 'react';
import { format, subDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAuth } from '../lib/AuthContext';
import { computeStreak } from '../lib/streak';

// How far back to fetch. A streak longer than this reads as capped — an
// accepted v1 limit (see 05-koban-engagement.md Phase 2), not a bug. Keeps the
// payload small; 90 days is more than enough for any streak worth showing.
const WINDOW_DAYS = 90;

const EMPTY = computeStreak([], new Date());

// Plain, non-hook fetch — the query logic lives here once, used by BOTH the
// hook below AND lib/notifications.js's rescheduleAll(), which cannot call a
// hook (it's a plain async function, not a component). rescheduleAll fetches
// streak data fresh on every call rather than accepting it as a stale-prone
// parameter — the exact same lesson as the settings-staleness bug documented
// in lib/notifications.js: a scheduler that trusts a passed-in snapshot
// instead of reading live state will eventually schedule against data that's
// no longer true.
export async function fetchStreak(userId) {
  if (!userId) return computeStreak([], new Date());

  // created_at, NOT occurred_at — see lib/streak.js's comment. occurred_at is
  // user-editable, so backfilling receipts would fabricate a streak.
  const since = format(subDays(new Date(), WINDOW_DAYS), 'yyyy-MM-dd');
  const { data, error } = await supabase
    .from('transactions')
    .select('created_at, type, amount')
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (error) return computeStreak([], new Date());
  return computeStreak(data ?? [], new Date());
}

// A streak is a habit, not a ledger view — so this is GLOBAL, deliberately not
// account-scoped (same reasoning that made bills global): logging a transaction
// in any account is still showing up. No .eq('account_id', ...) filter.
//
// Like useBills/useCategories, it therefore has no activeAccountId dependency
// to force a refetch once auth resolves, so it must depend on userId directly —
// otherwise the pre-auth fetch returns empty and is never revisited after
// sign-in (the standing rule in 00-index.md; that exact bug has been fixed
// twice already in this codebase).
export default function useStreak() {
  const { version } = useDataRefresh();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [streak, setStreak] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setStreak(await fetchStreak(userId));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { ...streak, loading, refetch };
}
