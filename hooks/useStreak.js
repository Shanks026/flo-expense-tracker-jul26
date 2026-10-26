import { useEffect, useState, useCallback } from 'react';
import { format, subDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAuth } from '../lib/AuthContext';
import { computeStreak, dayKey, planFreezes, MAX_FREEZES } from '../lib/streak';
import useLoadedFor from './useLoadedFor';

// How far back to fetch. A streak longer than this reads as capped — an
// accepted v1 limit (see 05-koban-engagement.md Phase 2), not a bug. Keeps the
// payload small; 90 days is more than enough for any streak worth showing.
const WINDOW_DAYS = 90;

const NO_PLAN = { toUse: [], toEarn: [] };
const empty = () => ({ ...computeStreak([], new Map(), new Date()), freezesHeld: 0, freezePlan: NO_PLAN });
const EMPTY = empty();

// Plain, non-hook fetch — used by the hook below. Previously also used by
// lib/notifications.js's rescheduleAll() (a plain async function, not a
// component, so it couldn't call a hook) — that consumer was removed
// 2026-07-19 when the daily reminder moved server-side
// (17-server-push-notifications.md Phase 2). Kept as a standalone exported
// function regardless: fetching fresh rather than accepting a possibly-stale
// passed-in streak is still the right shape for any future non-hook caller.
export async function fetchStreak(userId) {
  if (!userId) return empty();

  // created_at, NOT occurred_at — see lib/streak.js's comment. occurred_at is
  // user-editable, so backfilling receipts would fabricate a streak.
  const since = format(subDays(new Date(), WINDOW_DAYS), 'yyyy-MM-dd');
  const [txnResult, noSpendResult, frozenResult, marksResult] = await Promise.all([
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
    // The streak's own store (34-streak-only.md). New no-spend and freeze
    // days land here; the two reward_events reads above stay so legacy
    // history, written before the economy was flagged off, still counts.
    // Freeze marks are read all-time (there are only a few a week): the
    // freezes held are every earned mark minus every used one.
    supabase.from('streak_marks').select('day, kind').or(`kind.neq.no_spend,day.gte.${since}`),
  ]);

  if (txnResult.error) return empty();

  // Map, not a Set — lib/streak.js's history needs to know WHICH kind of
  // coverage a date has, not just that it's covered. Insertion order is the
  // precedence: no-spend first, frozen second, so frozen wins on the rare
  // date that's somehow both (matches lib/streak.js's own documented
  // logged > frozen > nospend precedence).
  const coveredDates = new Map();
  const marks = marksResult.error ? [] : marksResult.data ?? [];
  if (!noSpendResult.error) {
    for (const row of noSpendResult.data ?? []) coveredDates.set(row.ref, 'nospend');
  }
  for (const row of marks) if (row.kind === 'no_spend') coveredDates.set(row.day, 'nospend');
  if (!frozenResult.error) {
    for (const row of frozenResult.data ?? []) coveredDates.set(row.ref, 'frozen');
  }
  for (const row of marks) if (row.kind === 'freeze_used' && row.day >= since) coveredDates.set(row.day, 'frozen');

  const now = new Date();
  const streak = computeStreak(txnResult.data ?? [], coveredDates, now);

  // Automatic freezes (34-streak-only.md). Legacy reward_events freezes count
  // as already used: only streak_marks hold freezes.
  const earnedKeys = new Set(marks.filter((m) => m.kind === 'freeze_earned').map((m) => m.day));
  const usedCount = marks.filter((m) => m.kind === 'freeze_used').length;
  const freezesHeld = Math.min(MAX_FREEZES, Math.max(0, earnedKeys.size - usedCount));

  // Plan only from a complete picture: a failed coverage read would make a
  // covered day look missed and spend a freeze on it.
  let freezePlan = NO_PLAN;
  if (!marksResult.error && !noSpendResult.error && !frozenResult.error) {
    const coveredKeys = new Set(coveredDates.keys());
    for (const row of txnResult.data ?? []) coveredKeys.add(dayKey(new Date(row.created_at)));
    freezePlan = planFreezes({ coveredKeys, earnedKeys, held: freezesHeld, now });
  }

  return { ...streak, freezesHeld, freezePlan };
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
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id ?? null;
  const [streak, setStreak] = useState(EMPTY);
  // See hooks/useLoadedFor.js — otherwise Home's streak chip reported "loaded"
  // and painted an unlit zero-day streak while the real fetch was in flight.
  const [loading, markLoaded] = useLoadedFor(userId, authLoading);

  const refetch = useCallback(async () => {
    setStreak(await fetchStreak(userId));
    markLoaded(userId);
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { ...streak, loading, refetch };
}
