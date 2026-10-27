import { memo, useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  cancelAnimation,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { CARD_SCENES, SCENE_W, SCENE_H } from '../lib/cardScenes';

// An illustrated card scene that moves once, then settles
// (43-themes-back-unlocked.md, Phase 1b). The scene is a stack of SVG layers
// from lib/cardScenes.js, all drawn full-card in the same 360×180 space; each
// layer with a `motion` sits in its own Animated.View, so Reanimated fades,
// scales or swings it on the UI thread. react-native-svg can't animate parts
// inside one SvgXml, which is why the scene is layered.
//
// WCAG: every motion runs a fixed number of times and is over within about
// 5 seconds (2.2.2), the bulbs change well under 3 times a second (2.3.1),
// and with Reduce motion on nothing moves and no snow falls. Each layer's
// resting value is its finished frame, so a scene that never plays looks
// complete.
//
// It plays each time its screen comes into focus: Home on every return to the
// tab, the Personalize preview when it opens. Each play is a fresh ~5
// seconds, so it never runs continuously.
export default function AnimatedCardScene({ sceneId }) {
  const scene = CARD_SCENES[sceneId];
  const reduceMotion = useReducedMotion();
  const [frame, setFrame] = useState(null);
  // Bumped on every focus; each value is one play.
  const [run, setRun] = useState(0);
  useFocusEffect(useCallback(() => setRun((r) => r + 1), []));

  if (!scene) return null;

  // How the 360×180 scene maps onto the card: "xMidYMid slice" scales it to
  // cover and centres it, so a scene point (x, y) lands at
  // (ox + x·s, oy + y·s) in the card's own pixels.
  function onLayout(e) {
    const { width, height } = e.nativeEvent.layout;
    const s = Math.max(width / SCENE_W, height / SCENE_H);
    setFrame({ s, ox: (width - SCENE_W * s) / 2, oy: (height - SCENE_H * s) / 2 });
  }

  const play = !reduceMotion && frame !== null && run > 0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {scene.layers.map((layer) =>
        layer.motion ? (
          <MotionLayer key={layer.id} layer={layer} frame={frame} play={play} run={run} />
        ) : (
          <StaticLayer key={layer.id} xml={layer.xml} />
        )
      )}
      {play &&
        scene.flakes.map((flake, i) => (
          // Keyed by the play, so each focus drops a fresh snowfall.
          <Flake key={`${run}-${i}`} flake={flake} frame={frame} textAreas={scene.textAreas} />
        ))}
    </View>
  );
}

const StaticLayer = memo(function StaticLayer({ xml }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <SvgXml xml={xml} width="100%" height="100%" />
    </View>
  );
});

function MotionLayer({ layer, frame, play, run }) {
  const { motion } = layer;
  // 0 is the resting, finished frame for every motion type.
  const t = useSharedValue(0);

  useEffect(() => {
    // A replay starts from the resting frame, even if a play was cut short.
    cancelAnimation(t);
    t.value = 0;
    if (!play) return;
    const half = motion.period / 2;
    const ease = Easing.inOut(Easing.sin);
    let cycle;
    if (motion.type === 'swing') {
      // rest → one side → the other side → rest
      cycle = withSequence(
        withTiming(-1, { duration: motion.period / 4, easing: ease }),
        withTiming(1, { duration: half, easing: ease }),
        withTiming(0, { duration: motion.period / 4, easing: ease })
      );
    } else {
      cycle = withSequence(withTiming(1, { duration: half, easing: ease }), withTiming(0, { duration: half, easing: ease }));
    }
    t.value = withDelay(motion.delay ?? 0, withRepeat(cycle, motion.reps, false));
  }, [play, run]);

  const origin = motion.origin && frame ? [frame.ox + motion.origin[0] * frame.s, frame.oy + motion.origin[1] * frame.s, 0] : undefined;

  const animatedStyle = useAnimatedStyle(() => {
    if (motion.type === 'pulse') return { opacity: motion.from + (motion.to - motion.from) * t.value };
    if (motion.type === 'scale') return { transform: [{ scale: 1 + (motion.to - 1) * t.value }] };
    return { transform: [{ rotate: `${motion.angle * t.value}deg` }] };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, origin && { transformOrigin: origin }, animatedStyle]}>
      <SvgXml xml={layer.xml} width="100%" height="100%" />
    </Animated.View>
  );
}

// Fades a flake out over Home's text: 1 well clear of every text area, 0
// inside one, with a soft edge of FEATHER scene units.
const FEATHER = 5;
function clearOfText(x, y, areas) {
  'worklet';
  let factor = 1;
  for (let i = 0; i < areas.length; i++) {
    const a = areas[i];
    const dx = Math.max(a.x - x, 0, x - (a.x + a.w));
    const dy = Math.max(a.y - y, 0, y - (a.y + a.h));
    const d = Math.sqrt(dx * dx + dy * dy);
    factor = Math.min(factor, Math.min(d / FEATHER, 1));
  }
  return factor;
}

function Flake({ flake, frame, textAreas }) {
  // Progress down the card: 0 just above it, 1 just below. A negative delay
  // starts the flake partway down, so the card is snowy from the first frame.
  const start = Math.min(Math.max(-flake.delay / flake.duration, 0), 1);
  const p = useSharedValue(start);

  useEffect(() => {
    const run = withTiming(1, { duration: flake.duration * (1 - start), easing: Easing.linear });
    p.value = flake.delay > 0 ? withDelay(flake.delay, run) : run;
  }, []);

  const size = flake.r * 2 * frame.s;
  const animatedStyle = useAnimatedStyle(() => {
    const x = flake.x + flake.dx * p.value;
    const y = -20 + (SCENE_H + 45) * p.value;
    return {
      opacity: 0.85 * clearOfText(x, y, textAreas),
      transform: [
        { translateX: frame.ox + x * frame.s - size / 2 },
        { translateY: frame.oy + y * frame.s - size / 2 },
      ],
    };
  });

  return <Animated.View style={[styles.flake, { width: size, height: size, borderRadius: size / 2 }, animatedStyle]} />;
}

const styles = StyleSheet.create({
  flake: {
    position: 'absolute',
    left: 0,
    top: 0,
    // Snow is white on every scene; it isn't a theme colour.
    backgroundColor: '#FFFFFF',
  },
});
