// The Bills list's rules (spec 48, ticket 03): which group each bill sits
// in, and the line under its name. Pure, with no React Native imports, so
// scripts/ledger-check.mjs checks them under node.
//
// Groups, in this order, each left out when empty:
// - Overdue: active, next due before today;
// - This week: active, due today through today + 6;
// - Later: every other active bill;
// - Paused: not active, whatever its date (a bill you aren't tracking is
//   never overdue).
// Inside a group, by next due date, then name.
//
// `next_due_date` is a 'yyyy-MM-dd' string (a local calendar day).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CADENCE = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
const WEEK_DAYS = 7;

function dayNumber(y, m, d) {
  return Math.round(Date.UTC(y, m, d) / 86400000);
}

export function daysUntil(ymd, today) {
  const [y, m, d] = ymd.split('-').map(Number);
  return dayNumber(y, m - 1, d) - dayNumber(today.getFullYear(), today.getMonth(), today.getDate());
}

// "7 Nov", or "5 Jan 2027" outside this year.
export function shortDate(ymd, today) {
  const [y, m, d] = ymd.split('-').map(Number);
  return y === today.getFullYear() ? `${d} ${MONTHS[m - 1]}` : `${d} ${MONTHS[m - 1]} ${y}`;
}

const GROUPS = [
  { key: 'overdue', title: 'Overdue' },
  { key: 'week', title: 'This week' },
  { key: 'later', title: 'Later' },
  { key: 'paused', title: 'Paused' },
];

function groupKey(bill, today) {
  if (!bill.is_active) return 'paused';
  const days = daysUntil(bill.next_due_date, today);
  if (days < 0) return 'overdue';
  if (days < WEEK_DAYS) return 'week';
  return 'later';
}

export function groupBills(bills, today = new Date()) {
  const sorted = [...bills].sort(
    (a, b) => a.next_due_date.localeCompare(b.next_due_date) || (a.name ?? '').localeCompare(b.name ?? '')
  );
  return GROUPS.map((g) => ({ ...g, items: sorted.filter((b) => groupKey(b, today) === g.key) })).filter(
    (g) => g.items.length > 0
  );
}

// The row's sub line and its tone: null (muted, the default), 'danger' for
// overdue, 'muted' for paused.
export function billLine(bill, today = new Date()) {
  const cadence = CADENCE[bill.cadence] ?? '';
  if (!bill.is_active) return { sub: `${cadence} · Paused`, tone: 'muted' };
  const days = daysUntil(bill.next_due_date, today);
  if (days < 0) return { sub: `Overdue since ${shortDate(bill.next_due_date, today)}`, tone: 'danger' };
  const due = days === 0 ? 'Due today' : `Due ${shortDate(bill.next_due_date, today)}`;
  return { sub: `${cadence} · ${due}`, tone: null };
}

// The bill's terms for its detail band: "Monthly · Next due 7 Dec" (danger
// when that date has passed), or "Monthly · Paused". The status itself
// ("Overdue since…") is the timeline's first step, so it isn't repeated.
export function billTerms(bill, today = new Date()) {
  const cadence = CADENCE[bill.cadence] ?? '';
  if (!bill.is_active) return { text: `${cadence} · Paused`, tone: 'muted' };
  const overdue = daysUntil(bill.next_due_date, today) < 0;
  return { text: `${cadence} · Next due ${shortDate(bill.next_due_date, today)}`, tone: overdue ? 'danger' : null };
}
