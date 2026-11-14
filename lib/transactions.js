import { supabase } from './supabase';
import { isTransfer, deleteTransfer } from './transfers';

// Delete one entry (spec 46, ticket 11). The caller runs notifyChanged().
// - A transfer is two rows: both legs go, by transfer_id, never one leg.
// - Anything else is one row. A split entry that points at it is kept:
//   split_entries.transaction_id is ON DELETE SET NULL, so the split loses
//   only the cross-reference, not what others rely on.
export async function deleteTransaction(tx) {
  if (isTransfer(tx)) {
    // Never one leg: without the pair's id, refuse rather than orphan the other.
    if (!tx.transfer_id) return { error: new Error('This transfer can’t be matched to its other side.') };
    return deleteTransfer(tx.transfer_id);
  }
  return supabase.from('transactions').delete().eq('id', tx.id);
}
