import { Flame } from 'lucide-react-native';
import { colors } from '../theme/tokens';

// The big streak flame. ONE colour — fill and stroke the same.
//
// It was briefly two-toned (brand shell, darker core), copying the reference's
// orange/red flame. It didn't work at either size: our two brand values are much
// closer together than orange and red, so the core read as a smudge rather than
// a hot centre, and at chip size it turned to mud. A single solid flame is
// cleaner and unmistakably the brand.
export default function StreakFlameIcon({ size = 84, lit = true }) {
  const color = lit ? colors.streak : colors.chipBg;
  return <Flame size={size} color={color} fill={color} strokeWidth={1.6} />;
}
