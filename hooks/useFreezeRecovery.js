import { useState } from 'react';
import { format } from 'date-fns';
import useRewards from './useRewards';
import useMissedDays from './useMissedDays';
import { useFreezeForDates } from '../lib/rewardsMutations';
import { useDataRefresh } from '../lib/DataRefreshContext';

// Shared "cover a missed gap with a freeze" mechanic — used by both the
// once-a-day auto-popup (components/FreezePrompt.js) and the always-available
// action on the streak screen (app/streak.js), so the coverCount/isPartial
// slicing logic and the mutation call live in exactly one place instead of
// being copied between the two call sites.
//
// `canUse` mirrors FreezePrompt's own gate (`missedDates.length === 0 ||
// freezes < 1` → nothing to offer) — a clean streak or a zero freeze balance
// both correctly report canUse: false rather than a broken/negative action.
export default function useFreezeRecovery() {
  const { freezes, loading: rewardsLoading } = useRewards();
  const { missedDates, loading: missedLoading } = useMissedDays();
  const { notifyChanged } = useDataRefresh();
  const [using, setUsing] = useState(false);

  const loading = rewardsLoading || missedLoading;
  // Closest-to-today subset when only partially covering — computeStreak's
  // `current` only extends backward through a CONTIGUOUS covered run starting
  // at today, so freezing the oldest missed days instead buys zero streak
  // benefit even though real freezes were spent. Same reasoning as
  // useMissedDays.js's own comment.
  const coverCount = Math.min(freezes, missedDates.length);
  const datesToUse = missedDates.slice(-coverCount);
  const isPartial = coverCount > 0 && coverCount < missedDates.length;
  const canUse = !loading && missedDates.length > 0 && freezes >= 1;

  async function useFreeze() {
    if (!canUse) return { error: new Error('nothing_to_cover') };
    setUsing(true);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const { error } = await useFreezeForDates(datesToUse, todayStr);
    setUsing(false);
    if (!error) notifyChanged();
    return { error };
  }

  return { missedDates, freezes, loading, coverCount, isPartial, canUse, using, useFreeze };
}
