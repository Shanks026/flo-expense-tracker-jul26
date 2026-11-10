// Date-group labels for lists of entries (spec 46, ticket 08): "Today",
// "Yesterday", "Sat 7 Nov", and the year only when it isn't this year
// ("Wed 31 Dec 2025"). Pure, with no React Native imports, so
// scripts/ledger-check.mjs can run it. Everything is in local time.

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n) => String(n).padStart(2, '0');

// Accepts a Date, a timestamp string, or a date-only 'yyyy-MM-dd' string
// (what `transactions.occurred_at` holds). A date-only string is that local
// day: `new Date('2026-11-10')` would be UTC midnight, the day before
// anywhere west of UTC.
function toLocalDate(value) {
  if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(value);
}

// The local calendar day as "yyyy-MM-dd", for grouping.
export function dateGroupKey(date) {
  const d = toLocalDate(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dateGroupLabel(date, now = new Date()) {
  const d = toLocalDate(date);
  const key = dateGroupKey(d);
  if (key === dateGroupKey(now)) return 'Today';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (key === dateGroupKey(yesterday)) return 'Yesterday';
  const label = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? label : `${label} ${d.getFullYear()}`;
}
