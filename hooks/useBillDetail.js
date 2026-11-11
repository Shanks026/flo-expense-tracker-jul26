import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';

// A bill with its category, plus the payments linked to it
// (`transactions.bill_id`, spec 48 ticket 04), newest first, each with its
// account's name. Keyed by the bill's id from navigation, like
// useBudgetDetail; bills are per user, not per account, so it doesn't filter
// by the active account. Refetches on every `version` bump, so marking the
// bill paid shows the new payment and due date at once.
//
// `bill` is null once loading finishes for a bill that doesn't exist (or was
// just deleted); the screen goes back on that.
const PAYMENTS_SHOWN = 13; // one more than the timeline shows, so it knows there are more

export default function useBillDetail(billId) {
  const { version } = useDataRefresh();
  const [bill, setBill] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!billId) return;
    const [billRes, payRes] = await Promise.all([
      supabase.from('bills').select('*, category:categories(name, icon, color)').eq('id', billId).maybeSingle(),
      supabase
        .from('transactions')
        .select('id, occurred_at, amount, account:accounts!transactions_account_id_fkey(name)')
        .eq('bill_id', billId)
        .order('occurred_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(PAYMENTS_SHOWN),
    ]);
    if (billRes.error || !billRes.data) {
      setBill(null);
      setPayments([]);
    } else {
      setBill(billRes.data);
      setPayments((payRes.data ?? []).map((t) => ({ id: t.id, occurred_at: t.occurred_at, amount: Number(t.amount), accountName: t.account?.name ?? null })));
    }
    setLoading(false);
  }, [billId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { bill, payments, loading, refetch };
}
