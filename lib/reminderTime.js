// Reminder times (profiles.morning_reminder_time / evening_reminder_time,
// Postgres `time`, "HH:MM:SS"), shared by Settings and onboarding's reminder
// ask. Pure, so scripts/ledger-check.mjs checks it under node.

// NOT new Date(0, 0, 0, hour, minute) — that resolves to Dec 31, 1899, and
// India's timezone database applies the *historical* Madras Time offset
// (+5:21) for pre-1906 dates, not modern IST (+5:30). The JS-side
// getHours()/getMinutes() still read back correctly within the same
// environment, but the native Android time picker widget converts the
// underlying UTC timestamp using the *current* offset when rendering,
// producing a ~9-minute-ahead display — confirmed via TZ=Asia/Kolkata node
// repro during debugging (2026-07-12). Building on today's date sidesteps
// the whole historical-offset class of bug.
export function timeOnToday(hour, minute, now = new Date()) {
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// A stored "HH:MM:SS" as a Date on today (the picker's value), or the
// fallback time when there's none or it doesn't parse.
export function timeOnTodayFromString(timeStr, fallbackHour, fallbackMinute, now = new Date()) {
  const [h, m] = typeof timeStr === 'string' ? timeStr.split(':').map(Number) : [];
  if (!Number.isInteger(h) || !Number.isInteger(m)) return timeOnToday(fallbackHour, fallbackMinute, now);
  return timeOnToday(h, m, now);
}

// A picked Date → the column's "HH:MM:00".
export function toTimeColumn(date) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}:00`;
}

// The evening reminder lives in the PM half (Settings' rule, so it can never
// collide with the morning one).
export function isEveningTime(date) {
  return date.getHours() >= 12;
}

// The defaults when nothing is stored: 8 am and 9 pm.
export const MORNING_DEFAULT = { hour: 8, minute: 0 };
export const EVENING_DEFAULT = { hour: 21, minute: 0 };
