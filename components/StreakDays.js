import { View, StyleSheet } from 'react-native';
import { Flame, Snowflake } from 'lucide-react-native';
import { colors, radii } from '../theme/tokens';

// A single day of a streak — four states, since
// 18-gamification-ritual-and-ledger.md Phase 3/4:
//   'logged'  — a real transaction happened (brand-filled circle, solid flame
//               in a darker brand shade).
//   'nospend' — covered by a declared no-spend day, NOT a real transaction —
//               must never render identically to 'logged' (the calendar must
//               not lie about what actually happened). A muted income-green
//               wash, same flame glyph for visual-family consistency but
//               instantly distinguishable from the vivid orange of a real day.
//   'frozen'  — covered by a spent streak freeze, ALSO not a real transaction
//               — a different glyph entirely (Snowflake, not a recoloured
//               Flame), reusing the exact ice-blue language Home's freeze
//               chip already established, so "this day is frozen" reads as
//               unmistakably its own thing rather than a flame variant.
//   null / undefined / anything else — unlit (neutral fill, hollow muted
//               flame).
//
// This is the streak's atom. The 7-day row on the celebration screen and the
// month grid on /streak both render it, so the two can't drift into different
// visual languages for the same idea — which is exactly how the original plain
// squares ended up meaning nothing.
export function StreakFlame({ type, size = 34, dark = false, dimmed = false }) {
  const isLogged = type === 'logged';
  const isNospend = type === 'nospend';
  const isFrozen = type === 'frozen';

  const cellStyle = isLogged
    ? styles.cellLit
    : isFrozen
      ? styles.cellFrozen
      : isNospend
        ? styles.cellNospend
        : dark
          ? styles.cellEmptyDark
          : styles.cellEmpty;

  const iconColor = isLogged
    ? colors.streakDeep
    : isFrozen
      ? colors.iceBlue
      : isNospend
        ? colors.income
        : dark
          ? colors.mutedDarker
          : colors.mutedLight;

  return (
    <View style={[styles.cell, { width: size, height: size, borderRadius: radii.pill }, cellStyle, dimmed && styles.dimmed]}>
      {isFrozen ? (
        // Snowflake has no closed/fillable region (just radiating strokes,
        // same shape Home's freeze chip already renders) — no `fill` prop,
        // a bolder strokeWidth is what reads as "solid" for a line-only glyph.
        <Snowflake size={size * 0.5} color={iconColor} strokeWidth={2.8} />
      ) : (
        <Flame
          size={size * 0.5}
          // The deep orange on the orange fill — same hue, darker value, so the
          // flame sits IN the circle rather than fighting it. A white or ink flame
          // would read as a separate object stamped on top. Same reasoning for
          // the nospend green.
          color={iconColor}
          fill={isLogged || isNospend ? iconColor : 'transparent'}
          strokeWidth={2.4}
        />
      )}
    </View>
  );
}

export const STREAK_WINDOW_DAYS = 7;

// The trailing 7 days, newest → oldest. useStreak's history is longer (42
// days, for the month grid); only the last week is shown here. Reversed from
// chronological (oldest-first) order deliberately: for a brand-new or young
// streak, only the last day or two are actually lit, and oldest-first put
// those lit cells at the very END of the row — a new user's one real day of
// progress read as an afterthought tacked onto a mostly-empty week. Newest
// (today) first puts the thing worth celebrating up front, with the rest of
// the row reading as "what's ahead," not "what's missing."
export default function StreakDays({ history, size = 34, dark = false }) {
  const days = history.slice(-STREAK_WINDOW_DAYS).reverse();

  return (
    <View style={styles.row}>
      {days.map((day) => (
        <StreakFlame key={day.date} type={day.type} size={size} dark={dark} />
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
  // No-spend day — a muted income-green wash, deliberately NOT the vivid
  // streak orange: covered ≠ logged, and the calendar must say so at a glance.
  cellNospend: {
    backgroundColor: colors.incomeBg,
  },
  // Frozen day — pale ice wash, same iceBlue/iceBlueBg pairing Home's freeze
  // chip already uses. A third distinct look, never mistaken for logged or
  // no-spend.
  cellFrozen: {
    backgroundColor: colors.iceBlueBg,
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
