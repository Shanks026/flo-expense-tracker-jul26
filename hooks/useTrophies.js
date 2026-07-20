import { useEffect, useState, useCallback, useMemo } from 'react';
import { subDays, format } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAuth } from '../lib/AuthContext';
import useStreak from './useStreak';
import { evaluateTrophies, hasPerfectMonth, isCategorizerStreak } from '../lib/trophies';
import { TROPHY_REWARDS } from '../lib/rewards';

// How far back the perfect-month/categorizer window queries reach. 400 days
// (~13 months) covers "any completed calendar month" with margin, without
// pulling a user's entire lifetime history — modest data volume, per this
// app's own single-user scale.
const HISTORY_WINDOW_DAYS = 400;

const EMPTY_STATS = {
  txnCount: 0,
  longestStreak: 0,
  hasBreak: false,
  hasPerfectMonth: false,
  isCategorizer: false,
  completedPlans: 0,
  keptBudgetPeriods: null, // not computable yet — see lib/trophies.js
  noSpendDays: 0,
  // 21-achievement-rewards-and-milestone-road.md Phase 2 — which trophy tile
  // ids already have a claimed reward_events row (source: 'trophy').
  claimedTrophyRefs: new Set(),
};

// Global (user-scoped), like useStreak — a trophy is lifetime recognition,
// not scoped to whichever account happens to be active. Deliberately does
// NOT reuse useTransactions/usePlans/useBudgets: all three filter by
// activeAccountId, which is exactly the wrong scope here.
async function fetchStats(userId, streak) {
  if (!userId) return EMPTY_STATS;

  const since = format(subDays(new Date(), HISTORY_WINDOW_DAYS), 'yyyy-MM-dd');

  const [txnCountRes, historyRes, plansRes, noSpendCountRes, claimedTrophyRes] = await Promise.all([
    // Exact-type filter (income/expense only) — same discipline as the
    // streak and every other aggregation in this app: transfers are
    // bookkeeping between a user's own accounts, not "logging".
    supabase.from('transactions').select('id', { count: 'exact', head: true }).in('type', ['income', 'expense']),
    supabase
      .from('transactions')
      .select('created_at, category_id')
      .in('type', ['income', 'expense'])
      .gte('created_at', since),
    supabase.from('v_plans_with_totals').select('id').eq('status', 'completed'),
    // Lifetime, no date filter — same "not windowed" treatment as txnCount
    // above, since the `frugal` trophy's tiers (5/25/100) are a lifetime
    // total, not bounded by HISTORY_WINDOW_DAYS (18-gamification-ritual-and-
    // ledger.md Phase 3).
    supabase.from('reward_events').select('id', { count: 'exact', head: true }).eq('source', 'no_spend'),
    // Which trophy claims already have a ledger row (21-achievement-rewards-
    // and-milestone-road.md Phase 2) — `ref` is the trophy tile's own id
    // (`${groupId}:${tier}`), matching lib/trophies.js's makeEntry() exactly.
    supabase.from('reward_events').select('ref').eq('source', 'trophy'),
  ]);

  const rows = historyRes.data ?? [];

  return {
    txnCount: txnCountRes.count ?? 0,
    longestStreak: streak.longest,
    hasBreak: streak.breaks > 0,
    hasPerfectMonth: hasPerfectMonth(rows),
    isCategorizer: isCategorizerStreak(rows),
    completedPlans: plansRes.data?.length ?? 0,
    keptBudgetPeriods: null,
    noSpendDays: noSpendCountRes.count ?? 0,
    claimedTrophyRefs: new Set((claimedTrophyRes.data ?? []).map((r) => r.ref)),
  };
}

function seenKey(userId) {
  return `flo.trophies.seen.${userId}`;
}

export default function useTrophies() {
  const { version } = useDataRefresh();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const streak = useStreak();
  const [stats, setStats] = useState(EMPTY_STATS);
  const [statsLoading, setStatsLoading] = useState(true);
  const [seen, setSeen] = useState(new Set());

  const refetch = useCallback(async () => {
    if (streak.loading) return;
    setStats(await fetchStats(userId, streak));
    setStatsLoading(false);
  }, [userId, streak.loading, streak.longest, streak.breaks]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  // Loaded once per user, same "user-scoped AsyncStorage key" standing rule
  // as StreakCelebration's own seen-flag (00-index.md).
  useEffect(() => {
    if (!userId) return;
    AsyncStorage.getItem(seenKey(userId))
      .then((raw) => {
        if (raw) setSeen(new Set(JSON.parse(raw)));
      })
      .catch(() => {});
  }, [userId]);

  // 21-achievement-rewards-and-milestone-road.md Phase 2 — annotates each
  // tile with its reward + claimed state, WITHOUT touching lib/trophies.js
  // (which stays purely behavioral, per its own cardinal rule: "every trophy
  // rewards BEHAVIOR, never an amount"). A tile with no TROPHY_REWARDS entry
  // (Streak Keeper, Budget Keeper, or any tier this map doesn't cover) is
  // returned unchanged — that absence IS the "not claimable here" signal the
  // UI reads.
  const trophies = useMemo(
    () =>
      evaluateTrophies(stats).map((t) => {
        const reward = TROPHY_REWARDS[t.id];
        if (!reward) return t;
        return { ...t, reward, claimed: stats.claimedTrophyRefs.has(t.id) };
      }),
    [stats]
  );
  const earnedCount = useMemo(() => trophies.filter((t) => t.earned).length, [trophies]);
  const unseenCount = useMemo(
    () => trophies.filter((t) => t.earned && !seen.has(t.id)).length,
    [trophies, seen]
  );

  // Must be a genuine no-op when there's nothing new to mark — the caller
  // (app/trophies.js's useFocusEffect) can't fully control how often this
  // fires, since react-navigation re-runs a focus effect whenever its
  // callback's identity changes. Without this guard, setSeen(new Set(...))
  // below would construct a NEW Set object every call (even with identical
  // contents), which React always treats as changed state — triggering a
  // re-render, a new inline callback, another focus-effect run, another call
  // here, forever. Caught via a real "Maximum update depth exceeded" crash.
  const markAllSeen = useCallback(async () => {
    if (!userId) return;
    const earnedIds = trophies.filter((t) => t.earned).map((t) => t.id);
    if (earnedIds.every((id) => seen.has(id))) return;
    const next = new Set(earnedIds);
    setSeen(next);
    await AsyncStorage.setItem(seenKey(userId), JSON.stringify([...next])).catch(() => {});
  }, [userId, trophies, seen]);

  return {
    trophies,
    earnedCount,
    totalCount: trophies.length,
    unseenCount,
    markAllSeen,
    loading: streak.loading || statsLoading,
  };
}
