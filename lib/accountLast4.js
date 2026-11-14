// An account's optional last 4 digits (spec 48 ticket 06, spec 45 Phase 1).
// Pure, with no React Native imports, so scripts/ledger-check.mjs checks it.
//
// Display only: it tells two cards at the same bank apart. Never a full
// number; the database check (accounts_last4_format) is the real guard. The
// ai-assistant context never reads it.

export const LAST4_ERROR = 'Enter all 4 digits or leave it blank';

// The sheet's field → what to store. Non-digits are stripped; blank is none.
export function cleanLast4(input) {
  const digits = String(input ?? '').replace(/\D/g, '');
  if (!digits) return { value: null, error: null };
  if (digits.length === 4) return { value: digits, error: null };
  return { value: null, error: LAST4_ERROR };
}

// "•••• 4821", or null when none is set.
export function maskedLast4(account) {
  const last4 = account?.last4;
  return typeof last4 === 'string' && /^\d{4}$/.test(last4) ? `•••• ${last4}` : null;
}

// An account row's sub line: its description and masked last 4, joined with
// " · ", or null when it has neither (the row then looks as it did before).
export function accountSub(account) {
  const description = typeof account?.description === 'string' ? account.description.trim() : '';
  const parts = [description || null, maskedLast4(account)].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
