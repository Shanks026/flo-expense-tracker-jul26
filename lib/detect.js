import Constants, { ExecutionEnvironment } from 'expo-constants';

// FloNotificationListener (modules/flo-notification-listener) is a local
// native Expo module with no Expo Go build — requireNativeModule() throws
// immediately if the native module isn't present, the same failure class
// expo-notifications hit (see lib/notifications.js:8-19). Once
// DetectedTransactionHandler (06-transaction-auto-detect.md Phase 3) imports
// this file at app/_layout.js's module scope, a plain static import of the
// native module would crash the whole app at boot in Expo Go. Gate behind
// the same IS_EXPO_GO check and require() pattern used there.
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const NativeDetect = IS_EXPO_GO ? null : require('../modules/flo-notification-listener').default;

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

// Bank/UPI apps FLO watches by default, per 06-transaction-auto-detect.md's
// "Bonus constraint": deliberately excludes Google Messages
// (com.google.android.apps.messaging) — reading the notification Messages
// posts for a bank SMS is functionally an end-run around the SMS-permission
// policy Play Store review targets, the same landmine
// 03-sms-share-import.md already dodged once.
//
// These package names are a starting point, not verified — Phase 1's
// checklist requires confirming the user's actual bank apps' real package
// names on-device before this list can be trusted.
export const DEFAULT_ALLOWED_PACKAGES = [
  'com.google.android.apps.nbu.paisa.user', // Google Pay (India)
  'com.phonepe.app', // PhonePe
  'net.one97.paytm', // Paytm
];
