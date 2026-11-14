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

// The one due phrase for a bill's next date (spec 49, ticket 02): "Due 12
// Nov", "Due today", or "Overdue since 9 Nov" in danger. The list's sub
// line, the detail band's terms and the timeline's open step all take it
// from here, so the three can't drift.
export function dueWording(nextDueDate, today = new Date()) {
  const days = daysUntil(nextDueDate, today);
  const date = shortDate(nextDueDate, today);
  if (days < 0) return { text: `Overdue since ${date}`, tone: 'danger' };
  return { text: days === 0 ? 'Due today' : `Due ${date}`, tone: null };
}

// The row's sub line and its tone: null (muted, the default), 'danger' for
// overdue, 'muted' for paused.
export function billLine(bill, today = new Date()) {
  const cadence = CADENCE[bill.cadence] ?? '';
  if (!bill.is_active) return { sub: `${cadence} · Paused`, tone: 'muted' };
  const due = dueWording(bill.next_due_date, today);
  // Overdue stands alone: the cadence matters less than how late it is.
  if (due.tone === 'danger') return { sub: due.text, tone: due.tone };
  return { sub: `${cadence} · ${due.text}`, tone: null };
}

// The bill's terms for its detail band: "Monthly · Next due 7 Dec" (danger
// when that date has passed), or "Monthly · Paused". The status itself
// ("Overdue since…") is the timeline's first step, so it isn't repeated.
export function billTerms(bill, today = new Date()) {
  const cadence = CADENCE[bill.cadence] ?? '';
  if (!bill.is_active) return { text: `${cadence} · Paused`, tone: 'muted' };
  // "Next due", not the due phrase: the band states the bill's terms.
  const { tone } = dueWording(bill.next_due_date, today);
  return { text: `${cadence} · Next due ${shortDate(bill.next_due_date, today)}`, tone };
}

// The bills-due moment's content (spec 49, ticket 03): active bills due today
// or overdue, overdue first, each by date then name, under "1 bill needs you"
// / "N bills need you". Null when nothing is due, so the moment gives its
// turn back.
export function dueBillsMoment(bills, today = new Date()) {
  const due = bills
    .filter((b) => b.is_active && daysUntil(b.next_due_date, today) <= 0)
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date) || (a.name ?? '').localeCompare(b.name ?? ''));
  if (due.length === 0) return null;
  return { title: due.length === 1 ? '1 bill needs you' : `${due.length} bills need you`, bills: due };
}
