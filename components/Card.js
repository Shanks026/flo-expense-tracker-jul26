import { View, StyleSheet } from 'react-native';
import { radii, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

// `dark={true}` is a permanently-dark EMPHASIS surface (hero cards, summary
// blocks) — the same role sheet chrome plays, not "the app's dark theme".
// Its background reads `colors.emphasisBg`, a token each theme owns
// specifically for this — NOT `colors.ink` (Dark theme inverts that to a
// light color) and NOT a value pinned to Brand's tokens either: Dark theme's
// own screen is already near-black, so a card hardcoded to that same
// near-black would blend invisibly into it. Each theme picks its own
// emphasisBg that actually stands out against its own bg/surface.
export default function Card({ children, style, dark = false, variant = 'default' }) {
  const { colors } = useTheme();
  const borderColor = {
    default: colors.border,
    danger: colors.dangerBorder,
    warn: colors.warnBorder,
    completed: colors.completedBorder,
  }[variant];

  return (
    <View
      style={[
        styles.card,
        dark ? { backgroundColor: colors.emphasisBg, borderWidth: 0 } : { backgroundColor: colors.surface, borderColor },
        variant === 'completed' && !dark && { backgroundColor: colors.completedBg },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
    borderWidth: 1,
    padding: spacing.lg,
  },
});
