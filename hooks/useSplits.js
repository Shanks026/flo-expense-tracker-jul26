import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAccount } from '../lib/AccountContext';
import { useAuth } from '../lib/AuthContext';
import { SPLIT_SELECT, normalizeSplit } from '../lib/splitShape';
import { computeBalances } from '../lib/splitMath';

// The Splits list, account-scoped (Decision 10: a settlement transaction has to
// land in an account, so the split should already know which one).
//
// There is no v_splits_with_totals view, deliberately. The list needs each
// split's total AND the user's own net position, and the net can only be known
// from the full entry/share/settlement set — so a view would have to compute
// the whole thing anyway. Fetching it in one embedded select and aggregating in
// lib/splitMath.js keeps the math in one testable place and follows the skill's
// "prefer client-side unless reused across many screens" rule.
//
// VOLUME ASSUMPTION, stated so it can be checked later: a real split is ~15
// entries x ~5 shares, and a user has a handful of splits — low hundreds of
// rows. If someone ever accumulates dozens of splits this should become a view
// exposing total + my_net, and the list should stop hydrating entries at all.
export default function useSplits() {
  const { version } = useDataRefresh();
  const { activeAccountId } = useAccount();
  const { session } = useAuth();
  const myUserId = session?.user?.id ?? null;
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!activeAccountId) {
      setSplits([]);
      setLoading(false);
      return;
    }

    // NO `.eq('account_id', …)` any more, and that's a Phase 3 correction worth
    // spelling out. A split shared WITH me lives in the organizer's account —
    // an account row I can't even read — so an account filter would have hidden
    // every shared split completely.
    //
    // RLS already restricts this to splits I'm a member of, so the query is
    // safe to leave open and filter below: keep it if it belongs to the account
    // I'm looking at, OR if it's someone else's split shared with me (which
    // isn't "in" any account of mine). Account-scoping still holds where it
    // was actually load-bearing — the account a settlement lands in.
    const { data, error } = await supabase
      .from('splits')
      .select(SPLIT_SELECT)
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error) {
      setSplits(
        (data ?? [])
          .filter((row) => row.account_id === activeAccountId || row.user_id !== myUserId)
          .map((row) => {
          const { split, members, entries, settlements } = normalizeSplit(row, myUserId);
          const balances = computeBalances({ members, entries, settlements });
          const self = members.find((m) => m.isSelf);
          const total = entries.reduce((acc, e) => acc + e.amount, 0);
          return {
            ...split,
            memberCount: members.length,
            entryCount: entries.length,
            total,
            perHead: members.length ? total / members.length : 0,
            // > 0 means the user is owed, < 0 means they owe. Rounded to paise
            // so a float artefact can't render as "You owe ₹0".
            myNet: self
              ? Math.round((balances.find((b) => b.memberId === self.id)?.net ?? 0) * 100) / 100
              : 0,
          };
          })
      );
    }
    setLoading(false);
  }, [activeAccountId, myUserId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return {
    splits,
    openSplits: splits.filter((s) => s.status === 'open'),
    closedSplits: splits.filter((s) => s.status === 'closed'),
    loading,
    refetch,
  };
}
