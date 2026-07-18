import { View, StyleSheet } from 'react-native';
import { radii } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

export default function ProgressBar({ progress = 0, status = 'healthy', dark = false, height = 9 }) {
  const { colors } = useTheme();

  // warn/over/danger/completed's underlying colors are semantic-locked
  // (identical across every theme); 'healthy' deliberately uses the active
  // theme's accent — a healthy budget fills with whatever color the app's
  // identity currently is.
  const FILL_BY_STATUS = {
    healthy: colors.brand,
    warn: colors.warnStrong,
    // 'over' is what budgetStatus() actually returns; 'danger' is the older name
    // used elsewhere. Both map to red.
    over: colors.dangerStrong,
    danger: colors.dangerStrong,
    completed: colors.mutedLight,
  };

  const pct = Math.max(0, Math.min(1, progress)) * 100;
  const isOver = status === 'over' || status === 'danger';
  // The dark-track literal ('#2a2a2a') is already a pinned value, same role
  // as Card's dark variant — unrelated to the active theme.
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
