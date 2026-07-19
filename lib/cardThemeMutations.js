import { supabase } from './supabase';
import { getTheme } from './cardThemes';

// RFC-4122 v4 uuid — unused here (theme purchases key on the theme id
// itself, not a fresh uuid, since UNIQUE(user_id,source,ref) is exactly the
// "can't buy the same theme twice" guarantee we want) — kept out
// deliberately, unlike lib/rewardsMutations.js's freeze purchases which
// have no natural per-item key.

// Buys a card theme (19-card-themes.md Phase 1) — mirrors
// lib/rewardsMutations.js's buyFreeze exactly: read the live balance,
// guard client-side, then insert a negative-coin reward_events row. Unlike
// buyFreeze, `ref` is the themeId itself (not a fresh uuid) — the existing
// UNIQUE(user_id,source,ref) constraint is what makes a theme unbuyable
// twice, with `ignoreDuplicates` as a defensive backstop only (the Shop
// screen never calls this for an already-owned theme).
export async function buyTheme(themeId) {
  const theme = getTheme(themeId);
  if (theme.cost <= 0) return { error: new Error('theme_not_purchasable') };

  const { data: balance, error: balanceError } = await supabase
    .from('v_reward_balances')
    .select('coins')
    .maybeSingle();
  if (balanceError) return { error: balanceError };

  const coins = balance?.coins ?? 0;
  if (coins < theme.cost) return { error: new Error('not_enough_coins') };

  const { error } = await supabase
    .from('reward_events')
    .upsert(
      { source: 'theme_buy', ref: themeId, coins: -theme.cost },
      { onConflict: 'user_id,source,ref', ignoreDuplicates: true }
    );
  return { error };
}

// Equips an owned theme. Caller (Shop screen) must already have confirmed
// ownership (free, or present in useCardThemes' ownedIds) — this does not
// re-check server-side, matching this app's existing trust level for
// single-device mutations (see buyFreeze's own comment).
export async function equipTheme(userId, themeId) {
  if (!userId) return { error: new Error('not_signed_in') };
  const { error } = await supabase.from('profiles').update({ equipped_card_theme: themeId }).eq('id', userId);
  return { error };
}
