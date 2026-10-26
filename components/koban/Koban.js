import { useEffect, useId } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Ellipse, Circle, G, Defs, ClipPath } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { VIEWBOX, PALETTE, SHAPES, ARMS, STRIPES, WHISKERS, EYES, WIDTHS, JOINTS } from './art';

// Koban, FLO's ginger tabby (37-design-system-and-koban.md). One component for
// every placement, so he's the same character everywhere. The drawing itself
// is placeholder art in ./art.js (the person will swap in their own
// illustrations); this file only stacks and moves it.
//
//   size     width in dp (height follows the art's aspect ratio)
//   mood     expression — only 'neutral' so far (ticket 09 adds the rest)
//   pose     body — only 'idle' so far (ticket 10 adds the movement library)
//   loop     false = a still Koban
//   scarf    the optional lime zigzag scarf
//   surface  'light' | 'dark' — what he stands on (the ground shadow adapts)
//
// Each moving part is its own small Svg inside an Animated.View the size of
// the whole drawing, animated only by transform around its joint, so motion
// stays on the UI thread. Reduced motion (or loop={false}) makes him still.
// Placement rule: character moments only, never on a money figure.

const MOODS = ['neutral'];
const POSES = ['idle'];
const EASE = Easing.bezier(0.45, 0, 0.55, 1);

