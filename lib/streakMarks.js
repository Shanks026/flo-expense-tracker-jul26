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
