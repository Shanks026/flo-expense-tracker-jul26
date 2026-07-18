import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors as staticColors, radii, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

export default function Button({ title, onPress, variant = 'primary', disabled, loading, style }) {
  const { colors } = useTheme();

  // `primary`'s bg is the one thing in this file that MUST track the active
  // theme — it's the app's actual accent color, the whole point of a theme.
  // Its text stays pinned to the static dark ink, not the active theme's
  // `colors.ink`: Dark theme inverts `ink` to a LIGHT color (for on-screen
  // text), which would put near-white text on a bright accent background —
  // broken contrast. The accent itself is light-ish across every planned
  // theme, so a pinned dark label reliably reads on all of them.
  //
  // `dark` is a deliberately dark button regardless of screen theme (same
  // "permanently dark emphasis" role as Card's `dark` prop) — pinned to
  // static ink/surface, not the active theme, for the identical reason.
  //
  // `outline`/`danger` genuinely should follow the active theme: they're
  // meant to blend into whatever screen they sit on, not stand out as an
  // accent. `danger`/`dangerBorder` are semantic-locked already (identical
  // across every theme by construction), so reading them from the active
  // theme here is safe.
  const VARIANTS = {
    primary: { bg: colors.brand, text: staticColors.ink },
    dark: { bg: staticColors.ink, text: staticColors.surface },
    outline: { bg: colors.surface, text: colors.ink, border: colors.border },
    danger: { bg: colors.surface, text: colors.danger, border: colors.dangerBorder },
  };
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
