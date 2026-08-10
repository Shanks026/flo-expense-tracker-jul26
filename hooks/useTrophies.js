import { useEffect, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAuth } from '../lib/AuthContext';
import { computeRuns, dayKey } from '../lib/streak';
import useLoadedFor from './useLoadedFor';
import { evaluateTrophies, hasPerfectMonth, isCategorizerStreak } from '../lib/trophies';
import { TROPHY_REWARDS } from '../lib/rewards';

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
async function fetchStats(userId) {
  if (!userId) return EMPTY_STATS;

  const [txnCountRes, historyRes, plansRes, noSpendCountRes, claimedTrophyRes, coveredRes] = await Promise.all([
    // Exact-type filter (income/expense only) — same discipline as the
    // streak and every other aggregation in this app: transfers are
    // bookkeeping between a user's own accounts, not "logging".
    supabase.from('transactions').select('id', { count: 'exact', head: true }).in('type', ['income', 'expense']),
    // LIFETIME, deliberately unwindowed. This used to fetch a trailing 400
    // days, which quietly made trophies expire: the longest-streak and
    // perfect-month checks below are high-water marks ("did this EVER
    // happen"), so any window at all means a real achievement un-earns itself
    // and reverts to locked/grayscale once it ages past the cutoff. A trophy
    // is permanent recognition — it can only be derived from all of history.
    // Cheap at this app's single-user scale: two narrow columns, and even
    // years of daily logging is a few thousand rows.
    supabase.from('transactions').select('created_at, category_id').in('type', ['income', 'expense']),
    supabase.from('v_plans_with_totals').select('id').eq('status', 'completed'),
    // Lifetime, no date filter — same "not windowed" treatment as txnCount
    // above, since the `frugal` trophy's tiers (5/25/100) are a lifetime
    // total (18-gamification-ritual-and-ledger.md Phase 3).
    supabase.from('reward_events').select('id', { count: 'exact', head: true }).eq('source', 'no_spend'),
    // Which trophy claims already have a ledger row (21-achievement-rewards-
    // and-milestone-road.md Phase 2) — `ref` is the trophy tile's own id
    // (`${groupId}:${tier}`), matching lib/trophies.js's makeEntry() exactly.
    supabase.from('reward_events').select('ref').eq('source', 'trophy'),
    // Days covered by a declared no-spend or a spent freeze — these count for
    // streak CONTINUITY exactly like a logged day (see lib/streak.js), so the
    // lifetime longest-run below has to union them in or a streak carried
    // through a freeze would read as two shorter runs. `ref` already holds the
    // local 'yyyy-MM-dd' key, the same shape dayKey() produces.
    supabase.from('reward_events').select('ref').in('source', ['no_spend', 'freeze_used']),
  ]);

  const rows = historyRes.data ?? [];

  // Lifetime high-water marks, computed with the SAME arithmetic the streak
  // screen uses (lib/streak.js's computeRuns) — just over all of history
  // instead of a 90-day window, which is the whole point: a trophy earned in
  // March must still be earned in December.
  const lifetimeDays = new Set(rows.map((r) => dayKey(new Date(r.created_at))));
  for (const row of coveredRes.data ?? []) {
    if (row.ref) lifetimeDays.add(row.ref);
  }
  const { longest, breaks } = computeRuns(lifetimeDays);

  return {
    txnCount: txnCountRes.count ?? 0,
    longestStreak: longest,
    hasBreak: breaks > 0,
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
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id ?? null;
  const [stats, setStats] = useState(EMPTY_STATS);
  // See hooks/useLoadedFor.js — same loaded-for-which-user bookkeeping the
  // other read hooks use, so the wall never reports "loaded" while holding
  // EMPTY_STATS (which would paint every trophy locked for a beat).
  const [statsLoading, markLoaded] = useLoadedFor(userId, authLoading);
  const [seen, setSeen] = useState(new Set());

  // No longer depends on useStreak: its longest/breaks are window-scoped (90
  // days) and using them here is exactly what made earned trophies revert to
  // grayscale. fetchStats derives its own lifetime high-water marks instead,
  // so this hook also stops issuing useStreak's duplicate query.
  const refetch = useCallback(async () => {
    setStats(await fetchStats(userId));
    markLoaded(userId);
  }, [userId]);

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
  // Earned, carries a reward, and that reward hasn't been claimed yet — i.e.
  // there is something to COLLECT, not merely something new to look at.
  // Distinct from unseenCount on purpose: `seen` is a local AsyncStorage
  // "you've laid eyes on this tile" flag that clears the moment the Trophy
  // Room is opened, whereas this stays true until the user actually taps
  // Claim and a reward_events row exists. A tile with no TROPHY_REWARDS entry
  // is never counted — there's nothing to claim on it.
  const unclaimedCount = useMemo(
    () => trophies.filter((t) => t.earned && t.reward && !t.claimed).length,
    [trophies]
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
    unclaimedCount,
    markAllSeen,
    loading: statsLoading,
  };
}
