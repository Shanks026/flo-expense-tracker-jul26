import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import useLoadedFor from './useLoadedFor';

// Transaction detail's read (spec 46, ticket 11): one entry with its
// category and plan, the other leg when it's a transfer, and the live
// split entry that references it (with the split's id and name). Depends on
// `version` like every read hook, so an edit elsewhere shows here at once.
//
// `transaction` is null both while loading and when the entry is gone (it
// was deleted, or never existed); `loading`
// tells them apart; `error` is set when the read itself failed.
export default function useTransactionDetail(id) {
  const { version } = useDataRefresh();
  const [data, setData] = useState({ transaction: null, counterpart: null, splitEntry: null, error: null });
  const [loading, markLoaded] = useLoadedFor(id ?? null);

  const refetch = useCallback(async () => {
    if (!id) {
      setData({ transaction: null, counterpart: null, splitEntry: null, error: null });
      markLoaded(null);
      return;
    }
    const [{ data: tx, error: txError }, { data: entries, error: splitError }] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, category:categories(id, name, icon, color), plan:plans(id, name)')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('split_entries')
        .select('id, created_at, split:splits(id, name)')
        .eq('transaction_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(1),
    ]);
    let counterpart = null;
    if (tx?.transfer_id) {
      const { data: legs } = await supabase
        .from('transactions')
        .select('id, account_id, type')
        .eq('transfer_id', tx.transfer_id)
        .neq('id', tx.id)
        .limit(1);
      counterpart = legs?.[0] ?? null;
    }
    // A failed read is an error, not "gone": the screen says so and offers
    // a retry. A missing split link only loses the link, so it isn't one.
    if (txError) {
      setData((d) => ({ ...d, error: txError }));
      markLoaded(id);
      return;
    }
    if (splitError) console.warn('split link not loaded:', splitError.message);
    setData({ transaction: tx ?? null, counterpart, splitEntry: entries?.[0] ?? null, error: null });
    markLoaded(id);
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { ...data, loading, refetch };
}
