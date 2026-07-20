import { useState, useCallback, useRef, useEffect } from 'react';
import { useDataRefresh } from '../lib/DataRefreshContext';

// Shared pull-to-refresh for the main scroll screens. Every read hook in the
// app subscribes to useDataRefresh's `version` and refetches when it bumps, so
// a single notifyChanged() refreshes everything on a screen at once — no need
// to thread each hook's own refetch (several hooks, e.g. useSpendingTrend /
// useAllAccountSummaries / useAnalyticsData, don't even expose one).
//
// notifyChanged() only bumps a counter and returns nothing — there's no
// per-screen "all refetches settled" signal to await — so the spinner is held
// for a short fixed beat rather than guessing when the last query resolved.
// Long enough to read as a real refresh, short enough not to feel stuck.
const SPINNER_MS = 700;

export default function usePullToRefresh() {
  const { notifyChanged } = useDataRefresh();
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    notifyChanged();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setRefreshing(false), SPINNER_MS);
  }, [notifyChanged]);

  return { refreshing, onRefresh };
}
