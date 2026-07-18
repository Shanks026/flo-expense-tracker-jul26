import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  subMonths,
  subDays,
  setDate,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  getDaysInMonth,
  isAfter,
  isBefore,
  isSameDay,
  format,
} from 'date-fns';

// 11-reports.md Phase 1. Config + "last seen" live in AsyncStorage — same
// device-scoped pattern as lib/notifications.js — because a report's content
// is never stored: it's recomputed from `transactions` for whatever period is
// selected, exactly like Analytics.

const KEYS = {
  settings: 'flo.reports.settings',
};

// weekday follows JS/date-fns Date#getDay() convention: 0=Sun..6=Sat.
// cadenceStartedAt anchors the FIRST cycle to whenever the cadence was
// actually turned on (see setReportSettings/isReportDue below) — null means
// "not currently anchored" (cadence off, or set before this field existed).
export const DEFAULT_REPORT_SETTINGS = { cadence: 'off', weekday: 1, dayOfMonth: 1, hour: 9, minute: 0, cadenceStartedAt: null };

// expo-notifications' WeeklyTriggerInput uses a DIFFERENT convention from the
// `weekday` field above (confirmed against the installed version's type defs,
// not assumed): 1–7 with 1 = Sunday (the Apple Calendar convention), not JS's
// 0=Sun..6=Sat. Converting in exactly one place so this can't silently drift —
// a wrong offset here schedules the report notification on the wrong day with
// no obvious symptom until someone happens to notice which day it fired.
export function toExpoWeekday(jsWeekday) {
  return jsWeekday + 1;
}

export async function getReportSettings() {
  const raw = await AsyncStorage.getItem(KEYS.settings);
  return raw ? { ...DEFAULT_REPORT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_REPORT_SETTINGS;
}

export async function setReportSettings(partial) {
  const current = await getReportSettings();
  const next = { ...current, ...partial };

  // Anchor the first cycle to whenever the cadence actually turns on. Without
  // this, a brand-new signup (or anyone flipping cadence on mid-week/mid-month)
  // sees "your report is ready" almost immediately — reportDueMoment() finds
  // the most recent past occurrence of the schedule regardless of when the
  // schedule was configured, which for onboarding meant a report appearing
  // right after signup, covering a period with one transaction in it.
  if (partial.cadence && partial.cadence !== 'off' && !current.cadenceStartedAt) {
    next.cadenceStartedAt = new Date().toISOString();
  }
  // Re-arm on turning off: the next time cadence is enabled, it re-anchors
  // rather than reusing a stale start point from a previous stint.
  if (partial.cadence === 'off') {
    next.cadenceStartedAt = null;
  }

  await AsyncStorage.setItem(KEYS.settings, JSON.stringify(next));

  // Write-through mirror to `profiles` — 17-server-push-notifications.md
  // Phase 3. AsyncStorage stays the source of truth for every in-app read
  // (reportDueMoment/isReportDue, the report screen, Settings display); this
  // just gives the server-side cron something to read, since it can't touch
  // this device's AsyncStorage. Silently skipped if signed out (shouldn't
  // happen — report settings are only ever changed from a signed-in screen).
  const { data } = await supabase.auth.getSession();
  const userId = data?.session?.user?.id;
  if (userId) {
    const { error } = await supabase
      .from('profiles')
      .update({
        report_cadence: next.cadence,
        report_weekday: next.weekday,
        report_day_of_month: next.dayOfMonth,
        report_time: `${String(next.hour).padStart(2, '0')}:${String(next.minute).padStart(2, '0')}:00`,
        report_cadence_started_at: next.cadenceStartedAt,
      })
      .eq('id', userId);
    if (error) console.error('setReportSettings: profiles mirror failed:', error.message);
  }

  return next;
}

// A compact label for an arbitrary range — "6–12 Jul 2026", "6 Jul – 3 Aug
// 2026", or "July 2026" when the range is exactly one calendar month (so a
// monthly report reads like a month name, not a day range).
export function formatPeriodLabel(from, to) {
  const isFullMonth =
    from.getMonth() === to.getMonth() &&
    from.getFullYear() === to.getFullYear() &&
    isSameDay(from, startOfMonth(from)) &&
    isSameDay(to, endOfMonth(to));
  if (isFullMonth) return format(from, 'MMMM yyyy');

  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  if (sameMonth) return `${format(from, 'd')}–${format(to, 'd MMM yyyy')}`;

  const sameYear = from.getFullYear() === to.getFullYear();
  if (sameYear) return `${format(from, 'd MMM')} – ${format(to, 'd MMM yyyy')}`;

  return `${format(from, 'd MMM yyyy')} – ${format(to, 'd MMM yyyy')}`;
}

// The four quick-pick presets the report screen's period switcher offers,
// plus "Custom range". Centralized here (not duplicated in
// ReportPeriodPicker.js) so the picker's option list and the report header's
// "which preset is this?" label can never drift apart — both read the exact
// same {key, label, from, to} objects.
export function reportPeriodPresets(now) {
  const lastWeek = currentReportPeriod({ cadence: 'weekly' }, now);
  const lastMonth = currentReportPeriod({ cadence: 'monthly' }, now);
  return [
    { key: 'thisWeek', label: 'This week', from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) },
    { key: 'lastWeek', label: 'Last week', from: lastWeek.from, to: lastWeek.to },
    { key: 'thisMonth', label: 'This month', from: startOfMonth(now), to: endOfMonth(now) },
    { key: 'lastMonth', label: 'Last month', from: lastMonth.from, to: lastMonth.to },
  ];
}

