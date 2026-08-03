import { startOfMonth, startOfQuarter, startOfYear, format } from 'date-fns';

// 30-summary-reset-period.md — the start of the "current" reset period, as a
// 'yyyy-MM-dd' string ready for a `.gte('occurred_at', …)` filter.
// `customStart` is `profiles.reset_custom_start`, already a 'yyyy-MM-dd'
// string from Postgres — passed through as-is, no reparsing needed. Falls
// back to the start of the current month if `custom` is selected but no
// anchor has been set yet (shouldn't normally happen — the Settings UI sets
// both fields together).
export function resetPeriodStart(resetPeriod, customStart, now = new Date()) {
  switch (resetPeriod) {
    case 'quarterly':
      return format(startOfQuarter(now), 'yyyy-MM-dd');
    case 'yearly':
      return format(startOfYear(now), 'yyyy-MM-dd');
    case 'custom':
      return customStart || format(startOfMonth(now), 'yyyy-MM-dd');
    case 'monthly':
    default:
      return format(startOfMonth(now), 'yyyy-MM-dd');
  }
}

export const RESET_PERIOD_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
];
