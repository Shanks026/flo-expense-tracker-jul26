import { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  interpolateColor,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';

// Text with a light band sweeping across it, left to right, on a loop: the
// "thinking" shimmer AI chats use (44-ai-assistant.md, Ask FLO). Each letter
// is its own Animated.Text whose colour follows one shared clock, so there's
// no gradient or mask library. Meant for one short line. Under reduce-motion
// it's plain text in the base colour.
const BAND = 5; // letters either side of the band's centre that it lights

export default function ShimmerText({ text, style, baseColor, highlightColor, duration = 1500 }) {
  const reduce = useReducedMotion();
  const clock = useSharedValue(0);
  const chars = useMemo(() => Array.from(text), [text]);

  useEffect(() => {
    if (reduce) return undefined;
    clock.value = 0;
    clock.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }), -1, false);
    return () => cancelAnimation(clock);
  }, [reduce, duration, text]);

  if (reduce) {
    return <Animated.Text style={[style, { color: baseColor }]}>{text}</Animated.Text>;
  }

  return (
    <View style={styles.row} accessible accessibilityLabel={text}>
      {chars.map((char, i) => (
        <ShimmerChar
          key={`${i}-${char}`}
          char={char}
          index={i}
          count={chars.length}
          clock={clock}
          style={style}
          baseColor={baseColor}
          highlightColor={highlightColor}
        />
      ))}
    </View>
  );
}

function ShimmerChar({ char, index, count, clock, style, baseColor, highlightColor }) {
  const animated = useAnimatedStyle(() => {
    // The band travels from before the first letter to past the last one.
    const centre = clock.value * (count + BAND * 2) - BAND;
    const lit = Math.max(0, 1 - Math.abs(index - centre) / BAND);
    return { color: interpolateColor(lit, [0, 1], [baseColor, highlightColor]) };
  });
  return (
    <Animated.Text style={[style, animated]} importantForAccessibility="no">
      {char}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
