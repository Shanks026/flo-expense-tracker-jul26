import { useEffect, useRef } from 'react';
import useStreak from '../hooks/useStreak';
import { useAuth } from '../lib/AuthContext';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { applyFreezePlan } from '../lib/streakMarks';
import { track } from '../lib/track';
import { useToast } from './Toast';

// Headless: spends and earns streak freezes automatically (34-streak-only.md).
// useStreak works out the plan (lib/streak.js's planFreezes); this writes it,
// refreshes, and says "We saved your streak" when a missed day was covered.
// Replaces FreezePrompt — there's nothing left to ask. Mounted once, as a
// sibling of <Stack> in app/_layout.js, so the plan is applied by one owner
// rather than by every screen that reads the streak.
export default function StreakFreezeSync() {
  const { session } = useAuth();
  const { freezePlan, loading } = useStreak();
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();
  // The plan last written, so a re-render with the same plan (before the
  // refetch lands) doesn't write it again.
  const appliedRef = useRef(null);

  useEffect(() => {
    if (!session || loading) return;
    if (!freezePlan.toUse.length && !freezePlan.toEarn.length) return;
    const key = JSON.stringify(freezePlan);
    if (appliedRef.current === key) return;
    appliedRef.current = key;
    (async () => {
      const { error, saved } = await applyFreezePlan(freezePlan);
      if (error) {
        appliedRef.current = null; // try again on the next refresh
        return;
      }
      for (let i = 0; i < saved; i++) track('freeze_used');
      if (saved > 0) showToast({ message: 'We saved your streak', variant: 'success' });
      notifyChanged();
    })();
  }, [session, loading, freezePlan]);

  return null;
}
