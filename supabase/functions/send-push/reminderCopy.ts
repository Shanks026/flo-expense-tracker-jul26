// Deno-runtime twin of lib/reminderCopy.js — kept in sync BY HAND. Deno
// can't import an Expo/RN module graph, so this table is duplicated here in
// plain-object form. Same accepted-duplication precedent as
// 06-transaction-auto-detect.md's lib/smsParser.js ↔ TransactionParser.kt.
// If you tune one, tune the other.
type ReminderEntry = { title: string; body: string };
type Trigger = 'morning' | 'evening';
type State = 'momentum' | 'restart';

const REMINDER_COPY: Record<Trigger, Record<State, ReminderEntry[]>> = {
  morning: {
    momentum: [
      { title: "You're ahead of yourself, {name}", body: 'Yesterday’s logged. Keep the momentum going today.' },
      { title: 'Keep it going, {name}', body: "Yesterday's done — let's make it two in a row." },
      { title: 'Morning, {name}', body: "You're on a roll. Log today and keep it that way." },
    ],
    restart: [
      { title: 'New day, {name}', body: "Yesterday slipped by — today's a clean start." },
      { title: 'Morning, {name}', body: "Nothing logged yesterday. Let's turn today around." },
      { title: 'Fresh start, {name}', body: 'One entry today gets things moving again.' },
    ],
  },
  evening: {
    momentum: [
      { title: 'You missed it today, {name}', body: "Don't let it become two — one entry keeps things going." },
      { title: "{name}, today's still open", body: 'You were on a roll — one entry tonight keeps it that way.' },
      { title: 'Evening check-in, {name}', body: 'Today slipped by. Catch up before you turn in.' },
    ],
    restart: [
      { title: 'Evening, {name}', body: "Nothing logged today — whenever you're ready." },
      { title: '{name}, quiet day?', body: 'No pressure, just a gentle nudge to log something.' },
      { title: 'Evening, {name}', body: "Today's ledger is empty. Tomorrow's a fresh chance too." },
    ],
  },
};

export function getReminderCopy(trigger: Trigger, loggedYesterday: boolean, pickIndex: number, name: string) {
  const pool = REMINDER_COPY[trigger][loggedYesterday ? 'momentum' : 'restart'];
  const entry = pool[((pickIndex % pool.length) + pool.length) % pool.length];
  return { title: entry.title.replace('{name}', name), body: entry.body };
}
