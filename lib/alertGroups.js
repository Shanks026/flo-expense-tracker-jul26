// The bell's Alerts, grouped (spec 49, ticket 05). Pure, with no React Native
// imports, so scripts/ledger-check.mjs checks it under node. Nothing is
// stored: the feed is worked out from the bills, budgets and plans on hand.
//
// Groups, in this order, each left out when empty:
// - Overdue (danger title): active bills due before today;
// - Budgets: budgets whose progress is past 80 % or at 100 % and over, on
//   the same rule as the Budgets list and its bars (lib/budgetRow.js), so the
//   two never disagree. Ended custom budgets are left out: their period is
//   closed and nothing can be done about it;
// - Due soon: active bills due today through the next 3 days;
// - Plans: only while Plans is on (`plansOn`).
// A paused bill is never an alert.
//
// Each alert: { id, route, title, sub, tone: 'danger' | 'warn' }; a bill's
// also carries `iconKey`, its own icon (as on Bills and the bills-due sheet).
import { daysUntil, dueWording } from './billGroups.js';
import { budgetRowStatus } from './budgetRow.js';
import { billIconKey } from './billIcons.js';
import { amountParts, DEFAULT_CURRENCY } from './currency.js';

// The same window as hooks/useBills.js's billStatus (a hook, so it can't be
// imported here).
const DUE_SOON_DAYS = 3;
const PLAN_ENDING_SOON_DAYS = 7;

export const PERIOD_PHRASE = {
  calendar_week: 'this week',
  calendar_month: 'this month',
  custom: 'in this period',
};

const money = (n, currency = DEFAULT_CURRENCY) => amountParts(n, { currency }).text;

function byDueThenName(a, b) {
  return a.next_due_date.localeCompare(b.next_due_date) || (a.name ?? '').localeCompare(b.name ?? '');
}

function billAlert(bill, today) {
  const due = dueWording(bill.next_due_date, today);
  return {
    id: `bill-${bill.id}`,
    route: `/bill/${bill.id}`,
    title: bill.name,
    sub: `${money(bill.amount, bill.currency ?? DEFAULT_CURRENCY)} · ${due.text}`,
    tone: due.tone === 'danger' ? 'danger' : 'warn',
    iconKey: billIconKey(bill),
  };
}

function budgetAlerts(budgets, today) {
  const list = [];
  for (const budget of budgets) {
    const status = budgetRowStatus(budget, { today });
    if (status.state !== 'warn' && status.state !== 'over') continue;
    const spent = Number(budget.spent) || 0;
    const amount = Number(budget.amount) || 0;
    const over = spent - amount;
    // Over says by how much; spent exactly to the limit says "Used up", as
    // the Budgets list does.
    let sub;
    if (over > 0) sub = `Over by ${money(over, budget.currency ?? DEFAULT_CURRENCY)}`;
    else if (status.state === 'over') sub = 'Used up';
    else sub = `${Math.round(status.ratio * 100)}% used ${PERIOD_PHRASE[budget.period_type] ?? 'this period'}`;
    list.push({
      id: `budget-${budget.id}`,
      route: `/budget/${budget.id}`,
      title: budget.category_name ?? 'Overall budget',
      sub,
      tone: status.state === 'over' ? 'danger' : 'warn',
      ratio: status.ratio,
    });
  }
  // The worst first.
  return list.sort((a, b) => b.ratio - a.ratio).map(({ ratio, ...alert }) => alert);
}

function planAlerts(plans, today) {
  const list = [];
  for (const plan of plans) {
    if (plan.status !== 'active') continue;
    if (plan.target_amount && plan.total_spent > plan.target_amount) {
      list.push({
        id: `plan-over-${plan.id}`,
        route: `/plan/${plan.id}`,
        title: `${plan.name} over target`,
        sub: `Over by ${money(plan.total_spent - plan.target_amount)}`,
        tone: 'danger',
      });
    } else if (plan.end_date) {
      const daysLeft = daysUntil(plan.end_date, today);
      if (daysLeft >= 0 && daysLeft <= PLAN_ENDING_SOON_DAYS) {
        list.push({
          id: `plan-ending-${plan.id}`,
          route: `/plan/${plan.id}`,
          title: `${plan.name} ending soon`,
          sub: daysLeft === 0 ? 'Ends today' : `Ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
          tone: 'warn',
        });
      }
    }
  }
  return list;
}

export function alertGroups({ bills = [], budgets = [], plans = [], today = new Date(), plansOn = false }) {
  const active = bills.filter((b) => b.is_active).sort(byDueThenName);
  const overdue = active.filter((b) => daysUntil(b.next_due_date, today) < 0);
  const soon = active.filter((b) => {
    const days = daysUntil(b.next_due_date, today);
    return days >= 0 && days <= DUE_SOON_DAYS;
  });

  const groups = [
    { key: 'overdue', title: 'Overdue', tone: 'danger', alerts: overdue.map((b) => billAlert(b, today)) },
    { key: 'budgets', title: 'Budgets', tone: null, alerts: budgetAlerts(budgets, today) },
    { key: 'soon', title: 'Due soon', tone: null, alerts: soon.map((b) => billAlert(b, today)) },
    { key: 'plans', title: 'Plans', tone: null, alerts: plansOn ? planAlerts(plans, today) : [] },
  ];
  return groups.filter((g) => g.alerts.length > 0);
}
