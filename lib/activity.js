// Activity's rules (spec 46, ticket 10): the filter, the one-line summary,
// transfer pairing, date groups and the date-range presets. Pure, with no
// React Native imports, so scripts/ledger-check.mjs checks them under node.
//
// The Activity hook fetches by account and date range; everything else here
// runs on the fetched rows, in this order:
//   filterActivity → summarizeActivity (the summary line)
//                  → pairTransfers → groupEntries (the list)
import { dateGroupKey } from './dateLabels.js';

// `accountId: null` means "the active account" (so the default follows an
// account switch); 'all' means every account; otherwise an account id.
export const DEFAULT_FILTERS = {
  search: '',
  type: 'all', // 'all' | 'expense' | 'income' | 'transfer'
  categoryId: null,
  accountId: null,
  range: { preset: 'this_month' }, // 'this_month' | 'last_month' | 'last_30' | 'custom' (+ from, to)
};

export const RANGE_PRESETS = [
  { preset: 'this_month', label: 'This month' },
  { preset: 'last_month', label: 'Last month' },
  { preset: 'last_30', label: 'Last 30 days' },
  { preset: 'custom', label: 'Custom' },
];

export function isTransferType(type) {
  return type === 'transfer_in' || type === 'transfer_out';
}

export function isDefaultFilters(f) {
  return (
    !(f.search ?? '').trim() &&
    f.type === DEFAULT_FILTERS.type &&
    f.categoryId == null &&
    f.accountId == null &&
    f.range?.preset === DEFAULT_FILTERS.range.preset
  );
}

// --- Search, type, category ---

// An amount as plain digits for prefix matching: 1200 → "1200",
// 1367.6 → "1367.60". So "120" finds ₹120 and ₹1,200, never ₹1,120.
function amountDigits(amount) {
  const n = Math.abs(Number(amount) || 0);
  return n.toFixed(2).replace(/\.00$/, '');
}

// The query as an amount, or null when it isn't one: "₹1,200" → "1200".
function queryDigits(q) {
  if (!/\d/.test(q) || !/^[₹\s\d,.]+$/.test(q)) return null;
  return q.replace(/[₹\s,]/g, '');
}

function matchesSearch(tx, q) {
  const note = (tx.note ?? '').toLowerCase();
  const category = (tx.category?.name ?? '').toLowerCase();
  if (note.includes(q) || category.includes(q)) return true;
  const digits = queryDigits(q);
  return digits != null && digits !== '' && amountDigits(tx.amount).startsWith(digits);
}

function matchesType(tx, type) {
  if (!type || type === 'all') return true;
  if (type === 'transfer') return isTransferType(tx.type);
  return tx.type === type;
}

export function filterActivity(transactions, { search = '', type = 'all', categoryId = null } = {}) {
  const q = search.trim().toLowerCase();
  return transactions.filter(
    (tx) => matchesType(tx, type) && (categoryId == null || tx.category_id === categoryId) && (!q || matchesSearch(tx, q))
  );
}

// --- Summary: "Spent ₹X · Received ₹Y" ---

// Only real expenses and income count. Transfers (money between your own
// accounts) and settlements (being paid back) are neither.
export function summarizeActivity(transactions) {
  let spent = 0;
  let received = 0;
  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0;
    if (tx.type === 'expense') spent += amount;
    else if (tx.type === 'income') received += amount;
  }
  const paise = (n) => Math.round(n * 100) / 100;
  return { spent: paise(spent), received: paise(received) };
}

// --- Transfer pairing ---

// Each entry is { kind: 'tx', key, tx } or, for a transfer,
// { kind: 'transfer', key, tx, fromAccountId, toAccountId, legs }. The two
// legs of one transfer (same transfer_id) become one entry where the first
// leg sat; `tx` is the out leg when it's in view. One leg alone (a single
// account in view) is still a transfer entry, with the other account named.
export function pairTransfers(transactions) {
  const out = [];
  const byTransfer = new Map();
  for (const tx of transactions) {
    if (!isTransferType(tx.type) || !tx.transfer_id) {
      out.push({ kind: 'tx', key: tx.id, tx });
      continue;
    }
    const leaving = tx.type === 'transfer_out';
    const existing = byTransfer.get(tx.transfer_id);
    if (existing) {
      existing.legs += 1;
      if (leaving) existing.tx = tx;
      continue;
    }
    const entry = {
      kind: 'transfer',
      key: tx.transfer_id,
      tx,
      fromAccountId: leaving ? tx.account_id : tx.transfer_account_id ?? null,
      toAccountId: leaving ? tx.transfer_account_id ?? null : tx.account_id,
      legs: 1,
    };
    byTransfer.set(tx.transfer_id, entry);
    out.push(entry);
  }
  return out;
}

// "Personal → Savings". An account that's since been deleted (its
// transfer_account_id is SET NULL) reads as "Deleted account".
export function transferTitle(entry, accounts = []) {
  const name = (id) => accounts.find((a) => a.id === id)?.name ?? 'Deleted account';
  return `${name(entry.fromAccountId)} → ${name(entry.toAccountId)}`;
}

// Consecutive entries on the same local day share a group, in list order
// (the hook sorts newest first). Labels come from dateGroupLabel().
export function groupEntries(entries) {
  const groups = [];
  for (const entry of entries) {
    const key = dateGroupKey(entry.tx.occurred_at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(entry);
    else groups.push({ key, date: entry.tx.occurred_at, items: [entry] });
  }
  return groups;
}

// --- Date ranges ---

const pad = (n) => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// A Date as its local 'yyyy-MM-dd' day, and back (the custom date pickers).
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function dateFromYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// "1 Oct 2026", for the custom From / To rows.
export function fullDayLabel(s) {
  const [y, m, d] = s.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

// { from, to } as local 'yyyy-MM-dd' days, both inclusive (what
// transactions.occurred_at holds). Custom dates the wrong way round swap.
export function activityRange(range, today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth();
  switch (range?.preset) {
    case 'last_month':
      return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
    case 'last_30':
      return { from: ymd(new Date(y, m, today.getDate() - 29)), to: ymd(today) };
    case 'custom': {
      if (range.from && range.to) {
        return range.from <= range.to ? { from: range.from, to: range.to } : { from: range.to, to: range.from };
      }
      break;
    }
    default:
      break;
  }
  return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) };
}

// The Date chip's value: the preset's name, or "1 Sep – 15 Sep" for a custom
// range (with a year on any date outside this year).
export function rangeLabel(range, today = new Date()) {
  if (range?.preset === 'custom') {
    const { from, to } = activityRange(range, today);
    const day = (s) => {
      const [yy, mm, dd] = s.split('-').map(Number);
      const label = `${dd} ${MONTHS[mm - 1]}`;
      return yy === today.getFullYear() ? label : `${label} ${yy}`;
    };
    return `${day(from)} – ${day(to)}`;
  }
  return RANGE_PRESETS.find((p) => p.preset === range?.preset)?.label ?? 'This month';
}
