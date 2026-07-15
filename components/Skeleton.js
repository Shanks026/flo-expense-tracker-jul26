import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { colors, radii } from '../theme/tokens';

// A neutral placeholder block for content that hasn't loaded yet — replacing
// what would otherwise flash on screen: a real hook's default/empty value
// (₹0 balances, "no transactions yet") rendering as if it were the genuine
// answer, then popping to the real one a beat later. A slow opacity breathe
// signals "this is loading", not "this is broken" or "this is really empty" —
// skipped under reduce-motion (a static block instead of a pulse).
export default function Skeleton({ width = '100%', height = 16, radius = radii.iconTile, style }) {
  const p = useSharedValue(0.5);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => enabled && setReduce(true))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (reduce) return;
    p.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [reduce]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: p.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.chipBg },
        reduce ? { opacity: 0.6 } : animatedStyle,
        style,
      ]}
    />
  );
}
