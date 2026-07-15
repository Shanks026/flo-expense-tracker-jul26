import { useEffect, useState, Children } from 'react';
import { View, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

// The "flawless landing page" entrance: each direct child pops in, staggered by
// index. Built on react-native-reanimated (already in the bundle via
// @gorhom/bottom-sheet — same as components/Confetti.js), so no new dependency.
//
// Spring-based, not a linear/eased withTiming — a fixed-duration ease reads as
// mechanical when several items stagger in sequence; a spring gives each one a
// touch of overshoot-then-settle, which is what actually reads as "smooth" /
// "popping" rather than a slideshow advancing.
//
// Reduce-motion handling is ANIMATE-FIRST, snap-on-reduce — NOT "wait for the
// check, then decide". The earlier version held every item invisible until the
// async isReduceMotionEnabled() promise resolved; on some Android devices that
// native call takes a second or two to come back, which left the content (most
// visibly the reflection screen's falling cards) blank for ~2s before anything
// appeared. So instead: start the entrance immediately on mount, and if the OS
// later reports reduce-motion ON, snap straight to the final frame. Content is
// never hidden waiting on the bridge; a reduce-motion user at worst sees the
// gentle entrance cut short the instant the value arrives.
const SPRING = { damping: 15, stiffness: 160, mass: 0.7 };

function RevealItem({ children, delay, reduce }) {
  const p = useSharedValue(0);

  // Animate on mount, unconditionally — do not gate on `reduce`.
  useEffect(() => {
    p.value = withDelay(delay, withSpring(1, SPRING));
  }, []);

  // If reduce-motion resolves true, cut to the final frame (a raw assignment
  // cancels any in-flight spring and jumps).
  useEffect(() => {
    if (reduce) p.value = 1;
  }, [reduce]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value), // spring can overshoot slightly past 1 — clamp opacity only
    transform: [{ translateY: (1 - p.value) * 18 }, { scale: 0.92 + p.value * 0.08 }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

export default function OnboardingReveal({ children, delay = 0, stagger = 70, style }) {
  const [reduce, setReduce] = useState(false); // assume motion; correct to true only if the OS says so

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => active && enabled && setReduce(true))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const items = Children.toArray(children);

  return (
    <View style={style}>
      {items.map((child, i) => (
        <RevealItem key={i} delay={delay + i * stagger} reduce={reduce}>
          {child}
        </RevealItem>
      ))}
    </View>
  );
}
