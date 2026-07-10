import { View, StyleSheet } from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';

export default function Card({ children, style, dark = false, variant = 'default' }) {
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
        dark ? styles.dark : { backgroundColor: colors.surface, borderColor },
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
  dark: {
    backgroundColor: colors.ink,
    borderWidth: 0,
  },
});