export default function Koban({
  size = 120,
  mood = 'neutral',
  pose = 'idle',
  loop = true,
  scarf = false,
  surface = 'light',
  accessibilityLabel,
  style,
}) {
  if (__DEV__ && (!MOODS.includes(mood) || !POSES.includes(pose))) {
    console.warn(`Koban: mood "${mood}" / pose "${pose}" isn't drawn yet; showing neutral idle.`);
  }
  const width = size;
  const height = (size * VIEWBOX.h) / VIEWBOX.w;
  const scale = size / VIEWBOX.w;
  const origin = ([x, y]) => [(x - VIEWBOX.x) * scale, (y - VIEWBOX.y) * scale, 0];
  const clipId = `koban-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const reduceMotion = useReducedMotion();
  const animate = loop && !reduceMotion;

  const breath = useSharedValue(0);
  const head = useSharedValue(0.5);
  const tail = useSharedValue(0.5);
  const blink = useSharedValue(1);
  const earL = useSharedValue(0);
  const earR = useSharedValue(0);

  useEffect(() => {
    const all = [breath, head, tail, blink, earL, earR];
    if (!animate) {
      all.forEach(cancelAnimation);
      breath.value = 0;
      head.value = 0.5;
      tail.value = 0.5;
      blink.value = 1;
      earL.value = 0;
      earR.value = 0;
      return undefined;
    }
    breath.value = withRepeat(withTiming(1, { duration: 1800, easing: EASE }), -1, true);
    head.value = withRepeat(withTiming(1, { duration: 2800, easing: EASE }), -1, true);
    tail.value = withRepeat(withTiming(1, { duration: 1600, easing: EASE }), -1, true);
    blink.value = withRepeat(
      withSequence(withDelay(4300, withTiming(0.1, { duration: 110 })), withTiming(1, { duration: 140 })),
      -1
    );
    const twitch = (delay) =>
      withRepeat(
        withSequence(
          withDelay(delay, withTiming(-12, { duration: 150 })),
          withTiming(5, { duration: 150 }),
          withTiming(0, { duration: 150 })
        ),
        -1
      );
    earL.value = twitch(5200);
    earR.value = twitch(3100);
    return () => all.forEach(cancelAnimation);
  }, [animate]);

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 + 0.012 * breath.value }, { scaleY: 1 + 0.022 * breath.value }],
  }));
  const headStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-3 + 6 * head.value}deg` }] }));
  const tailStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-7 + 15 * tail.value}deg` }] }));
  const eyesStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));
  const earLStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${earL.value}deg` }] }));
  const earRStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${earR.value}deg` }] }));

  const layer = (children, animatedStyle, joint) => (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, joint && { transformOrigin: origin(joint) }, animatedStyle]}
    >
      <Svg width={width} height={height} viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}`}>
        {children}
      </Svg>
    </Animated.View>
  );

  const arms = ARMS.idle;
  const tube = (d, color, w, end) => (
    <G>
      <Path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      {end ? <Circle cx={end[0]} cy={end[1]} r={w * 0.6} fill={color} /> : null}
    </G>
  );
  const start = (d) => d.match(/-?\d+(\.\d+)?/g).slice(0, 2).map(Number);

  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'image', accessibilityLabel }
    : { accessible: false, importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true };

  return (
    <View style={[{ width, height }, style]} {...a11y}>
      {layer(<Ellipse cx={150} cy={303} rx={56} ry={7} fill={surface === 'dark' ? PALETTE.shadowDark : PALETTE.shadowLight} />)}

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transformOrigin: origin(JOINTS.body) }, breathStyle]}>
        {layer(tube(SHAPES.tail, PALETTE.fur, WIDTHS.tail), tailStyle, JOINTS.tail)}

        {layer(
          <>
            <Defs>
              <ClipPath id={clipId}>
                <Path d={SHAPES.torso} />
                <Path d={SHAPES.head} />
              </ClipPath>
            </Defs>
            {tube(SHAPES.legL, PALETTE.fur, WIDTHS.leg)}
            {tube(SHAPES.legR, PALETTE.fur, WIDTHS.leg)}
            <Ellipse cx={133} cy={296} rx={15} ry={8} fill={PALETTE.fur} />
            <Ellipse cx={167} cy={296} rx={15} ry={8} fill={PALETTE.fur} />
            <Path d={SHAPES.torso} fill={PALETTE.fur} />
            <Ellipse cx={150} cy={238} rx={21} ry={27} fill={PALETTE.cream} />
            <Path
              d="M128 299 L128 294 M138 299 L138 294 M162 299 L162 294 M172 299 L172 294"
              stroke={PALETTE.crease}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
            {/* Creases: the arms again in the crease colour, a touch wider,
                clipped to the body, with a fur disc over each shoulder — so a
                thin line shows only where an arm crosses the torso. */}
            <G clipPath={`url(#${clipId})`}>
              {tube(arms.left.d, PALETTE.crease, WIDTHS.arm + 3, arms.left.end)}
              {tube(arms.right.d, PALETTE.crease, WIDTHS.arm + 3, arms.right.end)}
              <Circle cx={start(arms.left.d)[0]} cy={start(arms.left.d)[1] + 3} r={WIDTHS.arm * 0.95} fill={PALETTE.fur} />
              <Circle cx={start(arms.right.d)[0]} cy={start(arms.right.d)[1] + 3} r={WIDTHS.arm * 0.95} fill={PALETTE.fur} />
            </G>
            {tube(arms.left.d, PALETTE.fur, WIDTHS.arm, arms.left.end)}
            {tube(arms.right.d, PALETTE.fur, WIDTHS.arm, arms.right.end)}
            {/* The scarf goes over the shoulders, under the chin. */}
            {scarf ? (
              <>
                <Path d={SHAPES.scarf} fill={PALETTE.lime} />
                <Path d={SHAPES.scarfZigzag} stroke={PALETTE.limeDeep} strokeWidth={2.4} fill="none" strokeLinejoin="round" />
                <Path d={SHAPES.scarfTail} fill={PALETTE.lime} />
              </>
            ) : null}
          </>
        )}

        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transformOrigin: origin(JOINTS.head) }, headStyle]}>
          {layer(<Path d={SHAPES.earL} fill={PALETTE.fur} />, earLStyle, JOINTS.earL)}
          {layer(<Path d={SHAPES.earR} fill={PALETTE.fur} />, earRStyle, JOINTS.earR)}
          {layer(<Path d={SHAPES.head} fill={PALETTE.fur} />)}
          {/* Inner ears sit over the head's edge, so they're their own layers
              turning with the outer ears. */}
          {layer(<Path d={SHAPES.innerEarL} fill={PALETTE.innerEar} />, earLStyle, JOINTS.earL)}
          {layer(<Path d={SHAPES.innerEarR} fill={PALETTE.innerEar} />, earRStyle, JOINTS.earR)}
          {layer(
            <>
              <Path d={SHAPES.muzzle} fill={PALETTE.cream} />
              {STRIPES.map((s) => (
                <Path key={s.d} d={s.d} stroke={PALETTE.stripe} strokeWidth={s.w} strokeLinecap="round" fill="none" />
              ))}
              <Ellipse cx={99} cy={152} rx={11} ry={6.5} fill={PALETTE.blush} />
              <Ellipse cx={201} cy={152} rx={11} ry={6.5} fill={PALETTE.blush} />
              <Path d={SHAPES.nose} fill={PALETTE.nose} />
              <G stroke={PALETTE.whisker} strokeWidth={1.6} strokeLinecap="round" fill="none">
                {WHISKERS.map((d) => (
                  <Path key={d} d={d} />
                ))}
              </G>
            </>
          )}
          {layer(
            <>
              {EYES.xs.map((x) => (
                <G key={x}>
                  <Ellipse cx={x} cy={EYES.y} rx={18} ry={21} fill={PALETTE.eyeWhite} />
                  <Ellipse cx={x + 1} cy={EYES.y + 1} rx={13} ry={15} fill={PALETTE.iris} />
                  <Ellipse cx={x + 1} cy={EYES.y + 2} rx={8.5} ry={10.5} fill={PALETTE.pupil} />
                  <Circle cx={x + 6} cy={EYES.y - 6} r={4.6} fill="#FFFFFF" />
                  <Circle cx={x - 4} cy={EYES.y + 9} r={2} fill="#FFFFFF" />
                </G>
              ))}
            </>,
            eyesStyle,
            JOINTS.eyes
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}
