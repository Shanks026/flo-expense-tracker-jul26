import { SvgXml } from 'react-native-svg';
import { colors } from '../theme/tokens';

// The bare zigzag "flow line" mark, no lime badge / no wordmark — for
// contexts where the boxed app-icon treatment reads as too heavy (e.g. the
// auth screens). Mirrors the current app icon (assets/LogoIconSVG.svg),
// cropped to the mark's own bounding box + small padding so it scales
// cleanly at any `size`. Same reasoning as components/Logo.js and
// OnboardingArrowMotif.js for why it's inlined rather than imported: no
// SVG-file-loader configured in Metro.
const ASPECT_RATIO = 620 / 261;

const arrowXml = (color) => `
<svg width="620" height="261" viewBox="0 0 620 261" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M220 12L12 220L40.5 248.5L220 68.5L400 249L608 41L579.5 12.5L400 192.5Z" fill="${color}"/>
</svg>
`;

export default function ArrowMark({ size = 52, color = colors.ink, style }) {
  return <SvgXml xml={arrowXml(color)} width={size} height={size / ASPECT_RATIO} style={style} />;
}
