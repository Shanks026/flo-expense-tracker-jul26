import { useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAddTransactionSheet } from '../components/AddTransactionSheet';
import { supabase } from './supabase';

// Local scheduling used to live in this file for all three of FLO's
// notifications — the daily nudge, bill-due reminders, and report-ready
// alerts. All three are sent server-side now (supabase/functions/send-push,
// on a pg_cron schedule — see 17-server-push-notifications.md): the nudge
// moved in Phase 2, bills and reports in Phase 3. Local pre-scheduling
// could never check real-time state (has this user already logged today?
// is a bill's due date still current?) or be timezone-aware per user;
// server-side push can do both, which is the entire reason this moved.
//
// What's left here — and still genuinely needed — is permission and
// channel management: a push notification still needs the OS notification
// permission granted and its target Android channel already created on the
// device to display correctly, regardless of whether it was scheduled
// locally or arrived via push. `sendTestNotification`/`getScheduledSummary`
// stay too, as local-only debug/QA helpers.

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

// Four channels — 'default' (Android's own, pre-existing) is deleted and
// replaced, since Android notification channels are IMMUTABLE after
// creation: calling setNotificationChannelAsync('default', { importance:
// HIGH }) would be silently ignored, since 'default' already exists
// on-device at DEFAULT importance. New channel IDs are the only way to
// actually change importance (05-koban-engagement.md Phase 1). `recap`
// exists but nothing sends to it — see lib/koban.js's own note on the
// removed Nudge/Recap split.
const CHANNELS = {
  nudge: 'flo.reminders.nudge', // HIGH — heads-up, sound, vibrate. Also what send-push's nudge/bill/report pushes target.
  recap: 'flo.reminders.recap', // LOW — silent, no banner (currently unused)
  bills: 'flo.bills.due', // HIGH — heads-up, sound, vibrate
  reports: 'flo.reports.ready', // HIGH — heads-up, sound, vibrate
};

const KEYS = {
  enabled: 'flo.notif.enabled',
  billReminders: 'flo.notif.billReminders',
};

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

// `billReminders` here is still real, in-app-display state (Settings' Bill
// Reminders toggle/day-picker, onboarding) — it's just no longer read by
// any LOCAL scheduler. See setBillReminderSettings below for where it's
// mirrored for the server to read.
export async function getNotificationSettings() {
  const [enabledRaw, billRaw] = await Promise.all([
    AsyncStorage.getItem(KEYS.enabled),
    AsyncStorage.getItem(KEYS.billReminders),
  ]);
  return {
    enabled: enabledRaw === 'true',
    billReminders: billRaw ? JSON.parse(billRaw) : DEFAULT_BILL_REMINDERS,
  };
}

export async function setNotificationEnabled(enabled) {
  await AsyncStorage.setItem(KEYS.enabled, enabled ? 'true' : 'false');
}

// AsyncStorage stays the source of truth for in-app reads (Settings,
// onboarding) — this mirrors the write to `profiles` too
// (17-server-push-notifications.md Phase 3) so send-push's cron can read
// it server-side, the same write-through pattern lib/reports.js's
// setReportSettings uses for the identical reason.
export async function setBillReminderSettings(next) {
  await AsyncStorage.setItem(KEYS.billReminders, JSON.stringify(next));

  const { data } = await supabase.auth.getSession();
  const userId = data?.session?.user?.id;
  if (userId) {
    const { error } = await supabase
      .from('profiles')
      .update({ bill_reminders_enabled: next.enabled, bill_reminder_days_before: next.daysBefore })
      .eq('id', userId);
    if (error) console.error('setBillReminderSettings: profiles mirror failed:', error.message);
  }
}

// Called from requestPermission() (so a fresh grant always has channels to
// display against) and once on mount by useNotificationSync (covering the
// case where permission was granted through some path other than
// requestPermission() — e.g. a reinstall where the OS grant carried over,
// or a push arriving before Settings was ever opened). Deleting 'default'
// is wrapped defensively: Android's own deleteNotificationChannel is a
// documented no-op on a channel that doesn't exist, but the Expo wrapper's
// behavior for that case isn't something to bet the whole permission flow
// on.
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
  await Notifications.setNotificationChannelAsync(CHANNELS.reports, {
    name: 'Reports',
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

// Debug/QA helper — fires a real heads-up notification a few seconds out on
// the nudge channel, so heads-up visibility can be confirmed on-device
// without waiting for a real push. Uses the same content shape
// (priority/sound/color/channel) send-push's own pushes target, so a pass
// here is a faithful test of what actually ships. A short delay (not an
// immediate/null trigger) is deliberate: it gives time to lock the screen or
// switch apps first, so the heads-up behavior is verified the way it's
// actually used, not just while staring at Settings.
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

// Debug/QA — returns what the OS *actually* has pending. Since nothing is
// locally scheduled anymore (see the top-of-file note), this should always
// come back empty except for sendTestNotification's own 3-second window —
// still useful as a "confirm no zombie local schedule survived the Phase
// 2/3 migration" check, not just a historical leftover.
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
  items.sort((a, b) => a.sortKey - b.sortKey);
  return { unsupported: false, items: items.map(({ sortKey, ...rest }) => rest) };
}

// Mounted once at the app root (see NotificationSync in app/_layout.js).
// Ensures channels exist (see ensureChannels' own comment on why this needs
// to run defensively, not just from requestPermission), and routes on
// notification tap — both for a tap while the app is already running (the
// live listener) and for a cold start caused by tapping a notification
// (getLastNotificationResponseAsync, which the live listener alone would
// miss since it isn't registered yet at that point).
export function useNotificationSync() {
  const router = useRouter();
  const { openAdd } = useAddTransactionSheet();

  useEffect(() => {
    ensureChannels();
  }, []);

  // A nudge notification (server-sent, 17-server-push-notifications.md
  // Phase 2 — tagged data.type === 'nudge') routes into AddTransactionSheet
  // directly instead of a plain route push, whether it was the "Log now"
  // action button or the notification body itself that was tapped — same
  // one-tap principle as 06-transaction-auto-detect.md's "Log it". Bills
  // and reports (also server-sent now, Phase 3) keep routing via data.route
  // (/bills, /report) exactly as they did when locally scheduled.
  const handleResponse = useCallback(
    (response) => {
      const data = response?.notification?.request?.content?.data;
      if (!data) return;
      if (data.type === 'nudge') {
        openAdd();
        return;
      }
      if (data.route) router.push(data.route);
    },
    [router, openAdd]
  );

  useEffect(() => {
    if (!Notifications) return;

    Notifications.getLastNotificationResponseAsync().then(handleResponse);

    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
  }, [handleResponse]);
}
