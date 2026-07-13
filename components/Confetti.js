import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { colors, radii } from '../theme/tokens';
import { CATEGORY_COLORS } from './CategoryIcon';

// The design's @keyframes flo-confetti (fall + spin + fade), ported to
// Reanimated — which this project already depends on via @gorhom/bottom-sheet,
// so no new dependency. Fires once on mount and stops: it's a celebration,
// not a background animation, and a looping one on the last onboarding screen
// would just be noise behind the button the user is trying to press.
const PIECE_COUNT = 40;
const FALL_MS = [1600, 2600]; // per-piece duration range
const STAGGER_MS = 900; // pieces don't all start at once
const START_ABOVE = 40; // spawn above the top edge, not on it

// Brand lime plus the brighter half of the shared category palette. The dark
// swatches (charcoal, slate, navy, forest) read as dirt rather than confetti
// against a white screen, so they sit this one out.
const CONFETTI_COLORS = [
  colors.brand,
  CATEGORY_COLORS[2], // amber
  CATEGORY_COLORS[3], // coral
  CATEGORY_COLORS[4], // teal
  CATEGORY_COLORS[5], // plum
  CATEGORY_COLORS[7], // rose
  CATEGORY_COLORS[10], // blue
];

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function Piece({ piece, fallTo }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      piece.delay,
      withTiming(1, { duration: piece.duration, easing: Easing.linear })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [-START_ABOVE, fallTo]) },
      { translateX: interpolate(progress.value, [0, 1], [0, piece.drift]) },
      { rotate: `${interpolate(progress.value, [0, 1], [0, piece.spin])}deg` },
    ],
    // Fade in fast, hold, fade out at the tail — matches the design's
    // 0% / 12% / 100% opacity stops.
    opacity: interpolate(progress.value, [0, 0.12, 0.82, 1], [0, 1, 1, 0]),
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: piece.x,
          width: piece.width,
          height: piece.height,
          borderRadius: piece.round ? radii.pill : 2,
          backgroundColor: piece.color,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function Confetti() {
  const { width, height } = useWindowDimensions();
  // Someone who has asked the OS for less motion should not be handed forty
  // spinning rectangles. Render nothing at all in that case.
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduceMotion(enabled);
      })
      .catch(() => {
        if (active) setReduceMotion(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const pieces = useMemo(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, i) => {
        const round = Math.random() < 0.3;
        const size = rand(7, 13);
        return {
          key: i,
          x: rand(0, width - size),
          width: size,
          height: round ? size : size * rand(1.4, 2.2),
          round,
          color: pick(CONFETTI_COLORS),
          delay: rand(0, STAGGER_MS),
          duration: rand(FALL_MS[0], FALL_MS[1]),
          drift: rand(-50, 50),
          spin: rand(360, 900) * (Math.random() < 0.5 ? -1 : 1),
        };
      }),
    [width]
  );

  if (reduceMotion) return null;

  return (
    // pointerEvents="none" is load-bearing, not defensive: this sits on top of
    // the whole screen, including the primary button.
    <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((piece) => (
        <Piece key={piece.key} piece={piece} fallTo={height + START_ABOVE} />
      ))}
    </Animated.View>
  );
}
