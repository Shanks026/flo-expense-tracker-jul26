import { View, StyleSheet } from 'react-native';
import { useLedger, ledgerRadius } from '../../theme/ledger';

const DOT = 6;

// Page dots under a swiped row (Home's account cards, the opener's slides):
// the current page in ink, the rest hairline. `count` pages, `index` current.
// The row keeps its height with one page or none, so nothing below it moves.
// Decorative: the pages announce their own position.
export default function PageDots({ count, index, style }) {
  const { c } = useLedger();
  return (
    <View style={[styles.row, style]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {count > 1 &&
        Array.from({ length: count }, (_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i === index ? c.ink : c.hairline }]} />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: DOT,
    height: 20,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: ledgerRadius.full,
  },
});
