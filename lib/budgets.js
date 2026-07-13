import { parseISO, format, differenceInCalendarDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

// Budget period helpers. Everything here reads the period bounds the VIEW
// computed (`period_start` / `period_end` on v_budgets_with_spent) rather than
// re-deriving "this week" client-side — that's the whole point of the
// 08-budget-periods-and-detail.md Phase 1 migration. A client that computed its
// own window could disagree with the `spent` figure printed right next to it,
// and that bug would be invisible: both halves look correct in isolation.
//
// parseISO, not new Date(): a bare 'yyyy-MM-dd' passed to the Date constructor
// is parsed as UTC midnight, which lands on the previous day for any negative
// UTC offset. parseISO treats a date-only string as local midnight, which is
// what a calendar date actually means here.
export function budgetPeriodDates(budget) {
  if (!budget?.period_start || !budget?.period_end) return null;
  return { start: parseISO(budget.period_start), end: parseISO(budget.period_end) };
}

// "July 2026" · "13 – 19 Jul" · "3 Aug – 12 Aug"
// The single line that answers "what window is this number computed over" —
// the absence of which is what made budget periods feel broken in the first
// place (the card only ever said "This Week").
export function formatPeriodLabel(budget) {
  const dates = budgetPeriodDates(budget);
  if (!dates) return '';
  const { start, end } = dates;

  if (budget.period_type === 'calendar_month') return format(start, 'MMMM yyyy');

  const sameYear = start.getFullYear() === end.getFullYear();
  const startFmt = sameYear ? 'd MMM' : 'd MMM yyyy';
  return `${format(start, startFmt)} – ${format(end, sameYear ? 'd MMM' : 'd MMM yyyy')}`;
}

// Only a custom budget can end — the calendar types roll forward forever.
export function isBudgetEnded(budget, today = new Date()) {
  if (budget?.period_type !== 'custom') return false;
  const dates = budgetPeriodDates(budget);
  if (!dates) return false;
  return differenceInCalendarDays(today, dates.end) > 0;
}

// Inclusive of today, so a period ending today reads "1 day left", not "0".
// Null for an ended budget: there is nothing left of it.
export function daysLeftInPeriod(budget, today = new Date()) {
  const dates = budgetPeriodDates(budget);
  if (!dates) return null;
  const left = differenceInCalendarDays(dates.end, today) + 1;
  return left > 0 ? left : null;
}

// Are you spending faster than the period can absorb? Projects the current
// daily burn rate across the whole period and compares it to the limit.
//
// Vocabulary is `on_track` / `over_pace` / `under_pace`, matching
// computePlanPace in lib/analytics.js — settled deliberately (see 00-index.md):
// a budget, like a plan target, is a spending CAP, and "ahead"/"behind" reads
// ambiguously for that direction. Don't reinvent the labels.
//
// Null when there's nothing meaningful to say: a finished budget has no pace,
// only a result.
export function computeBudgetPace(budget, today = new Date()) {
  const dates = budgetPeriodDates(budget);
  if (!dates || !budget.amount || budget.amount <= 0) return null;
  if (isBudgetEnded(budget, today)) return null;

  const totalDays = Math.max(1, differenceInCalendarDays(dates.end, dates.start) + 1);
  // Clamped: a custom budget can start in the future, where "days elapsed"
  // would otherwise go negative and invert the projection.
  const daysElapsed = Math.min(
    totalDays,
    Math.max(1, differenceInCalendarDays(today, dates.start) + 1)
  );

  const projected = (budget.spent / daysElapsed) * totalDays;
  const ratio = projected / budget.amount;

  if (ratio > 1.05) return 'over_pace';
  if (ratio < 0.95) return 'under_pace';
  return 'on_track';
}

// Preview bounds for a period type the user is *choosing* in the sheet, before
// any row exists to read period_start/period_end from. Must stay in lockstep
// with the view's own CASE: Postgres date_trunc('week', …) is ISO/Monday-start,
// hence weekStartsOn: 1. If these two ever drift, the sheet will promise a
// window the view doesn't honour.
export function previewPeriodDates(periodType, today = new Date()) {
  if (periodType === 'calendar_week') {
    return { start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfWeek(today, { weekStartsOn: 1 }) };
  }
  if (periodType === 'calendar_month') {
    return { start: startOfMonth(today), end: endOfMonth(today) };
  }
  return null; // custom — the user supplies the dates
}
