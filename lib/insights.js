// Insights' rules (spec 48, ticket 01): the "You spent ₹X" headline with its
// comparison line, and the chart's y-axis. Pure, with no React Native
// imports, so scripts/ledger-check.mjs checks them under node.
import { amountParts, currencySymbol, DEFAULT_CURRENCY } from './currency.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const DAY_MS = 24 * 60 * 60 * 1000;

function dayIndex(d) {
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

// What the comparison line calls the period before: the month's name, "last
// week" (or "the week before" for an earlier week), or "the 7 days before"
// for a custom range of 7 days.
function priorLabel(mode, from, to, today) {
  if (mode === 'month') return MONTHS[(from.getMonth() + 11) % 12];
  if (mode === 'week') {
    const t = dayIndex(today);
    return t >= dayIndex(from) && t <= dayIndex(to) ? 'last week' : 'the week before';
  }
  const days = dayIndex(to) - dayIndex(from) + 1;
  return days === 1 ? 'the day before' : `the ${days} days before`;
}

// The chart's y-axis: a 1 / 2 / 2.5 / 5 step that splits the largest day
// into about three intervals, ticks from 0 to the first step at or above it.
// An empty period still gets a small scale, so the axis never collapses.
export function spendAxis(max) {
  if (!(max > 0)) return { ticks: [0, 100], top: 100 };
  const raw = max / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((n) => n * mag).find((s) => s >= raw - 1e-9);
  const whole = Math.max(1, step); // no fractional-rupee ticks
  const count = Math.ceil(max / whole - 1e-9);
  const ticks = Array.from({ length: count + 1 }, (_, i) => Math.round(i * whole * 100) / 100);
  return { ticks, top: ticks[ticks.length - 1] };
}

// A short y-axis label in the Indian scale: ₹250, ₹2.5k, ₹1.5L, ₹2Cr.
export function axisLabel(value, currency = DEFAULT_CURRENCY) {
  const symbol = currencySymbol(currency);
  const short = (n) => String(Math.round(n * 10) / 10);
  if (value >= 1e7) return `${symbol}${short(value / 1e7)}Cr`;
  if (value >= 1e5) return `${symbol}${short(value / 1e5)}L`;
  if (value >= 1e3) return `${symbol}${short(value / 1e3)}k`;
  return `${symbol}${short(value)}`;
}

// The period the comparisons use. A whole calendar month compares with the
// whole month before (November with all of October, not 2–31 Oct); any
// other range compares with the same number of days just before it.
export function priorRange(from, to) {
  const y = from.getFullYear();
  const m = from.getMonth();
  const wholeMonth =
    from.getDate() === 1 && to.getFullYear() === y && to.getMonth() === m && to.getDate() === new Date(y, m + 1, 0).getDate();
  if (wholeMonth) return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) };
  const days = dayIndex(to) - dayIndex(from) + 1;
  return { from: new Date(y, m, from.getDate() - days), to: new Date(y, m, from.getDate() - 1) };
}

// A category's change against the period before, for its row's sub line:
// "↑138 % vs October", "None in October" (it had nothing then), "Same as
// October". `delta` is computeDelta's { pct, direction }.
export function categoryChange(delta, { mode, from, to, today = new Date() }) {
  const label = priorLabel(mode, from, to, today);
  if (delta.direction === 'flat') return `Same as ${label}`;
  if (delta.pct === null) return label === 'last week' ? 'None last week' : `None in ${label}`;
  return `${delta.direction === 'up' ? '↑' : '↓'}${Math.abs(delta.pct).toFixed(0)} % vs ${label}`;
}

// The headline is "You spent" + the amount (the screen sets the amount in
// display type), or "You haven't spent anything". The comparison is null when
// the period before had no spending, "About the same as …" when the change is
// under 5 %, otherwise "₹D less/more than …".
export function spendHeadline({ spent, priorSpent, mode, from, to, today = new Date(), currency = DEFAULT_CURRENCY }) {
  const money = (v) => amountParts(v, { currency }).text;
  const amount = spent > 0 ? money(spent) : null;
  const lead = amount ? 'You spent' : "You haven't spent anything";

  let comparison = null;
  if (priorSpent > 0) {
    const label = priorLabel(mode, from, to, today);
    const diff = spent - priorSpent;
    if (Math.abs(diff) / priorSpent < 0.05) comparison = `About the same as ${label}`;
    else comparison = `${money(Math.abs(diff))} ${diff < 0 ? 'less' : 'more'} than ${label}`;
  }
  return { lead, amount, comparison };
}
