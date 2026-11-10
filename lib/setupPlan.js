// The set-up planner (spec 47): turns the onboarding questions' answers into
// the writes that set the app up. Pure, with no React Native imports, so
// scripts/ledger-check.mjs checks it under node. The screens run the writes
// through the same lib/ mutations the app's own sheets use.

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
