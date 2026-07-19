import useStreak from './useStreak';

// Today's ritual state for TodayCard — 18-gamification-ritual-and-ledger.md
// Phase 3. Fully derived from useStreak's own `history` (no new query, no
// storage): the last entry is always today (lib/streak.js builds it oldest→
// newest, today last), and its `logged`/`type` fields already distinguish a
// real transaction from a declared no-spend day.
//
//   'logged'  — at least one transaction was logged today (real earn already
//               claimed by AddTransactionSheet's handleSave).
//   'nospend' — no transaction today, but a no-spend day was declared.
//   'open'    — nothing yet; TodayCard should offer the no-spend declaration.
export default function useDayState() {
  const { history, loading } = useStreak();
  const today = history[history.length - 1];
  const state = !today ? 'open' : today.logged ? 'logged' : today.type === 'nospend' ? 'nospend' : 'open';
  return { state, loading };
}
