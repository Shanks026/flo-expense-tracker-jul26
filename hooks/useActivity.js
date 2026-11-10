import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';
import useLoadedFor from './useLoadedFor';

// Activity's read (spec 46, ticket 10): every entry in one account, or in all
// of the person's accounts ('all'), between two local days (inclusive,
// 'yyyy-MM-dd'), newest first. Search, type and category are applied on the
// result by lib/activity.js, so typing in the search field never refetches.
//
// `accountIds` is what the filter resolved to: one id, or every account's id
// for All accounts. Same shape as every read hook: depends on `version`,
// returns { transactions, loading, refetch }.
export default function useActivity({ accountIds, from, to }) {
  const { version } = useDataRefresh();
  const { loading: accountLoading } = useAccount();
  const [transactions, setTransactions] = useState([]);
  const scopeKey = accountIds.length ? accountIds.join(',') : null;
  const [loading, markLoaded] = useLoadedFor(scopeKey, accountLoading);
  // Chips change the range or account quickly; only the latest answer lands.
  const requestRef = useRef(0);

  const refetch = useCallback(async () => {
    const request = ++requestRef.current;
    if (!scopeKey) {
      setTransactions([]);
      markLoaded(null);
      return;
    }
    const { data, error } = await supabase
      .from('transactions')
      .select('*, category:categories(id, name, icon, color), plan:plans(id, name)')
      .in('account_id', scopeKey.split(','))
      .gte('occurred_at', from)
      .lte('occurred_at', to)
      .order('occurred_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (request !== requestRef.current) return;
    if (!error) setTransactions(data ?? []);
    markLoaded(scopeKey);
  }, [scopeKey, from, to]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { transactions, loading, refetch };
}
