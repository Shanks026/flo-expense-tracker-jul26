// The set-up planner (spec 47): turns the onboarding questions' answers into
// the writes that set the app up. Pure, with no React Native imports, so
// scripts/ledger-check.mjs checks it under node. The screens run the writes
// through the same lib/ mutations the app's own sheets use.

import { isMonthDay } from './periods.js';

// ── Progress ────────────────────────────────────────────────────────────────
// The four set-up questions, in flow order. `card` is left out with
// FLAGS.themes off, so the counter reads "N of 3".
export const SETUP_QUESTIONS = ['accounts', 'month_start', 'budget', 'card'];

// → { label: '2 of 4', value: 0.5 } for a question step, else null.
export function setupProgress(stepKey, { themes = true } = {}) {
  const questions = themes ? SETUP_QUESTIONS : SETUP_QUESTIONS.filter((q) => q !== 'card');
  const index = questions.indexOf(stepKey);
  if (index < 0) return null;
  return { label: `${index + 1} of ${questions.length}`, value: (index + 1) / questions.length };
}

// ── "Where does your money live?" ───────────────────────────────────────────
export const ACCOUNT_CHOICES = ['Cash', 'SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak', 'UPI wallet'];

// The name handle_new_user gives the account it seeds at sign-up.
export const SEEDED_ACCOUNT_NAME = 'Personal';

export const ACCOUNT_NAME_MAX = 30;

// A typed account name: trimmed, inner spaces collapsed, 1–30 characters.
// → the clean name, or null when it isn't one.
export function cleanAccountName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > ACCOUNT_NAME_MAX) return null;
  return name;
}

const key = (name) => name.toLowerCase();

// picks: the chosen names, first pick first. existing: the user's accounts
// ({ id, name, color }). palette: the account colours, in order.
// canAddMore: false when the free plan has no room for another account (then
// only the rename can apply).
//
// → null when there is nothing to do, else
//   { rename: { id, name } | null, create: [{ name, color }], active }
// where active is { id } for an account that exists (or is being renamed),
// or { create: i } for the i-th created one.
//
// The first pick renames the seeded "Personal" only while it is the only
// account and still has its seeded name. Names already present, in any case,
// aren't created again, so Back then Next adds nothing.
export function planAccounts({ picks, existing, palette, canAddMore = true }) {
  const seen = new Set();
  const names = [];
  for (const pick of picks ?? []) {
    const name = cleanAccountName(pick);
    if (!name || seen.has(key(name))) continue;
    seen.add(key(name));
    names.push(name);
  }
  if (names.length === 0) return null;

  const accounts = existing ?? [];
  const byName = new Map(accounts.map((a) => [key(a.name), a]));
  const seeded = accounts.length === 1 && accounts[0].name === SEEDED_ACCOUNT_NAME ? accounts[0] : null;

  let rename = null;
  const toCreate = [];
  let active = null;

  names.forEach((name, i) => {
    const found = byName.get(key(name));
    if (found) {
      if (i === 0) active = { id: found.id };
      return;
    }
    if (i === 0 && seeded) {
      rename = { id: seeded.id, name };
      active = { id: seeded.id };
      return;
    }
    if (!canAddMore) return;
    if (i === 0) active = { create: toCreate.length };
    toCreate.push(name);
  });

  if (!rename && toCreate.length === 0 && !active) return null;

  const used = new Set(accounts.map((a) => (a.color ?? '').toLowerCase()));
  const free = palette.filter((c) => !used.has(c.toLowerCase()));
  const create = toCreate.map((name, i) => ({
    name,
    color: i < free.length ? free[i] : palette[(i - free.length) % palette.length],
  }));

  return { rename, create, active };
}

// ── "When does your month start?" ───────────────────────────────────────────
// The answer is { start: 'first' | 'salary_day', day }. The 1st is the
// calendar month; a salary day is lib/periods.js's salary-day month, and it
// needs a day.
export const MONTH_START_CHOICES = [
  { value: 'first', label: '1st of the month' },
  { value: 'salary_day', label: 'My salary day' },
];

// What the question shows first: the saved salary day, else the 1st (any
// other saved period isn't one of this question's answers).
export function monthStartFromProfile(profile) {
  return profile?.reset_period === 'salary_day' && isMonthDay(profile.reset_month_day)
    ? { start: 'salary_day', day: profile.reset_month_day }
    : { start: 'first', day: null };
}

// → the profile patch Next writes, or null while the answer is incomplete
// (salary day with no day picked). The 1st leaves reset_month_day as it is,
// as Settings does.
export function planMonthStart({ start, day } = {}) {
  if (start === 'first') return { reset_period: 'monthly' };
  if (start === 'salary_day' && isMonthDay(day)) return { reset_period: 'salary_day', reset_month_day: day };
  return null;
}

// ── "Want a monthly spending limit?" ────────────────────────────────────────
// The overall monthly budget this question writes, and how it's found again
// so Back then Next updates it rather than adding a second.
export const LIMIT_BUDGET_NAME = 'Monthly limit';

// budgets.amount is numeric(12,2).
const LIMIT_MAX = 9999999999.99;

// The typed limit → rupees rounded to paise, or null for no limit: blank,
// garbage, under ₹1 or past what the column holds. A ₹ sign, spaces and
// grouping commas (Indian or western) are allowed.
export function cleanLimitAmount(raw) {
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d*)?$/.test(text)) return null;
  const amount = Math.round(Number(text) * 100) / 100;
  if (!Number.isFinite(amount) || amount < 1 || amount > LIMIT_MAX) return null;
  return amount;
}

// The limit among an account's budgets: overall, monthly, by its name.
export function findLimitBudget(budgets) {
  return (
    (budgets ?? []).find(
      (b) => b.name === LIMIT_BUDGET_NAME && b.category_id == null && b.period_type === 'calendar_month'
    ) ?? null
  );
}

// amount: cleanLimitAmount's result. budgets: the active account's budgets.
// saved: the limit this session already wrote ({ id, amount, account_id }),
// if any. accountId: the active account.
// → null when there's nothing to write (no limit, or the same one again),
//   { create: fields } for a first limit, or { update: { id, fields } }.
// The saved row wins over a search, so Back across the accounts question
// (which can change the active account) moves that limit instead of leaving
// it behind and adding a second.
// A salary-day month doesn't change this: budgets keep their own period.
export function planLimit({ amount, budgets, saved = null, accountId = null }) {
  if (amount == null) return null;
  const fields = {
    name: LIMIT_BUDGET_NAME,
    amount,
    period_type: 'calendar_month',
    category_id: null,
    start_date: null,
    end_date: null,
  };
  const found = saved ?? findLimitBudget(budgets);
  if (!found) return { create: fields };
  const moved = accountId != null && found.account_id !== accountId;
  if (!moved && Number(found.amount) === amount) return null;
  return { update: { id: found.id, fields: moved ? { ...fields, account_id: accountId } : fields } };
}

// ── "Pick your card" ────────────────────────────────────────────────────────
// The card designs the question offers, from the themes Cards lists:
// Day first, seasonal skins next, then the rest in catalog order. The legacy
// 'ink' (the column default, meaning "never chose") is never offered; Ink is
// 'ink-classic'.
export function cardChoices(themes) {
  const listed = (themes ?? []).filter((t) => !t.legacy);
  return [
    ...listed.filter((t) => t.id === 'day'),
    ...listed.filter((t) => t.id !== 'day' && t.tier === 'seasonal'),
    ...listed.filter((t) => t.id !== 'day' && t.tier !== 'seasonal'),
  ];
}
