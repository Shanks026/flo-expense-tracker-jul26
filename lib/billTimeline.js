// A bill's timeline on its detail screen (spec 48, ticket 04). Pure, with no
// React Native imports, so scripts/ledger-check.mjs checks it under node.
//
// Steps, newest first:
// 1. the open step: "Due 7 Dec" / "Due today", or "Overdue since 7 Nov" in
//    danger; none for a paused bill;
// 2. one step per linked payment (`transactions.bill_id`), newest first:
//    "Paid ₹649" over "7 Nov · HDFC", each carrying its transaction id; at
//    most 12, then "Earlier payments are in Activity";
// 3. "Last paid 7 Oct" when the bill's last_paid_date has no linked payment
//    (paid before bill_id existed, or the payment was deleted): FLO shows
//    what it knows and doesn't guess the rest;
// 4. "Added" with the day the bill was created.
//
// `payments` are [{ id, occurred_at: 'yyyy-MM-dd', amount, accountName }],
// newest first.
import { amountParts } from './currency.js';
import { daysUntil, shortDate } from './billGroups.js';

const MAX_PAYMENTS = 12;

function localYmd(timestamp) {
  const d = new Date(timestamp);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function billTimeline(bill, payments = [], today = new Date()) {
  const steps = [];

  if (bill.is_active) {
    const days = daysUntil(bill.next_due_date, today);
    const date = shortDate(bill.next_due_date, today);
    steps.push({
      key: 'due',
      kind: 'due',
      title: days < 0 ? `Overdue since ${date}` : days === 0 ? 'Due today' : `Due ${date}`,
      sub: 'Next payment',
      tone: days < 0 ? 'danger' : null,
    });
  }

  for (const p of payments.slice(0, MAX_PAYMENTS)) {
    steps.push({
      key: `pay-${p.id}`,
      kind: 'payment',
      title: `Paid ${amountParts(p.amount, { currency: bill.currency }).text}`,
      sub: [shortDate(p.occurred_at, today), p.accountName].filter(Boolean).join(' · '),
      tone: null,
      txId: p.id,
    });
  }
  if (payments.length > MAX_PAYMENTS) {
    steps.push({ key: 'more', kind: 'more', title: 'Earlier payments are in Activity', sub: null, tone: null });
  }

  if (bill.last_paid_date && !payments.some((p) => p.occurred_at === bill.last_paid_date)) {
    steps.push({
      key: 'last-paid',
      kind: 'last_paid',
      title: `Last paid ${shortDate(bill.last_paid_date, today)}`,
      // No sub: the date may predate payment history, or its payment may
      // have been deleted (deleting a payment doesn't roll the bill back).
      sub: null,
      tone: null,
    });
  }

  steps.push({ key: 'added', kind: 'added', title: 'Added', sub: shortDate(localYmd(bill.created_at), today), tone: null });
  return steps;
}
