import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';

// A bill with its category, plus the payments linked to it
// (`transactions.bill_id`, spec 48 ticket 04), newest first, each with its
// account's name. Keyed by the bill's id from navigation, like
// useBudgetDetail; bills are per user, not per account, so it doesn't filter
// by the active account. Refetches on every `version` bump, so marking the
// bill paid shows the new payment and due date at once.
//
// Spec 49 ticket 02 tells "gone" apart from "couldn't load":
// - `missing` is true only when the read worked and found no bill (deleted,
//   or not the person's), or there's no id at all. The screen goes back.
// - `error` is true when a read failed and there's no bill to show. The
//   screen offers Retry (`refetch`). A failed refresh of a bill already on
//   screen keeps what's there rather than blanking it.
const PAYMENTS_SHOWN = 13; // one more than the timeline shows, so it knows there are more

export default function useBillDetail(billId) {
  const { version } = useDataRefresh();
  const [bill, setBill] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [missing, setMissing] = useState(false);
  // Only the newest request may write: a Retry or a `version` bump during a
  // slow read mustn't be overwritten by the older answer.
  const requestRef = useRef(0);

  // A different bill starts from scratch, never showing the last one's data.
  useEffect(() => {
    setBill(null);
    setPayments([]);
    setMissing(false);
    setError(false);
    setLoading(true);
  }, [billId]);

  const refetch = useCallback(async () => {
    const request = ++requestRef.current;
    if (!billId) {
      setMissing(true);
      setLoading(false);
      return;
    }
    setError(false);
    let billRes, payRes;
    try {
      [billRes, payRes] = await Promise.all([
        supabase.from('bills').select('*, category:categories(name, icon, color)').eq('id', billId).maybeSingle(),
        supabase
          .from('transactions')
          .select('id, occurred_at, amount, account:accounts!transactions_account_id_fkey(name)')
          .eq('bill_id', billId)
          .order('occurred_at', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(PAYMENTS_SHOWN),
      ]);
    } catch (thrown) {
      billRes = { error: thrown };
      payRes = { error: thrown };
    }
    if (request !== requestRef.current) return;
    if (billRes.error || payRes.error) {
      // Payments failing too counts: a timeline without them would read as
      // "never paid".
      setError(true);
    } else if (!billRes.data) {
      setMissing(true);
      setBill(null);
      setPayments([]);
    } else {
      setMissing(false);
      setBill(billRes.data);
      setPayments(payRes.data.map((t) => ({ id: t.id, occurred_at: t.occurred_at, amount: Number(t.amount), accountName: t.account?.name ?? null })));
    }
    setLoading(false);
  }, [billId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { bill, payments, loading, error: error && !bill, missing, refetch };
}
