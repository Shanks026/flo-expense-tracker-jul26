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

// --- Recap: two surfaces, two registers -------------------------------------
//
// There are two recaps and they are NOT the same thing:
//
//   RECAP_POOLS (below)          → the in-app CELEBRATION SCREEN. Fun only, no
//                                  numbers. It's a full-screen takeover on a
//                                  milestone; "₹450 out, ₹0 in" reads as a bleak
//                                  little balance sheet at the exact moment the
//                                  app is congratulating you.
//
// The nightly recap NOTIFICATION (which used to quote the day's totals) was
// removed alongside the nudge pools above — the server-side reminder no
// longer distinguishes "logged today" vs "didn't", it's just a twice-daily
// check-in. If a data-driven recap notification comes back later, it starts
// fresh against the new server-push pipeline, not by resurrecting this.
const RECAP_POOLS = {
  // isNewStreak — the account's very first transaction (or first after a
  // gap) landed today. Displayed as "Day 1" — matching `current`, which is
  // already 1 internally (see lib/streak.js) — not the earlier "Day 0"
  // convention this pool used, which read as an off-by-one against how
  // every other streak product (Duolingo etc.) counts a first day.
  // EVERY variant must say, in plain words, that a streak has started. A pool
  // rotates — the user sees exactly one of these — so "the streak is mentioned
  // somewhere in the pool" is worth nothing.
  // No mascot references here (no emoji, no "Koban" personification) —
  // mascot art doesn't exist yet (Phase 5, blocked on user art).
  new_streak: [
    () => ({ title: 'You started a streak!', body: "That's day 1 — the beginning of something good." }),
    () => ({ title: 'Streak started', body: 'Day 1. Beginning of something good?' }),
    () => ({ title: "That's day 1", body: 'A streak just began. Keep it going tomorrow.' }),
    () => ({ title: 'A streak begins', body: "Day 1 today. Let's see where this goes." }),
    () => ({ title: 'First day logged', body: "That's day 1 of a brand new streak." }),
  ],
  ongoing: [
    (c) => ({ title: `Day ${c} locked in`, body: 'Same again tomorrow.' }),
    (c) => ({ title: `Day ${c}, still going`, body: 'Keep the streak alive.' }),
    (c) => ({ title: `Streak holds at day ${c}`, body: "Don't be the one who breaks it." }),
    (c) => ({ title: `Day ${c} in the books`, body: 'The chain grows one more link.' }),
    (c) => ({ title: `Day ${c} done right`, body: 'Tomorrow makes it better.' }),
  ],
  milestone: [
    (c) => ({ title: `${c} days. Genuinely impressive.`, body: 'That takes actual discipline.' }),
    (c) => ({ title: `🎉 ${c}-day streak`, body: "That's real consistency. Keep going." }),
    (c) => ({ title: `Day ${c} — a real milestone`, body: 'Most people never get here.' }),
    (c) => ({ title: `${c} days straight`, body: "That's not luck, that's consistency." }),
    (c) => ({ title: `${c} days. Impressive.`, body: 'Now go make it a habit you never think about.' }),
  ],
};

// Seeded by the actual date (not a caller-supplied dayIndex — a Recap only
// ever schedules for TODAY's single slot, so there's no "window position" to
// seed from the way pickNudge used to). Days-since-epoch changes once a day,
// giving day-to-day variety across repeat visits to the same tier (e.g.
// several ordinary "ongoing" recaps in a row) without needing wall-clock
// randomness that would make this untestable.
// The in-app celebration screen's copy. No totals, deliberately — see above.
export function pickRecap({ streak, isNewStreak, isMilestone }) {
  const tierKey = isNewStreak ? 'new_streak' : isMilestone ? 'milestone' : 'ongoing';
  const pool = RECAP_POOLS[tierKey];
  const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  const pick = pool[daysSinceEpoch % pool.length];
  return pick(streak);
}

// Home's streak line. Lives here, in the copy layer, rather than in the
// component. `current` is 1 on the day a streak starts, and the user is now
// shown "Day 1" — matching `current` directly (the earlier "Day 0"
// convention was dropped; see lib/streak.js).
//
// Four states, and they are genuinely different things — a 0 streak must never
// be told "don't break it" (there is nothing to break), and a streak that's
// alive-but-unlogged-today is the one moment worth a nudge.
export function streakHeadline({ current, loggedToday, isNewStreak }) {
  if (current === 0) return 'Log today to start a streak';
  if (isNewStreak) return 'Day 1 — your streak begins';
  if (!loggedToday) return `${current} days — don't drop it today`;
  return `${current} days and counting`;
}

// Fixed label for the in-app celebration screen, stated independently of which
// copy variant pickRecap happened to draw. The pools rotate; this doesn't. It's
// the one thing on the screen that always says what the screen IS — which the
// varied, playful titles can't be relied on to do, and didn't.
//
// Not used by the recap NOTIFICATION (a notification has no room for an
// eyebrow, and its title carries the context instead).
//
// isNewStreak returns null (no pill at all) — every new_streak title variant
// above already says "streak"/"day 1" outright, so a "STREAK STARTED" pill
// on top of it was pure repetition, not reinforcement.
export function recapEyebrow({ streak, isNewStreak }) {
  if (isNewStreak) return null;
  return `${streak}-DAY STREAK`;
}

// The celebration's button. "Nice!" was a dismissal, not a commitment — it
// asked nothing of the user at the exact moment they're most willing to give
// something. One line for every tier, deliberately: this is the moment you
// close the app and go on with your day, and "Let's go" is the only register
// that fits all of day 0, day 8 and day 100 without sounding smug.
//
// Deliberately NOT part of pickRecap's return value: that object is spread
// straight into expo-notifications' `content`, and an unexpected key there is
// asking for trouble. This is in-app only.
export function recapCta() {
  return "Let's go";
}
