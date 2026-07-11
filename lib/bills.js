import { addWeeks, addMonths, addYears, format } from 'date-fns';
import { supabase } from './supabase';

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
