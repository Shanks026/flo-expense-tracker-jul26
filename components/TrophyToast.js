import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from './Toast';
import { useAuth } from '../lib/AuthContext';
import { useRewardBurst } from './RewardBurst';
import useTrophies from '../hooks/useTrophies';

// Keyed BY USER, same standing rule as StreakCelebration's own celebrated-today
// flag (00-index.md): a bare device-wide key would let account A's earned set
// suppress account B's very first achievement toast.
const storageKey = (userId) => `flo.trophies.announced.${userId}`;

// Root-mounted sibling of <Stack>, same shape as StreakCelebration /
// RankUpCelebration. Trophies previously became earned in total silence — the
// only trace was the header dot and the Trophy Room itself, so the moment an
// achievement actually landed was never surfaced. This announces it.
//
// A toast, not a takeover, deliberately: streak milestones already own the
// full-screen celebration, and trophies can land in batches (logging one
// transaction can cross two tiers at once). Stacking modals for those would
// be a lot of ceremony for something the Trophy Room already records.
export default function TrophyToast() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { showToast } = useToast();
  const { isBursting } = useRewardBurst();
  const { trophies, loading } = useTrophies();

  // The set of trophy ids already announced to THIS user. Held in a ref, not
  // state: it's written from inside the effect below, and putting it in state
  // would re-run that effect on every write.
  const announcedRef = useRef(null);
  const loadedForRef = useRef(null);

  // Reload the announced set whenever the signed-in user changes — and reset
  // it to null first so a stale set from the previous account can never gate
  // the new one's toasts.
  useEffect(() => {
    if (!userId) {
      announcedRef.current = null;
      loadedForRef.current = null;
      return;
    }
    let cancelled = false;
    announcedRef.current = null;
    AsyncStorage.getItem(storageKey(userId))
      .catch(() => null)
      .then((raw) => {
        if (cancelled) return;
        announcedRef.current = raw ? new Set(JSON.parse(raw)) : null;
        // null (no stored key) vs an empty Set are DIFFERENT here — see the
        // baseline branch in the effect below. `loadedFor` is what says "the
        // read finished", so a genuinely-absent key isn't mistaken for one
        // that just hasn't loaded yet.
        loadedForRef.current = userId;
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || loading) return;
    // Wait for the AsyncStorage read to finish for THIS user, or the first
    // pass would see an empty announced set and toast every trophy the user
    // has ever earned.
    if (loadedForRef.current !== userId) return;
    // Same deferral StreakCelebration uses: RewardBurst's overlay is animating
    // over the screen, so a toast fired now competes with it. The effect
    // re-evaluates once this flips false and the toast lands right after.
    if (isBursting) return;

    const earnedIds = trophies.filter((t) => t.earned).map((t) => t.id);

    // FIRST RUN for this user — establish a baseline silently. Everything
    // already earned is treated as "announced" without toasting, so
    // installing this doesn't greet an existing user with a burst of toasts
    // for achievements they earned weeks ago. Only what's earned AFTER this
    // point is announced.
    if (announcedRef.current === null) {
      announcedRef.current = new Set(earnedIds);
      AsyncStorage.setItem(storageKey(userId), JSON.stringify(earnedIds)).catch(() => {});
      return;
    }

    const fresh = trophies.filter((t) => t.earned && !announcedRef.current.has(t.id));
    if (!fresh.length) return;

    // Persist BEFORE showing, so a crash or a fast unmount mid-toast can't
    // replay the same achievement on next launch.
    const next = new Set([...announcedRef.current, ...earnedIds]);
    announcedRef.current = next;
    AsyncStorage.setItem(storageKey(userId), JSON.stringify([...next])).catch(() => {});

    // One toast per achievement up to two, then a single summary line —
    // crossing several tiers at once (possible: one transaction can complete
    // two tiers of the same group) shouldn't bury the screen in toasts.
    // ToastProvider itself also caps how many render at once.
    if (fresh.length <= 2) {
      for (const t of fresh) {
        showToast({
          message: `${t.name} — ${t.label} unlocked`,
          variant: 'success',
        });
      }
    } else {
      showToast({ message: `${fresh.length} new achievements unlocked`, variant: 'success' });
    }
  }, [userId, loading, trophies, isBursting, showToast]);

  return null;
}
