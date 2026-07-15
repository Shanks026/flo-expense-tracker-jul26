import { SvgXml } from 'react-native-svg';
import { colors } from '../theme/tokens';

// The bare two-arrow "flow" mark, no lime badge / no wordmark — for contexts
// where the boxed app-icon treatment reads as too heavy (e.g. the auth
// screens). Mirrors assets/LogoVector.svg (horizontal, 683x370 viewBox), same
// reasoning as components/Logo.js and OnboardingArrowMotif.js for why it's
// inlined rather than imported: no SVG-file-loader configured in Metro.
const ASPECT_RATIO = 683 / 370;

const arrowXml = (color) => `
<svg width="683" height="370" viewBox="0 0 683 370" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M370 0H0V55L275 55.5L0.5 330.5L40 370L314.5 96L314 370H683V314.5H407.5L683 40L643 0L370 273V0Z" fill="${color}"/>
</svg>
`;

export default function ArrowMark({ size = 52, color = colors.ink, style }) {
  return <SvgXml xml={arrowXml(color)} width={size} height={size / ASPECT_RATIO} style={style} />;
}
