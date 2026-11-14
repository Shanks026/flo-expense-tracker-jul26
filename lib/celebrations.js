import { MILESTONES } from './streak.js';

// Which streak days earn the full-screen celebration (spec 49, ticket 01):
// only the milestones (7, 30, 100, 365), and only once today's log has
// landed. Day one no longer celebrates. Pure, so the check script loads it.
//
// `todayStr` is the local 'yyyy-MM-dd' the moment is for; it goes into the
// moment id, so each milestone shows once.
export function celebrationFor({ current, loggedToday }, todayStr) {
  if (!loggedToday || !MILESTONES.includes(current)) return null;
  return { id: `streak-milestone:${current}:${todayStr}`, days: current };
}
