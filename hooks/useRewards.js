import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAuth } from '../lib/AuthContext';
import { levelFromXp } from '../lib/rewards';

const EMPTY_BALANCE = { coins: 0, xp: 0, freezes: 0 };

// Global (user-scoped), like useStreak — the whole gamification layer lives
// per-person, not per-account (see 18-gamification-ritual-and-ledger.md's
// scope discipline note). v_reward_balances returns no row for a user with
// zero reward_events yet, so `.maybeSingle()` + a zero default, same pattern
// as v_global_summary's own no-transactions-yet case.
export default function useRewards() {
  const { version } = useDataRefresh();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [balance, setBalance] = useState(EMPTY_BALANCE);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) {
      setBalance(EMPTY_BALANCE);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.from('v_reward_balances').select('*').maybeSingle();
    setBalance(error || !data ? EMPTY_BALANCE : { coins: data.coins, xp: data.xp, freezes: data.freezes });
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  const { level, xpIntoLevel, xpForNext, nextLevelAt, progress } = levelFromXp(balance.xp);

  return {
    coins: balance.coins,
    xp: balance.xp,
    freezes: balance.freezes,
    level,
    xpIntoLevel,
    xpForNext,
    // Display this alongside `xp`, not xpIntoLevel/xpForNext — see
    // lib/rewards.js's own comment on why a level-relative fraction reads as
    // XP "resetting" each level-up, which contradicts XP being monotonic.
    nextLevelAt,
    progress,
    loading,
    refetch,
  };
}
