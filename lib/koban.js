
// Koban's tiered copy pools — see 05-koban-engagement.md Phase 3. Pure, no
// React/Supabase/Notifications imports, so it's testable standalone the same
// way lib/streak.js is.
//
// Voice rules (app-wide copy is terse, no exclamation marks — Koban is
// warmer but not a different app): sentence case, at most one emoji and only
// in the title, never shame the user for *spending* — only for not
// *knowing*. Koban is a bookkeeper who misses you, not a scold.

// Milestones worth an interrupt even on a silent (Recap) slot — mirrors
// lib/streak.js's MILESTONES, kept independent since this is copy config,
// not streak math.
export const MILESTONES = [7, 30, 100];

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
    () => ({ title: 'Start a streak', body: "One entry today and Koban's paw goes up." }),
    () => ({ title: "Koban's ledger is empty", body: 'First entry starts the streak — takes ten seconds.' }),
    () => ({ title: 'No entries yet', body: 'FLO works best once you start. One transaction to begin.' }),
    () => ({ title: 'Ready when you are', body: "Log one thing today and Koban's paw lifts." }),
    () => ({ title: 'The streak starts with you', body: "One entry. That's the whole ask." }),
  ],
  at_risk: [
    (c) => ({ title: `Day ${c}. Don't break it now.`, body: 'One entry keeps it alive.' }),
    (c) => ({ title: `${c} day${c === 1 ? '' : 's'} in — don't stop now.`, body: "Today's the one that keeps the streak going." }),
    (c) => ({ title: "Koban's watching your streak", body: `Day ${c}, and it's still yours to lose.` }),
    (c) => ({ title: `Don't let day ${c} slip`, body: 'One entry, thirty seconds, streak intact.' }),
    (c) => ({ title: 'The streak needs you today', body: `Day ${c} and counting — keep it that way.` }),
  ],
  silent_1: [
    () => ({ title: 'Anything happen today?', body: "Koban's ledger has a suspicious blank spot where today should be." }),
    () => ({ title: 'Quiet day?', body: "Even a ₹0 day is worth a note — or maybe you just forgot." }),
    () => ({ title: "Today's missing", body: 'One entry catches you up.' }),
    () => ({ title: 'Koban noticed the gap', body: "Yesterday's fine. Today's still open." }),
    () => ({ title: 'Just checking in', body: 'Nothing logged today yet.' }),
  ],
  silent_2_3: [
    (_c, d) => ({ title: `${d} days off the books`, body: 'This is exactly how ₹2,000 disappears without a trace.' }),
    (_c, d) => ({ title: "Koban's paw is drooping", body: `${d} days quiet. Everything okay?` }),
    (_c, d) => ({ title: `${d} days, zero entries`, body: 'Small gaps turn into big blind spots.' }),
    (_c, d) => ({ title: "The ledger's gone quiet", body: `${d} days since you last logged anything.` }),
    (_c, d) => ({ title: `Day ${d} of silence`, body: 'A quick catch-up keeps the numbers honest.' }),
  ],
  silent_4_6: [
    (_c, d) => ({ title: 'Your budgets are guessing', body: `${d} days, zero entries. FLO is just decoration right now.` }),
    (_c, d) => ({ title: 'This is the danger zone', body: `${d} days quiet — budgets and plans are running blind.` }),
    (_c, d) => ({ title: `${d} days and counting`, body: "Koban's getting worried. So is your budget." }),
    (_c, d) => ({ title: "Numbers don't lie, but they do go quiet", body: `${d} days with nothing logged.` }),
    (_c, d) => ({ title: 'Almost a week dark', body: `${d} days — worth ten minutes to catch up.` }),
  ],
  silent_7_plus: [
    () => ({ title: 'The lucky cat is not feeling lucky', body: 'A week in the dark. Want to see the damage?' }),
    (_c, d) => ({ title: '😿 It\'s been a while', body: `${d} days since anything was logged.` }),
    () => ({ title: "Koban's paw is all the way down", body: "This long a gap, and FLO can't tell you anything useful." }),
    (_c, d) => ({ title: 'Time to face the numbers', body: `${d} days of silence — a fresh start beats a perfect record.` }),
    () => ({ title: "The ledger's cold", body: 'One entry gets it moving again.' }),
  ],
};

// Random pick WITHIN tier, seeded by dayIndex so consecutive days inside one
// scheduled window never repeat the same line back-to-back (a same-tier run
// of e.g. i=3,4,5 picks pool[3%5], pool[4%5], pool[0%5] — three different
// lines). Not a strict never-repeats-ever guarantee, just enough variety
// that a 30-day window doesn't feel like a broken record.
export function pickNudge({ streak, daysSinceLastLog, dayIndex }) {
  const tier = nudgeTier(streak, daysSinceLastLog);
  const pool = NUDGE_POOLS[tier];
  const pick = pool[((dayIndex % pool.length) + pool.length) % pool.length];
  return pick(streak, daysSinceLastLog);
}