// Which preset (if any) the current period exactly matches — drives both the
// picker's "indicate which selection is selected" highlight and the header's
// trigger label ("Last week" vs. a bare "Custom"). null when the period is a
// custom range that doesn't happen to coincide with any preset.
export function matchPeriodPreset(period, presets) {
  if (!period) return null;
  return presets.find((p) => p.from.getTime() === period.from.getTime() && p.to.getTime() === period.to.getTime()) ?? null;
}

// The most recent COMPLETED period as of `now`. Weekly → the prior Mon–Sun
// (matching weekStartsOn:1 used throughout budgets/analytics). Monthly → the
// prior calendar month. `cadence: 'off'` (or missing) falls back to weekly, so
// the report screen is always viewable even with no cadence configured.
export function currentReportPeriod(settings, now) {
  if (settings?.cadence === 'monthly') {
    const target = subMonths(now, 1);
    const from = startOfMonth(target);
    const to = endOfMonth(target);
    return { from, to, label: formatPeriodLabel(from, to) };
  }
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const from = subWeeks(thisWeekStart, 1);
  const to = endOfWeek(from, { weekStartsOn: 1 });
  return { from, to, label: formatPeriodLabel(from, to) };
}

function atTime(date, hour, minute) {
  return setMilliseconds(setSeconds(setMinutes(setHours(date, hour), minute), 0), 0);
}

// The most recent moment (<= now) at which this cadence's day+time occurs —
// e.g. "the most recent Monday 9:00am" or "the most recent 1st-of-month
// 9:00am". null when cadence is off. dayOfMonth clamps to the month's last
// day, so a "31st" cadence still fires in February.
export function reportDueMoment(settings, now) {
  if (!settings || settings.cadence === 'off') return null;

  if (settings.cadence === 'weekly') {
    let candidate = atTime(now, settings.hour, settings.minute);
    let diff = candidate.getDay() - settings.weekday;
    if (diff < 0) diff += 7;
    candidate = subDays(candidate, diff);
    if (diff === 0 && isAfter(candidate, now)) {
      // Today IS the configured weekday, but the time hasn't happened yet —
      // the most recent occurrence is a full week back, not today.
      candidate = subDays(candidate, 7);
    }
    return candidate;
  }

  // monthly
  const clampedThisMonth = Math.min(settings.dayOfMonth, getDaysInMonth(now));
  let candidate = atTime(setDate(now, clampedThisMonth), settings.hour, settings.minute);
  if (isAfter(candidate, now)) {
    const prevMonth = subMonths(now, 1);
    const clampedPrev = Math.min(settings.dayOfMonth, getDaysInMonth(prevMonth));
    candidate = atTime(setDate(prevMonth, clampedPrev), settings.hour, settings.minute);
  }
  return candidate;
}

// Seen-state is USER-scoped (not just device-scoped) — the same bug class
// fixed for the streak-celebration key (00-index.md): a shared device can
// have more than one FLO account signed in across sessions.
const seenKeyFor = (userId) => `flo.reports.lastSeenAt.${userId}`;

export async function getLastReportSeen(userId) {
  if (!userId) return null;
  return AsyncStorage.getItem(seenKeyFor(userId));
}

export async function setReportSeen(userId, iso) {
  if (!userId) return;
  await AsyncStorage.setItem(seenKeyFor(userId), iso);
}

export async function isReportDue(settings, userId, now) {
  if (!settings || settings.cadence === 'off' || !userId) return false;
  const due = reportDueMoment(settings, now);
  if (!due) return false;
  // Never surface a report for a cycle that predates when this cadence was
  // actually configured — see setReportSettings' comment. A new user (or
  // anyone re-enabling a cadence) waits for the NEXT real occurrence rather
  // than being told a report already covering barely-any data is ready.
  if (settings.cadenceStartedAt && isBefore(due, new Date(settings.cadenceStartedAt))) {
    return false;
  }
  const lastSeenIso = await getLastReportSeen(userId);
  if (!lastSeenIso) return true;
  return isBefore(new Date(lastSeenIso), due);
}
