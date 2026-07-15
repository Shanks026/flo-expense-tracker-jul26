import { differenceInCalendarDays, format, startOfDay } from 'date-fns';

// The days a streak is worth stopping the user for. Day 0 (a brand-new streak)
// is handled separately via isNewStreak — it's a state, not a count.
//
// This drives BOTH the full-screen in-app celebration and the notification's
// milestone tier, deliberately: two different definitions of "special" would
// mean the app throws a party on day 10 and the notification shrugs, or vice
// versa. One list, one answer.
//
// Was [7, 30, 100] and fired the celebration EVERY day you logged, which is the
// bug this fixes: a full-screen takeover on an ordinary Tuesday is not a reward,
// it's a toll booth. Rarity is the entire mechanism — celebrate everything and
// you've celebrated nothing.
export const MILESTONES = [3, 7, 10, 30, 50, 100];

// How many trailing days of history the UI gets. Independent of
// hooks/useStreak.js's 90-day fetch WINDOW_DAYS — that's how far back we query,
// this is how far back we hand to the UI; the fetch window just needs to be >=
// this.
//
// 42, not 30: the streak screen renders a full month grid, which starts on the
// Monday of the week containing the 1st. On the last day of a 31-day month that
// grid reaches ~36 days back — beyond a 30-day history, where the missing days
// would render as *unlogged*. A calendar that quietly shows a real logged day as
// empty is worse than no calendar. 42 (six weeks) covers any month grid with
// room to spare.
export const HISTORY_DAYS = 42;

const dayKey = (d) => format(startOfDay(d), 'yyyy-MM-dd');

// Pure. Takes raw transaction rows ({ created_at, type, amount }) and the
// current time (injected, never read from the ambient clock, so this is
// testable) and derives the whole streak picture. Nothing here is stored —
// a streak is a derived number, and storing it would drift the moment a
// transaction is deleted.
//
// Two things that look like bugs but aren't:
//
// 1. It counts `created_at`, NOT `occurred_at`. `occurred_at` is the date the
//    money moved, and AddTransactionSheet lets the user set it to any past
//    date — so a 30-day streak could be "earned" by backfilling a month of
//    receipts in one sitting. `created_at` measures showing up and logging,
//    which is the behaviour the streak exists to reward.
//
// 2. It buckets into LOCAL days, not UTC days. `created_at` is timestamptz
//    (stored UTC). At IST (+05:30) a transaction logged at 04:00 local is
//    22:30 UTC the *previous* day — bucketing on the raw UTC date would
//    silently break the streak of anyone who logs late at night. startOfDay()
//    resolves in the device's zone, which is what we want.
export function computeStreak(rows, now) {
  const days = new Set();
  for (const row of rows ?? []) {
    days.add(dayKey(new Date(row.created_at)));
  }

  const today = startOfDay(now);
  const loggedToday = days.has(dayKey(today));

  // The streak is "at risk", not dead, until a full day has passed with
  // nothing logged: if today is still empty we count back from yesterday, so
  // the user sees "Day 6, don't break it" rather than an already-zeroed count
  // they have no reason to protect.
  let current = 0;
  let cursor = loggedToday ? today : new Date(today.getTime() - 86400000);
  while (days.has(dayKey(cursor))) {
    current += 1;
    cursor = new Date(cursor.getTime() - 86400000);
  }

  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  // Breaks — the gaps BETWEEN streaks: every time a run of logged days ended
  // and a later one began. One or more consecutive missed days is a single
  // break, not one per day: missing a week is one broken streak, not seven.
  //
  // Counted only within the fetch window (hooks/useStreak.js's 90 days), same
  // cap that already applies to `longest`. A break is only counted once the
  // user has come back — an ongoing gap (they stopped yesterday and haven't
  // returned) is not a break yet, because the streak isn't over until it's
  // replaced by a new one. That's why this counts gaps between logged days and
  // never looks at today.
  let breaks = 0;
  for (const key of sorted) {
    const d = new Date(`${key}T00:00:00`);
    const gap = prev ? differenceInCalendarDays(d, prev) : 0;
    if (gap > 1) breaks += 1;
    run = gap === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }

  const lastLogged = sorted.length ? new Date(`${sorted[sorted.length - 1]}T00:00:00`) : null;
  const daysSinceLastLog = lastLogged ? differenceInCalendarDays(today, lastLogged) : Infinity;

  const todayTotals = { spent: 0, earned: 0, count: 0 };
  for (const row of rows ?? []) {
    if (dayKey(new Date(row.created_at)) !== dayKey(today)) continue;
    const amount = Number(row.amount) || 0;
    if (row.type === 'income') todayTotals.earned += amount;
    else todayTotals.spent += amount;
    todayTotals.count += 1;
  }

  // Last HISTORY_DAYS calendar days, oldest → newest, today last — feeds
  // the /streak screen's month grid, StreakCelebration's 7-day row
  // (05-koban-engagement.md Phase 4). Built from the same `days` Set already
  // computed above; no second query, no separate derivation elsewhere.
  const history = [];
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const key = dayKey(d);
    history.push({ date: key, logged: days.has(key) });
  }

  return {
    current,
    longest,
    breaks,
    loggedToday,
    daysSinceLastLog,
    // A brand-new streak is its own state, not just `current === 1` seen from
    // a distance — it's the most fragile the streak will ever be, and its copy
    // ("come back tomorrow and it's a streak") is nothing like an ongoing
    // one's. Likewise `current === 0` must NEVER be told "don't break your
    // streak" — there isn't one to break.
    //
    // Display convention: shown to the user as "Day 1 — you've started a
    // streak", matching `current` directly (an earlier "Day 0" convention
    // was dropped — every other streak product counts a first day as Day 1,
    // and having the internal count and the display label disagree was more
    // confusing than clarifying). `current` already counts this as 1, so no
    // relabeling is needed anywhere downstream anymore.
    isNewStreak: loggedToday && current === 1,
    isMilestone: loggedToday && MILESTONES.includes(current),
    todayTotals,
    history,
  };
}
