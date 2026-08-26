import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAuth } from '../lib/AuthContext';
import { SPLIT_SELECT, normalizeSplit } from '../lib/splitShape';
import { computeBalances, suggestPayments, membersChangedAfterSettling } from '../lib/splitMath';

// One split, fully hydrated, with every derived figure the detail screen needs.
// Same embedded select as useSplits, narrowed to one id.
//
// Not account-scoped: the id already pins it to one split, and RLS pins that to
// the user. Scoping by activeAccountId as well would break the detail screen
// the moment someone switches accounts while it's open, for no gain.
export default function useSplit(splitId) {
  const { version } = useDataRefresh();
  const { session } = useAuth();
  const myUserId = session?.user?.id ?? null;
  const [state, setState] = useState({
    split: null,
    members: [],
    entries: [],
    settlements: [],
    balances: [],
    payments: [],
    changedAfterSettling: [],
  });
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!splitId) return;
    const { data, error } = await supabase
      .from('splits')
      .select(SPLIT_SELECT)
      .eq('id', splitId)
      .maybeSingle();

    if (error || !data) {
      setState({
        split: null,
        members: [],
        entries: [],
        settlements: [],
        balances: [],
        payments: [],
        changedAfterSettling: [],
      });
      setLoading(false);
      return;
    }

    const { split, members, entries, settlements } = normalizeSplit(data, myUserId);
    const balances = computeBalances({ members, entries, settlements });
    setState({
      split,
      members,
      entries,
      settlements,
      balances,
      payments: suggestPayments(balances),
      changedAfterSettling: membersChangedAfterSettling({ members, entries, settlements }),
    });
    setLoading(false);
  }, [splitId, myUserId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  const total = state.entries.reduce((acc, e) => acc + e.amount, 0);
  const self = state.members.find((m) => m.isSelf) ?? null;

  // Mirrors the server's split_role(): the creator is always the organizer, so
  // a split can't become unmanageable if its member rows are ever odd. UI that
  // hides an organizer-only action reads this; the RLS policies enforce it for
  // real, so a wrong answer here is a cosmetic bug, never a security one.
  const myRole =
    state.split && myUserId
      ? state.split.userId === myUserId
        ? 'organizer'
        : (state.members.find((m) => m.memberUserId === myUserId)?.role ?? null)
      : null;

  return {
    ...state,
    self,
    myRole,
    isOrganizer: myRole === 'organizer',
    isSharedWithMe: !!state.split && !!myUserId && state.split.userId !== myUserId,
    total,
    perHead: state.members.length ? total / state.members.length : 0,
    myNet: self
      ? Math.round((state.balances.find((b) => b.memberId === self.id)?.net ?? 0) * 100) / 100
      : 0,
    // Drives the soft-vs-hard delete choice in lib/splits.js's deleteEntry:
    // once money has moved on the strength of these numbers, the trail has to
    // survive an edit (Decision 7).
    hasSettlements: state.settlements.length > 0,
    memberById: Object.fromEntries(state.members.map((m) => [m.id, m])),
    balanceByMemberId: Object.fromEntries(state.balances.map((b) => [b.memberId, b])),
    loading,
    refetch,
  };
}
