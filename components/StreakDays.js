import { View, StyleSheet } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Flame, Check, Snowflake } from 'lucide-react-native';
// The static palette only for `dark` cells (a permanently dark surface, e.g.
// StreakCelebration) and mode-independent fills; mode-following cells read the
// theme (37-design-system-and-koban.md).
import { colors, radii } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';


// Per-cell stagger step for the `animated` variant below — small enough that
// 7 cells finish well within half a second, not a slow reveal.
const STAGGER_MS = 60;

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
  const { colors: theme } = useTheme();
  // No-spend day: a muted income-green wash, deliberately NOT the vivid
  // streak orange (covered ≠ logged, and the calendar must say so at a glance).
  const nospendBg = dark ? colors.incomeBg : theme.incomeBg;
  const nospendFg = dark ? colors.income : theme.income;
  const isLogged = type === 'logged';
  const isNospend = type === 'nospend';
  const isFrozen = type === 'frozen';

  const cellStyle = isLogged
    ? styles.cellLit
    : isFrozen
      ? styles.cellFrozen
      : isNospend
        ? { backgroundColor: nospendBg }
        : dark
          ? styles.cellEmptyDark
          : { backgroundColor: theme.chipBg };

  // Flat lucide glyphs only (37-design-system-and-koban.md retired the glossy
  // flame and freeze-medallion PNGs): an outlined grey flame for an empty day,
  // a snowflake on the ice wash for a frozen one.
  const emptyFg = dark ? 'rgba(255,255,255,0.4)' : theme.mutedLight;

  return (
    <View style={[styles.cell, { width: size, height: size, borderRadius: radii.pill }, cellStyle, dimmed && styles.dimmed]}>
      {isFrozen ? (
        <Snowflake size={size * 0.5} color={colors.iceBlue} strokeWidth={2.4} />
      ) : isLogged ? (
        // A plain white checkmark on the rich streak-orange fill — Duolingo's
        // own treatment for a completed day, and simpler/clearer at this
        // small size than the illustrated flame was.
        <Check size={size * 0.5} color="#FFFFFF" strokeWidth={3.4} />
      ) : isNospend ? (
        <Flame size={size * 0.5} color={nospendFg} fill={nospendFg} strokeWidth={2.4} />
      ) : (
        <Flame size={size * 0.5} color={emptyFg} strokeWidth={2.2} />
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
// `animated` (opt-in, off by default) staggers each cell in one-by-one —
// used by StreakCelebration's 7-day row, NOT the /streak screen's month
// grid (42 cells animating in one-by-one on every visit would be noise, not
// a celebration). Same shared StreakFlame primitive either way, so the two
// screens can never drift into different visual languages for the same
// day-state — only the entrance differs. `baseDelay` lets the caller slot
// this into its own staggered sequence (e.g. after a title/body have
// already animated in) instead of always starting at 0.
export default function StreakDays({ history, size = 34, dark = false, animated = false, baseDelay = 0 }) {
  const days = history.slice(-STREAK_WINDOW_DAYS).reverse();

  return (
    <View style={styles.row}>
      {days.map((day, index) =>
        animated ? (
          <Animated.View key={day.date} entering={ZoomIn.delay(baseDelay + index * STAGGER_MS).duration(300)}>
            <StreakFlame type={day.type} size={size} dark={dark} />
          </Animated.View>
        ) : (
          <StreakFlame key={day.date} type={day.type} size={size} dark={dark} />
        )
      )}
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
  // streakFill, not colors.streak — per direct feedback, the logged-day cell
  // should read as orange, not the redder-leaning streak orange.
  cellLit: {
    backgroundColor: colors.streakFill,
  },
  // Frozen day — pale ice wash, same iceBlue/iceBlueBg pairing Home's freeze
  // chip already uses. A third distinct look, never mistaken for logged or
  // no-spend.
  cellFrozen: {
    backgroundColor: colors.iceBlueBg,
  },
  cellEmptyDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dimmed: {
    opacity: 0.35,
  },
});
