import { useMemo } from 'react';
import { format } from 'date-fns';
import useBills from './useBills';
import useBudgets from './useBudgets';
import usePlans from './usePlans';
import { alertGroups } from '../lib/alertGroups';
import { FLAGS } from '../lib/flags';

// The bell's feed, grouped (spec 49, ticket 05): lib/alertGroups.js decides
// what's an alert and where it goes; this only gathers the inputs. Nothing
// is stored (the Phase 6 goal in 04-notifications-and-recurring-bills.md).
// Deliberately mixed-scope: bills are global per user, budgets and plans are
// scoped to the active account, matching each source hook exactly.
//
// `count` drives Home's bell dot, so the dot shows exactly when the sheet
// has something in it.
export default function useAlerts() {
  const { bills, loading: billsLoading } = useBills();
  const { budgets, loading: budgetsLoading } = useBudgets();
  const { plans, loading: plansLoading } = usePlans();

  // Keyed by the day too, so "Due soon" and "Overdue" move on at midnight
  // without waiting for a refetch.
  const dayKey = format(new Date(), 'yyyy-MM-dd');
  const groups = useMemo(
    () => alertGroups({ bills, budgets, plans, today: new Date(), plansOn: FLAGS.plans }),
    [bills, budgets, plans, dayKey]
  );
  const count = groups.reduce((n, g) => n + g.alerts.length, 0);

  return { groups, count, loading: billsLoading || budgetsLoading || plansLoading };
}
