import { useEffect, useState, useCallback, useMemo } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAuth } from '../lib/AuthContext';
import { CARD_THEMES, normalizeEquippedId, resolveEquippedTheme } from '../lib/cardThemes';
import { dayPeriod } from '../lib/dayScenes';
import { FLAGS } from '../lib/flags';

const FREE_IDS = CARD_THEMES.filter((t) => t.tier === 'free').map((t) => t.id);
const ALL_IDS = new Set(CARD_THEMES.map((t) => t.id));

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
  const [equippedId, setEquippedId] = useState('day');
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) {
      setCoins(0);
      setOwnedIds(new Set(FREE_IDS));
      setEquippedId('day');
      setLoading(false);
      return;
    }
    // Gating off (43-themes-back-unlocked.md): every theme is owned and the
    // coin economy isn't read, only the equipped id.
    if (!FLAGS.themeGating) {
      const { data } = await supabase.from('profiles').select('equipped_card_theme').eq('id', userId).maybeSingle();
      setCoins(0);
      setOwnedIds(ALL_IDS);
      setEquippedId(normalizeEquippedId(data?.equipped_card_theme));
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
    setEquippedId(normalizeEquippedId(profileRes.data?.equipped_card_theme));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  // Day changes scene with the clock (spec 46): check each minute and when
  // the app comes back to the foreground.
  const [period, setPeriod] = useState(() => dayPeriod());
  useEffect(() => {
    if (equippedId !== 'day') return undefined;
    const update = () => setPeriod(dayPeriod());
    const timer = setInterval(update, 60 * 1000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && update());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [equippedId]);
  // `period` is the dependency that makes Day re-resolve; the date is now.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const equippedTheme = useMemo(() => resolveEquippedTheme(equippedId), [equippedId, period]);

  return {
    coins,
    ownedIds,
    equippedId,
    equippedTheme,
    loading,
    refetch,
  };
}
