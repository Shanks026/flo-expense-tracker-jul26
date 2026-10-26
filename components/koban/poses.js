import { Path, Ellipse, Circle, Rect, G, Text as SvgText } from 'react-native-svg';
import { PALETTE } from './art';

// Koban's movement library — PLACEHOLDER ART, part of the drawing like
// ./art.js and ./faces.js (37-design-system-and-koban.md).
//
// The seven moves are ported from the round-5 prototype's CSS keyframes
// (hello, jump-for-joy, walking, hmm, shrug, little dance, nice-one); the four
// prop poses (report, notepad, magnifier, tip) are new, in the same style.
//
// A pose is data: which arm shapes it uses, a duration, and keyframe channels.
// One clock runs 0 → 1 over `duration`; each channel maps it to transforms
// around its own joint (`origin`), optionally phase-shifted by `offset`.
// Channels: body, head, armL, armR, legL, legR, tail, bubble.
// Keyframes are [time 0..1, value] pairs for translateY / rotate (deg) /
// scaleX / scaleY. `still` is the clock time shown when motion is off.
// `mood` is the expression that suits the pose; callers may pass any mood.

// Arm centre-lines (drawn as round-capped tubes) and where each ends.
const mirror = (d) => {
  let i = 0;
  return d.replace(/-?\d+(\.\d+)?/g, (n) => (i++ % 2 === 0 ? String(300 - parseFloat(n)) : n));
};
const endOf = (d) => {
  const n = d.match(/-?\d+(\.\d+)?/g).map(Number);
  return [n[n.length - 2], n[n.length - 1]];
};
const LIMBS = {
  restL: 'M128 196 Q116 216 119 242',
  waveR: 'M172 196 Q206 196 222 160',
  hipR: 'M172 196 Q198 204 196 222 Q193 234 180 232',
  thumbL: 'M128 198 Q102 198 90 168',
  upL: 'M127 196 Q96 188 72 148',
  outL: 'M128 200 Q108 214 86 208',
  chinR: 'M172 196 Q192 214 186 230 Q178 240 168 224 Q161 208 159 178',
  // prop poses
  holdL: 'M128 198 Q114 222 124 238',
  writeR: 'M172 198 Q178 228 140 236',
  lensR: 'M172 196 Q200 198 212 176',
  // Out beside the head (not over it), so the raised finger reads.
  tipR: 'M172 196 Q208 196 222 170',
};
LIMBS.restR = mirror(LIMBS.restL);
LIMBS.upR = mirror(LIMBS.upL);
LIMBS.outR = mirror(LIMBS.outL);
LIMBS.holdR = mirror(LIMBS.holdL);
export const ARM_SHAPES = Object.fromEntries(Object.entries(LIMBS).map(([k, d]) => [k, { d, end: endOf(d) }]));

const SHOULDER_L = [126, 192];
const SHOULDER_R = [174, 192];

