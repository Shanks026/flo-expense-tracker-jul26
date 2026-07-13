import { View, StyleSheet } from 'react-native';
import { colors, radii } from '../theme/tokens';

const FILL_BY_STATUS = {
  healthy: colors.brand,
  warn: colors.warnStrong,
  // 'over' is what budgetStatus() actually returns; 'danger' is the older name
  // used elsewhere. Both map to red. Until now only 'danger' was listed, so an
  // over-limit bar fell through to the default brand lime — a green progress bar
  // on a budget you'd blown. Logged as a known gap in 00-index.md since the
  // Analytics build; fixed here because the budget detail screen makes it
  // indefensible.
  over: colors.dangerStrong,
  danger: colors.dangerStrong,
  completed: colors.mutedLight,
};

export default function ProgressBar({ progress = 0, status = 'healthy', dark = false, height = 9 }) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  const isOver = status === 'over' || status === 'danger';
  const track = dark ? '#2a2a2a' : isOver ? colors.dangerTrack : colors.border;
  // The status colour applies on dark cards too. It used to be hard-coded to
  // brand there, which meant the dark summary cards could never show a red bar.
  const fill = FILL_BY_STATUS[status] ?? colors.brand;

  return (
    <View style={[styles.track, { height, borderRadius: radii.pill, backgroundColor: track }]}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: fill, borderRadius: radii.pill }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
