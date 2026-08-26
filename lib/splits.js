import { supabase } from './supabase';
import { resolveEqualShares } from './splitMath';

// Mutations for 31-split-expenses.md Phase 1. Reads live in hooks/useSplit*.js;
// writes live here, and every caller runs notifyChanged() from useDataRefresh
// on success — the standard FLO contract.
//
// THE ONE HARD INVARIANT IN THIS FILE: a split entry is NOT a transaction.
// Abishek's ₹1,600 lunch is not the user's money and must never enter their
// ledger. The only functions here that touch `transactions` are
// recordSettlement and logEntryFromPocket, and both write exactly what really
// moved in or out of the user's own account — nothing derived, nothing
// speculative. See the doc's "the ledger records only rupees that actually
// moved" resolution.
//
// user_id is never passed on an insert: every table in this schema defaults it
// to auth.uid() (split_expenses_user_id_defaults migration), same as accounts /
// budgets / plans / transactions.

// ---------------------------------------------------------------- people

export async function addPerson({ name, phone, color }) {
  const { data, error } = await supabase
    .from('split_people')
    .insert({ name: name.trim(), phone: phone?.trim() || null, color })
    .select('id')
    .single();
  return { id: data?.id ?? null, error };
}

export async function updatePerson(personId, { name, phone, color }) {
  const { error } = await supabase
    .from('split_people')
    .update({ name: name.trim(), phone: phone?.trim() || null, color })
    .eq('id', personId);
  return { error };
}

// split_members.person_id is ON DELETE RESTRICT, so this fails while the person
// is in any split. That's the correct behaviour — silently unpicking someone
// from a trip's history to satisfy a delete would corrupt the math — but the
// raw Postgres 23503 is useless to read, so name the splits instead.
export async function deletePerson(personId) {
  const { error } = await supabase.from('split_people').delete().eq('id', personId);
  if (!error) return { error: null };

  const { data } = await supabase
    .from('split_members')
    .select('splits(name)')
    .eq('person_id', personId);
  const names = (data ?? []).map((r) => r.splits?.name).filter(Boolean);
  if (names.length) {
    return {
      error: {
        message: `They're in ${names.length === 1 ? 'a split' : 'splits'}: ${names.join(', ')}. Remove them there first.`,
      },
    };
  }
  return { error };
}

// ---------------------------------------------------------------- splits

export async function createSplit({ accountId, name, icon, occurredOn, planId, personIds }) {
  // The creator's own name, projected onto their member row. Without it they
  // have no readable name at all — person_id is NULL (you're not one of your own
  // contacts) — so their own phone showed a bare "You" and, on a shared split,
  // everyone else saw "Someone". `profiles` RLS is owner-only, so this select
  // can only ever return the caller's own row.
  const { data: me } = await supabase.from('profiles').select('full_name').maybeSingle();
  const myName = me?.full_name?.trim() || null;

  const { data: split, error } = await supabase
    .from('splits')
    .insert({
      account_id: accountId,
      name: name.trim(),
      icon: icon ?? null,
      occurred_on: occurredOn,
      plan_id: planId ?? null,
    })
    .select('id')
    .single();
  if (error) return { id: null, error };

  // Exactly one is_self row per split (DB-enforced by a partial unique index),
  // and it carries the organizer role. Both of those matter only from Phase 3,
  // but writing them correctly now is what keeps Phase 3 an RLS change rather
  // than a data migration.
  //
  // EVERY ROW MUST CARRY THE SAME KEYS. On a bulk insert, PostgREST takes the
  // union of keys across the array and sends NULL for any object missing one —
  // it does NOT fall back to the column default. So omitting `is_self` on the
  // person rows (relying on its `default false`) sent NULL instead and tripped
  // the NOT NULL constraint, which is exactly what "null value in column
  // is_self violates not null constraint" was. Spell out every column,
  // including the nulls.
  const rows = [
    { split_id: split.id, person_id: null, is_self: true, role: 'organizer', display_name: myName },
    ...(personIds ?? []).map((personId) => ({
      split_id: split.id,
      person_id: personId,
      is_self: false,
      role: 'member',
      // Ghosts are named by their contact row, so this stays null for them —
      // but the key must be PRESENT, because a bulk insert with differing keys
      // sends NULL for the missing ones anyway (see the note above) and being
      // explicit is what keeps that from being a surprise.
      display_name: null,
    })),
  ];
  const { error: memberError } = await supabase.from('split_members').insert(rows);
  if (memberError) {
    // Leaving a memberless split behind would be worse than failing outright —
    // it can't compute anything and the user can't tell why.
    await supabase.from('splits').delete().eq('id', split.id);
    return { id: null, error: memberError };
  }
  return { id: split.id, error: null };
}

