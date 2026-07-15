import { formatMoney } from './money';

// Koban's tiered copy pools — see 05-koban-engagement.md Phase 3. Pure, no
// React/Supabase/Notifications imports, so it's testable standalone the same
// way lib/streak.js is.
//
// Voice rules (app-wide copy is terse, no exclamation marks — Koban is
// warmer but not a different app): sentence case, at most one emoji and only
// in the title, never shame the user for *spending* — only for not
// *knowing*. Koban is a bookkeeper who misses you, not a scold.

// MILESTONES used to be duplicated here ([7, 30, 100]) "kept independent since
// this is copy config, not streak math". Deleted 2026-07-14: nothing ever
// imported it, and the moment the real list in lib/streak.js changed, this copy
// silently disagreed with it. A dead constant that looks authoritative is worse
// than no constant. There is exactly one milestone list, and it lives in
// lib/streak.js, which is also the only thing that computes `isMilestone`.

// --- Nudge tier selection -------------------------------------------------
//
// Corrected during implementation (2026-07-12) from the original plan's
// tier table, which read `current === 0` as one single "No streak" bucket.
// Two real bugs that would have shipped from that:
//
// 1. Empirically verified (see Phase 3's Implementation Notes):
//    `daysSinceLastLog === 1` ALWAYS implies `current >= 1` — the streak-
//    counting loop's very first check, when nothing is logged today, IS
//    "yesterday", the same cell daysSinceLastLog measures from. So a
//    same-day Nudge can never actually be in a state of "exactly 1 day
//    silent AND no streak at risk" — whenever there's exactly one silent
//    day, there is always, structurally, a streak (even a 1-day one) at
//    risk. The "streak at risk" tier must therefore win outright whenever
//    `current > 0`, ahead of any daysSinceLastLog-keyed tier — not be a
//    separate, differently-triggered tier as the original table implied.
// 2. "Never logged a single transaction, ever" (`daysSinceLastLog ===
//    Infinity`) and "used to log, gone quiet for a week" (`daysSinceLastLog
//    >= 7`, `current === 0`) are emotionally opposite states that the
//    original `current === 0` bucket conflated. A brand-new user who hasn't
//    started yet should never see "the lucky cat is not feeling lucky" —
//    that's a guilt line for someone who *stopped*, not someone who never
//    began. Split into its own `never_started` tier with inviting-only copy.
function nudgeTier(current, daysSinceLastLog) {
  if (current > 0) return 'at_risk';
  if (!Number.isFinite(daysSinceLastLog)) return 'never_started';
  if (daysSinceLastLog === 1) return 'silent_1'; // kept for defensive completeness — see note above on why this is structurally rare/unreachable given current computeStreak semantics; harmless to retain, costs nothing, guards against the invariant changing later.
  if (daysSinceLastLog <= 3) return 'silent_2_3';
  if (daysSinceLastLog <= 6) return 'silent_4_6';
  return 'silent_7_plus';
}

