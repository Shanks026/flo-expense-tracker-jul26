import { useEffect, useId, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Ellipse, Circle, G, Defs, ClipPath } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { VIEWBOX, PALETTE, SHAPES, WIDTHS, JOINTS } from './art';
import { MOODS, FaceFeatures, OpenEyes } from './faces';
import { POSES, ARM_SHAPES, ArmExtras, HeldProp, FaceProp, Overlay, Bubble } from './poses';

// Koban, FLO's ginger tabby (37-design-system-and-koban.md). One component for
// every placement, so he's the same character everywhere. The drawing is
// placeholder art in ./art.js, ./faces.js and ./poses.js (the person will
// swap in their own animated illustrations); this file only stacks and moves
// it.
//
//   size      width in dp (height follows the art's aspect ratio)
//   mood      expression: neutral, happy, joy, wink, surprised, curious,
//             focus, content, worried, sleepy (./faces.js)
//   pose      body: idle, hello, jump, walk, hmm, shrug, dance, niceOne,
//             report, notepad, magnifier, tip (./poses.js)
//   loop      true (default) repeats the pose; false plays it once and
//             settles into idle
//   animated  false = a completely still Koban (the pose's key frame)
//   scarf     the optional lime zigzag scarf
//   surface   'light' | 'dark' — what he stands on (the ground shadow adapts)
//
// Every moving part is its own small Svg inside an Animated.View the size of
// the whole drawing, moved only by transforms around its joint, so motion
// stays on the UI thread. One clock drives the pose's keyframe channels; the
// idle life (breathing, blink, tail sway, head tilt, ear twitch) runs
// underneath. Reduced motion makes him still. Placement rule: character
// moments only, never on a money figure.

const EASE = Easing.bezier(0.45, 0, 0.55, 1);
const CHANNELS = ['body', 'head', 'armL', 'armR', 'legL', 'legR', 'tail', 'bubble'];
const PROPS = ['translateY', 'rotate', 'scaleX', 'scaleY'];

// Pose keyframes → plain arrays the UI thread can interpolate. translateY is
// converted from drawing units to dp here.
function compileChannels(channels, scale) {
  const out = {};
  for (const name of CHANNELS) {
    const ch = channels?.[name];
    if (!ch) continue;
    out[name] = {
      offset: ch.offset ?? 0,
      origin: ch.origin,
      props: PROPS.filter((p) => ch[p]).map((p) => ({
        name: p,
        input: ch[p].map((k) => k[0]),
        output: ch[p].map((k) => (p === 'translateY' ? k[1] * scale : k[1])),
      })),
    };
  }
  return out;
}

function channelTransform(ch, t) {
  'worklet';
  if (!ch) return [];
  const tt = ch.offset ? (t + ch.offset) % 1 : t;
  const transform = [];
  for (let i = 0; i < ch.props.length; i++) {
    const p = ch.props[i];
    const v = interpolate(tt, p.input, p.output);
    if (p.name === 'rotate') transform.push({ rotate: `${v}deg` });
    else if (p.name === 'translateY') transform.push({ translateY: v });
    else if (p.name === 'scaleX') transform.push({ scaleX: v });
    else transform.push({ scaleY: v });
  }
  return transform;
}

