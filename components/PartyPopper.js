import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '../theme/tokens';
import { CATEGORY_COLORS } from './CategoryIcon';

// The design's celebration mark (FLO App.dc.html, onboarding screen 05) — a
// party popper whose streamers and sparks are individually coloured. Lucide's
// PartyPopper is a single-colour icon and can't express that, so this is the
// design's own SVG rather than an icon-library stand-in.
//
// The design specified its own hex values (#FF6B4A, #2A6FDB, …). Those are
// remapped onto the shared category palette here so the popper, the confetti,
// and the rest of the app read as one system instead of introducing a fourth
// set of accent colours.
const CORAL = CATEGORY_COLORS[3];
const BLUE = CATEGORY_COLORS[10];
const PLUM = CATEGORY_COLORS[5];
const TEAL = CATEGORY_COLORS[4];
const AMBER = CATEGORY_COLORS[2];

export default function PartyPopper({ size = 104 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* cone + confetti spray, in ink */}
      <Path
        d="M5.8 11.3 2 22l10.7-3.8"
        stroke={colors.ink}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"
        stroke={colors.ink}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* streamers */}
      <Path
        d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"
        stroke={CORAL}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11-.11.7-.72 1.22-1.43 1.22H17"
        stroke={BLUE}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7"
        stroke={PLUM}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* sparks */}
      <Circle cx={4} cy={3} r={1.1} fill={BLUE} />
      <Circle cx={22} cy={8} r={1.1} fill={TEAL} />
      <Circle cx={15} cy={2} r={1.1} fill={CORAL} />
      <Circle cx={22} cy={20} r={1.1} fill={AMBER} />
    </Svg>
  );
}
