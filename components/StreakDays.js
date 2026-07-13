import { View, StyleSheet } from 'react-native';
import { Flame } from 'lucide-react-native';
import { colors, radii } from '../theme/tokens';

// A single day of a streak: lit (brand-filled circle, solid flame in a darker
// brand shade) or unlit (neutral fill, hollow muted flame).
//
// This is the streak's atom. The 7-day row on the celebration screen and the
// month grid on /streak both render it, so the two can't drift into different
// visual languages for the same idea — which is exactly how the original plain
// squares ended up meaning nothing.
export function StreakFlame({ lit, size = 34, dark = false, dimmed = false }) {
  return (
    <View
      style={[
        styles.cell,
        { width: size, height: size, borderRadius: radii.pill },
        lit ? styles.cellLit : dark ? styles.cellEmptyDark : styles.cellEmpty,
        dimmed && styles.dimmed,
      ]}
    >
      <Flame
        size={size * 0.5}
        // The deep orange on the orange fill — same hue, darker value, so the
        // flame sits IN the circle rather than fighting it. A white or ink flame
        // would read as a separate object stamped on top.
        color={lit ? colors.streakDeep : dark ? colors.mutedDarker : colors.mutedLight}
        fill={lit ? colors.streakDeep : 'transparent'}
        strokeWidth={2.4}
      />
    </View>
  );
}

export const STREAK_WINDOW_DAYS = 7;

// The trailing 7 days, oldest → newest. useStreak's history is longer (42 days,
// for the month grid); only the last week is shown here.
export default function StreakDays({ history, size = 34, dark = false }) {
  const days = history.slice(-STREAK_WINDOW_DAYS);

  return (
    <View style={styles.row}>
      {days.map((day) => (
        <StreakFlame key={day.date} lit={day.logged} size={size} dark={dark} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellLit: {
    backgroundColor: colors.streak,
  },
  cellEmpty: {
    backgroundColor: colors.chipBg,
  },
  cellEmptyDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dimmed: {
    opacity: 0.35,
  },
});
