import { differenceInCalendarDays, startOfMonth, endOfMonth, eachDayOfInterval, format, isBefore } from 'date-fns';
import { MILESTONES } from './streak';

// Trophy Room — 18-gamification-ritual-and-ledger.md Phase 1. Pure, no React/
// Supabase imports, same discipline as lib/streak.js: hooks/useTrophies.js
// gathers the raw stats, this file turns them into earned/locked view models.
//
// Rule that must never be violated here (IDEAS-gamification.md's cardinal
// rule): every trophy rewards BEHAVIOR, never an amount. There is no rupee
// threshold anywhere in this file — only counts of days/transactions/plans.

// Each group is one row on the wall; `tiers` is that row's ladder (a single
// entry for a binary trophy like Fresh Start). `threshold` is compared
// against the matching stat in evaluateTrophies() below.
export const TROPHY_GROUPS = {
  streak: {
    id: 'streak',
    name: 'Streak Keeper',
    icon: 'Flame',
    tone: 'streak',
    // Rides lib/streak.js's own MILESTONES list, not a re-typed copy — one
    // milestone list, one answer, per that file's own comment.
    tiers: MILESTONES.map((day) => ({ tier: day, threshold: day, label: `${day}-Day Streak` })),
  },
  logger: {
    id: 'logger',
    name: 'Logger',
    icon: 'NotebookPen',
    tone: 'neutral',
    tiers: [100, 500, 1000, 5000].map((n) => ({
      tier: n,
      threshold: n,
      label: `${n.toLocaleString('en-IN')} Transactions`,
    })),
  },
  perfect_month: {
    id: 'perfect_month',
    name: 'Perfect Month',
    icon: 'CalendarCheck2',
    tone: 'brand',
    tiers: [{ tier: 1, threshold: 1, label: 'Perfect Month' }],
  },
  budget_keeper: {
    id: 'budget_keeper',
    name: 'Budget Keeper',
    icon: 'Target',
    tone: 'income',
    // NOT YET COMPUTABLE — see hooks/useTrophies.js's stats.keptBudgetPeriods
    // (always null in Phase 1) and this feature's Implementation Notes. Left
    // in the catalogue (locked, "coming soon") rather than deleted so the
    // wall's shape is right and nothing needs re-adding later.
    tiers: [1, 3, 6, 12].map((n) => ({
      tier: n,
      threshold: n,
      label: `Kept ${n} Period${n > 1 ? 's' : ''}`,
    })),
  },
  frugal: {
    id: 'frugal',
    name: 'Frugal',
    icon: 'Leaf',
    tone: 'income',
    // Counts lifetime `no_spend` reward_events rows (18-gamification-ritual-
    // and-ledger.md Phase 3) — was locked at 0 in Phase 1, before the
    // declaration existed to count.
    tiers: [5, 25, 100].map((n) => ({ tier: n, threshold: n, label: `${n} No-Spend Days` })),
  },
  planner: {
    id: 'planner',
    name: 'Planner',
    icon: 'Compass',
    tone: 'neutral',
    tiers: [1, 5, 10].map((n) => ({ tier: n, threshold: n, label: `${n} Plan${n > 1 ? 's' : ''} Completed` })),
  },
  categorizer: {
    id: 'categorizer',
    name: 'Categorizer',
    icon: 'Tags',
    tone: 'brand',
    tiers: [{ tier: 1, threshold: 1, label: 'Categorizer' }],
  },
  comeback: {
    id: 'comeback',
    name: 'Comeback',
    icon: 'RotateCcw',
    tone: 'streak',
    tiers: [{ tier: 1, threshold: 1, label: 'Comeback' }],
  },
  fresh_start: {
    id: 'fresh_start',
    name: 'Fresh Start',
    icon: 'Sparkles',
    tone: 'brand',
    // Everyone gets one — the wall must never be empty. Earned the moment a
    // single transaction exists.
    tiers: [{ tier: 1, threshold: 1, label: 'Fresh Start' }],
  },
};

export const TROPHY_GROUP_ORDER = [
  'fresh_start',
  'streak',
  'logger',
  'perfect_month',
  'categorizer',
  'planner',
  'budget_keeper',
  'frugal',
  'comeback',
];

const HINTS = {
  streak: (t) => `Reach a ${t.threshold}-day streak`,
  logger: (t) => `Log ${t.threshold.toLocaleString('en-IN')} lifetime transactions`,
  perfect_month: () => 'Log every day of one calendar month',
  budget_keeper: (t) => `Coming soon — keep a budget ${t.threshold > 1 ? `${t.threshold} periods in a row` : 'for its full period'}`,
  frugal: (t) => `Declare ${t.threshold} no-spend days`,
  planner: (t) => `Complete ${t.threshold} plan${t.threshold > 1 ? 's' : ''}`,
  categorizer: () => 'Categorize every transaction for 30 straight days',
  comeback: () => 'Rebuild to a 30-day streak after a break',
  fresh_start: () => 'Log your first transaction',
};

