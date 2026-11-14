import { Pressable, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { toneColors } from './ledger/ListRow';
import { useLedger, ledgerRadius, ledgerSpace } from '../theme/ledger';

// A bill row's Mark paid: a round check on a soft wash of the "paid" green
// (the person's call, 2026-11-12), lighter than a text button on every row.
// Used by the Bills list and the bills-due sheet (spec 49, ticket 03).
export default function BillPaidButton({ billName, onPress }) {
  const { c, modeId } = useLedger();
  const tint = toneColors(c.positive, c, modeId);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.button, { backgroundColor: tint.bg }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Mark ${billName} paid`}
    >
      <Check size={20} color={tint.fg} strokeWidth={2.25} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: ledgerRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: ledgerSpace.md,
  },
  pressed: {
    opacity: 0.7,
  },
});
