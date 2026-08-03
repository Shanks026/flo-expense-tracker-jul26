import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAuth } from '../lib/AuthContext';
import { resetPeriodStart } from '../lib/periods';
import useLoadedFor from './useLoadedFor';

// v_global_summary is grouped by account_id, so selecting without an
// account filter returns one row per account for the current user (RLS
// already scopes it) — exactly what the account switcher cards need.
//
// 30-summary-reset-period.md — `in_hand_balance`/`total_income`/`total_expense`
// still come straight off that view (genuinely lifetime, unchanged). The
// view's OWN `month_income`/`month_expense` columns are hardcoded to the
// calendar month and are no longer read here — `period_income`/
// `period_expense` are computed client-side instead, scoped to whatever
// reset period the user picked in Settings (profiles.reset_period/
// reset_custom_start), same "fetch raw rows, aggregate with date-fns"
// pattern Analytics' own useAnalyticsData already uses. A Postgres view
// can't take a runtime parameter, which is why this couldn't stay server-side.
export default function useAllAccountSummaries() {
  const { version } = useDataRefresh();
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id ?? null;
  const [summaries, setSummaries] = useState({});
  // See hooks/useLoadedFor.js — a bare loading boolean reported "loaded" with
  // an empty map while the real post-sign-in request was still in flight, and
  // Home's hero rendered ₹0 balances as if they were the answer.
  const [loading, markLoaded] = useLoadedFor(userId, authLoading);

  // Not scoped by activeAccountId (unlike most read hooks), so it has no
  // dependency that changes once auth resolves — depend on userId directly
  // or a pre-auth empty fetch never gets revisited after sign-in. Same root
  // cause as the AccountContext bug documented in 00-index.md.
  const refetch = useCallback(async () => {
    if (!userId) {
      setSummaries({});
      markLoaded(null);
      return;
    }
    const [{ data: globalRows, error: globalError }, { data: profile }] = await Promise.all([
      supabase.from('v_global_summary').select('*'),
      supabase.from('profiles').select('reset_period, reset_custom_start').maybeSingle(),
    ]);
    if (globalError || !globalRows) {
      // Still mark this user as resolved — otherwise a failed read leaves the
      // caller pinned on a skeleton forever with no way out but a refresh.
      markLoaded(userId);
      return;
    }

    const since = resetPeriodStart(profile?.reset_period, profile?.reset_custom_start);
    const { data: periodRows } = await supabase
      .from('transactions')
      .select('account_id, type, amount')
      .gte('occurred_at', since);

    // account_id -> { income, expense }. Transfers excluded by exact-type
    // check — same discipline v_global_summary itself uses (see
    // 10-account-self-transfer.md's standing note in 00-index.md: any new
    // aggregation over `transactions` must filter on the exact type string
    // or it will silently count transfers as income/expense).
    const periodTotals = {};
    for (const row of periodRows ?? []) {
      if (row.type !== 'income' && row.type !== 'expense') continue;
      const bucket = periodTotals[row.account_id] ?? (periodTotals[row.account_id] = { income: 0, expense: 0 });
      bucket[row.type] += Number(row.amount) || 0;
    }

    const map = {};
    globalRows.forEach((row) => {
      const totals = periodTotals[row.account_id] ?? { income: 0, expense: 0 };
      map[row.account_id] = { ...row, period_income: totals.income, period_expense: totals.expense };
    });
    setSummaries(map);
    markLoaded(userId);
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { summaries, loading };
}
