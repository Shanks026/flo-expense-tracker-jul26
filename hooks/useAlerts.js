import { useMemo } from 'react';
import { format, differenceInCalendarDays } from 'date-fns';
import useBills, { billStatus } from './useBills';
import useBudgets, { budgetStatus } from './useBudgets';
import usePlans from './usePlans';
import useReportDue from './useReportDue';
import { formatMoney } from '../lib/money';
import { isBudgetEnded } from '../lib/budgets';

const PLAN_ENDING_SOON_DAYS = 7;
// 'info' (added 11-reports.md Phase 2) sorts after danger/warn — a report
// being ready is good news, not a problem, and shouldn't outrank an overdue
// bill or a blown budget for attention.
const SEVERITY_ORDER = { danger: 0, warn: 1, info: 2 };

const CADENCE_TITLE = { weekly: 'Weekly report ready', monthly: 'Monthly report ready' };

const BUDGET_PERIOD_PHRASE = {
  calendar_week: 'this week',
  calendar_month: 'this month',
  custom: 'in this period',
};

// Aggregates a live, computed alert feed — nothing is stored (see the Phase 6
// goal in 04-notifications-and-recurring-bills.md). Deliberately mixed-scope:
// bills are global per-user (Phase 3 course-correction), budgets/plans are
// scoped to whichever account is active, matching each source hook exactly.
export default function useAlerts() {
  const { bills, loading: billsLoading } = useBills();
  const { budgets, loading: budgetsLoading } = useBudgets();
  const { plans, loading: plansLoading } = usePlans();
  const { due: reportDue } = useReportDue();

  const alerts = useMemo(() => {
    const list = [];

    if (reportDue) {
      list.push({
        id: 'report-due',
        kind: 'report',
        severity: 'info',
        title: CADENCE_TITLE[reportDue.cadence],
        subtitle: reportDue.period.label,
        route: '/report',
      });
    }

    for (const bill of bills) {
      if (!bill.is_active) continue;
      const status = billStatus(bill.next_due_date);
      if (status === 'overdue') {
        list.push({
          id: `bill-${bill.id}`,
          kind: 'bill',
          severity: 'danger',
          title: `${bill.name} overdue`,
          subtitle: `${formatMoney(bill.amount)} — was due ${format(new Date(bill.next_due_date), 'd MMM')}`,
          route: '/bills',
        });
      } else if (status === 'due_soon') {
        list.push({
          id: `bill-${bill.id}`,
          kind: 'bill',
          severity: 'warn',
          title: `${bill.name} due soon`,
          subtitle: `${formatMoney(bill.amount)} — due ${format(new Date(bill.next_due_date), 'd MMM')}`,
          route: '/bills',
        });
      }
    }

    for (const budget of budgets) {
      const status = budgetStatus(budget.spent, budget.amount);
      if (status === 'healthy') continue;
      // An ended custom budget can't be acted on — its window is closed and its
      // spent figure is final. Alerting on it would nag about a trip you took
      // last month, forever.
      if (isBudgetEnded(budget)) continue;
      list.push({
        id: `budget-${budget.id}`,
        kind: 'budget',
        severity: status === 'over' ? 'danger' : 'warn',
        title: budget.category_name ?? 'Overall budget',
        subtitle:
          status === 'over'
            ? `Over by ${formatMoney(budget.spent - budget.amount)}`
            : `${Math.round((budget.spent / budget.amount) * 100)}% used ${BUDGET_PERIOD_PHRASE[budget.period_type] ?? 'this period'}`,
        route: '/budgets',
      });
    }

    for (const plan of plans) {
      if (plan.status !== 'active') continue;

      if (plan.target_amount && plan.total_spent > plan.target_amount) {
        list.push({
          id: `plan-over-${plan.id}`,
          kind: 'plan',
          severity: 'danger',
          title: `${plan.name} over target`,
          subtitle: `Over by ${formatMoney(plan.total_spent - plan.target_amount)}`,
          route: `/plan/${plan.id}`,
        });
      } else if (plan.end_date) {
        const daysLeft = differenceInCalendarDays(new Date(plan.end_date), new Date());
        if (daysLeft >= 0 && daysLeft <= PLAN_ENDING_SOON_DAYS) {
          list.push({
            id: `plan-ending-${plan.id}`,
            kind: 'plan',
            severity: 'warn',
            title: `${plan.name} ending soon`,
            subtitle: daysLeft === 0 ? 'Ends today' : `Ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
            route: `/plan/${plan.id}`,
          });
        }
      }
    }

    return list.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  }, [bills, budgets, plans, reportDue]);

  return { alerts, count: alerts.length, loading: billsLoading || budgetsLoading || plansLoading };
}
