import { useEffect, useState, useCallback } from 'react';
import { format, subDays, addDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';

export default function useDailyTotals(days = 7) {
  const { version } = useDataRefresh();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const end = new Date();
    const start = subDays(end, days - 1);

    const byDay = {};
    for (let i = 0; i < days; i++) {
      const d = addDays(start, i);
      byDay[format(d, 'yyyy-MM-dd')] = { date: d, income: 0, expense: 0 };
    }

    const { data: rows, error } = await supabase
      .from('transactions')
      .select('type, amount, occurred_at')
      .gte('occurred_at', format(start, 'yyyy-MM-dd'))
      .lte('occurred_at', format(end, 'yyyy-MM-dd'));

    if (!error && rows) {
      rows.forEach((tx) => {
        const bucket = byDay[tx.occurred_at];
        if (bucket) bucket[tx.type] += tx.amount;
      });
    }

    setData(Object.values(byDay));
    setLoading(false);
  }, [days]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { data, loading };
}