// --- Recap tier selection --------------------------------------------------
//
// NO TRANSACTION DATA IN ANY RECAP COPY (2026-07-13). Every pool used to quote
// the day's spent/earned/count. Two reasons that's gone, and it must not creep
// back in:
//
// 1. It can be stale by the time it's read. The recap NOTIFICATION is composed
//    at schedule time (see buildReminderPlan), not at delivery time — so its
//    totals are a snapshot from whenever rescheduleAll last ran, and the copy
//    can confidently announce numbers that no longer match the day. Copy that
//    quotes data has to be generated at the moment it's shown; this isn't.
// 2. It's the wrong register. This is a streak celebration, not a statement.
//    "₹450 out, ₹0 in" reads as a bleak little balance sheet at the exact
//    moment the app is supposed to be congratulating you — and on day 0 there
//    is no day to summarise at all.
//
// The numbers already live on Home, Analytics, and Transactions, computed live.
// Keep this surface to the fun.
const RECAP_POOLS = {
  // isNewStreak — the account's very first transaction (or first after a
  // gap) landed today. Displayed as "Day 0", never "Day 1" — a deliberate,
  // user-specified convention (see 05-koban-engagement.md Phase 2/3): the
  // underlying streak count is still 1 internally, only this label differs.
  // EVERY variant must say, in plain words, that a streak has started. A pool
  // rotates — the user sees exactly one of these — so "the streak is mentioned
  // somewhere in the pool" is worth nothing. Copy that only Koban understands
  // ("Paw's up") left people unsure what the screen even was.
  new_streak: [
    () => ({ title: '🐱 You started a streak', body: "This is Day 0. Log again tomorrow and it's real." }),
    () => ({ title: '🐱 Streak started', body: 'Day 0. One entry a day is all it takes to keep it alive.' }),
    () => ({ title: "🐱 Paw's up — your streak begins", body: "Day 0 of something new. Don't break it." }),
    () => ({ title: '🐱 Day 0. Streak started.', body: 'Come back tomorrow and it becomes a real one.' }),
    () => ({ title: '🐱 Your streak has started', body: "That's Day 0. Koban is watching." }),
  ],
  ongoing: [
    (c) => ({ title: `🐱 Day ${c} locked in`, body: 'Same again tomorrow.' }),
    (c) => ({ title: `🐱 Day ${c}, still going`, body: "Koban's paw stays up." }),
    (c) => ({ title: `Streak holds at day ${c}`, body: "Don't be the one who breaks it." }),
    (c) => ({ title: `🐱 Koban approves — day ${c}`, body: 'The chain grows one more link.' }),
    (c) => ({ title: `🐱 Day ${c} done right`, body: 'Tomorrow makes it better.' }),
  ],
  milestone: [
    (c) => ({ title: `${c} days. Koban is impressed.`, body: 'That takes actual discipline.' }),
    (c) => ({ title: `🎉 ${c}-day streak`, body: "That's real consistency. Keep going." }),
    (c) => ({ title: `Day ${c} — a real milestone`, body: 'Most people never get here.' }),
    (c) => ({ title: `${c} days straight`, body: "Koban's paw has never been higher." }),
    (c) => ({ title: `🐱 ${c} days. Impressive.`, body: 'Now go make it a habit you never think about.' }),
  ],
};

// Seeded by the actual date (not a caller-supplied dayIndex — a Recap only
// ever schedules for TODAY's single slot, so there's no "window position" to
// seed from the way pickNudge has). Days-since-epoch changes once a day,
// giving day-to-day variety across repeat visits to the same tier (e.g.
// several ordinary "ongoing" recaps in a row) without needing wall-clock
// randomness that would make this untestable.
// No todayTotals parameter any more — see the RECAP_POOLS comment above. If you
// find yourself wanting to pass it back in, read that first.
export function pickRecap({ streak, isNewStreak, isMilestone }) {
  const tierKey = isNewStreak ? 'new_streak' : isMilestone ? 'milestone' : 'ongoing';
  const pool = RECAP_POOLS[tierKey];
  const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  const pick = pool[daysSinceEpoch % pool.length];
  return pick(streak);
}

// Fixed label for the in-app celebration screen, stated independently of which
// copy variant pickRecap happened to draw. The pools rotate; this doesn't. It's
// the one thing on the screen that always says what the screen IS — which the
// varied, playful titles can't be relied on to do, and didn't.
//
// Not used by the recap NOTIFICATION (a notification has no room for an
// eyebrow, and its title carries the context instead).
export function recapEyebrow({ streak, isNewStreak }) {
  if (isNewStreak) return 'STREAK STARTED';
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
export function buildReminderPlan({ streak, hour, minute, now = new Date(), windowDays = 30 }) {
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
      content = pickRecap({
        streak: streak.current,
        isNewStreak: streak.isNewStreak,
        isMilestone: streak.isMilestone,
      });
      // A milestone earns the interrupt even on a slot that would otherwise
      // be silent.
      lane = streak.isMilestone ? 'nudge' : 'recap';
    } else {
      const projectedDaysSinceLastLog = baseDaysSinceLastLog + i;
      const projectedCurrent = i === firstSilentDayIndex && streak.current > 0 ? streak.current : 0;
      content = pickNudge({
        streak: projectedCurrent,
        daysSinceLastLog: projectedDaysSinceLastLog,
        dayIndex: i,
      });
      lane = 'nudge';
    }

    plan.push({ dayIndex: i, fireDate, content, lane });
  }

  return plan;
}
