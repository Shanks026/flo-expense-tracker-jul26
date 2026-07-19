import useStreak from './useStreak';

// The single unresolved gap immediately behind today — 18-gamification-
// ritual-and-ledger.md Phase 4. Fully derived from useStreak's own
// `daysSinceLastLog`/`history`, no new query, no new storage.
//
// `daysSinceLastLog` (lib/streak.js) counts days since the last COVERED day
// (logged, no-spend, or already-frozen) — 0 if that was today, 1 if
// yesterday, etc. The genuinely MISSED days are the ones strictly between
// that last covered day and today: `daysSinceLastLog - 1` of them. Infinity
// (never covered anything, ever — a brand-new account) and 0-or-negative
// (already covered today, or the edge maths lands on nothing) both correctly
// resolve to an empty list — never a "you missed 41 days" prompt for an
// account that simply hasn't existed that long, and never a prompt at all
// once today is already handled.
//
// Returned oldest → newest, same order as `history` itself. A caller that can
// only partially cover the gap (fewer freezes than missed days) MUST use the
// dates closest to today, not the oldest ones — computeStreak's `current`
// only extends backward through a CONTIGUOUS covered run starting at today,
// so freezing the wrong end of a partial gap buys zero streak benefit even
// though real freezes were spent. That slicing is the caller's job
// (FreezePrompt), not this hook's.
export default function useMissedDays() {
  const { daysSinceLastLog, history, loading } = useStreak();

  if (loading) return { missedDates: [], loading: true };

  if (!Number.isFinite(daysSinceLastLog)) return { missedDates: [], loading: false };

  const missedCount = daysSinceLastLog - 1;
  if (missedCount <= 0) return { missedDates: [], loading: false };

  // history: oldest → newest, today last. The missed run is the
  // `missedCount` entries immediately before today.
  const missedDates = history.slice(-1 - missedCount, -1).map((d) => d.date);
  return { missedDates, loading: false };
}
