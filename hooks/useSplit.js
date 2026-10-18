import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAuth } from '../lib/AuthContext';
import useLoadedFor from './useLoadedFor';
import { SPLIT_SELECT, normalizeSplit } from '../lib/splitShape';
import {
  computeBalances,
  suggestPayments,
  membersChangedAfterSettling,
  computeDirectDebts,
} from '../lib/splitMath';

// One split, fully hydrated, with every derived figure the detail screen needs.
// Same embedded select as useSplits, narrowed to one id.
//
// Not account-scoped: the id already pins it to one split, and RLS pins that to
// the user. Scoping by activeAccountId as well would break the detail screen
// the moment someone switches accounts while it's open, for no gain.
const EMPTY = {
  forSplitId: null,
  split: null,
  members: [],
  entries: [],
  settlements: [],
  balances: [],
  directDebts: [],
  debtOffsets: [],
  payments: [],
  changedAfterSettling: [],
};

export default function useSplit(splitId) {
  const { version } = useDataRefresh();
  const { session } = useAuth();
  const myUserId = session?.user?.id ?? null;
  const [state, setState] = useState(EMPTY);
  // useLoadedFor, not a plain useState(true) — see that hook's own comment. A
  // bare boolean is never set back to true when `splitId` CHANGES, which caused
  // a real bug: opening split B while holding split A's data reported
  // "loaded" and rendered A's entries, totals and balances under B's name. With
  // two splits sharing a name that is indistinguishable from a broken
  // calculation.
  //
  // Worse than the display: `entryCtx` on the detail screen is memoised off
  // this state, so tapping "Add Entry" in that window passed the OLD split's id
  // to save_split_entry and FILED THE ENTRY INTO THE WRONG SPLIT. Keying the
  // loaded state on splitId closes both.
  const [loading, markLoaded] = useLoadedFor(splitId);

  const refetch = useCallback(async () => {
    if (!splitId) return;
    const { data, error } = await supabase
      .from('splits')
      .select(SPLIT_SELECT)
      .eq('id', splitId)
      .maybeSingle();

    if (error || !data) {
      setState({ ...EMPTY, forSplitId: splitId });
      markLoaded(splitId);
      return;
    }

    const { split, members, entries, settlements } = normalizeSplit(data, myUserId);
    const balances = computeBalances({ members, entries, settlements });
    // Two answers to "who owes whom", both true and both shown (the detail is
    // NOT hidden behind a toggle — see the detail screen's own comment):
    //   directDebts — every debt traced to whoever paid. The honest picture.
    //   payments    — the same money collapsed into the fewest transfers.
    const { debts, offsets } = computeDirectDebts({ members, entries, settlements });
    setState({
      // Stamped with the split this data belongs to, so a consumer that ignores
      // `loading` still can't be handed another split's numbers.
      forSplitId: splitId,
      split,
      members,
      entries,
      settlements,
      balances,
      directDebts: debts,
      debtOffsets: offsets,
      payments: suggestPayments(balances),
      changedAfterSettling: membersChangedAfterSettling({ members, entries, settlements }),
    });
    markLoaded(splitId);
  }, [splitId, myUserId, markLoaded]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  // The guard that makes this hook safe by construction rather than by consumer
  // discipline: until the fetch for THIS splitId has landed, hand back nothing
  // instead of the previous split's data.
  const data = state.forSplitId === splitId ? state : EMPTY;

  const total = data.entries.reduce((acc, e) => acc + e.amount, 0);
  const self = data.members.find((m) => m.isSelf) ?? null;

  // Mirrors the server's split_role(): the creator is always the organizer, so
  // a split can't become unmanageable if its member rows are ever odd. UI that
  // hides an organizer-only action reads this; the RLS policies enforce it for
  // real, so a wrong answer here is a cosmetic bug, never a security one.
  const myRole =
    data.split && myUserId
      ? data.split.userId === myUserId
        ? 'organizer'
        : (data.members.find((m) => m.memberUserId === myUserId)?.role ?? null)
      : null;

  return {
    ...data,
    self,
    myRole,
    isOrganizer: myRole === 'organizer',
    isSharedWithMe: !!data.split && !!myUserId && data.split.userId !== myUserId,
    total,
    perHead: data.members.length ? total / data.members.length : 0,
    myNet: self
      ? Math.round((data.balances.find((b) => b.memberId === self.id)?.net ?? 0) * 100) / 100
      : 0,
    // Drives the soft-vs-hard delete choice in lib/splits.js's deleteEntry:
    // once money has moved on the strength of these numbers, the trail has to
    // survive an edit (Decision 7).
    hasSettlements: data.settlements.length > 0,
    memberById: Object.fromEntries(data.members.map((m) => [m.id, m])),
    balanceByMemberId: Object.fromEntries(data.balances.map((b) => [b.memberId, b])),
    loading,
    refetch,
  };
}
