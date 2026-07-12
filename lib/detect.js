import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// FloNotificationListener (modules/flo-notification-listener) is a local
// native Expo module, Android-only (expo-module.config.json declares
// "platforms": ["android"]) with no Expo Go build — requireNativeModule()
// throws immediately if the native module isn't present or isn't linked for
// the current platform, the same failure class expo-notifications hit (see
// lib/notifications.js:8-19). Once DetectedTransactionHandler
// (06-transaction-auto-detect.md Phase 3) imports this file at
// app/_layout.js's module scope, a plain static import of the native module
// would crash the whole app at boot — in Expo Go, AND on a real iOS build
// (the module simply isn't linked there). Gate on both: the IS_EXPO_GO
// check already used in lib/notifications.js, plus Platform.OS — the second
// check didn't matter while this app was Android-only in practice, but
// matters now that an iOS release is a stated goal.
const IS_SUPPORTED_PLATFORM =
  Platform.OS === 'android' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
const NativeDetect = IS_SUPPORTED_PLATFORM ? require('../modules/flo-notification-listener').default : null;

export function isSupported() {
  return !!NativeDetect;
}

// Whether Android's system-level notification-access grant is on — this is
// separate from, and a prerequisite for, FLO's own opt-in (isDetectionEnabled).
export function hasNotificationAccess() {
  if (!NativeDetect) return false;
  return NativeDetect.hasNotificationAccess();
}

// ACTION_NOTIFICATION_LISTENER_SETTINGS cannot be prompted for like a normal
// runtime permission — this deep-links to the system screen where the user
// grants it manually. There is no callback; the caller must re-check
// hasNotificationAccess() on next screen focus (see 06-...md Phase 3).
export function openNotificationAccessSettings() {
  if (!NativeDetect) return;
  NativeDetect.openNotificationAccessSettings();
}

// FLO's own opt-in, distinct from the OS-level grant above. The native
// listener service only queues detections when BOTH this is true AND OS
// access is granted.
export function isDetectionEnabled() {
  if (!NativeDetect) return false;
  return NativeDetect.isEnabled();
}

export function setDetectionEnabled(enabled) {
  if (!NativeDetect) return;
  NativeDetect.setEnabled(enabled);
}

export function getAllowedPackages() {
  if (!NativeDetect) return [];
  return NativeDetect.getAllowedPackages();
}

export function setAllowedPackages(packages) {
  if (!NativeDetect) return;
  NativeDetect.setAllowedPackages(packages);
}

// Atomic read-then-clear on the native side — every call returns only what
// hasn't already been drained.
export function drainDetections() {
  if (!NativeDetect) return [];
  return NativeDetect.drainDetections();
}

// ⚠️ DEBUG ONLY — remove before any store build (see the note in
// NotificationPrefs.kt). Returns every allowlisted notification recently seen
// AND the parser's verdict on it, *including* ones that failed to parse
// ('no-parse') or were deduped ('duplicate'). Those never reach the normal
// queue, so without this there's no way to see what real bank/UPI wording the
// parser is choking on — you'd be tuning regexes against text you've never
// read. Persists raw notification content; capped at 15 entries.
export function getDetectionDebugLog() {
  if (!NativeDetect) return [];
  return NativeDetect.getDebugLog();
}

export function clearDetectionDebugLog() {
  if (!NativeDetect) return;
  NativeDetect.clearDebugLog();
}

// Play-safe base — bank/UPI apps' own notifications only. This array alone
// is what should ever ship to a Google Play or Apple App Store build.
const PLAY_SAFE_PACKAGES = [
  'com.google.android.apps.nbu.paisa.user', // Google Pay (India)
  'com.phonepe.app', // PhonePe
  'net.one97.paytm', // Paytm
];

// ⚠️ PERSONAL-USE ONLY. Reading the notification a default SMS/Messages app
// posts for a bank SMS is functionally the same as reading the SMS directly
// (READ_SMS/RECEIVE_SMS) — exactly the workaround Play Store policy targets,
// the same landmine 03-sms-share-import.md already dodged once, and the
// reason this was originally excluded (06-transaction-auto-detect.md's
// "Bonus constraint" section — read that before touching this).
//
// Reversed 2026-07-12, the user's explicit call, after real on-device
// testing: GPay's own notification doesn't reliably fire for outgoing
// transfers (confirmed — a self-transfer produced no GPay notification at
// all), while the bank SMS is the dominant, most-frequent signal for this
// user's actual transaction volume. UPI-app-only detection was missing most
// real transactions. Priority is personal use working now; store compliance
// is a deferred, explicitly-tracked follow-up — NOT solved by this comment,
// only postponed. Before any store submission: delete or comment out this
// constant and the one line below that spreads it in.
//
// Package is a best guess for "Messages" (the default SMS app on the user's
// iQOO 12), NOT yet confirmed — SMS app package names vary by OEM. Confirm
// via `adb shell settings get secure sms_default_application` on the actual
// device and correct this if it doesn't match.
const PERSONAL_USE_EXTRA_PACKAGES = [
  'com.google.android.apps.messaging', // Google Messages — UNCONFIRMED, see above
];

export const DEFAULT_ALLOWED_PACKAGES = [
  ...PLAY_SAFE_PACKAGES,
  ...PERSONAL_USE_EXTRA_PACKAGES, // ⚠️ delete this line before any store build
];
