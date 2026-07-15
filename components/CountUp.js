import { useEffect, useState } from 'react';
import { Text, AccessibilityInfo } from 'react-native';

// A number that counts up from 0 to `value` on mount — for the aha-stat screen.
// ANIMATE-FIRST, snap-on-reduce (same reasoning as OnboardingReveal): the count
// starts immediately on mount rather than waiting for isReduceMotionEnabled()
// to resolve — a slow native check would otherwise leave the number stuck at 0
// for a second or two. If reduce-motion resolves true, jump to the final value.
// rAF-driven; app code, so requestAnimationFrame's timestamp is available.
export default function CountUp({ value, duration = 1100, style, format = (n) => String(n) }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf;
    let start = null;
    let cancelled = false;

    const tick = (t) => {
      if (cancelled) return;
      if (start === null) start = t;
      const progress = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplay(Math.round(value * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // If reduce-motion is on, stop counting and show the final value.
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (cancelled || !reduce) return;
        if (raf) cancelAnimationFrame(raf);
        setDisplay(value);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return <Text style={style}>{format(display)}</Text>;
}
