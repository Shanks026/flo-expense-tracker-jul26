import { View, StyleSheet } from 'react-native';
import { useLedger, ledgerRadius } from '../../theme/ledger';
import { progressState } from '../../lib/progressState';

// A 4 dp bar (redesign §2.5): `accent` on a `surfaceSunk` track, `warn` past
// 80 %, `danger` past 100 % (the rule is lib/progressState.js). `value` is
// used/limit, so 1.2 is 20 % over. It replaces components/ProgressBar.js as
// each screen (Budgets, Plans) moves to the ledger kit in Phase 4.
//
// TalkBack hears it as a progress bar with the percentage; pass
// `accessibilityLabel` for what it measures ("Groceries budget").
export default function ProgressBar({ value, accessibilityLabel, style }) {
  const { c } = useLedger();
  const { tone, fill, pct } = progressState(value);

  return (
    <View
      style={[styles.track, { backgroundColor: c.surfaceSunk }, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.min(pct, 100), text: `${pct}%` }}
    >
      <View style={[styles.fill, { width: `${fill * 100}%`, backgroundColor: c[tone] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    width: '100%',
    borderRadius: ledgerRadius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: ledgerRadius.full,
  },
});