const NUDGE_POOLS = {
  never_started: [
    () => ({ title: 'Start a streak', body: 'One entry today is all it takes to begin.' }),
    () => ({ title: 'Your ledger is empty', body: 'First entry starts the streak — takes ten seconds.' }),
    () => ({ title: 'No entries yet', body: 'FLO works best once you start. One transaction to begin.' }),
    () => ({ title: 'Ready when you are', body: 'Log one thing today and the streak begins.' }),
    () => ({ title: 'The streak starts with you', body: "One entry. That's the whole ask." }),
  ],
  at_risk: [
    (c) => ({ title: `Day ${c}. Don't break it now.`, body: 'One entry keeps it alive.' }),
    (c) => ({ title: `${c} day${c === 1 ? '' : 's'} in — don't stop now.`, body: "Today's the one that keeps the streak going." }),
    (c) => ({ title: 'Your streak is on the line', body: `Day ${c}, and it's still yours to lose.` }),
    (c) => ({ title: `Don't let day ${c} slip`, body: 'One entry, thirty seconds, streak intact.' }),
    (c) => ({ title: 'The streak needs you today', body: `Day ${c} and counting — keep it that way.` }),
  ],
  silent_1: [
    () => ({ title: 'Anything happen today?', body: "There's a suspicious blank spot where today should be." }),
    () => ({ title: 'Quiet day?', body: "Even a ₹0 day is worth a note — or maybe you just forgot." }),
    () => ({ title: "Today's missing", body: 'One entry catches you up.' }),
    () => ({ title: 'Noticed the gap', body: "Yesterday's fine. Today's still open." }),
    () => ({ title: 'Just checking in', body: 'Nothing logged today yet.' }),
  ],
  silent_2_3: [
    (_c, d) => ({ title: `${d} days off the books`, body: 'This is exactly how ₹2,000 disappears without a trace.' }),
    (_c, d) => ({ title: 'Things have gone quiet', body: `${d} days quiet. Everything okay?` }),
    (_c, d) => ({ title: `${d} days, zero entries`, body: 'Small gaps turn into big blind spots.' }),
    (_c, d) => ({ title: "The ledger's gone quiet", body: `${d} days since you last logged anything.` }),
    (_c, d) => ({ title: `Day ${d} of silence`, body: 'A quick catch-up keeps the numbers honest.' }),
  ],
  silent_4_6: [
    (_c, d) => ({ title: 'Your budgets are guessing', body: `${d} days, zero entries. FLO is just decoration right now.` }),
    (_c, d) => ({ title: 'This is the danger zone', body: `${d} days quiet — budgets and plans are running blind.` }),
    (_c, d) => ({ title: `${d} days and counting`, body: "Your budget's running blind too." }),
    (_c, d) => ({ title: "Numbers don't lie, but they do go quiet", body: `${d} days with nothing logged.` }),
    (_c, d) => ({ title: 'Almost a week dark', body: `${d} days — worth ten minutes to catch up.` }),
  ],
  silent_7_plus: [
    () => ({ title: 'A week in the dark', body: 'Want to see the damage?' }),
    (_c, d) => ({ title: "It's been a while", body: `${d} days since anything was logged.` }),
    () => ({ title: 'Nothing logged in a while', body: "This long a gap, and FLO can't tell you anything useful." }),
    (_c, d) => ({ title: 'Time to face the numbers', body: `${d} days of silence — a fresh start beats a perfect record.` }),
    () => ({ title: "The ledger's cold", body: 'One entry gets it moving again.' }),
  ],
};

// --- Tone: derived from onboarding's commitment answer --------------------
// 12-personal-onboarding.md Phase 3 — the commitment question ("how
// committed are you?") only lies if it doesn't change anything. Scoped
// deliberately to the tiers where pressure genuinely varies (a streak
// actually at risk, or a real gap of silence) — 'never_started' and
// 'silent_1' stay tone-invariant: there's nothing to push harder on for a
// user who hasn't begun, and a same-day check-in is already the gentlest
// register this pool has. Falling back to 'default' (the original, unchanged
// pools) for a 'committed' answer or a missing/older profile with no
// commitment recorded at all.
export function toneFromCommitment(commitment) {
  if (commitment === 'all_in') return 'push';
  if (commitment === 'will_try') return 'gentle';
  return 'default';
}