export async function updateSplit(splitId, { name, icon, occurredOn, planId }) {
  const { error } = await supabase
    .from('splits')
    .update({
      name: name.trim(),
      icon: icon ?? null,
      occurred_on: occurredOn,
      plan_id: planId ?? null,
    })
    .eq('id', splitId);
  return { error };
}

export async function deleteSplit(splitId) {
  const { error } = await supabase.from('splits').delete().eq('id', splitId);
  return { error };
}

// status and closed_at move together — the splits_closed_at_matches_status
// CHECK rejects one without the other.
//
// Closing is the ONLY thing that locks a split, and it's a deliberate action
// someone takes rather than a side effect of the last payment landing
// (Decision 7). Reopening is always available.
export async function closeSplit(splitId) {
  const { error } = await supabase
    .from('splits')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', splitId);
  return { error };
}

export async function reopenSplit(splitId) {
  const { error } = await supabase
    .from('splits')
    .update({ status: 'open', closed_at: null })
    .eq('id', splitId);
  return { error };
}

// ---------------------------------------------------------------- members

// Same explicit-every-column rule as createSplit above — these rows happen to
// be uniform, but relying on that is how the bug came back.
export async function addMembers(splitId, personIds) {
  const { error } = await supabase.from('split_members').insert(
    personIds.map((personId) => ({
      split_id: splitId,
      person_id: personId,
      is_self: false,
      role: 'member',
      display_name: null,
    }))
  );
  return { error };
}

// RESTRICT again, and for the same reason: a member who paid for something or
// owes a share can't be lifted out without changing what everyone else owes.
export async function removeMember(memberId) {
  const { error } = await supabase.from('split_members').delete().eq('id', memberId);
  if (!error) return { error: null };
  return {
    error: {
      message: "They've already paid for something or owe a share here. Remove or edit those entries first.",
    },
  };
}

// ---------------------------------------------------------------- entries

// Entry + shares in ONE transaction, via the RPC. supabase-js can't run a
// multi-statement transaction, so doing this as two client inserts would leave
// a window where an entry exists with no shares (or partial ones) and every
// balance in the split is quietly wrong. save_split_entry also re-checks that
// the shares sum to the amount, so no client bug can get past it.
export async function saveEntry({
  entryId,
  splitId,
  description,
  amount,
  occurredOn,
  payerMemberId,
  strategy,
  shares, // { [memberId]: number }
}) {
  const { data, error } = await supabase.rpc('save_split_entry', {
    p_entry_id: entryId ?? null,
    p_split_id: splitId,
    p_description: description.trim(),
    p_amount: amount,
    p_occurred_on: occurredOn,
    p_payer_member_id: payerMemberId,
    p_strategy: strategy,
    p_shares: Object.entries(shares).map(([member_id, share]) => ({
      member_id,
      amount: share,
    })),
  });
  return { id: data ?? null, error };
}

// ---------------------------------------------------------------- sharing (P3)

// Invite CODES, not a user directory (Decision 3). The code goes in a link the
// organizer pastes into the group chat where the trip is already being
// planned — which needs no user search, no address-book upload, no phone number
// at signup, and nothing to declare in Play Data Safety.
//
// 22 chars of base36 from the same CSPRNG lib/transfers.js already relies on
// (react-native-get-random-values is polyfilled at app entry). Not a uuid: this
// is read and sometimes retyped by humans.
function inviteCode() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes]
    .map((b) => b.toString(36))
    .join('')
    .slice(0, 22);
}

export const INVITE_TTL_DAYS = 14;

// Expiry is mandatory server-side (the column is NOT NULL) because a link that
// works forever is an unrevocable grant to a money record. Reuses a live
// unexpired invite rather than minting one per tap, so the organizer can share
// the same link twice without silently invalidating the first.
export async function getOrCreateInvite(splitId) {
  const { data: existing } = await supabase
    .from('split_invites')
    .select('code, expires_at')
    .eq('split_id', splitId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.code) return { code: existing.code, error: null };

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

  const { data, error } = await supabase
    .from('split_invites')
    .insert({ split_id: splitId, code: inviteCode(), expires_at: expiresAt.toISOString() })
    .select('code')
    .single();
  return { code: data?.code ?? null, error };
}

