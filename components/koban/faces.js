import { Path, Ellipse, Circle, G } from 'react-native-svg';
import { PALETTE, EYES, STRIPES, WHISKERS, SHAPES } from './art';

// Koban's expressions — PLACEHOLDER ART, part of the drawing like ./art.js
// (37-design-system-and-koban.md). Each mood only changes the face: eyes,
// pupils, lids, brows, mouth. Six come straight from the round-5 prototype
// (neutral, happy = its smile, joy, wink, curious = its look-up, worried = its
// flat); surprised, focus, content and sleepy are drawn in the same style.
//
// A face is two parts so the blink can run on open eyes only:
//   FaceFeatures — everything that doesn't blink (muzzle, stripes, blush,
//                  nose, whiskers, brows, mouth, closed eyes)
//   OpenEyes     — the open eyes and their lids, which the blink squashes

export const MOODS = ['neutral', 'happy', 'joy', 'wink', 'surprised', 'curious', 'focus', 'content', 'worried', 'sleepy'];

const MOUTH = '#7A2418';
const CLOSED = '#3A1E0E';
const BROW = PALETTE.stripe;

// Per mood: what each eye is ('open' | 'arc' (happy closed ^) | 'line' (asleep ‿)),
// how the open ones look, then the brows and the mouth.
const SPEC = {
  neutral: { eyes: ['open', 'open'] },
  happy: { eyes: ['open', 'open'], mouth: 'smile' },
  joy: { eyes: ['arc', 'arc'], mouth: 'joy' },
  wink: { eyes: ['open', 'arc'], mouth: 'smile' },
  surprised: { eyes: ['open', 'open'], eyeScale: 1.12, pupilScale: 0.75, brows: 'raised', mouth: 'o' },
  curious: { eyes: ['open', 'open'], look: [3, -5], brows: 'oneUp', mouth: 'small' },
  focus: { eyes: ['open', 'open'], lid: 0.34, look: [0, 2], brows: 'level', mouth: 'small' },
  content: { eyes: ['open', 'open'], lid: 0.5, mouth: 'soft' },
  worried: { eyes: ['open', 'open'], pupilScale: 0.85, brows: 'up', mouth: 'wobble' },
  sleepy: { eyes: ['line', 'line'], mouth: 'small', zzz: true },
};

export function moodSpec(mood) {
  return SPEC[mood] ?? SPEC.neutral;
}

function openEye(x, spec) {
  const y = EYES.y;
  const s = spec.eyeScale ?? 1;
  const p = spec.pupilScale ?? 1;
  const [lx, ly] = spec.look ?? [0, 0];
  const rx = 18 * s;
  const ry = 21 * s;
  return (
    <G key={x}>
      <Ellipse cx={x} cy={y} rx={rx} ry={ry} fill={PALETTE.eyeWhite} />
      <G transform={`translate(${lx} ${ly})`}>
        <Ellipse cx={x + 1} cy={y + 1} rx={13 * s} ry={15 * s} fill={PALETTE.iris} />
        <Ellipse cx={x + 1} cy={y + 2} rx={8.5 * s * p} ry={10.5 * s * p} fill={PALETTE.pupil} />
        <Circle cx={x + 6 * s} cy={y - 6 * s} r={4.6 * s} fill="#FFFFFF" />
        <Circle cx={x - 4 * s} cy={y + 9 * s} r={2 * s} fill="#FFFFFF" />
      </G>
      {spec.lid ? (
        // A fur lid over the top of the eye, with a crease along its edge.
        <G>
          <Path
            d={`M${x - rx - 1} ${y - ry - 1} L${x + rx + 1} ${y - ry - 1} L${x + rx + 1} ${y - ry + 2 * ry * spec.lid} Q${x} ${y - ry + 2 * ry * spec.lid + 5} ${x - rx - 1} ${y - ry + 2 * ry * spec.lid} Z`}
            fill={PALETTE.fur}
          />
          <Path
            d={`M${x - rx + 2} ${y - ry + 2 * ry * spec.lid + 1} Q${x} ${y - ry + 2 * ry * spec.lid + 6} ${x + rx - 2} ${y - ry + 2 * ry * spec.lid + 1}`}
            stroke={PALETTE.crease}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      ) : null}
    </G>
  );
}

