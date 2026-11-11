import { startOfMonth, startOfQuarter, startOfYear, format } from 'date-fns';

// The summary period (30-summary-reset-period.md, salary day from spec 47):
// which stretch of time Home's "in · out" line and the account totals cover.
// A period is read off the profile as
//   { resetPeriod, customStart, monthDay }
// = profiles.reset_period, reset_custom_start ('yyyy-MM-dd' from Postgres,
// passed through as-is) and reset_month_day (1–31, salary day only).
export function periodFromProfile(profile) {
  return {
    resetPeriod: profile?.reset_period ?? null,
    customStart: profile?.reset_custom_start ?? null,
    monthDay: profile?.reset_month_day ?? null,
  };
}

function isMonthDay(day) {
  return Number.isInteger(day) && day >= 1 && day <= 31;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// The most recent salary day on or before `now`, as a local Date at
// midnight. A day past a month's end means that month's last day: 31 is
// 30 Apr, and 28 or 29 Feb.
export function salaryDayStart(day, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const thisMonth = Math.min(day, daysInMonth(year, month));
  if (now.getDate() >= thisMonth) return new Date(year, month, thisMonth);
  return new Date(year, month - 1, Math.min(day, daysInMonth(year, month - 1)));
}

// The start of the current period, as a 'yyyy-MM-dd' string ready for a
// `.gte('occurred_at', …)` filter. Custom without an anchor, or salary day
// without a day, falls back to the calendar month (the Settings UI sets both
// fields together, so neither should happen).
export function resetPeriodStart({ resetPeriod, customStart, monthDay } = {}, now = new Date()) {
  switch (resetPeriod) {
    case 'quarterly':
      return format(startOfQuarter(now), 'yyyy-MM-dd');
    case 'yearly':
      return format(startOfYear(now), 'yyyy-MM-dd');
    case 'custom':
      return customStart || format(startOfMonth(now), 'yyyy-MM-dd');
    case 'salary_day':
      return format(isMonthDay(monthDay) ? salaryDayStart(monthDay, now) : startOfMonth(now), 'yyyy-MM-dd');
    case 'monthly':
    default:
      return format(startOfMonth(now), 'yyyy-MM-dd');
  }
}

export const RESET_PERIOD_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'salary_day', label: 'Salary day' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
];

export function resetPeriodLabel(resetPeriod) {
  return (RESET_PERIOD_OPTIONS.find((o) => o.value === resetPeriod) ?? RESET_PERIOD_OPTIONS[0]).label;
}

// "1st", "22nd", "25th": the salary day as Settings shows it.
export function ordinalDay(day) {
  const teen = day % 100 >= 11 && day % 100 <= 13;
  const suffix = teen ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] ?? 'th';
  return `${day}${suffix}`;
}

// The words after Home's "₹X in · ₹Y out" (spec 46, ticket 08), matching the
// period those totals actually cover. Custom and salary day read
// "since 25 Oct". `period.since` (the 'yyyy-MM-dd' start the totals were
// fetched with, from useAllAccountSummaries) wins over working it out again,
// so a screen left open past a salary day can't name a newer start than
// its totals use.
export function resetPeriodPhrase(period = {}, now = new Date()) {
  switch (period.resetPeriod) {
    case 'quarterly':
      return 'this quarter';
    case 'yearly':
      return 'this year';
    case 'custom':
      return period.customStart ? `since ${format(new Date(`${period.customStart}T00:00:00`), 'd MMM')}` : 'this month';
    case 'salary_day':
      if (period.since) return `since ${format(new Date(`${period.since}T00:00:00`), 'd MMM')}`;
      return isMonthDay(period.monthDay) ? `since ${format(salaryDayStart(period.monthDay, now), 'd MMM')}` : 'this month';
    case 'monthly':
    default:
      return 'this month';
  }
}
