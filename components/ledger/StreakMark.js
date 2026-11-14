import { View, StyleSheet } from 'react-native';
import { Snowflake } from 'lucide-react-native';
import { useLedger, ledgerRadius } from '../../theme/ledger';

// One day of a streak (spec 49): the mark shared by the milestone
// celebration's seven-day row, the Streak calendar and its legend, so the
// three can't drift apart.
//   'logged'  a real entry: a filled `streak` dot;
//   'nospend' a declared no-spend day: a `streak` ring (covered, not logged,
//             so it must never look like a logged day);
//   'frozen'  covered by a freeze: a snowflake in `muted`;
//   anything else: an empty sunk circle.
// `dimmed` fades days outside the month or in the future.
export const STREAK_MARK_LABELS = { logged: 'Logged', nospend: 'No spend', frozen: 'Frozen' };

export default function StreakMark({ type, size = 32, dimmed = false, accessibilityLabel }) {
  const { c } = useLedger();
  const box = { width: size, height: size, borderRadius: ledgerRadius.full };

  let look;
  if (type === 'logged') look = { backgroundColor: c.streak };
  else if (type === 'nospend') look = { borderWidth: Math.max(2, Math.round(size / 12)), borderColor: c.streak };
  else look = { backgroundColor: c.surfaceSunk };

  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'image', accessibilityLabel }
    : { accessible: false, importantForAccessibility: 'no-hide-descendants' };

  return (
    <View style={[styles.mark, box, look, dimmed && styles.dimmed]} {...a11y}>
      {type === 'frozen' && <Snowflake size={Math.round(size * 0.55)} color={c.muted} strokeWidth={1.75} />}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: {
    opacity: 0.35,
  },
});
