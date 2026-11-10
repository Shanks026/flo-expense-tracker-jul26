import { Pressable, Text, StyleSheet } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useLedger, ledgerRadius, ledgerSize, inter } from '../../theme/ledger';

// An outlined pill (redesign §2.5); selected is an ink fill with on-ink text,
// so the choice reads without the accent. `icon` is an optional lucide
// component drawn before the label; `caret` adds a trailing ▾ for a filter
// chip that opens a sheet. 36 dp tall, with hitSlop bringing the
// target to 48 dp.
const HEIGHT = 36;

export default function Chip({ label, selected = false, onPress, icon: Icon, caret = false, accessibilityLabel, accessibilityHint, style }) {
  const { c } = useLedger();
  const fg = selected ? c.inkOnInk : c.ink;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={(ledgerSize.hit - HEIGHT) / 2}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: selected ? c.ink : c.hairline, backgroundColor: selected ? c.ink : 'transparent' },
        pressed && !selected && { opacity: 0.6 },
        style,
      ]}
    >
      {Icon ? <Icon size={14} color={fg} strokeWidth={1.75} /> : null}
      <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
      {caret ? <ChevronDown size={14} color={fg} strokeWidth={1.75} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: ledgerRadius.full,
    borderWidth: 1,
  },
  label: {
    fontFamily: inter.medium,
    fontSize: 13,
    lineHeight: 18,
  },
});
