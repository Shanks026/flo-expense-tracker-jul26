import { supabase } from './supabase';

// Writes to the streak's own store, `streak_marks` (34-streak-only.md) — one
// row per user, kind and local day. The economy's `reward_events` ledger is
// flagged off, so streak days no longer go there; hooks/useStreak.js still
// reads the legacy rows.

// A declared no-spend day. Idempotent: a second tap the same day hits the
// unique key and writes nothing, and `isNew` comes back false.
export async function markNoSpend(localDateStr) {
  const { data, error } = await supabase
    .from('streak_marks')
    .upsert({ kind: 'no_spend', day: localDateStr }, { onConflict: 'user_id,kind,day', ignoreDuplicates: true })
    .select();
  return { error, isNew: !error && (data?.length ?? 0) > 0 };
}

// Writes a freeze plan from hooks/useStreak.js (lib/streak.js's planFreezes):
// `freeze_used` for each missed day it covers, then `freeze_earned` for the
// day a run earned one. Idempotent like markNoSpend, so a plan applied twice
// (two refetches racing) writes each row once. `saved` counts only the
// freeze_used rows this call actually wrote, so the caller toasts once.
export async function applyFreezePlan({ toUse, toEarn }) {
  let saved = 0;
  if (toUse.length) {
    const { data, error } = await supabase
      .from('streak_marks')
      .upsert(toUse.map((day) => ({ kind: 'freeze_used', day })), { onConflict: 'user_id,kind,day', ignoreDuplicates: true })
      .select();
    if (error) return { error, saved: 0 };
    saved = data?.length ?? 0;
  }
  if (toEarn.length) {
    const { error } = await supabase
      .from('streak_marks')
      .upsert(toEarn.map((day) => ({ kind: 'freeze_earned', day })), { onConflict: 'user_id,kind,day', ignoreDuplicates: true });
    if (error) return { error, saved };
  }
  return { error: null, saved };
}
