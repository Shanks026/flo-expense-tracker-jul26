import { differenceInCalendarDays, format, startOfDay } from 'date-fns';

// Streak milestones worth interrupting the user for (see lib/koban.js — a
// milestone recap fires on the loud channel, an ordinary one doesn't).
export const MILESTONES = [7, 30, 100];

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
  for (const key of sorted) {
    const d = new Date(`${key}T00:00:00`);
    run = prev && differenceInCalendarDays(d, prev) === 1 ? run + 1 : 1;
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

  return {
    current,
    longest,
    loggedToday,
    daysSinceLastLog,
    // Day 1 is its own state, not just `current === 1` seen from a distance.
    // A brand-new streak is the most fragile it will ever be, and the copy for
    // it ("come back tomorrow and it's a streak") is nothing like the copy for
    // an ongoing one. Likewise `current === 0` must never be told "don't break
    // your streak" — there isn't one.
    isNewStreak: loggedToday && current === 1,
    isMilestone: loggedToday && MILESTONES.includes(current),
    todayTotals,
  };
}
