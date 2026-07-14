import { supabase } from './supabase';

// Account-to-account self-transfer. A transfer is TWO linked transaction rows —
// a `transfer_out` in the source account and a `transfer_in` in the destination —
// sharing one `transfer_id`. New `type` values (not income/expense) mean every
// existing spent/earned aggregation excludes transfers automatically; only
// v_global_summary's balance counts them. See 10-account-self-transfer.md.

export function isTransfer(tx) {
  return tx?.type === 'transfer_in' || tx?.type === 'transfer_out';
}

// A transfer row's user-facing label, resolved from its counterpart account.
// transfer_out (money leaving this account) → "Transfer to X"; transfer_in →
// "Transfer from X". Falls back to a bare "Transfer" if the counterpart account
// is gone (transfer_account_id SET NULL) or not in the passed list.
export function transferLabel(tx, accounts) {
  const other = accounts?.find((a) => a.id === tx.transfer_account_id);
  if (!other) return 'Transfer';
  return tx.type === 'transfer_out' ? `Transfer to ${other.name}` : `Transfer from ${other.name}`;
}

// RFC-4122 v4 uuid from the CSPRNG that react-native-get-random-values already
// polyfills at app entry (for lib/supabase.js). Both legs of one transfer must
// share the SAME transfer_id, so it's generated once here rather than relying on
// two independent DB-default row ids.
function uuidv4() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0'));
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`;
}

// Insert the two legs in one statement (atomic). user_id is omitted on purpose —
// it defaults to auth.uid() (standing rule, 00-index.md). category_id/plan_id
// stay NULL: a transfer has neither.
export async function logTransfer({ fromAccountId, toAccountId, amount, occurredAt, note }) {
  const transferId = uuidv4();
  const base = {
    amount,
    occurred_at: occurredAt,
    note: note || null,
    transfer_id: transferId,
    category_id: null,
    plan_id: null,
  };
  return supabase.from('transactions').insert([
    { ...base, account_id: fromAccountId, type: 'transfer_out', transfer_account_id: toAccountId },
    { ...base, account_id: toAccountId, type: 'transfer_in', transfer_account_id: fromAccountId },
  ]);
}

// Editing = replace the pair (fresh transfer_id), which sidesteps re-mapping
// which leg is which when the accounts change. Insert the NEW pair FIRST, then
// delete the old — so a failed insert leaves the original transfer intact rather
// than destroying it. The new pair gets fresh ids/created_at, harmless here
// (transfers are excluded from the streak's created_at logic).
export async function updateTransfer(transferId, fields) {
  const { error } = await logTransfer(fields);
  if (error) return { error };
  return deleteTransfer(transferId);
}

export async function deleteTransfer(transferId) {
  return supabase.from('transactions').delete().eq('transfer_id', transferId);
}
