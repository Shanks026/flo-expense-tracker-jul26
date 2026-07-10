import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, radii, fontFamily, fontSize } from '../theme/tokens';

const VARIANTS = {
  primary: { bg: colors.brand, text: colors.ink },
  dark: { bg: colors.ink, text: colors.surface },
  outline: { bg: colors.surface, text: colors.ink, border: colors.border },
  danger: { bg: colors.surface, text: colors.danger, border: colors.dangerBorder },
};

export default function Button({ title, onPress, variant = 'primary', disabled, loading, style }) {
  const v = VARIANTS[variant] ?? VARIANTS.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: v.bg,
          borderWidth: v.border ? 1.5 : 0,
          borderColor: v.border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <Text style={[styles.text, { color: v.text }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    letterSpacing: -0.2,
  },
});