export default function Koban({
  size = 120,
  mood = 'neutral',
  pose = 'idle',
  loop = true,
  animated = true,
  scarf = false,
  surface = 'light',
  accessibilityLabel,
  style,
}) {
  if (__DEV__ && (!MOODS.includes(mood) || !POSES[pose])) {
    console.warn(`Koban: mood "${mood}" / pose "${pose}" isn't drawn; showing neutral / idle.`);
  }
  const shownMood = MOODS.includes(mood) ? mood : 'neutral';
  const requestedPose = POSES[pose] ? pose : 'idle';

  const width = size;
  const height = (size * VIEWBOX.h) / VIEWBOX.w;
  const scale = size / VIEWBOX.w;
  const origin = ([x, y]) => [(x - VIEWBOX.x) * scale, (y - VIEWBOX.y) * scale, 0];
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  const reduceMotion = useReducedMotion();
  const moving = animated && !reduceMotion;

  // A pose with loop={false} plays once, then settles into idle.
  const [settled, setSettled] = useState(false);
  useEffect(() => setSettled(false), [requestedPose, loop]);
  const poseName = !loop && settled ? 'idle' : requestedPose;
  const spec = POSES[poseName];
  const channels = useMemo(() => compileChannels(spec.channels, scale), [poseName, scale]);

  // --- the pose clock ---------------------------------------------------------
  const clock = useSharedValue(spec.still ?? 0);
  useEffect(() => {
    cancelAnimation(clock);
    if (!moving) {
      clock.value = spec.still ?? 0;
      return undefined;
    }
    clock.value = 0;
    const timing = withTiming(1, { duration: spec.duration, easing: Easing.linear });
    if (loop || poseName === 'idle') {
      clock.value = withRepeat(timing, -1, false);
      return () => cancelAnimation(clock);
    }
    clock.value = timing;
    const id = setTimeout(() => setSettled(true), spec.duration);
    return () => {
      clearTimeout(id);
      cancelAnimation(clock);
    };
  }, [poseName, moving, loop]);

  const bodyStyle = useAnimatedStyle(() => ({ transform: channelTransform(channels.body, clock.value) }));
  const headPoseStyle = useAnimatedStyle(() => ({ transform: channelTransform(channels.head, clock.value) }));
  const armLStyle = useAnimatedStyle(() => ({ transform: channelTransform(channels.armL, clock.value) }));
  const armRStyle = useAnimatedStyle(() => ({ transform: channelTransform(channels.armR, clock.value) }));
  const legLStyle = useAnimatedStyle(() => ({ transform: channelTransform(channels.legL, clock.value) }));
  const legRStyle = useAnimatedStyle(() => ({ transform: channelTransform(channels.legR, clock.value) }));
  const tailPoseStyle = useAnimatedStyle(() => ({ transform: channelTransform(channels.tail, clock.value) }));
  const bubbleStyle = useAnimatedStyle(() => ({ transform: channelTransform(channels.bubble, clock.value) }));

  // --- idle life, under every pose -------------------------------------------
  const breath = useSharedValue(0);
  const tilt = useSharedValue(0.5);
  const sway = useSharedValue(0.5);
  const blink = useSharedValue(1);
  const earL = useSharedValue(0);
  const earR = useSharedValue(0);

  useEffect(() => {
    const all = [breath, tilt, sway, blink, earL, earR];
    if (!moving) {
      all.forEach(cancelAnimation);
      breath.value = 0;
      tilt.value = 0.5;
      sway.value = 0.5;
      blink.value = 1;
      earL.value = 0;
      earR.value = 0;
      return undefined;
    }
    breath.value = withRepeat(withTiming(1, { duration: 1800, easing: EASE }), -1, true);
    tilt.value = withRepeat(withTiming(1, { duration: 2800, easing: EASE }), -1, true);
    sway.value = withRepeat(withTiming(1, { duration: 1600, easing: EASE }), -1, true);
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
  }, [moving]);

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 + 0.012 * breath.value }, { scaleY: 1 + 0.022 * breath.value }],
  }));
  const tiltStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-3 + 6 * tilt.value}deg` }] }));
  const swayStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-7 + 15 * sway.value}deg` }] }));
  const eyesStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));
  const earLStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${earL.value}deg` }] }));
  const earRStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${earR.value}deg` }] }));

  // --- mood crossfade (~200 ms; instant with reduced motion) -----------------
  const [faces, setFaces] = useState({ current: shownMood, previous: null });
  const faceFade = useSharedValue(1);
  useEffect(() => {
    if (shownMood === faces.current) return;
    setFaces({ current: shownMood, previous: faces.current });
    faceFade.value = 0;
    faceFade.value = reduceMotion ? 1 : withTiming(1, { duration: 200, easing: EASE });
  }, [shownMood]);
  const currentFaceStyle = useAnimatedStyle(() => ({ opacity: faceFade.value }));
  const previousFaceStyle = useAnimatedStyle(() => ({ opacity: 1 - faceFade.value }));

  // --- drawing helpers ----------------------------------------------------------
  const viewBox = `${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}`;
  const layer = (children, animatedStyle, joint) => (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, joint && { transformOrigin: origin(joint) }, animatedStyle]}>
      <Svg width={width} height={height} viewBox={viewBox}>
        {children}
      </Svg>
    </Animated.View>
  );
  // A wrapper that moves everything inside it (no drawing of its own).
  const group = (children, animatedStyle, joint) => (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, joint && { transformOrigin: origin(joint) }, animatedStyle]}>
      {children}
    </Animated.View>
  );
  const tube = (d, color, w, end) => (
    <G>
      <Path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      {end ? <Circle cx={end[0]} cy={end[1]} r={w * 0.6} fill={color} /> : null}
    </G>
  );
  const start = (d) => d.match(/-?\d+(\.\d+)?/g).slice(0, 2).map(Number);

  // One arm: its crease (the arm again in the crease colour, clipped to the
  // body and head, with a fur disc over the shoulder) under the fur arm, plus
  // anything the hand holds.
  const arm = (side) => {
    const shape = ARM_SHAPES[spec.arms[side === 'L' ? 0 : 1]];
    const [sx, sy] = start(shape.d);
    const id = `koban-${uid}-${side}`;
    return (
      <>
        <Defs>
          <ClipPath id={id}>
            <Path d={SHAPES.torso} />
            <Path d={SHAPES.head} />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${id})`}>
          {tube(shape.d, PALETTE.crease, WIDTHS.arm + 3, shape.end)}
          <Circle cx={sx} cy={sy + 3} r={WIDTHS.arm * 0.95} fill={PALETTE.fur} />
        </G>
        {tube(shape.d, PALETTE.fur, WIDTHS.arm, shape.end)}
        <ArmExtras pose={poseName} side={side} />
      </>
    );
  };
  const leg = (d, footX, toes) => (
    <>
      {tube(d, PALETTE.fur, WIDTHS.leg)}
      <Ellipse cx={footX} cy={296} rx={15} ry={8} fill={PALETTE.fur} />
      <Path d={toes} stroke={PALETTE.crease} strokeWidth={1.8} strokeLinecap="round" />
    </>
  );
  const face = (m) => (
    <>
      {layer(<FaceFeatures mood={m} />)}
      {layer(<OpenEyes mood={m} />, eyesStyle, JOINTS.eyes)}
    </>
  );

  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'image', accessibilityLabel }
    : { accessible: false, importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true };

  return (
    <View style={[{ width, height }, style]} {...a11y}>
      {layer(<Ellipse cx={150} cy={303} rx={56} ry={7} fill={surface === 'dark' ? PALETTE.shadowDark : PALETTE.shadowLight} />)}
      {layer(<Overlay pose={poseName} />)}
      {spec.bubble ? layer(<Bubble />, bubbleStyle, channels.bubble?.origin) : null}

      {group(
        group(
          <>
            {group(layer(tube(SHAPES.tail, PALETTE.fur, WIDTHS.tail), tailPoseStyle, channels.tail?.origin ?? JOINTS.tail), swayStyle, JOINTS.tail)}
            {layer(leg(SHAPES.legL, 133, 'M128 299 L128 294 M138 299 L138 294'), legLStyle, channels.legL?.origin)}
            {layer(leg(SHAPES.legR, 167, 'M162 299 L162 294 M172 299 L172 294'), legRStyle, channels.legR?.origin)}
            {layer(
              <>
                <Path d={SHAPES.torso} fill={PALETTE.fur} />
                <Ellipse cx={150} cy={238} rx={21} ry={27} fill={PALETTE.cream} />
              </>
            )}

            {group(
              group(
                <>
                  {layer(<Path d={SHAPES.earL} fill={PALETTE.fur} />, earLStyle, JOINTS.earL)}
                  {layer(<Path d={SHAPES.earR} fill={PALETTE.fur} />, earRStyle, JOINTS.earR)}
                  {layer(<Path d={SHAPES.head} fill={PALETTE.fur} />)}
                  {/* Inner ears sit over the head's edge, so they're their own
                      layers turning with the outer ears. */}
                  {layer(<Path d={SHAPES.innerEarL} fill={PALETTE.innerEar} />, earLStyle, JOINTS.earL)}
                  {layer(<Path d={SHAPES.innerEarR} fill={PALETTE.innerEar} />, earRStyle, JOINTS.earR)}
                  {/* The face: the one leaving fades out while the new one
                      fades in, so a mood change eases rather than snaps. */}
                  {faces.previous && faces.previous !== faces.current
                    ? group(face(faces.previous), previousFaceStyle)
                    : null}
                  {group(face(faces.current), currentFaceStyle)}
                  {layer(<FaceProp pose={poseName} />)}
                </>,
                headPoseStyle,
                channels.head?.origin ?? JOINTS.head
              ),
              tiltStyle,
              JOINTS.head
            )}

            {/* Arms over the head, as in the prototype: a paw can reach the chin. */}
            {layer(arm('L'), armLStyle, channels.armL?.origin)}
            {layer(arm('R'), armRStyle, channels.armR?.origin)}
            {layer(<HeldProp pose={poseName} />)}
            {scarf
              ? layer(
                  <>
                    <Path d={SHAPES.scarf} fill={PALETTE.lime} />
                    <Path d={SHAPES.scarfZigzag} stroke={PALETTE.limeDeep} strokeWidth={2.4} fill="none" strokeLinejoin="round" />
                    <Path d={SHAPES.scarfTail} fill={PALETTE.lime} />
                  </>
                )
              : null}
          </>,
          bodyStyle,
          channels.body?.origin ?? JOINTS.body
        ),
        breathStyle,
        JOINTS.body
      )}
    </View>
  );
}
