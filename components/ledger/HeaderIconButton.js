import { Pressable, View, StyleSheet } from 'react-native';
import { useLedger, ledgerRadius, ledgerSize } from '../../theme/ledger';

// The ScreenHeader's circle action (redesign §2.5): a 40 dp sunk circle, with
// hitSlop bringing the target to 48 dp. `dot` adds the bell's unread mark.
// `children` (e.g. a flame plus a count) widens it into a pill.
export default function HeaderIconButton({ icon: Icon, onPress, accessibilityLabel, dot = false, children }) {
  const { c } = useLedger();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.circle, children && styles.pill, { backgroundColor: c.surfaceSunk }, pressed && { opacity: 0.6 }]}
    >
      {Icon ? <Icon size={18} color={c.ink} strokeWidth={1.75} /> : null}
      {children}
      {dot && <View style={[styles.dot, { backgroundColor: c.danger, borderColor: c.surfaceSunk }]} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: ledgerSize.iconCircle,
    height: ledgerSize.iconCircle,
    borderRadius: ledgerRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    width: undefined,
    minWidth: ledgerSize.iconCircle,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
});