function makeEntry(group, tier, currentValue, locked) {
  const value = Number(currentValue) || 0;
  const earned = !locked && value >= tier.threshold;
  return {
    id: `${group.id}:${tier.tier}`,
    groupId: group.id,
    name: group.name,
    label: tier.label,
    icon: group.icon,
    tone: group.tone,
    tier: tier.tier,
    threshold: tier.threshold,
    hint: HINTS[group.id](tier),
    earned,
    locked: !!locked,
    progress: locked ? 0 : Math.min(value / tier.threshold, 1),
    current: locked ? 0 : value,
  };
}

// Takes a plain stats bag (gathered by hooks/useTrophies.js from
// streak/transaction/plan data) and returns every trophy tile, earned or
// not, in TROPHY_GROUP_ORDER. Pure — no defaults are guessed beyond 0/false,
// so a caller passing an empty object safely renders an all-locked wall.
export function evaluateTrophies(stats = {}) {
  const {
    longestStreak = 0,
    hasBreak = false,
    txnCount = 0,
    hasPerfectMonth = false,
    keptBudgetPeriods = null, // null = not computable yet (see budget_keeper above)
    noSpendDays = 0,
    completedPlans = 0,
    isCategorizer = false,
  } = stats;

  const hasComeback = hasBreak && longestStreak >= 30;

  const results = [];
  for (const groupId of TROPHY_GROUP_ORDER) {
    const group = TROPHY_GROUPS[groupId];
    for (const tier of group.tiers) {
      switch (groupId) {
        case 'streak':
          results.push(makeEntry(group, tier, longestStreak));
          break;
        case 'logger':
          results.push(makeEntry(group, tier, txnCount));
          break;
        case 'perfect_month':
          results.push(makeEntry(group, tier, hasPerfectMonth ? 1 : 0));
          break;
        case 'budget_keeper':
          results.push(makeEntry(group, tier, keptBudgetPeriods, keptBudgetPeriods === null));
          break;
        case 'frugal':
          results.push(makeEntry(group, tier, noSpendDays));
          break;
        case 'planner':
          results.push(makeEntry(group, tier, completedPlans));
          break;
        case 'categorizer':
          results.push(makeEntry(group, tier, isCategorizer ? 1 : 0));
          break;
        case 'comeback':
          results.push(makeEntry(group, tier, hasComeback ? 1 : 0));
          break;
        case 'fresh_start':
          results.push(makeEntry(group, tier, txnCount > 0 ? 1 : 0));
          break;
        default:
          break;
      }
    }
  }
  return results;
}

// Perfect Month — true if any FULLY COMPLETED calendar month within `rows`
// (raw {created_at} transaction rows) has at least one logged local day for
// every day of that month. Mirrors lib/streak.js's local-day bucketing
// exactly (startOfDay/format, not UTC) — the same reasoning applies: a
// timestamptz logged late at night in IST must bucket to the local date.
export function hasPerfectMonth(rows, now = new Date()) {
  const days = new Set();
  for (const row of rows ?? []) {
    days.add(format(new Date(row.created_at), 'yyyy-MM-dd'));
  }
  if (days.size === 0) return false;

  const dates = [...days].map((k) => new Date(`${k}T00:00:00`));
  dates.sort((a, b) => a - b);
  const earliest = dates[0];
  const currentMonthStart = startOfMonth(now);

  // Walk every calendar month touched by the data, oldest to newest, up to
  // (but excluding) the current in-progress month — an incomplete month can
  // never be "perfect" yet.
  let cursor = startOfMonth(earliest);
  while (isBefore(cursor, currentMonthStart)) {
    const monthDays = eachDayOfInterval({ start: cursor, end: endOfMonth(cursor) });
    const allLogged = monthDays.every((d) => days.has(format(d, 'yyyy-MM-dd')));
    if (allLogged) return true;
    cursor = startOfMonth(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  }
  return false;
}

// Categorizer — every logged transaction in the most recent 30 local days
// (rolling, ending today) has a category_id. A day with zero transactions
// doesn't break this (categorizer measures categorization discipline, not
// logging frequency — that's the streak's job); only an UNcategorized
// transaction does. Requires at least one transaction in the window, or
// there's nothing to have categorized.
export function isCategorizerStreak(rows, now = new Date()) {
  let sawAny = false;
  for (const row of rows ?? []) {
    const created = new Date(row.created_at);
    if (differenceInCalendarDays(now, created) > 29) continue;
    if (created > now) continue;
    sawAny = true;
    if (!row.category_id) return false;
  }
  return sawAny;
}
