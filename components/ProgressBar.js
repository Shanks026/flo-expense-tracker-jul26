import { View, StyleSheet } from 'react-native';
import { colors, radii } from '../theme/tokens';

const FILL_BY_STATUS = {
  healthy: colors.brand,
  warn: colors.warnStrong,
  danger: colors.dangerStrong,
  completed: colors.mutedLight,
};

export default function ProgressBar({ progress = 0, status = 'healthy', dark = false, height = 9 }) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  const track = dark ? '#2a2a2a' : status === 'danger' ? colors.dangerTrack : colors.border;
  const fill = dark ? colors.brand : FILL_BY_STATUS[status] ?? colors.brand;

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
