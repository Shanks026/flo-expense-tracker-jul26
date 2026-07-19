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

const EMPTY = computeStreak([], new Map(), new Date());

// Plain, non-hook fetch — used by the hook below. Previously also used by
// lib/notifications.js's rescheduleAll() (a plain async function, not a
// component, so it couldn't call a hook) — that consumer was removed
// 2026-07-19 when the daily reminder moved server-side
// (17-server-push-notifications.md Phase 2). Kept as a standalone exported
// function regardless: fetching fresh rather than accepting a possibly-stale
// passed-in streak is still the right shape for any future non-hook caller.
export async function fetchStreak(userId) {
  if (!userId) return computeStreak([], new Map(), new Date());

  // created_at, NOT occurred_at — see lib/streak.js's comment. occurred_at is
  // user-editable, so backfilling receipts would fabricate a streak.
  const since = format(subDays(new Date(), WINDOW_DAYS), 'yyyy-MM-dd');
  const [txnResult, noSpendResult, frozenResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('created_at, type, amount')
      // Transfers are bookkeeping between your own accounts, not "showing up
      // and logging" — they must not count toward the streak or today's totals.
      .in('type', ['income', 'expense'])
      .gte('created_at', since)
      .order('created_at', { ascending: false }),
    // Declared no-spend days (18-gamification-ritual-and-ledger.md Phase 3) —
    // `ref` holds the local date string for a 'no_spend' reward_events row,
    // the same idempotency key claimNoSpend() writes.
    supabase.from('reward_events').select('ref').eq('source', 'no_spend').gte('ref', since),
    // Frozen days (Phase 4) — `ref` holds the local date string for each
    // 'freeze_used' row useFreezeForDates() writes, one per covered day.
    // RLS already scopes both queries to the caller, same as the
    // transactions query above — no explicit .eq('user_id', ...) needed.
    // String comparison on `ref` works for the >= since bound because
    // zero-padded ISO dates sort lexicographically in chronological order.
    supabase.from('reward_events').select('ref').eq('source', 'freeze_used').gte('ref', since),
  ]);

  if (txnResult.error) return computeStreak([], new Map(), new Date());

  // Map, not a Set — lib/streak.js's history needs to know WHICH kind of
  // coverage a date has, not just that it's covered. Insertion order is the
  // precedence: no-spend first, frozen second, so frozen wins on the rare
  // date that's somehow both (matches lib/streak.js's own documented
  // logged > frozen > nospend precedence).
  const coveredDates = new Map();
  if (!noSpendResult.error) {
    for (const row of noSpendResult.data ?? []) coveredDates.set(row.ref, 'nospend');
  }
  if (!frozenResult.error) {
    for (const row of frozenResult.data ?? []) coveredDates.set(row.ref, 'frozen');
  }

  return computeStreak(txnResult.data ?? [], coveredDates, new Date());
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
