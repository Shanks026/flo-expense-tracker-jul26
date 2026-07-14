import { supabase } from './supabase';

// Arm or disarm a plan's collecting flag while preserving the "at most one
// collecting plan per account" invariant enforced by the
// plans_one_collecting_per_account partial unique index.
//
// The clear MUST run before the set: two collecting plans in one account would
// violate the index, so setting this one true while another is still true is
// rejected outright. Clearing the account's currently-armed plan first is what
// makes arming a new one a single coherent action. See 09-plans-that-collect.md.
export async function setPlanCollecting({ planId, accountId, collecting }) {
  if (collecting) {
    const { error: clearError } = await supabase
      .from('plans')
      .update({ is_collecting: false })
      .eq('account_id', accountId)
      .eq('is_collecting', true);
    if (clearError) return { error: clearError };
  }
  const { error } = await supabase
    .from('plans')
    .update({ is_collecting: collecting })
    .eq('id', planId);
  return { error };
}
