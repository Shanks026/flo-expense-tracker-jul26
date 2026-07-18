import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useAuth } from './AuthContext';
import { supabase } from './supabase';

// Same crash lib/notifications.js already guards against: expo-notifications'
// module-level push-token auto-registration side effect throws at import
// time in Expo Go on Android (removed there since SDK 53). iOS Expo Go is
// unaffected — push still works there per the SDK 54 docs — and any real
// dev/production build is unaffected on either platform, so the import is
// only skipped for the one broken combination, not gated on Expo Go alone.
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const UNSUPPORTED = IS_EXPO_GO && Platform.OS === 'android';
const Notifications = UNSUPPORTED ? null : require('expo-notifications');

const PROJECT_ID = '080548cb-69f6-469e-a3da-38cac92c7b9c';

// Registers (or re-registers) this device's Expo push token against the
// given user. Safe to call repeatedly — claim_push_token upserts on the
// token itself, so a re-call with the same token is a no-op write.
//
// Goes through the `claim_push_token` RPC (SECURITY DEFINER), not a plain
// client-side upsert — found via real device testing: the same physical
// device produces the SAME Expo push token across different accounts
// signed in on it, and push_tokens' RLS policy (`auth.uid() = user_id`) is
// checked against the row's EXISTING owner. A raw
// `.upsert(..., {onConflict:'token'})` from a second account gets rejected
// by RLS the moment the token is already owned by a different user_id —
// silently, since the error was only console.error'd — leaving that
// second account's push status stuck on "not registered" forever. The RPC
// reassigns ownership using auth.uid() server-side, which only a
// SECURITY DEFINER function can do across owners.
export async function registerPushToken(userId) {
  if (!Notifications || !userId) return { registered: false, unsupported: !Notifications };

  const perms = await Notifications.getPermissionsAsync();
  if (!perms.granted) return { registered: false, unsupported: false };

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    const { error } = await supabase.rpc('claim_push_token', { p_token: token });
    if (error) {
      console.error('registerPushToken: claim_push_token RPC failed:', error.message);
      return { registered: false, unsupported: false, error };
    }
    return { registered: true, unsupported: false };
  } catch (error) {
    // getExpoPushTokenAsync calls Expo's own servers — network hiccups are
    // expected and non-fatal here, so this never crashes app boot. But it's
    // also where an on-device FCM misconfiguration surfaces (e.g. no
    // google-services.json in the build — see 17-server-push-notifications.md
    // Phase 1's Implementation Notes), which is a real setup gap, not a
    // transient blip — logged so it's visible in `adb logcat` instead of
    // silently producing zero rows in push_tokens with no clue why.
    console.error('registerPushToken: getExpoPushTokenAsync failed:', error?.message ?? error);
    return { registered: false, unsupported: false, error };
  }
}

// Settings' push-status row (17-server-push-notifications.md Phase 4) —
// "is there at least one push_tokens row for this user" is enough to tell
// someone their device is registered; it doesn't need to know which
// specific token is theirs.
export async function getPushTokenStatus(userId) {
  if (!Notifications) return { registered: false, unsupported: true };
  if (!userId) return { registered: false, unsupported: false };
  const { data, error } = await supabase.from('push_tokens').select('id').eq('user_id', userId).limit(1);
  if (error) {
    console.error('getPushTokenStatus: push_tokens read failed:', error.message);
    return { registered: false, unsupported: false, error };
  }
  return { registered: (data?.length ?? 0) > 0, unsupported: false };
}

// Settings' "Send test notification" button — invokes the REAL send-push
// Edge Function (Phase 1's manual-test-send path), not the local-only
// sendTestNotification() in lib/notifications.js. This is the only way to
// verify the actual server → Expo → device pipeline end to end without
// waiting for a scheduled cron window.
export async function sendTestPush(userId) {
  if (!userId) return { sent: false, error: new Error('Not signed in') };
  const { data, error } = await supabase.functions.invoke('send-push', { body: { userId } });
  if (error) {
    console.error('sendTestPush: send-push invoke failed:', error.message);
    return { sent: false, error };
  }
  // send-push now reports real per-ticket delivery status, not just
  // "queued" — a ticket error (e.g. FCM credentials misconfigured on the
  // Expo/EAS project) used to come back as `sent: true` with nothing ever
  // arriving on-device, which is exactly what surfaced this gap.
  const ticketErrors = data?.ticketErrors ?? [];
  if (ticketErrors.length > 0) {
    console.error('sendTestPush: Expo push ticket error(s):', JSON.stringify(ticketErrors));
    return { sent: false, error: new Error(ticketErrors[0]?.message ?? 'Push delivery failed'), data };
  }
  return { sent: (data?.sent ?? 0) > 0, data };
}

// One-time, device-level (not per-user) registration of the "Log now"
// action button — 17-server-push-notifications.md Phase 2. Independent of
// sign-in state: it just tells the OS what buttons a notification tagged
// with categoryId: 'reminder-nudge' should show, which send-push's push
// payload references. useNotificationSync's tap listener (lib/notifications.js)
// is what actually opens AddTransactionSheet when this button — or the
// notification body itself — is tapped.
async function ensureCategories() {
  if (!Notifications) return;
  await Notifications.setNotificationCategoryAsync('reminder-nudge', [
    { identifier: 'log-now', buttonTitle: 'Log now', options: { opensAppToForeground: true } },
  ]);
}

// Mounted once at the app root (see PushTokenSync in app/_layout.js).
// Registers this device's push token whenever a signed-in session exists —
// on mount, and again whenever the session's user changes (sign-out/
// sign-in or switching accounts on the same device).
export function usePushTokenSync() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    ensureCategories();
  }, []);

  useEffect(() => {
    if (!userId) return;
    registerPushToken(userId);
  }, [userId]);
}
