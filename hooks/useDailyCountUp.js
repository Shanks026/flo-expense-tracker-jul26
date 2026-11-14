import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dateGroupKey } from '../lib/dateLabels';

// Home's balance counts up from 0 only on the first Home load of the local
// day (spec 46, ticket 08), gated by the last count-up date on the device.
// Reduce motion skips it.
//
// The decision is made on mount, before the balance arrives, so the screen
// never paints the final number and then drops to 0: while `pending` the
// caller keeps its skeleton up, and once it's animating the value starts at
// 0. The day is only used up when the count actually starts, so a Home that
// unmounts or never loads keeps it. Returns { pending, value }.
const KEY = 'flo.balanceCountUpDay';
const DURATION = 900;

export default function useDailyCountUp(target, ready) {
  const [mode, setMode] = useState('pending'); // 'pending' | 'animate' | 'static'
  const [shown, setShown] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let last = null;
      let reduce = false;
      try {
        [last, reduce] = await Promise.all([AsyncStorage.getItem(KEY), AccessibilityInfo.isReduceMotionEnabled()]);
      } catch {
        // Storage or the a11y check failing just means no animation.
        reduce = true;
      }
      if (cancelled) return;
      setMode(last === dateGroupKey(new Date()) || reduce ? 'static' : 'animate');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== 'animate' || !ready || started.current) return undefined;
    started.current = true;
    AsyncStorage.setItem(KEY, dateGroupKey(new Date())).catch(() => {});
    let raf;
    let start = null;
    const tick = (t) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / DURATION);
      if (p < 1) {
        // Whole rupees while moving.
        setShown(Math.round(target * (1 - Math.pow(1 - p, 3))));
        raf = requestAnimationFrame(tick);
      } else {
        setMode('static');
      }
    };
    raf = requestAnimationFrame(tick);
    // Cut short (a refetch flips `ready`, or Home unmounts): settle on the
    // real balance rather than freezing mid-count.
    return () => {
      if (raf) cancelAnimationFrame(raf);
      setMode('static');
    };
    // The count runs once, toward the balance as it was when it started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ready]);

  // Animating shows the moving count (from 0); otherwise the exact balance.
  return { pending: mode === 'pending', value: mode === 'animate' ? shown : target };
}