export const POSES = {
  idle: { duration: 4000, mood: 'neutral', arms: ['restL', 'restR'], channels: {} },
  hello: {
    duration: 1200,
    mood: 'happy',
    arms: ['restL', 'waveR'],
    channels: { armR: { origin: [172, 196], rotate: [[0, -10], [0.5, 12], [1, -10]] } },
  },
  jump: {
    duration: 1400,
    mood: 'joy',
    arms: ['upL', 'upR'],
    confetti: true,
    still: 0.5,
    channels: {
      body: {
        origin: [150, 305],
        translateY: [[0, 0], [0.14, 0], [0.34, -42], [0.5, -50], [0.68, 0], [0.8, 0], [1, 0]],
        scaleX: [[0, 1], [0.14, 1.08], [0.34, 0.94], [0.5, 1], [0.68, 1.08], [0.8, 0.97], [0.92, 1], [1, 1]],
        scaleY: [[0, 1], [0.14, 0.9], [0.34, 1.08], [0.5, 1], [0.68, 0.9], [0.8, 1.03], [0.92, 1], [1, 1]],
      },
      armL: { origin: SHOULDER_L, rotate: [[0, 6], [0.25, -8], [0.5, 6], [0.75, -8], [1, 6]] },
      armR: { origin: SHOULDER_R, rotate: [[0, -6], [0.25, 8], [0.5, -6], [0.75, 8], [1, -6]] },
    },
  },
  walk: {
    duration: 1000,
    mood: 'neutral',
    arms: ['restL', 'restR'],
    channels: {
      body: { origin: [150, 305], translateY: [[0, 0], [0.25, -4], [0.5, 0], [0.75, -4], [1, 0]] },
      legL: { origin: [134, 268], rotate: [[0, 14], [0.5, -14], [1, 14]] },
      legR: { origin: [166, 268], offset: 0.5, rotate: [[0, 14], [0.5, -14], [1, 14]] },
      armL: { origin: SHOULDER_L, offset: 0.5, rotate: [[0, 12], [0.5, -12], [1, 12]] },
      armR: { origin: SHOULDER_R, rotate: [[0, 12], [0.5, -12], [1, 12]] },
    },
  },
  hmm: {
    duration: 4000,
    mood: 'curious',
    arms: ['restL', 'chinR'],
    bubble: true,
    channels: {
      head: { origin: [150, 178], rotate: [[0, -7], [0.5, -2], [1, -7]] },
      tail: {
        origin: [186, 256],
        rotate: [[0, 0], [0.275, 0], [0.325, 16], [0.375, -6], [0.425, 8], [0.5, 0], [0.775, 0], [0.825, 16], [0.875, -6], [0.925, 8], [1, 0]],
      },
      bubble: { origin: [250, 70], translateY: [[0, 0], [0.5, -6], [1, 0]] },
    },
  },
  shrug: {
    duration: 2400,
    mood: 'worried',
    arms: ['outL', 'outR'],
    still: 0.75,
    channels: {
      armL: { origin: SHOULDER_L, translateY: [[0, 0], [0.55, 0], [0.65, -8], [0.85, -8], [1, 0]] },
      armR: { origin: SHOULDER_R, translateY: [[0, 0], [0.55, 0], [0.65, -8], [0.85, -8], [1, 0]] },
      head: {
        origin: [150, 178],
        rotate: [[0, 0], [0.55, 0], [0.65, -7], [0.85, -7], [1, 0]],
        translateY: [[0, 0], [0.55, 0], [0.65, 4], [0.85, 4], [1, 0]],
      },
    },
  },
  dance: {
    duration: 1100,
    mood: 'joy',
    arms: ['upL', 'outR'],
    confetti: true,
    channels: {
      body: {
        origin: [150, 305],
        rotate: [[0, -6], [0.25, 0], [0.5, 6], [0.75, 0], [1, -6]],
        translateY: [[0, 0], [0.25, -8], [0.5, 0], [0.75, -8], [1, 0]],
      },
      armL: { origin: SHOULDER_L, rotate: [[0, -14], [0.5, 14], [1, -14]] },
      armR: { origin: SHOULDER_R, offset: 0.5, rotate: [[0, -14], [0.5, 14], [1, -14]] },
    },
  },
  niceOne: {
    duration: 1800,
    mood: 'wink',
    arms: ['thumbL', 'hipR'],
    channels: { armL: { origin: [128, 198], rotate: [[0, 0], [0.6, 0], [0.7, 9], [0.82, -3], [1, 0]] } },
  },
  report: {
    duration: 3200,
    mood: 'focus',
    arms: ['holdL', 'holdR'],
    glasses: true,
    channels: {
      // The arms stay put so the paws stay on the sheet; the head reads it.
      head: { origin: [150, 178], rotate: [[0, 0], [0.4, 0], [0.5, 3], [0.6, 0], [1, 0]] },
    },
  },
  notepad: {
    duration: 1600,
    mood: 'focus',
    arms: ['holdL', 'writeR'],
    channels: { armR: { origin: SHOULDER_R, rotate: [[0, 0], [0.2, 3], [0.4, -1], [0.6, 3], [0.8, -1], [1, 0]] } },
  },
  magnifier: {
    duration: 3000,
    mood: 'curious',
    arms: ['restL', 'lensR'],
    channels: {
      armR: { origin: SHOULDER_R, rotate: [[0, -6], [0.5, 6], [1, -6]] },
      head: { origin: [150, 178], rotate: [[0, 2], [0.5, 5], [1, 2]] },
    },
  },
  tip: {
    duration: 2000,
    mood: 'happy',
    arms: ['restL', 'tipR'],
    channels: { armR: { origin: SHOULDER_R, rotate: [[0, 0], [0.6, 0], [0.7, -6], [0.82, 2], [1, 0]] } },
  },
};

export const POSE_NAMES = Object.keys(POSES);

