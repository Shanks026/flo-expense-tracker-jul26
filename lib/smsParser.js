// Pure, dependency-free heuristics for turning a bank SMS into a
// best-effort transaction guess. Always returns null rather than a wrong
// guess when it can't tell confidently — the user reviews/edits before
// anything is saved, so a missed parse just costs a bit of manual entry,
// but a wrong parse would be an actual mistake.
//
// Has a Kotlin twin: modules/flo-notification-listener/android/.../
// TransactionParser.kt (06-transaction-auto-detect.md). The regexes can't be
// shared across the JS/Kotlin boundary — detection there must run natively
// even when the JS runtime doesn't exist. If you tune one, tune the other.

// The share target accepts text from *any* app on the device, not just
// Messages — these are defensive ceilings, not expected real-world values.
const MAX_INPUT_LENGTH = 2000; // longest real bank SMS is well under this
const MAX_SANE_AMOUNT = 10_000_000; // ₹1 crore; rules out garbage/overflow input

const CURRENCY_PATTERN = /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/gi;
const BALANCE_CONTEXT_PATTERN = /\b(?:avl\s*bal|available\s*bal(?:ance)?|bal(?:ance)?)\s*:?\s*$/i;

const EXPENSE_PATTERN = /\b(?:debited|spent|withdrawn|paid|debit)\b/i;
const INCOME_PATTERN = /\b(?:credited|received|deposited|refund(?:ed)?|credit)\b/i;

function findAmount(text) {
  const matches = text.matchAll(CURRENCY_PATTERN);
  for (const match of matches) {
    // Bank SMS almost always state the transaction amount before any
    // "Avl Bal: Rs.X" mention — skip amounts that look like a balance
    // rather than the transaction itself.
    const before = text.slice(Math.max(0, match.index - 25), match.index);
    if (BALANCE_CONTEXT_PATTERN.test(before)) continue;

    const numeric = Number(match[1].replace(/,/g, ''));
    if (!Number.isNaN(numeric) && numeric > 0 && numeric <= MAX_SANE_AMOUNT) return numeric;
  }
  return null;
}

function findDirection(text) {
  const expenseIndex = text.search(EXPENSE_PATTERN);
  const incomeIndex = text.search(INCOME_PATTERN);
  const hasExpense = expenseIndex !== -1;
  const hasIncome = incomeIndex !== -1;

  if (!hasExpense && !hasIncome) return null;
  if (hasExpense && !hasIncome) return 'expense';
  if (hasIncome && !hasExpense) return 'income';
  // Both appear (e.g. "...debited... XYZ MERCHANT credited...") — the
  // user's own account action is conventionally stated first.
  return expenseIndex <= incomeIndex ? 'expense' : 'income';
}

export function parseTransactionSms(text) {
  if (!text || typeof text !== 'string') return null;
  if (text.length > MAX_INPUT_LENGTH) text = text.slice(0, MAX_INPUT_LENGTH);

  const amount = findAmount(text);
  const type = findDirection(text);

  if (amount === null || type === null) return null;

  return { amount, type };
}
