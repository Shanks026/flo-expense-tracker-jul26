import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLedger, ledgerRadius, ledgerSpace } from '../../theme/ledger';
import { inter as fontFamily } from '../../theme/ledger';

// Home's quick actions (redesign §4 Home, item 3; Kit's Manage / Lock /
// Transfer): equal tiles on the sunk surface, an icon over a label.
// `actions` is [{ key, label, icon, onPress }].
export default function QuickActions({ actions }) {
  const { c } = useLedger();
  return (
    <View style={styles.row}>
      {actions.map(({ key, label, icon: Icon, onPress }) => (
        <Pressable
          key={key}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={({ pressed }) => [styles.tile, { backgroundColor: c.surfaceSunk }, pressed && { opacity: 0.6 }]}
        >
          <Icon size={18} color={c.ink} strokeWidth={1.75} />
          <Text style={[styles.label, { color: c.ink }]} numberOfLines={1}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: ledgerSpace.sm,
  },
  tile: {
    flex: 1,
    height: 64,
    borderRadius: ledgerRadius.input,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
  },
});
