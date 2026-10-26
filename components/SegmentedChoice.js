import { View, Text, Pressable, StyleSheet } from 'react-native';
import { fontFamily, type, radius, hitTarget } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

// Pick one of a few options (37-design-system-and-koban.md): a radio group,
// each option announced with its label and selected state, each at least
// 48dp tall. `options` is [{ value, label, accessibilityLabel? }]. Options
// share the width equally and wrap at large font sizes rather than clip.
export default function SegmentedChoice({ options, value, onChange, accessibilityLabel, style }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.chipBg }, style]} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onChange(opt.value)}
            hitSlop={{ top: 3, bottom: 3 }}
            accessibilityRole="radio"
            accessibilityLabel={opt.accessibilityLabel ?? opt.label}
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.option,
              selected && { backgroundColor: colors.ink },
              pressed && !selected && { backgroundColor: colors.border },
            ]}
          >
            <Text style={[styles.label, { color: selected ? colors.surface : colors.muted }]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: radius.md,
    padding: 3,
    gap: 2,
  },
  option: {
    flexGrow: 1,
    flexBasis: 0,
    // Lets 7 short options (weekdays) wrap at large font sizes instead of
    // squashing.
    minWidth: 44,
    minHeight: hitTarget - 6,
    paddingHorizontal: 8,
    borderRadius: radius.md - 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: type.body,
    textAlign: 'center',
  },
});
