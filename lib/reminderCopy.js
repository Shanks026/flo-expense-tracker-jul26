// Server-sent daily reminder copy (17-server-push-notifications.md Phase 2).
// Same voice as lib/greetings.js: sentence case, no exclamation marks, no
// emoji, second person, never shame the user for *spending* — only gently
// nudge for not *logging*.
//
// Keyed by trigger × whether they logged YESTERDAY — not day of week. First
// pass keyed on the calendar day, but that produced copy that was really
// just "which day is it" filler dressed up as a reminder — it never said
// anything about whether the user actually needs the nudge. `loggedYesterday`
// is the one piece of real state that's cheap to check server-side (see
// send-push/index.ts's has_logged_on_relative_day RPC) and meaningfully
// changes what's worth saying:
//   - morning: momentum ("you're ahead of yourself") vs a clean restart
//   - evening: something's actually at stake (today would break a real
//     streak) vs an ordinary quiet day with nothing on the line
// A small pool per state (not one fixed line) for enough day-to-day variety
// that it doesn't read as a broken record — rotated by day-of-week purely
// as a pick index, not as the thing that decides WHAT is said.
//
// Deliberately NOT imported by the Edge Function — Deno can't import an
// Expo/RN module graph. This table is duplicated, by hand, into
// supabase/functions/send-push/reminderCopy.ts in plain-object form. Keep
// both in sync; same accepted-duplication precedent as
// 06-transaction-auto-detect.md's lib/smsParser.js ↔ TransactionParser.kt.
const REMINDER_COPY = {
  morning: {
    // Logged yesterday — there's momentum to protect, so the copy leans
    // into keeping it going rather than starting from zero.
    momentum: [
      { title: "You're ahead of yourself, {name}", body: 'Yesterday’s logged. Keep the momentum going today.' },
      { title: 'Keep it going, {name}', body: "Yesterday's done — let's make it two in a row." },
      { title: 'Morning, {name}', body: "You're on a roll. Log today and keep it that way." },
    ],
    // Didn't log yesterday — a clean-slate restart, never a scold.
    restart: [
      { title: 'New day, {name}', body: "Yesterday slipped by — today's a clean start." },
      { title: 'Morning, {name}', body: "Nothing logged yesterday. Let's turn today around." },
      { title: 'Fresh start, {name}', body: 'One entry today gets things moving again.' },
    ],
  },
  evening: {
    // Only ever sent when today hasn't been logged (that's the trigger
    // condition) — momentum here means yesterday WAS logged, so today's
    // miss is actually breaking something, not just an ordinary gap.
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

export function getReminderCopy(trigger, loggedYesterday, pickIndex, name) {
  const pool = REMINDER_COPY[trigger][loggedYesterday ? 'momentum' : 'restart'];
  const entry = pool[((pickIndex % pool.length) + pool.length) % pool.length];
  return { title: entry.title.replace('{name}', name), body: entry.body };
}
