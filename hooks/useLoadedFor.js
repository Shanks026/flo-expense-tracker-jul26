import { useState } from 'react';

// Correct "is this still loading?" bookkeeping for the read hooks — a drop-in
// replacement for the plain `useState(true)` + `setLoading(false)` pattern,
// which is subtly wrong for every hook that fetches on a KEY that starts null
// and resolves a beat later (`userId` from AuthContext, `activeAccountId` from
// AccountContext).
//
// The bug it fixes: the pre-resolution pass ("no key yet") legitimately runs,
// stores an empty result, and sets loading=false — and nothing ever set it back
// to true once the REAL key arrived. So for the entire window of the real
// request the hook reported "loaded" while holding an empty result, and the
// screen rendered that emptiness as though it were the answer (₹0 balances, a
// zeroed streak chip, "no transactions yet"), then popped to real data a beat
// later. Every hook here had its own copy of that mistake.
//
// Tracking WHICH key the current data belongs to is self-consistent no matter
// what order the effects run in, and — unlike resetting a boolean at the top of
// each fetch — it deliberately stays `false` when only `version` bumps (same
// key), so an ordinary post-mutation refetch never flashes a skeleton back over
// data that's already on screen.
//
// `blockedBy` is the upstream gate a null key can't express on its own: "auth
// hasn't resolved yet" and "genuinely signed out" both look like
// `userId === null`, so callers pass AuthContext's own `loading` (or
// AccountContext's, for account-scoped hooks) here.
//
// Deliberately keyed on the IDENTITY only (which user / which account), not on
// a hook's filter arguments — a month/range/category change keeps its existing
// show-stale-then-update behavior rather than newly flashing a skeleton.
export default function useLoadedFor(key, blockedBy = false) {
  const [loadedKey, setLoadedKey] = useState(undefined);
  // setLoadedKey is referentially stable, so callers can call it from inside a
  // useCallback'd fetch without perturbing that callback's identity.
  return [blockedBy || loadedKey !== key, setLoadedKey];
}