export function OpenEyes({ mood }) {
  const spec = moodSpec(mood);
  return <>{EYES.xs.map((x, i) => (spec.eyes[i] === 'open' ? openEye(x, spec) : null))}</>;
}

function closedEye(x, kind) {
  const y = EYES.y;
  const d =
    kind === 'arc'
      ? `M${x - 13} ${y + 3} Q${x} ${y - 12} ${x + 13} ${y + 3}`
      : `M${x - 13} ${y + 1} Q${x} ${y + 9} ${x + 13} ${y + 1}`;
  return <Path key={x} d={d} stroke={CLOSED} strokeWidth={5} fill="none" strokeLinecap="round" />;
}

const BROWS = {
  raised: 'M106 90 Q120 80 134 88 M166 88 Q180 80 194 90',
  oneUp: 'M168 92 Q180 86 192 92',
  // Concentrating, not cross: nearly level, only a slight inward dip.
  level: 'M108 92 Q119 90 130 94 M192 92 Q181 90 170 94',
  up: 'M108 96 L130 88 M192 96 L170 88',
};

const MOUTHS = {
  smile: <Path d="M141 154 Q150 167 159 154 Q150 158 141 154 Z" fill={MOUTH} />,
  joy: (
    <G>
      <Path d="M138 153 Q150 174 162 153 Q150 159 138 153 Z" fill={MOUTH} />
      <Ellipse cx={150} cy={163} rx={5.5} ry={3.5} fill="#F2847C" />
    </G>
  ),
  o: <Ellipse cx={150} cy={160} rx={5} ry={6.2} fill={MOUTH} />,
  small: <Ellipse cx={150} cy={158} rx={3.6} ry={4.2} fill={MOUTH} />,
  flat: <Path d="M143 158 Q150 155 157 158" stroke={MOUTH} strokeWidth={2.6} fill="none" strokeLinecap="round" />,
  soft: <Path d="M143 156 Q150 162 157 156" stroke={MOUTH} strokeWidth={2.6} fill="none" strokeLinecap="round" />,
  wobble: <Path d="M142 159 Q146 155 150 159 Q154 163 158 159" stroke={MOUTH} strokeWidth={2.6} fill="none" strokeLinecap="round" />,
};

export function FaceFeatures({ mood }) {
  const spec = moodSpec(mood);
  return (
    <>
      <Path d={SHAPES.muzzle} fill={PALETTE.cream} />
      {STRIPES.map((s) => (
        <Path key={s.d} d={s.d} stroke={PALETTE.stripe} strokeWidth={s.w} strokeLinecap="round" fill="none" />
      ))}
      <Ellipse cx={99} cy={152} rx={11} ry={6.5} fill={PALETTE.blush} />
      <Ellipse cx={201} cy={152} rx={11} ry={6.5} fill={PALETTE.blush} />
      {EYES.xs.map((x, i) => (spec.eyes[i] === 'open' ? null : closedEye(x, spec.eyes[i])))}
      {spec.brows ? <Path d={BROWS[spec.brows]} stroke={BROW} strokeWidth={4} fill="none" strokeLinecap="round" /> : null}
      <Path d={SHAPES.nose} fill={PALETTE.nose} />
      {spec.mouth ? MOUTHS[spec.mouth] : null}
      <G stroke={PALETTE.whisker} strokeWidth={1.6} strokeLinecap="round" fill="none">
        {WHISKERS.map((d) => (
          <Path key={d} d={d} />
        ))}
      </G>
      {spec.zzz ? (
        <Path d="M212 66 L222 66 L212 78 L222 78 M226 50 L233 50 L226 59 L233 59" stroke={PALETTE.whisker} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
    </>
  );
}
