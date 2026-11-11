// Sign-up's live checks (spec 47): the password rules the form ticks off as
// they're met, and a lenient email shape check. Pure, with no React Native
// imports, so scripts/ledger-check.mjs checks them under node.
//
// Supabase Auth is the real judge. On this project it rejects passwords
// under 6 characters and has no character-class rule (read 2026-11-11 from
// the server's own weak_password reply). The app asks for 8, stricter than
// the server, so Create account never enables for a password it would turn
// down. If the Auth settings gain a rule, add it here too.
export const PASSWORD_MIN = 8;

const RULES = [
  { key: 'length', label: `${PASSWORD_MIN} or more characters`, test: (pw) => pw.length >= PASSWORD_MIN },
];

// → [{ key, label, met }], in the order the form lists them.
export function passwordRules(password) {
  const pw = typeof password === 'string' ? password : '';
  return RULES.map(({ key, label, test }) => ({ key, label, met: test(pw) }));
}

export function passwordPasses(password) {
  return passwordRules(password).every((r) => r.met);
}

// Something@something.something, with no spaces and one @. Lenient on
// purpose: plus-addressing, subdomains and long TLDs all pass.
export function looksLikeEmail(email) {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// The one line under the form when Supabase turns a sign-in or sign-up down.
// Known codes get plain words; anything else shows Supabase's own message.
// (No weak_password line: the form asks for more than the server does.)
const TAKEN = 'That email already has an account. Sign in instead';
const ERROR_LINES = {
  invalid_credentials: "That email and password don't match",
  user_already_exists: TAKEN,
  email_exists: TAKEN,
  over_request_rate_limit: 'Too many tries. Wait a minute and try again',
};

export function authErrorLine(error) {
  if (!error) return null;
  return ERROR_LINES[error.code] ?? error.message ?? 'Something went wrong. Try again';
}
