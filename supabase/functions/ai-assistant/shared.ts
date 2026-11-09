// Small pieces both modes of ai-assistant use (index.ts quick add, chat.ts).

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// A real calendar date: Date.parse alone would roll 2026-02-31 into March.
export const isYmd = (s: unknown): s is string => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export const DAY_MS = 24 * 60 * 60 * 1000;
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ₹ with en-IN grouping, decimals only when there are paise: the same rule as
// the app's formatMoney (lib/currency.js), so an answer reads like the screen.
export function formatInr(amount: number) {
  const hasFraction = Math.round(amount * 100) % 100 !== 0;
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

// Date helpers on plain 'YYYY-MM-DD' strings, in UTC so no zone can shift a day.
export const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
export const ymd = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => ymd(new Date(toDate(s).getTime() + n * DAY_MS));
export function monthBounds(s: string, offset = 0) {
  const d = toDate(s);
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset + 1, 0));
  return { start: ymd(first), end: ymd(last) };
}
// Monday-first, as the Insights week (WEEK_OPTIONS weekStartsOn: 1).
export function weekBounds(s: string, offset = 0) {
  const back = (toDate(s).getUTCDay() + 6) % 7;
  const start = addDays(s, -back + offset * 7);
  return { start, end: addDays(start, 6) };
}
// "Sun 8 Nov 2026".
export function dayLong(s: string) {
  const d = toDate(s);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export type Account = { id: string; name: string };
export type Category = { id: string; name: string; type: 'expense' | 'income' };
export type Ctx = { accounts: Account[]; categories: Category[]; activeAccountId: string | null; today: string };
