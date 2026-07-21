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
    // Top tier lowered 5000→2500 (2026-07-20, per direct feedback) — 5000
    // lifetime transactions was 1.5-7 real-world years depending on logging
    // pace (even with auto-detect catching every UPI notification), a much
    // steeper jump than the 100→500→1000 climb before it and harder to reach
    // than the game's own hardest streak milestone. 2500 keeps it clearly the
    // top Logger tier while landing under a year at a moderate pace.
    tiers: [100, 500, 1000, 2500].map((n) => ({
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

// Illustrated badge art for Streak Keeper's tiers (assets/streak/, the user's
// own art — flame-medal PNGs named `${day}streak.png`), keyed by the
// milestone day (matches each tier's own `tier`/`threshold` value — see
// MILESTONES above). Metro requires static string literals, so this can't be
// built as `require(`../assets/streak/${day}streak.png`)`. `_LOCKED` is a
// pre-baked true-grayscale variant (same reasoning as RANK_BADGE_ART_LOCKED
// in lib/rewards.js — plain RN `Image` has no grayscale filter prop) for a
// tier not yet reached. Covers all 12 MILESTONES days. app/trophies.js still
// falls back to the icon placeholder for any tier this map doesn't cover, so
// a future new milestone day without art degrades gracefully.
export const STREAK_BADGE_ART = {
  3: require('../assets/streak/3streak.png'),
  7: require('../assets/streak/7streak.png'),
  10: require('../assets/streak/10streak.png'),
  30: require('../assets/streak/30streak.png'),
  50: require('../assets/streak/50streak.png'),
  100: require('../assets/streak/100streak.png'),
  150: require('../assets/streak/150streak.png'),
  200: require('../assets/streak/200streak.png'),
  300: require('../assets/streak/300streak.png'),
  365: require('../assets/streak/365streak.png'),
  500: require('../assets/streak/500streak.png'),
  1000: require('../assets/streak/1000streak.png'),
};

export const STREAK_BADGE_ART_LOCKED = {
  3: require('../assets/streak/3streak-locked.png'),
  7: require('../assets/streak/7streak-locked.png'),
  10: require('../assets/streak/10streak-locked.png'),
  30: require('../assets/streak/30streak-locked.png'),
  50: require('../assets/streak/50streak-locked.png'),
  100: require('../assets/streak/100streak-locked.png'),
  150: require('../assets/streak/150streak-locked.png'),
  200: require('../assets/streak/200streak-locked.png'),
  300: require('../assets/streak/300streak-locked.png'),
  365: require('../assets/streak/365streak-locked.png'),
  500: require('../assets/streak/500streak-locked.png'),
  1000: require('../assets/streak/1000streak-locked.png'),
};

// Illustrated badge art for Logger's ladder (assets/logger/), keyed by
// transaction-count tier — same shape as STREAK_BADGE_ART above.
export const LOGGER_BADGE_ART = {
  100: require('../assets/logger/100.png'),
  500: require('../assets/logger/500.png'),
  1000: require('../assets/logger/1000.png'),
  2500: require('../assets/logger/2500.png'),
};

export const LOGGER_BADGE_ART_LOCKED = {
  100: require('../assets/logger/100-locked.png'),
  500: require('../assets/logger/500-locked.png'),
  1000: require('../assets/logger/1000-locked.png'),
  2500: require('../assets/logger/2500-locked.png'),
};

// Perfect Month / Categorizer / Comeback are single binary trophies (one
// tier each, tier:1) — a plain pair of requires, not a tier-keyed map like
// Logger/Streak/Planner/Budget Keeper (nothing to key by).
export const PERFECT_MONTH_BADGE_ART = require('../assets/perfect-month/perfect-month.png');
export const PERFECT_MONTH_BADGE_ART_LOCKED = require('../assets/perfect-month/perfect-month-locked.png');
export const CATEGORIZER_BADGE_ART = require('../assets/categorizer/categorizer.png');
export const CATEGORIZER_BADGE_ART_LOCKED = require('../assets/categorizer/categorizer-locked.png');
export const COMEBACK_BADGE_ART = require('../assets/comeback/comeback.png');
export const COMEBACK_BADGE_ART_LOCKED = require('../assets/comeback/comeback-locked.png');

// Illustrated badge art for Planner's ladder (assets/plan/), keyed by the
// plans-completed tier — same shape as LOGGER_BADGE_ART above.
export const PLANNER_BADGE_ART = {
  1: require('../assets/plan/1plan.png'),
  5: require('../assets/plan/5plan.png'),
  10: require('../assets/plan/10plan.png'),
};

export const PLANNER_BADGE_ART_LOCKED = {
  1: require('../assets/plan/1plan-locked.png'),
  5: require('../assets/plan/5plan-locked.png'),
  10: require('../assets/plan/10plan-locked.png'),
};

// Illustrated badge art for Budget Keeper's ladder (assets/budget/), keyed by
// kept-periods tier. Budget Keeper isn't computable yet (see TROPHY_GROUPS'
// own comment — stats.keptBudgetPeriods is always null), so every tile here
// always renders the LOCKED variant in practice today — wired now anyway so
// nothing needs revisiting once it becomes computable.
export const BUDGET_BADGE_ART = {
  1: require('../assets/budget/1budget.png'),
  3: require('../assets/budget/3budget.png'),
  6: require('../assets/budget/6budget.png'),
  12: require('../assets/budget/12budget.png'),
};

export const BUDGET_BADGE_ART_LOCKED = {
  1: require('../assets/budget/1budget-locked.png'),
  3: require('../assets/budget/3budget-locked.png'),
  6: require('../assets/budget/6budget-locked.png'),
  12: require('../assets/budget/12budget-locked.png'),
};

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
