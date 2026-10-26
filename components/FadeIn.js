import { useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { motion } from '../theme/tokens';

// Content no longer fades in on every load (37-design-system-and-koban.md):
// once data is ready it simply appears, which reads as faster. FadeIn stays as
// the one wrapper for the rare first-time moment that should ease in — pass
// `animate` for that. Without it this is a plain View, so the many load-time
// call sites keep their layout and just stop animating.
export default function FadeIn({ style, children, animate = false }) {
  if (!animate) return <View style={style}>{children}</View>;
  return <AnimatedFadeIn style={style}>{children}</AnimatedFadeIn>;
}

function AnimatedFadeIn({ style, children }) {
  const p = useSharedValue(0);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    p.value = withTiming(1, { duration: motion.base });
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
