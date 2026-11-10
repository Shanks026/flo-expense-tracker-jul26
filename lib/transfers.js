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
    // Both legs (spec 46, ticket 07). An edit replaces the pair, so the new
    // legs are transfers too.
    source: 'transfer',
  };
  return supabase.from('transactions').insert([
    { ...base, account_id: fromAccountId, type: 'transfer_out', transfer_account_id: toAccountId },
    { ...base, account_id: toAccountId, type: 'transfer_in', transfer_account_id: fromAccountId },
  ]);
}

// Editing updates both legs IN PLACE, in one upsert (one statement, so
// atomic), keyed by their ids: each leg keeps its id, created_at and source,
// so Transaction detail stays on the same entry and its History shows the
// edit (the trigger stamps updated_at). It used to replace the pair with new
// rows, which left an open detail screen on an id that no longer existed
// (spec 46, ticket 11). Which leg is which comes from its type.
export async function updateTransfer(transferId, { fromAccountId, toAccountId, amount, occurredAt, note }) {
  const { data: legs, error: readError } = await supabase
    .from('transactions')
    .select('id, type')
    .eq('transfer_id', transferId);
  if (readError) return { error: readError };
  const out = legs?.find((l) => l.type === 'transfer_out');
  const inn = legs?.find((l) => l.type === 'transfer_in');
  if (!out || !inn) return { error: new Error('This transfer is missing a side. Delete it and add it again.') };
  const shared = { amount, occurred_at: occurredAt, note: note || null, transfer_id: transferId };
  return supabase.from('transactions').upsert(
    [
      { ...shared, id: out.id, type: 'transfer_out', account_id: fromAccountId, transfer_account_id: toAccountId },
      { ...shared, id: inn.id, type: 'transfer_in', account_id: toAccountId, transfer_account_id: fromAccountId },
    ],
    { onConflict: 'id' }
  );
}

export async function deleteTransfer(transferId) {
  return supabase.from('transactions').delete().eq('transfer_id', transferId);
}
