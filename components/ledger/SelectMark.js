import { View, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { useLedger, ledgerRadius } from '../../theme/ledger';

// "Ink = selected" (redesign §2.2, like a chip): an ink disc with a check in
// inkOnInk. Without `size` it fills its parent, so a ListRow's icon circle
// can turn into it (the Activity filter's chosen account); with `size` it
// stands alone (Radio below).
export default function SelectMark({ size, checkSize = 18 }) {
  const { c } = useLedger();
  return (
    <View style={[styles.disc, size ? { width: size, height: size } : styles.fill, { backgroundColor: c.ink }]}>
      <Check size={checkSize} color={c.inkOnInk} strokeWidth={2.5} />
    </View>
  );
}

// A radio for a choose-one list (Pro's plans): an empty muted ring, or the
// SelectMark when chosen.
const RADIO = 22;
export function Radio({ selected }) {
  const { c } = useLedger();
  if (selected) return <SelectMark size={RADIO} checkSize={13} />;
  return <View style={[styles.disc, styles.ring, { borderColor: c.muted }]} />;
}

const styles = StyleSheet.create({
  disc: {
    borderRadius: ledgerRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  ring: {
    width: RADIO,
    height: RADIO,
    borderWidth: 1.5,
  },
});