export async function revokeInvites(splitId) {
  const { error } = await supabase
    .from('split_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('split_id', splitId)
    .is('revoked_at', null);
  return { error };
}

// Joining goes through the SECURITY DEFINER RPC because a joiner is by
// definition not yet a member — no membership policy can authorise their own
// insert, and RLS can't take an invite code as a parameter.
//
// `claimMemberId` is the "ghost becomes real" path: someone recorded as just a
// name installs FLO and must MERGE into their existing member row rather than
// showing up a second time.
export async function joinSplit({ code, claimMemberId }) {
  const { data, error } = await supabase.rpc('join_split', {
    p_code: code,
    p_claim_member_id: claimMemberId ?? null,
  });
  return { splitId: data ?? null, error };
}

// What a joiner is shown BEFORE committing: which split, who's already in it,
// and which unclaimed names they might be. Read through the definer RPC's
// sibling — a non-member can't select these tables directly, by design.
export async function previewInvite(code) {
  const { data, error } = await supabase.rpc('preview_split_invite', { p_code: code });
  return { preview: data ?? null, error };
}

// Append-only, and the reason the permissive role model is safe (Decision 6):
// an organizer can edit anything, and every edit is attributed. Never allowed
// to fail a real mutation — a missing log line is not worth losing the action.
export async function logActivity({ splitId, kind, summary }) {
  const { error } = await supabase
    .from('split_activity')
    .insert({ split_id: splitId, kind, summary });
  if (error) console.warn('split activity not logged:', error.message);
}

// ---------------------------------------------------------------- linking

// Phase 2. Kept as a separate call rather than a parameter on save_split_entry:
// adding an argument to that function would change its signature, and
// `create or replace` with a new argument list creates a SECOND function rather
// than replacing the first — which leaves PostgREST with two overloads to pick
// between and starts erroring on every call. Two round trips is a much cheaper
// price than that.
//
// The window between the two calls is harmless: if the link fails, the entry is
// still complete and correct, just not cross-referenced.
export async function linkEntryToTransaction(entryId, transactionId) {
  const { error } = await supabase
    .from('split_entries')
    .update({ transaction_id: transactionId })
    .eq('id', entryId);
  return { error };
}

export async function unlinkEntry(entryId) {
  // Clears the cross-reference only. The transaction itself is untouched —
  // that money moved, and forgetting the link doesn't un-move it (Decision 9).
  const { error } = await supabase
    .from('split_entries')
    .update({ transaction_id: null })
    .eq('id', entryId);
  return { error };
}

// Turn transactions the user has ALREADY logged into split entries — the
// "log it once, not twice" fix. Drives both the "Add to Split" picker in
// AddTransactionSheet (one transaction) and the add-from-history screen (many).
//
// Defaults are the overwhelmingly common case and are all editable afterwards:
// the user is the payer (they logged it, so they paid it), every member is a
// participant, split equally.
export async function createEntriesFromTransactions({ splitId, transactions }) {
  const { data: members, error: memberError } = await supabase
    .from('split_members')
    .select('id, is_self')
    .eq('split_id', splitId);
  if (memberError) return { created: 0, error: memberError };

  const self = (members ?? []).find((m) => m.is_self);
  if (!self) return { created: 0, error: { message: "That split doesn't include you." } };
  const memberIds = (members ?? []).map((m) => m.id);

  // Sequential, not parallel: each call is an RPC that writes an entry plus its
  // shares, and firing fifteen at once buys little while making a partial
  // failure much harder to report honestly. A trip's worth takes a moment.
  let created = 0;
  for (const txn of transactions) {
    const amount = Number(txn.amount);
    const { id, error } = await saveEntry({
      entryId: null,
      splitId,
      description: entryDescriptionFor(txn),
      amount,
      occurredOn: txn.occurred_at,
      payerMemberId: self.id,
      strategy: 'equal',
      shares: resolveEqualShares(amount, memberIds),
    });
    if (error) return { created, error };

    // Link is best-effort by design — see linkEntryToTransaction. A missing
    // cross-reference is cosmetic; a missing entry is not.
    if (id) await linkEntryToTransaction(id, txn.id);
    created += 1;
  }
  return { created, error: null };
}

// A transaction has no description of its own — just a note, a category and an
// amount. The note is what a human actually wrote, so it wins.
export function entryDescriptionFor(txn) {
  const note = txn.note?.trim();
  if (note) return note.slice(0, 80);
  return (txn.category?.name ?? 'Expense').slice(0, 80);
}

// Single-transaction variant used by AddTransactionSheet, where the transaction
// id is known and worth linking back.
export async function createEntryFromTransaction({ splitId, transaction }) {
  const { data: members, error: memberError } = await supabase
    .from('split_members')
    .select('id, is_self')
    .eq('split_id', splitId);
  if (memberError) return { error: memberError };

  const self = (members ?? []).find((m) => m.is_self);
  if (!self) return { error: { message: "That split doesn't include you." } };

  const amount = Number(transaction.amount);
  const { id, error } = await saveEntry({
    entryId: null,
    splitId,
    description: entryDescriptionFor(transaction),
    amount,
    occurredOn: transaction.occurred_at,
    payerMemberId: self.id,
    strategy: 'equal',
    shares: resolveEqualShares(amount, (members ?? []).map((m) => m.id)),
  });
  if (error) return { error };
  if (transaction.id && id) await linkEntryToTransaction(id, transaction.id);
  return { error: null };
}

// Soft when the split has settlements, hard otherwise (Decision 7). Once
// someone has handed money over on the strength of a number, deleting the row
// that produced it outright breaks the trail — "why did I pay ₹1,414 when the
// split says ₹1,224?" has to stay answerable.
export async function deleteEntry(entryId, { hasSettlements }) {
  const { error } = hasSettlements
    ? await supabase.from('split_entries').update({ deleted_at: new Date().toISOString() }).eq('id', entryId)
    : await supabase.from('split_entries').delete().eq('id', entryId);
  return { error };
}

// ---------------------------------------------------------------- settlements

// The bridge into the ledger, and the only reason this feature knows about
// transactions at all.
//
// `ledger` is present only when the user is one of the two parties AND chose to
// record it. The amount is whatever actually moved, so partial payments are just
// smaller settlements. A settlement between two OTHER people writes no
// transaction at all.
//
// THE TYPE IS ASYMMETRIC, AND THAT ASYMMETRY IS THE POINT (§2.4, option B):
//
//   I pay them   -> 'expense'    it IS my own consumption. Paying my share of
//                                the lunch is spending on lunch, and it should
//                                land in my category totals and my budgets.
//   They pay me  -> 'settle_in'  it is NOT income. Getting back money I fronted
//                                for other people was never earnings, and
//                                counting it as income inflates my income total
//                                and lies about my savings rate. settle_in
//                                raises the balance and counts nowhere else.
//
// Before this, the payee case wrote plain `income` — which is exactly the
// distortion the doc flagged: front ₹6,750 on a trip, get ₹5,336 back, and the
// app reports you earned ₹5,336 that month.
export async function recordSettlement({
  splitId,
  fromMemberId,
  toMemberId,
  amount,
  occurredOn,
  note,
  ledger, // { type, accountId, categoryId, planId, note } | null
}) {
  let transactionId = null;

  if (ledger) {
    const { data: txn, error: txnError } = await supabase
      .from('transactions')
      .insert({
        type: ledger.type,
        amount,
        account_id: ledger.accountId,
        category_id: ledger.categoryId ?? null,
        plan_id: ledger.planId ?? null,
        occurred_at: occurredOn,
        note: ledger.note ?? null,
      })
      .select('id')
      .single();
    if (txnError) return { error: txnError };
    transactionId = txn?.id ?? null;
  }

  const { error } = await supabase.from('split_settlements').insert({
    split_id: splitId,
    from_member_id: fromMemberId,
    to_member_id: toMemberId,
    amount,
    occurred_on: occurredOn,
    note: note?.trim() || null,
    transaction_id: transactionId,
  });

  if (error && transactionId) {
    // Don't leave a transaction in the ledger for a settlement that never
    // recorded — the balance would move with nothing explaining it.
    await supabase.from('transactions').delete().eq('id', transactionId);
  }
  return { error };
}

export async function deleteSettlement(settlementId) {
  // Deliberately does NOT delete the linked transaction. That money really did
  // move; un-recording the split's note about it doesn't un-move it
  // (Decision 9). The user deletes the transaction itself if they meant to.
  const { error } = await supabase.from('split_settlements').delete().eq('id', settlementId);
  return { error };
}

// ---------------------------------------------------------------- pocket log

// The optional per-entry escape hatch, default OFF everywhere it's offered.
//
// The user's own instinct — nothing hits the ledger until a final amount is
// settled — is exactly right when you paid nothing, and degrades in proportion
// to how much you fronted. If you're the one who paid ₹6,750 on the trip, that
// money genuinely left your account today, and this is how you say so.
//
// Returns the new transaction's id so the caller can link the entry to it —
// Phase 2 closed the gap noted in 1.6, where this wrote a transaction that
// nothing pointed back at.
export async function logEntryFromPocket({ amount, accountId, categoryId, planId, occurredOn, note }) {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      type: 'expense',
      amount,
      account_id: accountId,
      category_id: categoryId ?? null,
      plan_id: planId ?? null,
      occurred_at: occurredOn,
      note: note ?? null,
    })
    .select('id')
    .single();
  return { transactionId: data?.id ?? null, error };
}
