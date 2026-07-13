import {
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfWeek,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  addMonths,
  addWeeks,
  isBefore,
  isAfter,
  differenceInCalendarDays,
  isWithinInterval,
  parseISO,
  format,
} from 'date-fns';
import { budgetStatus } from '../hooks/useBudgets';

export function computeTrend(transactions, from, to) {
  const days = differenceInCalendarDays(to, from) + 1;

  if (days <= 31) {
    const buckets = eachDayOfInterval({ start: from, end: to }).map((date) => ({
      bucketStart: date,
      income: 0,
      expense: 0,
    }));
    const byKey = new Map(buckets.map((b) => [format(b.bucketStart, 'yyyy-MM-dd'), b]));
    transactions.forEach((tx) => {
      const bucket = byKey.get(tx.occurred_at);
      if (bucket) bucket[tx.type] += tx.amount;
    });
    return buckets;
  }

  const buckets = eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 }).map((date) => ({
    bucketStart: date,
    income: 0,
    expense: 0,
  }));
  transactions.forEach((tx) => {
    const txDate = new Date(tx.occurred_at);
    const bucket = buckets.find((b) =>
      isWithinInterval(txDate, { start: b.bucketStart, end: endOfWeek(b.bucketStart, { weekStartsOn: 1 }) })
    );
    if (bucket) bucket[tx.type] += tx.amount;
  });
  return buckets;
}

export function computeDelta(currentValue, priorValue) {
  if (priorValue === 0) {
    if (currentValue === 0) return { pct: 0, direction: 'flat' };
    return { pct: null, direction: 'up' };
  }
  const pct = ((currentValue - priorValue) / priorValue) * 100;
  return { pct, direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
}

export function computeSavingsRate(income, expense) {
  if (income === 0) return null;
  return ((income - expense) / income) * 100;
}

export function computeBiggestTransaction(transactions) {
  if (!transactions.length) return null;
  return transactions.reduce((max, tx) => (tx.amount > max.amount ? tx : max), transactions[0]);
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function computeDayOfWeek(transactions) {
  const totals = Object.fromEntries(WEEKDAYS.map((d) => [d, 0]));
  transactions
    .filter((tx) => tx.type === 'expense')
    .forEach((tx) => {
      const day = format(new Date(tx.occurred_at), 'EEE');
      if (totals[day] !== undefined) totals[day] += tx.amount;
    });
  return WEEKDAYS.map((day) => ({ day, amount: totals[day] }));
}

export function computeCategoryBreakdown(transactions, type) {
  const filtered = transactions.filter((tx) => tx.type === type);
  const total = filtered.reduce((sum, tx) => sum + tx.amount, 0);
  const byCategory = new Map();
  filtered.forEach((tx) => {
    const key = tx.category_id ?? 'uncategorized';
    if (!byCategory.has(key)) byCategory.set(key, { category: tx.category ?? null, amount: 0 });
    byCategory.get(key).amount += tx.amount;
  });
  return Array.from(byCategory.values())
    .map((entry) => ({ ...entry, pct: total > 0 ? (entry.amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

export function computeCategoryDeltas(currentBreakdown, priorTransactions, type) {
  const priorBreakdown = computeCategoryBreakdown(priorTransactions, type);
  const priorByKey = new Map(priorBreakdown.map((entry) => [entry.category?.id ?? 'uncategorized', entry.amount]));
  return currentBreakdown.map((entry) => {
    const key = entry.category?.id ?? 'uncategorized';
    const priorAmount = priorByKey.get(key) ?? 0;
    return { ...entry, delta: computeDelta(entry.amount, priorAmount) };
  });
}

export function getCategoryColor(category) {
  return category?.color ?? null;
}

// Branches on period_type. The old `budget.period === 'month'` test became a
// live hazard the moment that column was dropped (08-budget-periods-and-detail.md
// Phase 1): `undefined !== 'month'` doesn't throw, it just silently routes every
// budget — monthly ones included — down the weekly branch, producing wrong
// history with no error anywhere.
//
// weekStartsOn: 1 must stay in lockstep with Postgres's ISO date_trunc('week'),
// or Analytics and the Budgets tab will disagree about the same budget by a day.
export function computeBudgetPeriods(budget, transactions, from, to) {
  const periodDates = [];
  if (budget.period_type === 'custom') {
    // A custom budget doesn't recur: it has exactly one period, its own range,
    // and there is no cursor to walk. Clipped to the requested window so an
    // out-of-range custom budget contributes nothing rather than a phantom bar.
    const start = parseISO(budget.start_date);
    const end = parseISO(budget.end_date);
    if (!isAfter(start, to) && !isBefore(end, from)) {
      periodDates.push({ start, end });
    }
  } else if (budget.period_type === 'calendar_month') {
    let cursor = startOfMonth(from);
    while (!isAfter(cursor, to)) {
      periodDates.push({ start: startOfMonth(cursor), end: endOfMonth(cursor) });
      cursor = addMonths(cursor, 1);
    }
  } else {
    let cursor = startOfWeek(from, { weekStartsOn: 1 });
    while (!isAfter(cursor, to)) {
      periodDates.push({ start: cursor, end: endOfWeek(cursor, { weekStartsOn: 1 }) });
      cursor = addWeeks(cursor, 1);
    }
  }

  const createdAt = new Date(budget.created_at);
  const expenseTx = transactions.filter(
    (tx) => tx.type === 'expense' && (!budget.category_id || tx.category_id === budget.category_id)
  );

  return periodDates
    .filter((p) => !isBefore(p.end, createdAt))
    .map((p) => {
      const spent = expenseTx
        .filter((tx) => {
          const d = new Date(tx.occurred_at);
          return !isBefore(d, p.start) && !isAfter(d, p.end);
        })
        .reduce((sum, tx) => sum + tx.amount, 0);
      return {
        periodStart: p.start,
        periodEnd: p.end,
        spent,
        limit: budget.amount,
        status: budgetStatus(spent, budget.amount),
      };
    });
}

export function computeConsistencyFlag(periods) {
  if (periods.length < 2) return false;
  const last = periods[periods.length - 1];
  const secondLast = periods[periods.length - 2];
  return last.status === 'over' && secondLast.status === 'over';
}

export function computeRangeSpentByPlan(plan, transactions) {
  return transactions
    .filter((tx) => tx.type === 'expense' && tx.plan_id === plan.id)
    .reduce((sum, tx) => sum + tx.amount, 0);
}

export function computePlanPace(plan) {
  if (plan.target_amount == null || !plan.start_date || !plan.end_date) return null;

  const start = new Date(plan.start_date);
  const end = new Date(plan.end_date);
  const today = new Date();
  const daysElapsed = Math.max(1, differenceInCalendarDays(today, start) + 1);
  const totalDays = Math.max(1, differenceInCalendarDays(end, start) + 1);
  const dailyRate = plan.total_spent / daysElapsed;
  const projected = dailyRate * totalDays;
  const ratio = plan.target_amount > 0 ? projected / plan.target_amount : 0;

  if (ratio > 1.05) return 'over_pace';
  if (ratio < 0.95) return 'under_pace';
  return 'on_track';
}
