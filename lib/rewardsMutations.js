import { supabase } from './supabase';
import { REWARDS, FREEZE_COST, FREEZE_CAP, MILESTONE_REWARDS, MILESTONE_THEME_GRANTS } from './rewards';

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
// The freeze portion respects FREEZE_CAP: reads the live balance and clamps
// the grant down to whatever room is left, silently dropping the overflow
// rather than queueing it — a milestone hit while already holding 4 freezes
// grants at most 1 more, even if MILESTONE_REWARDS says 3 (doc's own
// documented behaviour: "overflow grants are lost, not banked").
export async function claimMilestone(day) {
  const reward = MILESTONE_REWARDS[day];
  if (!reward) return { error: null, isNewClaim: false, coins: 0, freezes: 0 };

  let freezesToGrant = reward.freezes;
  if (freezesToGrant > 0) {
    const { data: balance, error: balanceError } = await supabase
      .from('v_reward_balances')
      .select('freezes')
      .maybeSingle();
    if (!balanceError) {
      const current = balance?.freezes ?? 0;
      freezesToGrant = Math.max(0, Math.min(freezesToGrant, FREEZE_CAP - current));
    }
  }

  const { data, error } = await supabase
    .from('reward_events')
    .upsert(
      { source: 'milestone', ref: `milestone:${day}`, coins: reward.coins, freezes: freezesToGrant },
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
    coins: reward.coins,
    freezes: freezesToGrant,
    themeId: themeId ?? null,
  };
}

// Chest pick-one-of-3 (19-card-themes.md Phase 2) — day 30 and day 50 each
// offer a fixed, deterministic choice (no randomness): a coin bundle, a
// freeze bundle, or that tier's chest-exclusive theme (see
// components/MilestoneChest.js for the actual pool). `ref: 'chest:<day>'`
// makes the whole chest choice claimable exactly once ever, same as
// `milestone:<day>` above — picking again (e.g. the celebration re-showing)
// is a no-op via ignoreDuplicates, regardless of which option was picked.
export async function claimChestPick(day, choice) {
  const { data, error } = await supabase
    .from('reward_events')
    .upsert(
      {
        source: 'chest',
        ref: `chest:${day}`,
        coins: choice.coins ?? 0,
        freezes: choice.freezes ?? 0,
      },
      { onConflict: 'user_id,source,ref', ignoreDuplicates: true }
    )
    .select();

  const isNewClaim = !error && (data?.length ?? 0) > 0;

  // Only actually grant the theme if this claim was the one that stuck —
  // otherwise a re-render/replay after the chest was already resolved could
  // grant a DIFFERENT theme than the one originally picked, if the two
  // calls ever disagreed. Uses the theme's own id as `ref`, matching
  // buyTheme/the milestone theme grant above.
  if (isNewClaim && choice.themeId) {
    await supabase
      .from('reward_events')
      .upsert({ source: 'theme_grant', ref: choice.themeId, coins: 0 }, { onConflict: 'user_id,source,ref', ignoreDuplicates: true });
  }

  return { data, error, isNewClaim };
}
