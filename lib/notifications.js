import { useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useBills from '../hooks/useBills';
import { fetchStreak } from '../hooks/useStreak';
import { useAuth } from './AuthContext';
import { useDataRefresh } from './DataRefreshContext';
import { formatMoney } from './money';
import { buildReminderPlan } from './koban';

// expo-notifications auto-registers a device push-token listener as a
// module-level side effect on import (DevicePushTokenAutoRegistration.fx.js),
// and that throws outright in Expo Go on Android (removed there since SDK
// 53) — even though this file only ever uses *local* scheduling, which Expo
// Go does support. A plain `import * as Notifications from 'expo-notifications'`
// pulls in that whole side-effecting module graph unconditionally and crashes
// the entire app at boot (app/_layout.js imports this file at module scope).
// Gating the require behind an Expo Go check keeps the crash from ever
// happening; every exported function below no-ops (or returns an
// `unsupported` status) when `Notifications` is null instead.
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const Notifications = IS_EXPO_GO ? null : require('expo-notifications');

// Three channels, replacing the single 'default' channel this app shipped
// with originally. Android notification channels are IMMUTABLE after
// creation — calling setNotificationChannelAsync('default', { importance:
// HIGH }) would be silently ignored, since 'default' already exists on-device
// at DEFAULT importance. New channel IDs are the only way to actually change
// importance (05-koban-engagement.md Phase 1).
//
// Every slot the daily reminder schedules currently lands on `nudge` — the
// `recap` channel exists from this phase on, but nothing schedules onto it
// until 05-koban-engagement.md Phase 3 builds the streak-aware Nudge/Recap
// split. Creating it now means Phase 3 needs zero further channel migration.
const CHANNELS = {
  nudge: 'flo.reminders.nudge', // HIGH — heads-up, sound, vibrate
  recap: 'flo.reminders.recap', // LOW — silent, no banner (unused until Phase 3)
  bills: 'flo.bills.due', // HIGH — heads-up, sound, vibrate
};

const KEYS = {
  enabled: 'flo.notif.enabled',
  dailyReminder: 'flo.notif.dailyReminder',
  billReminders: 'flo.notif.billReminders',
};

const DEFAULT_DAILY_REMINDER = { enabled: false, hour: 20, minute: 0 };
const DEFAULT_BILL_REMINDERS = { enabled: true, daysBefore: 2 };

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function getNotificationSettings() {
  const [enabledRaw, dailyRaw, billRaw] = await Promise.all([
    AsyncStorage.getItem(KEYS.enabled),
    AsyncStorage.getItem(KEYS.dailyReminder),
    AsyncStorage.getItem(KEYS.billReminders),
  ]);
  return {
    enabled: enabledRaw === 'true',
    dailyReminder: dailyRaw ? JSON.parse(dailyRaw) : DEFAULT_DAILY_REMINDER,
    billReminders: billRaw ? JSON.parse(billRaw) : DEFAULT_BILL_REMINDERS,
  };
}

export async function setNotificationEnabled(enabled) {
  await AsyncStorage.setItem(KEYS.enabled, enabled ? 'true' : 'false');
}

export async function setDailyReminderSettings(next) {
  await AsyncStorage.setItem(KEYS.dailyReminder, JSON.stringify(next));
}

export async function setBillReminderSettings(next) {
  await AsyncStorage.setItem(KEYS.billReminders, JSON.stringify(next));
}

// Called from both requestPermission() (so a fresh grant always has
// somewhere valid to schedule against) and rescheduleAll() (so a permission
// granted via some other path — e.g. re-installed after being revoked — still
// gets channels before scheduling runs). Deleting 'default' is wrapped
// defensively: Android's own deleteNotificationChannel is a documented no-op
// on a channel that doesn't exist, but the Expo wrapper's behavior for that
// case isn't something to bet the whole permission flow on.
async function ensureChannels() {
  if (!Notifications || Platform.OS !== 'android') return;

  await Notifications.deleteNotificationChannelAsync('default').catch(() => {});

  await Notifications.setNotificationChannelAsync(CHANNELS.nudge, {
    name: 'Daily nudge',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
    lightColor: '#BBDC12',
  });
  await Notifications.setNotificationChannelAsync(CHANNELS.recap, {
    name: 'Daily recap',
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    enableVibrate: false,
  });
  await Notifications.setNotificationChannelAsync(CHANNELS.bills, {
    name: 'Bill reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
  });
}

// Returns the full permission status ({ granted, canAskAgain, ... }) so the
// caller can distinguish "denied, can ask again" from "denied, must open
// system settings" — Settings needs both states, plus `unsupported` for
// Expo Go (a permission prompt/system-settings link wouldn't help there).
export async function requestPermission() {
  if (!Notifications) return { granted: false, canAskAgain: false, unsupported: true };
  await ensureChannels();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return existing;
  return Notifications.requestPermissionsAsync();
}

// Read-only status check (no prompt) — used to detect the OS permission
// having been revoked behind the scenes (e.g. via system settings) since the
// last time this screen was open, so the "blocked" hint doesn't only appear
// after the user happens to retry the toggle.
export async function getPermissionStatus() {
  if (!Notifications) return { granted: false, canAskAgain: false, unsupported: true };
  return Notifications.getPermissionsAsync();
}

// How far ahead the daily reminder is pre-scheduled, replacing the old single
// repeating DAILY trigger. A repeating trigger bakes its content once, at
// schedule time, and repeats it verbatim forever — there is no way to vary
// copy or react to the streak with one. So instead: a rolling window of
// individually-DATE-triggered notifications, rebuilt from scratch (via the
// same cancel-all-then-reschedule this function already does for bills)
// every time rescheduleAll runs — which happens on every app open and every
// data change (see useNotificationSync below). If the app isn't opened for 30
// days, reminders run out; accepted — at 30 days silent, the notification
// is not the problem.
const ROLLING_WINDOW_DAYS = 30;

// Single source of truth for what's scheduled: cancel everything, then
// schedule fresh from current bills + settings + streak. Local scheduled
// notifications are finite and cheap to rebuild — this avoids drift, same
// philosophy as the useDataRefresh version-counter (recompute rather than
// incrementally patch).
//
// Settings are read from AsyncStorage HERE, not passed in — and that is
// load-bearing, not a style choice. This function opens with
// cancelAllScheduledNotificationsAsync() and bails early when
// `settings.enabled` is false, so being handed a *stale* settings object
// silently wipes the entire schedule.
//
// That was a real bug (found 2026-07-12): useNotificationSync loaded settings
// once at mount and held them in state, while app/settings.js mutated and
// persisted its own copy. Turn notifications ON mid-session, then do anything
// that bumps the useDataRefresh version (logging a transaction — which
// bank-notification auto-detect does automatically), and useNotificationSync's
// effect re-ran with its stale `enabled: false`, cancelled everything, and
// scheduled nothing. Silently. Reading storage here makes a stale copy
// impossible: every caller persists first, so storage is always current.
//
// Streak is fetched fresh here for the exact same reason, not accepted as a
// parameter — see hooks/useStreak.js's fetchStreak() comment.
// Serialization guard. rescheduleAll is `cancel-everything, then schedule ~30
// notifications one await at a time`, which is NOT re-entrant — and it is called
// concurrently, by design:
//
//   notifyChanged()
//     → version++          → useNotificationSync's effect fires → call A
//     → useBills refetches → setBills(NEW array, every time — see useBills.js)
//                          → `bills` identity changes
//                          → the SAME effect fires again          → call B
//
// Overlapped, A cancels and starts scheduling; B then cancels only what A has
// managed to schedule *so far* and lays down its own full set — while A carries
// on scheduling the rest. The survivors from A land on top of B's, and every
// slot ends up scheduled twice. That is the "daily reminder fires twice" bug
// (found 2026-07-13, reproduced in isolation: 5 slots → 5 duplicates).
//
// Queueing rather than dropping: the last caller's args must still be honoured,
// or a settings change made during an in-flight run would be silently lost.
// Any number of overlapping requests collapse into a single trailing run.
let inFlightReschedule = null;
let pendingRescheduleArgs = null;

export function rescheduleAll(args) {
  if (inFlightReschedule) {
    pendingRescheduleArgs = args;
    return inFlightReschedule;
  }
  inFlightReschedule = (async () => {
    try {
      await doRescheduleAll(args);
      while (pendingRescheduleArgs) {
        const next = pendingRescheduleArgs;
        pendingRescheduleArgs = null;
        await doRescheduleAll(next);
      }
    } finally {
      inFlightReschedule = null;
    }
  })();
  return inFlightReschedule;
}

async function doRescheduleAll({ bills, userId }) {
  if (!Notifications) return;
  // Ensures channels exist before scheduling against them — covers the case
  // where permission was granted through some path other than
  // requestPermission() (e.g. a reinstall where the OS grant carried over).
  await ensureChannels();
  const settings = await getNotificationSettings();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.enabled) return;

  const now = new Date();

  if (settings.billReminders.enabled) {
    const daysBefore = settings.billReminders.daysBefore;
    for (const bill of bills) {
      if (!bill.is_active) continue;

      const fireDate = new Date(bill.next_due_date);
      fireDate.setDate(fireDate.getDate() - daysBefore);
      fireDate.setHours(9, 0, 0, 0);
      if (fireDate <= now) continue;

      const dueLabel = daysBefore === 0 ? 'due today' : `due in ${daysBefore} day${daysBefore === 1 ? '' : 's'}`;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${bill.name} ${dueLabel}`,
          body: `${formatMoney(bill.amount)} — tap to review`,
          data: { route: '/bills' },
          priority: Notifications.AndroidNotificationPriority.HIGH,
          sound: true,
          color: '#BBDC12',
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate, channelId: CHANNELS.bills },
      });
    }
  }

  if (settings.dailyReminder.enabled) {
    const streak = await fetchStreak(userId);
    // The rolling-window projection itself lives in lib/koban.js, pure and
    // unit-tested there — this just turns the plan into scheduled OS
    // notifications, the one thing that needs the native Notifications module.
    const plan = buildReminderPlan({
      streak,
      hour: settings.dailyReminder.hour,
      minute: settings.dailyReminder.minute,
      now,
      windowDays: ROLLING_WINDOW_DAYS,
    });

    for (const { fireDate, content, lane } of plan) {
      const isRecapChannel = lane === 'recap';
      const channelId = isRecapChannel ? CHANNELS.recap : CHANNELS.nudge;

      await Notifications.scheduleNotificationAsync({
        content: {
          ...content,
          data: { route: '/' },
          priority: isRecapChannel ? Notifications.AndroidNotificationPriority.LOW : Notifications.AndroidNotificationPriority.HIGH,
          sound: !isRecapChannel,
          color: '#BBDC12',
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate, channelId },
      });
    }
  }
}

// Debug/QA helper — fires a real heads-up notification a few seconds out on
// the nudge channel, so the visibility fix (05-koban-engagement.md Phase 1)
// can be confirmed on-device without waiting for the scheduled daily time.
// Uses the same content shape (priority/sound/color/channel) as the real
// daily reminder, so a pass here is a faithful test of what actually ships —
// not a separate, easier-to-pass code path. A short delay (not an
// immediate/null trigger) is deliberate: it gives time to lock the screen or
// switch apps first, so the heads-up behavior is verified the way it's
// actually used, not just while staring at Settings.
//
// Note: rescheduleAll() cancels ALL scheduled notifications before
// re-scheduling (see its own comment) — if something triggers a reschedule
// in the 3-second window (e.g. toggling a setting), the pending test
// notification is cancelled along with everything else and won't fire.
// Don't touch other settings between tapping this and it firing.
export async function sendTestNotification() {
  if (!Notifications) return { scheduled: false, unsupported: true };
  await ensureChannels();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔔 Test notification',
      body: 'If this dropped down over your screen with a buzz, the heads-up channel works.',
      data: { route: '/' },
      priority: Notifications.AndroidNotificationPriority.HIGH,
      sound: true,
      color: '#BBDC12',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: CHANNELS.nudge },
  });
  return { scheduled: true };
}

// Debug/QA — returns what the OS *actually* has pending, so a missing reminder
// can be diagnosed instead of guessed at. If the reminder shows up here but
// never arrives, it's a delivery problem (see the inexact-alarm note below);
// if it isn't here at all, it's a scheduling/logic problem. Those are very
// different bugs and this is the only way to tell them apart from the outside.
//
// Inexact-alarm caveat worth knowing when reading the output: expo-notifications
// uses AlarmManager.setAndAllowWhileIdle() unless the app holds
// SCHEDULE_EXACT_ALARM (we deliberately don't — Google Play restricts it to
// alarm-clock/calendar apps). Android is therefore free to defer these,
// especially with the screen off. A daily reminder landing a few minutes late
// is normal and fine; it just makes short-interval manual testing unreliable —
// prefer "Send test notification" (a 3s TIME_INTERVAL) for checking that
// delivery works at all.
export async function getScheduledSummary() {
  if (!Notifications) return { unsupported: true, items: [] };
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const items = scheduled.map((req) => {
    const trigger = req.trigger ?? {};
    let when = 'unknown trigger';
    let sortKey = Infinity; // unknown triggers sort last, not first
    if (trigger.type === 'date' || trigger.value != null) {
      const ts = trigger.value ?? trigger.date;
      when = ts ? `once at ${new Date(ts).toLocaleString()}` : 'once (date)';
      sortKey = ts ? new Date(ts).getTime() : Infinity;
    } else if (trigger.type === 'daily' || (trigger.hour != null && trigger.minute != null)) {
      when = `daily at ${String(trigger.hour).padStart(2, '0')}:${String(trigger.minute).padStart(2, '0')}`;
      sortKey = -1; // legacy repeating trigger, if one somehow still exists — surface it first, it shouldn't be there
    } else if (trigger.seconds != null) {
      when = `in ${trigger.seconds}s`;
      sortKey = Date.now() + trigger.seconds * 1000;
    }
    return {
      title: req.content?.title ?? '(no title)',
      body: req.content?.body ?? '',
      when,
      channelId: trigger.channelId ?? '—',
      sortKey,
    };
  });
  // Soonest-first — the first few entries are what's actually worth reading
  // (today's slot, tomorrow's, etc.); bill reminders and far-future nudge
  // days sort in naturally by their real fire time, not by the formatted
  // display string (which would sort lexicographically, not chronologically).
  items.sort((a, b) => a.sortKey - b.sortKey);
  return { unsupported: false, items: items.map(({ sortKey, ...rest }) => rest) };
}

// Mounted once at the app root (see NotificationSync in app/_layout.js).
// Keeps scheduled notifications in sync with live bills + settings, and
// routes on notification tap — both for a tap while the app is already
// running (the live listener) and for a cold start caused by tapping a
// notification (getLastNotificationResponseAsync, which the live listener
// alone would miss since it isn't registered yet at that point).
export function useNotificationSync() {
  const router = useRouter();
  const { bills, loading } = useBills();
  const { session } = useAuth();
  const { version } = useDataRefresh();
  const userId = session?.user?.id ?? null;

  // No settings/streak state held here on purpose — rescheduleAll reads
  // settings from AsyncStorage and fetches streak fresh itself. Holding a
  // copy here is exactly what caused the stale-settings schedule-wipe bug
  // documented on rescheduleAll above; the same reasoning applies to streak.
  //
  // `version` is depended on explicitly (05-koban-engagement.md Phase 3,
  // Architecture D) rather than relying on `bills`' reference identity
  // changing on every refetch (which it does today, since useBills() always
  // produces a fresh array — but that's an implementation detail of useBills,
  // not a contract, and an explicit dependency on the actual signal is more
  // robust than an incidental one). Every transaction insert calls
  // notifyChanged(), so logging at 2pm swaps tonight's slot from Nudge to
  // Recap — there is no path to create a transaction without the app being
  // open (⊕ tab, Plan Detail, share-intent, auto-detect, markBillPaid all run
  // in-app), so this is airtight, not best-effort.
  useEffect(() => {
    if (loading) return;
    rescheduleAll({ bills, userId });
  }, [bills, loading, userId, version]);

  useEffect(() => {
    if (!Notifications) return;

    Notifications.getLastNotificationResponseAsync().then((response) => {
      const route = response?.notification?.request?.content?.data?.route;
      if (route) router.push(route);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = response.notification.request.content.data?.route;
      if (route) router.push(route);
    });
    return () => subscription.remove();
  }, []);
}
