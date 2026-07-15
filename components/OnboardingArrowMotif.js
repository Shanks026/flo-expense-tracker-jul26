import { View, useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { colors } from '../theme/tokens';

// Where the motif's box CENTRE sits, as a fraction of screen height — measured
// from the top for `position="top"`, from the bottom for `position="bottom"`.
// ~0.3 puts the shape in the upper/lower third with clear space between it and
// the text, matching the reference design (arrows sitting well down from the
// status bar, not jammed against the top edge).
const CENTER_FRACTION = 0.34;

// Tuned against the reference screenshots: big enough (1.25x screen width) that
// BOTH arrowheads read clearly rather than cropping into an abstract zigzag,
// and rotated 24° (was 15°) so the up→down "flow" reads at a glance. The shape
// deliberately bleeds ~12% past each side edge, same as the reference.
const WIDTH_SCALE = 1.4;
const TOP_ANGLE = -15;

// Mirrors assets/LogoVector.svg (horizontal, 683x370 viewBox) — the same
// two-arrow "flow" mark as the app's real logo. Kept inline, not imported,
// for the same reason as components/Logo.js: no SVG-file-loader configured
// in Metro. Recolored to the exact `colors.brand` token rather than the
// design export's close-but-not-identical hex (#B3DC00) — update both this
// string and the asset if the source vector changes.
const ARROW_XML = `
<svg width="683" height="370" viewBox="0 0 683 370" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M370 0H0V55L275 55.5L0.5 330.5L40 370L314.5 96L314 370H683V314.5H407.5L683 40L643 0L370 273V0Z" fill="${colors.brand}"/>
</svg>
`;

const ASPECT_RATIO = 683 / 370;

// Decorative fill for the intro's "text + subtitle only" hero screens
// (problem/solution/ready/journey) — sits behind the content at low opacity,
// filling the empty half the text isn't using. `pointerEvents="none"` so it
// never intercepts a tap.
//
// `position="top"` tilts 24deg — its implied motion leads DOWN into the
// title. `position="bottom"` is the exact same tilt flipped 180deg
// (24 - 180 = -156deg) — leads UP into the title from below. One base angle,
// not two independently-tuned assets; the alternation is deliberate visual
// choreography (arrows leading the eye toward the text), not arbitrary
// placement — see 12-personal-onboarding.md for the reasoning.
//
// Positioned by CENTRE fraction of screen height (not a negative edge offset),
// so the shape sits well down from the top/bottom edge with clear space
// before the text rather than jammed against the status bar.
export default function OnboardingArrowMotif({ position = 'top', opacity = 0.1 }) {
  const { width, height } = useWindowDimensions();
  const motifWidth = width * WIDTH_SCALE;
  const motifHeight = motifWidth / ASPECT_RATIO;

  const rotate = position === 'top' ? `${TOP_ANGLE}deg` : `${TOP_ANGLE - 180}deg`;
  // Box centre lands at CENTER_FRACTION of screen height from the anchored
  // edge; `top`/`bottom` is that centre minus half the box's own height.
  const edgeInset = height * CENTER_FRACTION - motifHeight / 2;
  const edgeStyle = position === 'top' ? { top: edgeInset } : { bottom: edgeInset };

  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: -(motifWidth - width) / 2, // centre horizontally, symmetric bleed off both sides
          width: motifWidth,
          height: motifHeight,
          opacity,
          transform: [{ rotate }],
        },
        edgeStyle,
      ]}
    >
      <SvgXml xml={ARROW_XML} width="100%" height="100%" />
    </View>
  );
}
