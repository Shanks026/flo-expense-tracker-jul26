import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAuth } from '../lib/AuthContext';
import { CARD_THEMES, getTheme } from '../lib/cardThemes';

const FREE_IDS = CARD_THEMES.filter((t) => t.tier === 'free').map((t) => t.id);

// 19-card-themes.md Phase 1. Global (user-scoped), like useRewards/useStreak
// — card themes belong to the person, not one account. Fetches, in
// parallel: the live coin balance (v_reward_balances, already exposed —
// reused rather than going through useRewards to avoid a second XP/level
// computation this screen doesn't need), which theme ids the user has
// bought (reward_events rows with source='theme_buy'), and the equipped
// theme (profiles.equipped_card_theme).
export default function useCardThemes() {
  const { version } = useDataRefresh();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [coins, setCoins] = useState(0);
  const [ownedIds, setOwnedIds] = useState(new Set(FREE_IDS));
  const [equippedId, setEquippedId] = useState('ink');
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) {
      setCoins(0);
      setOwnedIds(new Set(FREE_IDS));
      setEquippedId('ink');
      setLoading(false);
      return;
    }
    const [balanceRes, boughtRes, profileRes] = await Promise.all([
      supabase.from('v_reward_balances').select('coins').maybeSingle(),
      // theme_buy (Phase 1 purchases) + theme_grant (Phase 2 milestone/chest
      // auto-grants) both use the theme's own id as `ref` — either source
      // means "owned".
      supabase.from('reward_events').select('ref').in('source', ['theme_buy', 'theme_grant']),
      supabase.from('profiles').select('equipped_card_theme').eq('id', userId).maybeSingle(),
    ]);

    setCoins(balanceRes.data?.coins ?? 0);
    setOwnedIds(new Set([...FREE_IDS, ...(boughtRes.data ?? []).map((r) => r.ref)]));
    setEquippedId(profileRes.data?.equipped_card_theme ?? 'ink');
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return {
    coins,
    ownedIds,
    equippedId,
    equippedTheme: getTheme(equippedId),
    loading,
    refetch,
  };
}