// Drawn with the arm, so it moves with it. `side` is 'L' or 'R'.
export function ArmExtras({ pose, side }) {
  const ink = PALETTE.whisker;
  if (pose === 'hello' && side === 'R') {
    return (
      <G>
        <Ellipse cx={222} cy={161} rx={4.5} ry={3.6} fill="#F4A296" />
        <Circle cx={217} cy={155} r={1.9} fill="#F4A296" />
        <Circle cx={222} cy={153.5} r={1.9} fill="#F4A296" />
        <Circle cx={227} cy={155} r={1.9} fill="#F4A296" />
      </G>
    );
  }
  if (pose === 'niceOne' && side === 'L') {
    return <Path d="M89 160 L89 147" stroke={PALETTE.fur} strokeWidth={9} strokeLinecap="round" />;
  }
  if (pose === 'tip' && side === 'R') {
    return <Path d="M222 162 L222 144" stroke={PALETTE.fur} strokeWidth={8} strokeLinecap="round" />;
  }
  if (pose === 'notepad' && side === 'L') {
    // A lime notepad held against the body.
    return (
      <G>
        <Rect x={104} y={214} width={42} height={50} rx={5} fill={PALETTE.lime} />
        <Rect x={104} y={214} width={42} height={9} rx={4} fill={PALETTE.limeDeep} />
        <Path d="M111 234 L139 234 M111 243 L139 243 M111 252 L131 252" stroke={PALETTE.limeDeep} strokeWidth={2.2} strokeLinecap="round" />
      </G>
    );
  }
  if (pose === 'notepad' && side === 'R') {
    // The pencil, tip on the pad.
    return (
      <G>
        <Path d="M146 238 L128 250" stroke="#FFC83D" strokeWidth={6} strokeLinecap="round" />
        <Path d="M128 250 L124 253" stroke={ink} strokeWidth={4} strokeLinecap="round" />
      </G>
    );
  }
  if (pose === 'magnifier' && side === 'R') {
    return (
      <G>
        <Path d="M212 176 L220 162" stroke={ink} strokeWidth={5} strokeLinecap="round" />
        <Circle cx={228} cy={146} r={18} fill="rgba(255,255,255,0.35)" stroke={ink} strokeWidth={5} />
        <Path d="M219 139 Q224 133 231 133" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" fill="none" />
      </G>
    );
  }
  return null;
}

// Drawn over the arms, between both hands, with the paws redrawn on top so
// they grip its edges (report only).
export function HeldProp({ pose }) {
  if (pose !== 'report') return null;
  const paw = ARM_SHAPES.holdL.end;
  return (
    <G>
      <Rect x={118} y={212} width={64} height={52} rx={6} fill="#FFFFFF" stroke="#E4E2DA" strokeWidth={2} />
      <Path d="M128 226 L160 226 M128 236 L172 236 M128 246 L150 246" stroke="#B9BCB2" strokeWidth={3} strokeLinecap="round" />
      <Path d="M158 254 L164 246 L170 250 L176 240" stroke={PALETTE.limeDeep} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={paw[0]} cy={paw[1]} r={12.6} fill={PALETTE.fur} />
      <Circle cx={300 - paw[0]} cy={paw[1]} r={12.6} fill={PALETTE.fur} />
    </G>
  );
}

// On the face, moving with the head (report only).
export function FaceProp({ pose }) {
  if (pose !== 'report') return null;
  const ink = '#3A1E0E';
  return (
    <G fill="none" stroke={ink} strokeWidth={3.5}>
      <Circle cx={120} cy={122} r={23} />
      <Circle cx={180} cy={122} r={23} />
      <Path d="M143 120 Q150 114 157 120" strokeLinecap="round" />
    </G>
  );
}

// Around the cat: confetti for celebrations, a thought bubble for "hmm".
export function Overlay({ pose }) {
  const spec = POSES[pose] ?? POSES.idle;
  if (spec.confetti) {
    return (
      <G>
        {['#BBDC12', '#FFC83D', '#FF7AA2', '#7FD1FF', '#BBDC12', '#FFC83D'].map((c, i) => (
          <Rect
            key={i}
            x={60 + i * 34}
            y={-20 + (i % 2) * 22}
            width={7}
            height={12}
            rx={2}
            fill={c}
            transform={`rotate(${i * 37} ${63 + i * 34} ${-14 + (i % 2) * 22})`}
          />
        ))}
      </G>
    );
  }
  return null;
}

export function Bubble() {
  // Shifted left from the prototype so the cloud stays inside the drawing.
  return (
    <G transform="translate(-26 0)">
      <Circle cx={216} cy={96} r={4} fill="#FFF1DC" />
      <Circle cx={228} cy={82} r={6.5} fill="#FFF1DC" />
      <Path
        d="M240 74 C228 74 226 58 238 54 C238 42 256 38 262 48 C270 40 286 46 284 58 C296 62 294 78 282 78 C280 88 264 90 258 82 C250 88 238 84 240 74 Z"
        fill="#FFF1DC"
      />
      <SvgText x={261} y={74} textAnchor="middle" fontWeight="800" fontSize={24} fill="#7DA80F">
        ?
      </SvgText>
    </G>
  );
}
