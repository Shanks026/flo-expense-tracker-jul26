// Koban's celebration copy — see 05-koban-engagement.md Phase 3. Pure, no
// React/Supabase/Notifications imports, so it's testable standalone the same
// way lib/streak.js is.
//
// The nudge-copy pools and buildReminderPlan/toneFromCommitment that used to
// live here were removed 2026-07-19 (17-server-push-notifications.md Phase
// 2) — the daily reminder is now sent server-side, not locally scheduled,
// and its copy now lives in lib/reminderCopy.js (client) /
// supabase/functions/send-push/reminderCopy.ts (its Deno-runtime twin),
// following the SAME voice rules stated below, not koban.js's tiered pools.
//
// Voice rules (app-wide copy is terse, no exclamation marks — Koban is
// warmer but not a different app): sentence case, at most one emoji and only
// in the title, never shame the user for *spending* — only for not
// *knowing*. Koban is a bookkeeper who misses you, not a scold.

// --- The milestone celebration's line ------------------------------------
//
// The in-app celebration (components/StreakCelebration.js) shows one of these
// on a streak milestone. Fun only, no numbers: "₹450 out, ₹0 in" reads as a
// bleak little balance sheet at the moment the app is congratulating you.
// The day-one and ordinary-day pools, the eyebrow and the button copy went in
// spec 49's cleanup (ticket 11): only milestones celebrate now.
const MILESTONE_LINES = [
  (c) => ({ title: `${c} days. Genuinely impressive.`, body: 'That takes actual discipline.' }),
  (c) => ({ title: `🎉 ${c}-day streak`, body: "That's real consistency. Keep going." }),
  (c) => ({ title: `Day ${c} — a real milestone`, body: 'Most people never get here.' }),
  (c) => ({ title: `${c} days straight`, body: "That's not luck, that's consistency." }),
  (c) => ({ title: `${c} days. Impressive.`, body: 'Now go make it a habit you never think about.' }),
];

// Seeded by the date: days-since-epoch changes once a day, giving day-to-day
// variety without wall-clock randomness that would make this untestable.
export function pickMilestoneLine({ streak }) {
  const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  return MILESTONE_LINES[daysSinceEpoch % MILESTONE_LINES.length](streak);
}

// The streak screen's headline. Lives here, in the copy layer, rather than in
// the component. `current` is 1 on the day a streak starts, shown as "Day 1"
// (the earlier "Day 0" convention was dropped; see lib/streak.js).
//
// Four states, genuinely different things — a 0 streak must never be told
// "don't break it" (there is nothing to break), and a streak that's
// alive-but-unlogged-today is the one moment worth a nudge. The ordinary
// logged-today case no longer echoes the count ("N days and counting" sat
// right under the giant "N day streak!" on the card — pure repetition, per
// direct feedback); it shows a milestone-varied hero line instead, so the
// headline actually changes as the streak grows rather than restating a number.
const STREAK_HERO_BANDS = [
  { min: 1000, text: 'A thousand days. Simply untouchable.' },
  { min: 500, text: 'Five hundred days. Legend territory now.' },
  { min: 365, text: 'A full year — every single day. Incredible.' },
  { min: 300, text: 'Three hundred days of never breaking.' },
  { min: 200, text: 'Two hundred days. Unbroken and unbothered.' },
  { min: 150, text: 'A hundred and fifty days of showing up.' },
  { min: 100, text: 'A hundred days. This is who you are now.' },
  { min: 50, text: 'Fifty days. Most people never get here.' },
  { min: 30, text: 'A whole month. That is real discipline.' },
  { min: 10, text: 'Ten days strong — not missing a beat.' },
  { min: 7, text: 'A full week. This is becoming second nature.' },
  { min: 3, text: 'Three days in. The habit is forming.' },
];

// Milestone-varied congratulatory line for an active streak — keyed on the
// highest streak milestone reached, so it changes AT each milestone instead of
// repeating one line forever. Below the first milestone (day 3) it's a gentle
// keep-going nudge.
export function streakHero(current) {
  const band = STREAK_HERO_BANDS.find((b) => current >= b.min);
  return band ? band.text : 'Every day counts. Keep it rolling.';
}

export function streakHeadline({ current, loggedToday, isNewStreak }) {
  if (current === 0) return 'Log today to start a streak';
  if (isNewStreak) return 'Day 1 — your streak begins';
  if (!loggedToday) return `${current} days — don't drop it today`;
  return streakHero(current);
}
