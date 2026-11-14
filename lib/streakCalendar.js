// The Streak screen's rules (spec 49, ticket 06). Pure, with no React Native
// imports, so scripts/ledger-check.mjs checks them under node.
import { addDays, endOfMonth, endOfWeek, format, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { MILESTONES } from './streak.js';

const MARKS = new Set(['logged', 'nospend', 'frozen']);

// The month's calendar as fixed seven-day weeks, Monday first, from the
// week holding the 1st to the week holding the last day. Built row by row
// (never one wrapping list), because a wrapping grid of 100/7 % cells
// rounded past the row on Android and put dates under the wrong weekday.
//
// `history` is useStreak's [{ date: 'yyyy-MM-dd', type }]. Each day:
// { key, day, inMonth, future, isToday, mark }, where `mark` is 'logged',
// 'nospend', 'frozen' or null. A day outside the history is null: unknown,
// not "missed".
export function streakCalendar(history = [], today = new Date()) {
  const typeByDate = new Map(history.map((d) => [d.date, d.type]));
  const todayKey = format(today, 'yyyy-MM-dd');
  const month = today.getMonth();
  const end = endOfWeek(endOfMonth(today), { weekStartsOn: 1 });

  const weeks = [];
  let cursor = startOfDay(startOfWeek(startOfMonth(today), { weekStartsOn: 1 }));
  while (cursor <= end) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const key = format(cursor, 'yyyy-MM-dd');
      const type = typeByDate.get(key);
      week.push({
        key,
        day: cursor.getDate(),
        inMonth: cursor.getMonth() === month,
        future: key > todayKey,
        isToday: key === todayKey,
        mark: MARKS.has(type) ? type : null,
      });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

// The next milestone ahead of `current` and how many days to it, or null
// once the last one (365) is reached.
export function nextMilestone(current) {
  const days = MILESTONES.find((d) => current < d);
  return days ? { days, toGo: days - current } : null;
}
