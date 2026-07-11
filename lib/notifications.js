import { useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useBills from '../hooks/useBills';

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

const CHANNEL_ID = 'default';

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
      shouldPlaySound: false,
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

async function ensureChannel() {
  if (!Notifications || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'FLO Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

// Returns the full permission status ({ granted, canAskAgain, ... }) so the
// caller can distinguish "denied, can ask again" from "denied, must open
// system settings" — Settings needs both states, plus `unsupported` for
// Expo Go (a permission prompt/system-settings link wouldn't help there).
export async function requestPermission() {
  if (!Notifications) return { granted: false, canAskAgain: false, unsupported: true };
  await ensureChannel();
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

function formatMoney(n) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

// Single source of truth for what's scheduled: cancel everything, then
// schedule fresh from current bills + settings. Local scheduled notifications
// are finite and cheap to rebuild — this avoids drift, same philosophy as the
// useDataRefresh version-counter (recompute rather than incrementally patch).
export async function rescheduleAll({ bills, settings }) {
  if (!Notifications) return;
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
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate, channelId: CHANNEL_ID },
      });
    }
  }

  if (settings.dailyReminder.enabled) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Log today's spending?",
        body: 'Keep FLO up to date with today’s transactions.',
        data: { route: '/' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: settings.dailyReminder.hour,
        minute: settings.dailyReminder.minute,
        channelId: CHANNEL_ID,
      },
    });
  }
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
  const [settings, setSettings] = useState(null);

  const refreshSettings = useCallback(async () => {
    const next = await getNotificationSettings();
    setSettings(next);
    return next;
  }, []);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    if (loading || !settings) return;
    rescheduleAll({ bills, settings });
  }, [bills, loading, settings]);

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

  return { settings, refreshSettings };
}
