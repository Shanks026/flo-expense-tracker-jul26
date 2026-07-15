import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

// A gentle, ONE-TIME cross-fade for content that just finished loading —
// mount this in place of a Skeleton once real data arrives, and it fades in
// (240ms, small 6px rise, no bounce/spring) rather than popping in instantly.
//
// Deliberately restrained compared to onboarding's OnboardingReveal: this is
// the main app, seen dozens of times a day, not a first-run flourish — quick
// and quiet, not playful. Animate-first, snap-on-reduce (same fix already
// applied to OnboardingReveal/CountUp after the reflection-screen lag bug):
// starts fading immediately on mount rather than waiting on the async
// reduce-motion check, and only snaps to the final frame if that check later
// resolves true.
export default function FadeIn({ style, children }) {
  const p = useSharedValue(0);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    p.value = withTiming(1, { duration: 240 });
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => enabled && setReduce(true))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (reduce) p.value = 1;
  }, [reduce]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * 6 }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
