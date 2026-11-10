import { Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLedger, ledgerType, ledgerRadius, ledgerSize, ledgerSpace } from '../../theme/ledger';

// Redesign §2.5: `primary` (ink fill), `secondary` (outlined ink), `quiet`
// (text only), `danger` (dangerSoft fill, danger text). 52 dp, weight 600.
// `compact` is a 34 dp version for inline actions inside a row (hitSlop
// keeps its target near 48 dp). `accessibilityLabel` overrides the title
// for TalkBack when the title alone is vague ("Review").
export default function Button({ title, onPress, variant = 'primary', compact = false, loading = false, disabled = false, accessibilityLabel, style }) {
  const { c } = useLedger();
  const v = disabled
    ? // Its own flat look, not a faded button: on Android the fill and the
      // border faded separately and stacked into a dark ring.
      {
        bg: variant === 'primary' || variant === 'danger' ? c.surfaceSunk : 'transparent',
        fg: c.muted,
        border: variant === 'secondary' ? c.hairline : variant === 'quiet' ? 'transparent' : c.surfaceSunk,
      }
    : {
        primary: { bg: c.ink, fg: c.inkOnInk, border: c.ink },
        secondary: { bg: 'transparent', fg: c.ink, border: c.ink },
        quiet: { bg: 'transparent', fg: c.ink, border: 'transparent' },
        danger: { bg: c.dangerSoft, fg: c.danger, border: c.dangerSoft },
      }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      hitSlop={compact ? 7 : 0}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        variant === 'quiet' && styles.quiet,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && !disabled && { opacity: 0.75 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[ledgerType.button, compact && styles.compactText, { color: v.fg }, variant === 'quiet' && styles.quietText]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: ledgerSize.button,
    borderRadius: ledgerRadius.full,
    borderWidth: 1.5,
    paddingHorizontal: ledgerSpace.gutter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    height: 34,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  compactText: {
    fontSize: 13,
    lineHeight: 16,
  },
  quiet: {
    paddingHorizontal: ledgerSpace.sm,
  },
  quietText: {
    textDecorationLine: 'underline',
  },
});
