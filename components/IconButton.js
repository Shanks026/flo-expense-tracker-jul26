import { Pressable, StyleSheet } from 'react-native';
import { hitTarget, radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

// An icon-only button that is accessible by construction
// (37-design-system-and-koban.md): a 48dp target whatever the icon size, a
// button role, a pressed highlight, and an accessibilityLabel that is
// required — an icon alone tells TalkBack nothing.
//
// `icon` is a lucide component; `color` defaults to the theme ink.
export default function IconButton({
  icon: Icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  size = 20,
  color,
  disabled = false,
  style,
}) {
  const { colors } = useTheme();
  if (__DEV__ && !accessibilityLabel) {
    console.error('IconButton needs an accessibilityLabel');
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        pressed && { backgroundColor: colors.chipBg },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Icon size={size} color={color ?? colors.ink} strokeWidth={2.2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: hitTarget,
    height: hitTarget,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
});