const TONE_NUDGE_POOLS = {
  at_risk: {
    push: [
      (c) => ({ title: `Day ${c}. Don't break it now.`, body: 'One entry. Right now.' }),
      (c) => ({ title: `${c} days in — this is not the day to quit`, body: 'You said you were all in. Log it.' }),
      (c) => ({ title: `Day ${c} on the line`, body: 'Keep the streak alive. It only takes a minute.' }),
    ],
    gentle: [
      (c) => ({ title: `Day ${c}, whenever you get a chance`, body: "No rush. Just don't forget." }),
      (c) => ({ title: `Still day ${c}`, body: 'A quick entry keeps it going, no pressure.' }),
      (c) => ({ title: `Day ${c} is still open`, body: 'One entry, whenever it suits you.' }),
    ],
  },
  silent_2_3: {
    push: [
      (_c, d) => ({ title: `${d} days gone. Fix it now.`, body: 'This is exactly how money disappears unnoticed.' }),
      (_c, d) => ({ title: `${d} days of nothing. That ends today.`, body: 'Log it, all of it.' }),
    ],
    gentle: [
      (_c, d) => ({ title: `${d} quiet days`, body: 'Whenever you have a moment, a quick catch-up helps.' }),
      (_c, d) => ({ title: `It's been ${d} days`, body: 'No pressure, just a gentle nudge to catch up.' }),
    ],
  },
  silent_4_6: {
    push: [
      (_c, d) => ({ title: `${d} days blind. Fix this.`, body: 'Your budgets are just guessing right now.' }),
    ],
    gentle: [
      (_c, d) => ({ title: `${d} days since your last entry`, body: "Whenever you're ready, we're here." }),
    ],
  },
  silent_7_plus: {
    push: [
      () => ({ title: 'A week dark. Time to fix this.', body: 'Open FLO and catch up, right now.' }),
    ],
    gentle: [
      (_c, d) => ({ title: "It's been a while", body: `${d} days. Come back whenever you're ready, no judgment.` }),
    ],
  },
};

// Random pick WITHIN tier, seeded by dayIndex so consecutive days inside one
// scheduled window never repeat the same line back-to-back (a same-tier run
// of e.g. i=3,4,5 picks pool[3%5], pool[4%5], pool[0%5] — three different
// lines). Not a strict never-repeats-ever guarantee, just enough variety
// that a 30-day window doesn't feel like a broken record.
//
// `tone` (see toneFromCommitment above) is optional and defaults to
// 'default' — every existing caller that doesn't pass it gets byte-for-byte
// the same pools/behaviour as before this feature.
export function pickNudge({ streak, daysSinceLastLog, dayIndex, tone = 'default' }) {
  const tier = nudgeTier(streak, daysSinceLastLog);
  const tonePool = tone !== 'default' ? TONE_NUDGE_POOLS[tier]?.[tone] : null;
  const pool = tonePool ?? NUDGE_POOLS[tier];
  const pick = pool[((dayIndex % pool.length) + pool.length) % pool.length];
  return pick(streak, daysSinceLastLog);
}

// --- Recap: two surfaces, two registers -------------------------------------
//
// There are two recaps and they are NOT the same thing:
//
//   RECAP_POOLS (below)          → the in-app CELEBRATION SCREEN. Fun only, no
//                                  numbers. It's a full-screen takeover on a
//                                  milestone; "₹450 out, ₹0 in" reads as a bleak
//                                  little balance sheet at the exact moment the
//                                  app is congratulating you.
//   RECAP_NOTIFICATION_POOLS     → the nightly NOTIFICATION on a day you logged.
//                                  This one DOES quote the day's totals, because
//                                  that is the entire job: a summary of the day,
//                                  waiting for you at 8pm.
//
// On staleness — an earlier version of this file stripped the totals out of the
// notification too, arguing it was "composed at schedule time, so the numbers
// could be out of date by delivery". That reasoning was WRONG, and the mistake
// is worth recording so it isn't repeated: rescheduleAll() re-runs on every
// notifyChanged() (see useNotificationSync's `version` dependency), and a
// transaction cannot be created without the app being open. So tonight's recap
// is recomposed after every single transaction, and by the time it fires it
// necessarily reflects the day's final state. The totals are safe to quote.
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
// seed from the way pickNudge has). Days-since-epoch changes once a day,
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

// --- Recap: the nightly notification ---------------------------------------
//
// A day you logged. The job here is a SUMMARY — what went out, what came in —
// not a pep talk. This is the half of the daily reminder that answers "what did
// today look like"; the nudge pools above are the other half, for days with
// nothing logged.
const summaryLine = (t) =>
  `${formatMoney(t.spent)} out · ${formatMoney(t.earned)} in · ${t.count} ${t.count === 1 ? 'entry' : 'entries'}`;

