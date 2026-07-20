import { supabase } from './supabase';
import { REWARDS, FREEZE_COST, FREEZE_CAP, FREEZE_OVERFLOW_COINS, MILESTONE_REWARDS, MILESTONE_THEME_GRANTS, TROPHY_REWARDS, SPIN_WHEELS } from './rewards';

// RFC-4122 v4 uuid from the CSPRNG that react-native-get-random-values already
// polyfills at app entry (for lib/supabase.js) — same implementation as
// lib/transfers.js/lib/receipts.js's own uuidv4(), duplicated rather than
// shared for the same reason those two don't share it either (no existing
// shared utils module for this one-liner).
function uuidv4() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0'));
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`;
}

// Clamps a freeze grant to FREEZE_CAP and converts any OVERFLOW to coins
// (22-coin-store-and-reward-tiering.md Phase 2 — FREEZE_OVERFLOW_COINS each)
// instead of silently dropping it. The single home for the rule "everywhere
// freezes are granted": claimMilestone, claimSpin, and claimTrophy all call
// this (buyFreeze doesn't — it hard-blocks at the cap, so no overflow is ever
// possible there). Returns { freezes, bonusCoins }; the caller adds bonusCoins
// to whatever coins it was already granting and writes/returns the sum.
// On a balance-read error the grant passes through unclamped with no bonus —
// the same "trust the single read" behaviour each claim had inline before,
// now in one place.
async function clampFreezeGrant(requested) {
  const want = requested ?? 0;
  if (want <= 0) return { freezes: 0, bonusCoins: 0 };
  const { data: balance, error } = await supabase
    .from('v_reward_balances')
    .select('freezes')
    .maybeSingle();
  if (error) return { freezes: want, bonusCoins: 0 };
  const current = balance?.freezes ?? 0;
  const room = Math.max(0, FREEZE_CAP - current);
  const freezes = Math.min(want, room);
  return { freezes, bonusCoins: (want - freezes) * FREEZE_OVERFLOW_COINS };
}

// Plain async claim functions, not hooks — same shape as lib/transfers.js's
// mutations. Each is an idempotent upsert into reward_events: the UNIQUE
// (user_id, source, ref) constraint makes a repeat call for the same key a
// silent no-op (ignoreDuplicates skips the insert outright, no update
// attempted), which is what makes "call this on every save, just in case"
// safe rather than a double-pay risk.
//
// Unlike lib/pushToken.js's registerPushToken (which had to go through a
// SECURITY DEFINER RPC because push_tokens' conflict target is the bare
// `token` column — a value that can already belong to a DIFFERENT user on a
// shared device, so RLS blocks a plain client upsert), reward_events' conflict
// target is (user_id, source, ref): user_id is PART of the key, so any row a
// conflict could ever match is already guaranteed to belong to the calling
// user. A plain client-side upsert is safe here — no cross-user RLS gap is
// possible.
//
// Every claim also chains `.select()` and reports `isNewClaim` — with
// `ignoreDuplicates: true`, PostgREST's RETURNING clause only reports rows
// actually touched by the insert, so an empty `data` array means the
// (user_id, source, ref) key already existed and this call was a no-op. This
// is what lets a caller show the reward-earned animation ONLY on a genuine
// first claim for the day, not on every repeat call "just in case".

// Claimed once per LOCAL calendar day (see AddTransactionSheet.handleSave —
// `localDateStr` is computed client-side with `format(new Date(), 'yyyy-MM-dd')`,
// never derived from `created_at` server-side, because the streak buckets by
// local day and a DB-side `created_at::date` would claim the wrong day for a
// late-night log in a timezone ahead of UTC).
export async function claimDailyLog(localDateStr) {
  const { coins, xp } = REWARDS.dailyLog;
  const { data, error } = await supabase
    .from('reward_events')
    .upsert({ source: 'daily_log', ref: localDateStr, coins, xp }, { onConflict: 'user_id,source,ref', ignoreDuplicates: true })
    .select();
  return { data, error, isNewClaim: !error && (data?.length ?? 0) > 0, coins, xp };
}

// The no-spend declaration (18-gamification-ritual-and-ledger.md Phase 3) —
// the ONLY place `source: 'no_spend'` is ever written. Zero coins, always —
// that invariant is what stops a no-spend declaration from ever out-earning
// an honest logged day; only `REWARDS.noSpend.xp` varies. `ref` is the same
// local-date idempotency key as claimDailyLog, and doubles as the
// streak-cover signal hooks/useStreak.js reads back.
export async function claimNoSpend(localDateStr) {
  const { xp } = REWARDS.noSpend;
  const { data, error } = await supabase
    .from('reward_events')
    .upsert({ source: 'no_spend', ref: localDateStr, coins: 0, xp }, { onConflict: 'user_id,source,ref', ignoreDuplicates: true })
    .select();
  return { data, error, isNewClaim: !error && (data?.length ?? 0) > 0, coins: 0, xp };
}

// Buys one streak freeze (18-gamification-ritual-and-ledger.md Phase 4) — the
// anchor shop item. Reads the current balance first (not DB-enforced — this
// app has no concurrent-device-write concern in practice, same trust level
// AddBudgetSheet etc. already place in a single read-then-act round trip) and
// guards both ends: can't overspend coins, can't exceed the hold cap. `ref` is
// a fresh uuid, not a date — unlike daily_log/no_spend, a freeze purchase has
// no natural once-per-day key; each buy is its own event.
export async function buyFreeze() {
  const { data: balance, error: balanceError } = await supabase
    .from('v_reward_balances')
    .select('coins, freezes')
    .maybeSingle();
  if (balanceError) return { error: balanceError };

  const coins = balance?.coins ?? 0;
  const freezes = balance?.freezes ?? 0;
  if (coins < FREEZE_COST) return { error: new Error('not_enough_coins') };
  if (freezes >= FREEZE_CAP) return { error: new Error('freeze_cap_reached') };

  const { error } = await supabase
    .from('reward_events')
    .insert({ source: 'freeze_buy', ref: uuidv4(), coins: -FREEZE_COST, freezes: 1 });
  return { error };
}

// Spends 1 freeze per date in `missedDates` to cover a recoverable gap, plus
// one flat one-time `freeze_comeback` reward for the whole return (never
// per-day — hoarding gaps must not out-earn a single honest logged day).
// `missedDates` must already be the CLOSEST-to-today subset when the caller
// is only partially covering a gap (FreezePrompt's job, not this function's)
// — computeStreak's `current` only extends backward from today through a
// CONTIGUOUS covered run, so freezing the wrong subset (e.g. the oldest
// missed days instead of the most recent) would spend real freezes for zero
// streak benefit. `returnDateStr` is today's local date — the comeback claim
// reuses the same idempotent-upsert shape as claimDailyLog/claimNoSpend, so a
// user can never collect it twice for one return even if this were somehow
// called again the same day.
export async function useFreezeForDates(missedDates, returnDateStr) {
  if (!missedDates?.length) return { error: new Error('no_missed_dates') };

  const { data: balance, error: balanceError } = await supabase
    .from('v_reward_balances')
    .select('freezes')
    .maybeSingle();
  if (balanceError) return { error: balanceError };
  if ((balance?.freezes ?? 0) < missedDates.length) return { error: new Error('not_enough_freezes') };

  const usedRows = missedDates.map((date) => ({ source: 'freeze_used', ref: date, freezes: -1 }));
  const { error: useError } = await supabase.from('reward_events').insert(usedRows);
  if (useError) return { error: useError };

  const { coins, xp } = REWARDS.freezeComeback;
  const { error: comebackError } = await supabase
    .from('reward_events')
    .upsert(
      { source: 'freeze_comeback', ref: returnDateStr, coins, xp },
      { onConflict: 'user_id,source,ref', ignoreDuplicates: true }
    );
  return { error: comebackError };
}

// Streak milestone payout (18-gamification-ritual-and-ledger.md Phase 5) —
// `day` is the streak count that just crossed a MILESTONES tier (3/7/10/30/
// 50/100). `ref: 'milestone:<day>'` makes each tier payable exactly ONCE
// EVER per user, not once per day — re-hitting day 30 on a rebuilt streak
// (or the celebration re-rendering) never pays twice, unlike the daily/
// no-spend claims above which key on a date and reset every day.
//
// The freeze portion respects FREEZE_CAP via clampFreezeGrant: a milestone hit
// while already holding 4 freezes grants at most 1 more even if
// MILESTONE_REWARDS says 3 — but as of 22-coin-store-and-reward-tiering.md
// Phase 2 the overflow is NO LONGER dropped: each freeze that can't fit
// converts to FREEZE_OVERFLOW_COINS coins, added to this day's lump (so the
// returned/burst `coins` is the real credited amount, cap-overflow included).
export async function claimMilestone(day) {
  const reward = MILESTONE_REWARDS[day];
  if (!reward) return { error: null, isNewClaim: false, coins: 0, freezes: 0 };

  const { freezes: freezesToGrant, bonusCoins } = await clampFreezeGrant(reward.freezes);
  const coinsToGrant = reward.coins + bonusCoins;

  const { data, error } = await supabase
    .from('reward_events')
    .upsert(
      { source: 'milestone', ref: `milestone:${day}`, coins: coinsToGrant, freezes: freezesToGrant },
      { onConflict: 'user_id,source,ref', ignoreDuplicates: true }
    )
    .select();

  // Legendary theme grant (19-card-themes.md Phase 2) — a SEPARATE row, not
  // folded into the one above: `ref` here must be the theme's own id (same
  // shape as buyTheme's `theme_buy` rows, so useCardThemes' ownedIds query
  // can read theme_buy/theme_grant identically), whereas the coins/freezes
  // row above keys on `milestone:<day>` — the two need different `ref`
  // values, so they can't share one upsert. `isNewClaim` above (from the
  // coins/freezes row) is still what the caller should check for
  // "did this milestone actually just fire" — this insert is best-effort
  // and additionally idempotent on its own via the same UNIQUE constraint.
  const themeId = MILESTONE_THEME_GRANTS[day];
  if (themeId) {
    await supabase
      .from('reward_events')
      .upsert({ source: 'theme_grant', ref: themeId, coins: 0 }, { onConflict: 'user_id,source,ref', ignoreDuplicates: true });
  }

  return {
    data,
    error,
    isNewClaim: !error && (data?.length ?? 0) > 0,
    coins: coinsToGrant,
    freezes: freezesToGrant,
    themeId: themeId ?? null,
  };
}

// Milestone spin wheel (20-milestone-spin-wheel.md Phase 1, extended Phase 2)
// — replaces the old pick-1-of-3 chest (claimChestPick, removed). This claims
// the wheel's BONUS coins/freezes segment AND, if `SPIN_WHEELS[day].theme` is
// set, grants that theme directly — the single rule settled in Phase 2 is
// "wheel day → theme via claimSpin; pure milestone day (no wheel) → theme via
// claimMilestone's own MILESTONE_THEME_GRANTS," so the two never overlap.
// `ref: 'spin:<day>'` makes the wheel claimable exactly once ever per
// milestone day, same shape as `milestone:<day>` in claimMilestone.
//
// `segment` is the caller's CLIENT-SIDE random pick (MilestoneSpinWheel picks
// an index, then calls this). On a genuine first claim, the persisted row
// carries that segment's coins/freezes — the freeze portion is clamped to
// FREEZE_CAP, same "read live balance, drop overflow, never queue it" rule
// claimMilestone already uses. On a REPLAY (isNewClaim false — the wheel was
// already spun for this day, e.g. the celebration re-rendering), the caller
// must not re-roll: this re-selects the row that actually landed, so the
// wheel animates to the outcome the user actually won, not a fresh random
// spin that would then silently no-op.
export async function claimSpin(day, segment) {
  const { freezes: freezesToGrant, bonusCoins } = await clampFreezeGrant(segment.freezes);
  const coinsToGrant = (segment.coins ?? 0) + bonusCoins;

  const ref = `spin:${day}`;
  const { data, error } = await supabase
    .from('reward_events')
    .upsert(
      { source: 'spin', ref, coins: coinsToGrant, freezes: freezesToGrant },
      { onConflict: 'user_id,source,ref', ignoreDuplicates: true }
    )
    .select();

  const isNewClaim = !error && (data?.length ?? 0) > 0;

  // Theme grant — a SEPARATE row (own idempotent upsert, `ref` is the theme's
  // own id, matching claimMilestone's theme_grant shape exactly), attempted
  // unconditionally rather than gated on `isNewClaim`: it's idempotent on its
  // own UNIQUE(user_id,source,ref), so a replay simply no-ops here too,
  // costing nothing extra to call every time this function runs for a themed
  // wheel day.
  const themeId = SPIN_WHEELS[day]?.theme ?? null;
  if (themeId) {
    await supabase
      .from('reward_events')
      .upsert({ source: 'theme_grant', ref: themeId, coins: 0 }, { onConflict: 'user_id,source,ref', ignoreDuplicates: true });
  }

  if (isNewClaim) {
    return { data, error, isNewClaim, coins: coinsToGrant, freezes: freezesToGrant, themeId };
  }

  // Replay: read back whatever actually got recorded the first time, so the
  // wheel can animate to the TRUE outcome instead of the freshly-rolled one.
  const { data: existing, error: existingError } = await supabase
    .from('reward_events')
    .select('coins, freezes')
    .eq('source', 'spin')
    .eq('ref', ref)
    .maybeSingle();

  return {
    data,
    error: error ?? existingError,
    isNewClaim: false,
    coins: existing?.coins ?? 0,
    freezes: existing?.freezes ?? 0,
    themeId,
  };
}

// Achievement trophy claim (21-achievement-rewards-and-milestone-road.md
// Phase 2) — `trophyId` is the exact tile id lib/trophies.js's makeEntry()
// already computes (`${groupId}:${tier}`), reused verbatim as `ref`. Mirrors
// claimMilestone's shape exactly: live-balance read + FREEZE_CAP clamp for
// the freeze portion, then an idempotent upsert so a trophy can only ever be
// claimed once, forever (not per-day, like milestone:<day>). A trophyId with
// no TROPHY_REWARDS entry (Streak Keeper, Budget Keeper, or any tier this map
// doesn't cover) is a deliberate no-op — the caller's UI never offers a Claim
// button for those in the first place, but this is the second layer of the
// same guard.
export async function claimTrophy(trophyId) {
  const reward = TROPHY_REWARDS[trophyId];
  if (!reward) return { error: null, isNewClaim: false, coins: 0, xp: 0, freezes: 0 };

  const { freezes: freezesToGrant, bonusCoins } = await clampFreezeGrant(reward.freezes);
  const coinsToGrant = (reward.coins ?? 0) + bonusCoins;

  const { data, error } = await supabase
    .from('reward_events')
    .upsert(
      { source: 'trophy', ref: trophyId, coins: coinsToGrant, xp: reward.xp ?? 0, freezes: freezesToGrant },
      { onConflict: 'user_id,source,ref', ignoreDuplicates: true }
    )
    .select();

  // Achievement theme grant (22-coin-store-and-reward-tiering.md Phase 1) — a
  // SEPARATE row, identical shape to claimMilestone/claimSpin's own
  // theme_grant block: `ref` is the theme's own id (so useCardThemes' ownedIds
  // reads theme_buy/theme_grant identically), idempotent on its own UNIQUE
  // (user_id,source,ref), attempted unconditionally (a replay just no-ops).
  // Only the six premium trophies carry a `themeId` (see TROPHY_REWARDS).
  const themeId = reward.themeId ?? null;
  if (themeId) {
    await supabase
      .from('reward_events')
      .upsert({ source: 'theme_grant', ref: themeId, coins: 0 }, { onConflict: 'user_id,source,ref', ignoreDuplicates: true });
  }

  return {
    data,
    error,
    isNewClaim: !error && (data?.length ?? 0) > 0,
    coins: coinsToGrant,
    xp: reward.xp ?? 0,
    freezes: freezesToGrant,
    themeId,
  };
}
