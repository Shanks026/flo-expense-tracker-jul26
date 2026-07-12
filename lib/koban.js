import { formatMoney } from './money';

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

const RECAP_POOLS = {
  // isNewStreak — the account's very first transaction (or first after a
  // gap) landed today. Displayed as "Day 0", never "Day 1" — a deliberate,
  // user-specified convention (see 05-koban-engagement.md Phase 2/3): the
  // underlying streak count is still 1 internally, only this label differs.
  new_streak: [
    (_c, t) => ({ title: "🐱 Day 0. Paw's up.", body: `${formatMoney(t.spent)} out, ${formatMoney(t.earned)} in. You've started a streak.` }),
    () => ({ title: "🐱 First entry's in", body: 'Day 0 — come back tomorrow and it\'s a real streak.' }),
    (_c, t) => ({ title: "🐱 Koban's paw just went up", body: `${formatMoney(t.spent)} out, ${formatMoney(t.earned)} in today. Day 0 of something new.` }),
    () => ({ title: '🐱 Streak started', body: 'One entry today. That\'s Day 0.' }),
    (_c, t) => ({ title: '🐱 Off to a start', body: `${t.count} ${t.count === 1 ? 'entry' : 'entries'} today, ${formatMoney(t.spent)} out. Day 0.` }),
  ],
  ongoing: [
    (c, t) => ({ title: `🐱 Day ${c} locked in`, body: `${formatMoney(t.spent)} out · ${formatMoney(t.earned)} in, ${t.count} ${t.count === 1 ? 'entry' : 'entries'}.` }),
    (c, t) => ({ title: `🐱 Day ${c}, still going`, body: `${formatMoney(t.spent)} out · ${formatMoney(t.earned)} in today.` }),
    (c, t) => ({ title: `Streak holds at day ${c}`, body: `${t.count} ${t.count === 1 ? 'entry' : 'entries'}, ${formatMoney(t.spent)} out · ${formatMoney(t.earned)} in.` }),
    (c, t) => ({ title: `🐱 Koban approves — day ${c}`, body: `${formatMoney(t.spent)} out · ${formatMoney(t.earned)} in today.` }),
    (c, t) => ({ title: `🐱 Day ${c} done right`, body: `${t.count} ${t.count === 1 ? 'entry' : 'entries'} logged, ${formatMoney(t.spent)} out · ${formatMoney(t.earned)} in.` }),
  ],
  milestone: [
    (c, t) => ({ title: `${c} days. Koban is impressed.`, body: `${formatMoney(t.spent)} out · ${formatMoney(t.earned)} in today.` }),
    (c) => ({ title: `🎉 ${c}-day streak`, body: 'That\'s real consistency. Keep going.' }),
    (c, t) => ({ title: `Day ${c} — a real milestone`, body: `${formatMoney(t.spent)} out · ${formatMoney(t.earned)} in today.` }),
    (c) => ({ title: `${c} days straight`, body: "Koban's paw has never been higher." }),
    (c, t) => ({ title: `🐱 ${c} days. Impressive.`, body: `${t.count} ${t.count === 1 ? 'entry' : 'entries'} today, ${formatMoney(t.spent)} out · ${formatMoney(t.earned)} in.` }),
  ],
};

// Seeded by the actual date (not a caller-supplied dayIndex — a Recap only
// ever schedules for TODAY's single slot, so there's no "window position" to
// seed from the way pickNudge has). Days-since-epoch changes once a day,
// giving day-to-day variety across repeat visits to the same tier (e.g.
// several ordinary "ongoing" recaps in a row) without needing wall-clock
// randomness that would make this untestable.
export function pickRecap({ streak, isNewStreak, isMilestone, todayTotals }) {
  const tierKey = isNewStreak ? 'new_streak' : isMilestone ? 'milestone' : 'ongoing';
  const pool = RECAP_POOLS[tierKey];
  const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  const pick = pool[daysSinceEpoch % pool.length];
  return pick(streak, todayTotals);
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
        todayTotals: streak.todayTotals,
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