const RECAP_NOTIFICATION_POOLS = {
  new_streak: [
    (_c, t) => ({ title: 'Day 1 — streak started', body: summaryLine(t) }),
    (_c, t) => ({ title: 'First entry logged', body: `${summaryLine(t)}. Day 1.` }),
  ],
  ongoing: [
    (c, t) => ({ title: `Day ${c} logged`, body: summaryLine(t) }),
    (c, t) => ({ title: `Today's recap · day ${c}`, body: summaryLine(t) }),
    (c, t) => ({ title: `Day ${c} on the books`, body: summaryLine(t) }),
  ],
  milestone: [
    (c, t) => ({ title: `🎉 ${c}-day streak`, body: summaryLine(t) }),
    (c, t) => ({ title: `🎉 Day ${c}. Genuinely impressive.`, body: summaryLine(t) }),
  ],
};

export function pickRecapNotification({ streak, isNewStreak, isMilestone, todayTotals }) {
  const tierKey = isNewStreak ? 'new_streak' : isMilestone ? 'milestone' : 'ongoing';
  const pool = RECAP_NOTIFICATION_POOLS[tierKey];
  const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  const pick = pool[daysSinceEpoch % pool.length];
  return pick(streak, todayTotals);
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

// --- Rolling reminder window ----------------------------------------------
//
// Pure — no Notifications/AsyncStorage/Supabase import, deliberately, so it's
// testable standalone without native modules or a network connection (unlike
// rescheduleAll in lib/notifications.js, which calls this and then just
// iterates the result into scheduleNotificationAsync calls). Extracted during
// implementation specifically so the doc's "verify the tier ladder + lane
// swap with a throwaway node script" checklist item was actually possible to
// satisfy, not just asserted.
//
// The projection model — "first silent day" — replaces a flawed simpler rule
// from the original plan ("projected current = 0 for every i >= 1"), caught
// while implementing this: that rule would make tomorrow's notification
// discard a strong real streak's "at risk" messaging the very next day,
// defaulting to generic day-1-silence copy regardless of how many days the
// user was actually protecting. The correct rule: only the SINGLE day
// immediately following a real streak carries that streak's actual count —
// every day beyond that projects current = 0, since the streak would already
// be broken by then.
export function buildReminderPlan({ streak, hour, minute, now = new Date(), windowDays = 30, tone = 'default' }) {
  const baseDaysSinceLastLog = streak.loggedToday ? 0 : streak.daysSinceLastLog;
  const firstSilentDayIndex = streak.loggedToday ? 1 : 0;
  const plan = [];

  for (let i = 0; i < windowDays; i++) {
    const fireDate = new Date(now);
    fireDate.setDate(fireDate.getDate() + i);
    fireDate.setHours(hour, minute, 0, 0);
    if (fireDate <= now) continue; // only ever matters for i === 0

    let content;
    let lane; // 'recap' | 'nudge'

    if (i === 0 && streak.loggedToday) {
      // Logged today → a SUMMARY of the day, with the actual numbers.
      content = pickRecapNotification({
        streak: streak.current,
        isNewStreak: streak.isNewStreak,
        isMilestone: streak.isMilestone,
        todayTotals: streak.todayTotals,
      });

      // ALWAYS the silent lane now, milestones included (changed 2026-07-14).
      // A milestone used to escalate to the loud heads-up channel — but a
      // transaction cannot be logged without the app being open, so on a
      // milestone day the user has ALREADY had the full-screen celebration
      // hours earlier. Buzzing them at 8pm to say the same thing again isn't
      // reinforcement, it's repetition, and repetition is how a streak feature
      // curdles into a nag.
      //
      // The asymmetry is the whole design: interrupt to make the user act
      // (the nudge, below, on days they HAVEN'T logged — where no in-app
      // celebration is competing with it), whisper to confirm they did.
      lane = 'recap';
    } else {
      const projectedDaysSinceLastLog = baseDaysSinceLastLog + i;
      const projectedCurrent = i === firstSilentDayIndex && streak.current > 0 ? streak.current : 0;
      content = pickNudge({
        streak: projectedCurrent,
        daysSinceLastLog: projectedDaysSinceLastLog,
        dayIndex: i,
        tone,
      });
      lane = 'nudge';
    }

    plan.push({ dayIndex: i, fireDate, content, lane });
  }

  return plan;
}
