// A budget's row on the Budgets list (spec 48, ticket 02): its state, the
// coloured caption and the money on the right. Pure, with no React Native
// imports, so scripts/ledger-check.mjs checks it under node.
//
// Thresholds come from the shared progress rule (lib/progressState.js), so
// the row and its ProgressBar always agree: fine up to 80 %, "Almost out"
// past it, over from 100 %. Spent exactly to the limit is red too, but says
// "Used up" and "₹0 left", since nothing has gone over yet. Over the limit
// needs no caption: "₹104.50 over" says it.
//
// A custom budget whose end date has passed is "ended": its numbers are
// final, so the caption says so, and the money keeps its final tone.
import { progressState } from './progressState.js';
import { amountParts, DEFAULT_CURRENCY } from './currency.js';

function ymd(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function budgetRowStatus(budget, { today = new Date(), currency = DEFAULT_CURRENCY } = {}) {
  const spent = Number(budget.spent) || 0;
  const amount = Number(budget.amount) || 0;
  const ratio = amount > 0 ? spent / amount : 0;
  const { tone } = progressState(ratio);
  const left = amount - spent;

  const rightText = `${amountParts(Math.abs(left), { currency }).text} ${left < 0 ? 'over' : 'left'}`;
  const rightTone = tone === 'danger' ? 'danger' : 'ink';

  const ended = budget.period_type === 'custom' && !!budget.end_date && budget.end_date < ymd(today);
  if (ended) return { state: 'ended', ratio, caption: 'Ended', captionTone: 'muted', rightText, rightTone };
  if (tone === 'danger') {
    // "₹104.50 over" already says it; only spent-to-the-limit needs a word.
    if (left < 0) return { state: 'over', ratio, caption: null, captionTone: null, rightText, rightTone };
    return { state: 'over', ratio, caption: 'Used up', captionTone: 'danger', rightText, rightTone };
  }
  if (tone === 'warn') return { state: 'warn', ratio, caption: 'Almost out', captionTone: 'warn', rightText, rightTone };
  return { state: 'ok', ratio, caption: null, captionTone: null, rightText, rightTone };
}
