// Scoring for the phase 1 test set (44-ai-assistant.md, §1.7). Shared by the
// node check script (scripts/quick-parse-check.mjs) and the dev eval screen
// (app/dev/ai-eval.js), so both count "fully correct" the same way: amount,
// type, category, date and account all match; the note isn't scored.
import { EVAL_ACCOUNTS, EVAL_ACTIVE_ACCOUNT, EVAL_CATEGORY_SETS } from './aiEvalCases.js';

export const SCORED = ['amount', 'type', 'category', 'date', 'account'];

// The set's categories with stable fake ids ("expense:Food").
export function categoriesFor(setName) {
  const set = EVAL_CATEGORY_SETS[setName];
  return [
    ...set.expense.map((name) => ({ id: `expense:${name}`, name, type: 'expense' })),
    ...set.income.map((name) => ({ id: `income:${name}`, name, type: 'income' })),
  ];
}

// A prefill ({ amount, type, categoryId, accountId, date, note }) in the test
// set's terms: names instead of ids, and the active account when none is named.
export function readable(prefill, categories) {
  if (!prefill) return null;
  const category = categories.find((c) => c.id === prefill.categoryId);
  const account = EVAL_ACCOUNTS.find((a) => a.id === prefill.accountId)?.name ?? EVAL_ACTIVE_ACCOUNT;
  return {
    amount: prefill.amount,
    type: prefill.type,
    category: category?.name ?? null,
    date: prefill.date,
    account,
    note: prefill.note ?? null,
  };
}

// → { correct, problems: [string] }. A case whose right answer is "couldn't
// read that" (expected: null) is correct only when nothing came back.
export function scoreCase(testCase, got, setName) {
  if (!testCase.expected) {
    return got
      ? { correct: false, problems: [`should be refused, got ${JSON.stringify(got)}`] }
      : { correct: true, problems: [] };
  }
  if (!got) return { correct: false, problems: ['not read'] };
  const want = { ...testCase.expected, category: testCase.expected.category[setName] };
  const problems = SCORED.filter((field) => got[field] !== want[field]).map(
    (field) => `${field}: got ${JSON.stringify(got[field])}, want ${JSON.stringify(want[field])}`
  );
  return { correct: problems.length === 0, problems };
}

// Percentile by nearest rank; null for an empty list.
export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}
