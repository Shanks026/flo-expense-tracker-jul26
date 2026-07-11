import { useEffect, useState, useCallback } from 'react';
import { format, subDays, addDays, eachWeekOfInterval, endOfWeek, isWithinInterval } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';

// Bucket granularity mirrors lib/analytics.js's computeTrend: daily bars stay
// readable up to a few weeks, but 30-90 daily bars would be too thin/cramped
// for the Home screen's chunky-bar chart, so 1M/3M roll up into weekly bars
// (Monday-start, matching the rest of the app's week convention).
const RANGE_CONFIG = {
  '7d': { days: 7, granularity: 'day' },
  '1m': { days: 30, granularity: 'week' },
  '3m': { days: 90, granularity: 'week' },
};

export default function useSpendingTrend(range = '7d') {
  const { version } = useDataRefresh();
  const { activeAccountId } = useAccount();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const { days, granularity } = RANGE_CONFIG[range] ?? RANGE_CONFIG['7d'];

  const refetch = useCallback(async () => {
    const end = new Date();
    const start = subDays(end, days - 1);

    const buckets =
      granularity === 'day'
        ? Array.from({ length: days }, (_, i) => ({ date: addDays(start, i), income: 0, expense: 0 }))
        : eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map((weekStart) => ({
            date: weekStart,
            income: 0,
            expense: 0,
          }));

    if (!activeAccountId) {
      setData(buckets);
      setLoading(false);
      return;
    }

    const { data: rows, error } = await supabase
      .from('transactions')
      .select('type, amount, occurred_at')
      .eq('account_id', activeAccountId)
      .gte('occurred_at', format(start, 'yyyy-MM-dd'))
      .lte('occurred_at', format(end, 'yyyy-MM-dd'));

    if (!error && rows) {
      if (granularity === 'day') {
        const byKey = new Map(buckets.map((b) => [format(b.date, 'yyyy-MM-dd'), b]));
        rows.forEach((tx) => {
          const bucket = byKey.get(tx.occurred_at);
          if (bucket) bucket[tx.type] += tx.amount;
        });
      } else {
        rows.forEach((tx) => {
          const txDate = new Date(tx.occurred_at);
          const bucket = buckets.find((b) => isWithinInterval(txDate, { start: b.date, end: endOfWeek(b.date, { weekStartsOn: 1 }) }));
          if (bucket) bucket[tx.type] += tx.amount;
        });
      }
    }

    setData(buckets);
    setLoading(false);
  }, [days, granularity, activeAccountId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { data, loading };
}
