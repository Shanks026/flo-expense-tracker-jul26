import { View, Text, StyleSheet } from 'react-native';
import { Crown } from 'lucide-react-native';
import { useLedger, ledgerType, ledgerRadius } from '../theme/ledger';

// A crown and "Pro" in ink on a sunk pill, never a colour (spec 49, ticket
// 10), on locked options (Settings' Export all) and the Settings profile
// row. Caller-gated: it renders unconditionally, so wrap it in a condition.
// The unused corner-overlay variant was dropped in ticket 10.
export default function ProBadge() {
  const { c } = useLedger();
  return (
    <View style={[styles.pill, { backgroundColor: c.surfaceSunk }]}>
      <Crown size={12} color={c.ink} strokeWidth={2.4} fill={c.ink} />
      <Text style={[styles.pillText, { color: c.ink }]}>Pro</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: ledgerRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: {
    ...ledgerType.caption,
  },
});
