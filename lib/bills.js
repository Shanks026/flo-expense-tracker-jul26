import { addWeeks, addMonths, addYears, format } from 'date-fns';
import { supabase } from './supabase';
import { aiBillIcon } from './ai';

const ADVANCERS = {
  weekly: (d) => addWeeks(d, 1),
  monthly: (d) => addMonths(d, 1),
  yearly: (d) => addYears(d, 1),
};

export function advanceDueDate(dateStr, cadence) {
  const advance = ADVANCERS[cadence];
  return format(advance(new Date(dateStr)), 'yyyy-MM-dd');
}

// Creates the real transaction for a bill payment, then advances the bill's
// own next_due_date/last_paid_date. Bills are global (not account-scoped —
// see 04-notifications-and-recurring-bills.md's Phase 3 course-correction),
// so accountId has no bill-level fallback and must be supplied by the caller
// (PayBillSheet defaults it to the currently active account, editable).
export async function markBillPaid(bill, { amount, occurredAt, accountId }) {
  const paidAmount = amount ?? bill.amount;
  const paidDate = format(occurredAt ?? new Date(), 'yyyy-MM-dd');

  const { error: insertError } = await supabase.from('transactions').insert({
    type: 'expense',
    amount: paidAmount,
    category_id: bill.category_id,
    plan_id: null,
    occurred_at: paidDate,
    note: bill.name,
    account_id: accountId,
    source: 'bill',
    // Links the payment to its bill, for the bill's payment history (spec 48).
    bill_id: bill.id,
  });
  if (insertError) return { error: insertError };

  const { error: updateError } = await supabase
    .from('bills')
    .update({ next_due_date: advanceDueDate(bill.next_due_date, bill.cadence), last_paid_date: paidDate })
    .eq('id', bill.id);
  if (updateError) return { error: updateError };

  return { error: null };
}

// Advances the due date with no transaction — for when a charge didn't
// happen this cycle. Deliberately does not touch last_paid_date, so "Last
// paid ..." on the bill card never claims a payment that didn't occur.
export async function skipBillCycle(bill) {
  const { error } = await supabase
    .from('bills')
    .update({ next_due_date: advanceDueDate(bill.next_due_date, bill.cadence) })
    .eq('id', bill.id);
  return { error };
}

// Creates or updates a bill from the sheet's fields. → { id, error }.
export async function saveBill(fields, editingId = null) {
  const query = editingId
    ? supabase.from('bills').update(fields).eq('id', editingId)
    : supabase.from('bills').insert(fields);
  const { data, error } = await query.select('id').single();
  return { id: data?.id ?? null, error };
}

export async function deleteBill(billId) {
  const { error } = await supabase.from('bills').delete().eq('id', billId);
  return { error };
}

// Ask FLO's icon for a bill, written only if the person hasn't picked one
// since (spec 48, bill icons). Run after a save, never awaited by it.
// → { icon } when one was written, else { icon: null }.
export async function fillBillIconFromAi(billId, name) {
  const icon = await aiBillIcon(name);
  if (!icon) return { icon: null };
  const { data, error } = await supabase
    .from('bills')
    .update({ icon })
    .eq('id', billId)
    .eq('icon_picked', false)
    .eq('name', name)
    .select('id');
  if (error || !data?.length) return { icon: null };
  return { icon };
}
