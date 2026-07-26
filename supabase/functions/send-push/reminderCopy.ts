// Deno-runtime twin of lib/reminderCopy.js — kept in sync BY HAND. Deno
// can't import an Expo/RN module graph, so this table is duplicated here in
// plain-object form. Same accepted-duplication precedent as
// 06-transaction-auto-detect.md's lib/smsParser.js ↔ TransactionParser.kt.
// If you tune one, tune the other.
//
// Selection is RANDOM per send (not day-of-week keyed as it originally was —
// that made every Monday identical week-over-week, and re-triggering on the
// same day repeated verbatim). State (momentum vs restart) is still the real
// signal; within a state, a variant is picked at random from the pool.
type ReminderEntry = { title: string; body: string };
type Trigger = 'morning' | 'evening';
type State = 'momentum' | 'restart';

const REMINDER_COPY: Record<Trigger, Record<State, ReminderEntry[]>> = {
  morning: {
    momentum: [
      { title: "You're ahead of yourself, {name}", body: 'Yesterday’s logged. Keep the momentum going today.' },
      { title: 'Keep it going, {name}', body: "Yesterday's done — let's make it two in a row." },
      { title: 'Morning, {name}', body: "You're on a roll. Log today and keep it that way." },
      { title: 'Two in a row, {name}?', body: "Yesterday's in the books — add today and keep the thread going." },
      { title: 'Right where you left off, {name}', body: 'You logged yesterday. Pick it back up with one entry today.' },
      { title: 'Steady on, {name}', body: 'Yesterday counted. One entry keeps today counting too.' },
      { title: 'Good rhythm, {name}', body: "You've got something going. Log today to keep it." },
      { title: 'Morning, {name}', body: 'Yesterday was logged. A quick entry keeps the run alive.' },
    ],
    restart: [
      { title: 'New day, {name}', body: "Yesterday slipped by — today's a clean start." },
      { title: 'Morning, {name}', body: "Nothing logged yesterday. Let's turn today around." },
      { title: 'Fresh start, {name}', body: 'One entry today gets things moving again.' },
      { title: 'Clean slate, {name}', body: "Yesterday's behind you. Today's ready when you are." },
      { title: 'Back to it, {name}', body: 'A single entry today restarts the flow.' },
      { title: "Today's yours, {name}", body: "Yesterday's a blank — log one thing and get rolling." },
      { title: 'Fresh page, {name}', body: "Start today with one entry. That's the whole trick." },
      { title: 'Morning, {name}', body: 'No entries yesterday. Today only needs one to begin again.' },
    ],
  },
  evening: {
    momentum: [
      { title: 'You missed it today, {name}', body: "Don't let it become two — one entry keeps things going." },
      { title: "{name}, today's still open", body: 'You were on a roll — one entry tonight keeps it that way.' },
      { title: 'Evening check-in, {name}', body: 'Today slipped by. Catch up before you turn in.' },
      { title: 'Before the day closes, {name}', body: 'Nothing logged yet today. One entry keeps your run intact.' },
      { title: "{name}, don't lose the thread", body: 'You logged yesterday. A quick entry tonight keeps it alive.' },
      { title: 'One more before bed, {name}?', body: 'Today’s still blank — a single entry protects your momentum.' },
      { title: 'Evening, {name}', body: 'You were on a roll. Keep it going with one entry tonight.' },
      { title: 'Still time tonight, {name}', body: 'Log today before you turn in and stay on track.' },
    ],
    restart: [
      { title: 'Evening, {name}', body: "Nothing logged today — whenever you're ready." },
      { title: '{name}, quiet day?', body: 'No pressure, just a gentle nudge to log something.' },
      { title: 'Evening, {name}', body: "Today's ledger is empty. Tomorrow's a fresh chance too." },
      { title: 'No rush, {name}', body: "If today had any spending, tonight's a fine time to jot it down." },
      { title: 'Evening, {name}', body: 'Whenever it suits you — a quick entry keeps things current.' },
      { title: '{name}, winding down?', body: 'Add anything from today, or start fresh tomorrow. Either works.' },
      { title: 'Gentle reminder, {name}', body: 'Nothing logged today. A single entry whenever you like.' },
      { title: 'End of the day, {name}', body: "Today's still open if you'd like to log something." },
    ],
  },
};

export function getReminderCopy(trigger: Trigger, loggedYesterday: boolean, name: string) {
  const pool = REMINDER_COPY[trigger][loggedYesterday ? 'momentum' : 'restart'];
  const entry = pool[Math.floor(Math.random() * pool.length)];
  return { title: entry.title.replace('{name}', name), body: entry.body };
}
