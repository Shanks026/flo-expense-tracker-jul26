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
// given user. Safe to call repeatedly — upserts on the token itself, so a
// re-call with the same token is a no-op write.
//
// `userId` is passed in explicitly and written into the upsert payload
// rather than relying on push_tokens' `DEFAULT auth.uid()` — that default
// only applies on INSERT, not on the UPDATE branch of an upsert. If it were
// omitted here, a device signing into a DIFFERENT account would upsert on
// the same physical token and silently leave `user_id` pointing at whoever
// registered that token first, misdirecting reminders to the wrong account.
// Same class of cross-account leak already fixed once this session for
// ThemeContext's device-local cache — same fix shape: never trust a stale
// default across a user switch, write the current owner explicitly.
export async function registerPushToken(userId) {
  if (!Notifications || !userId) return { registered: false, unsupported: !Notifications };

  const perms = await Notifications.getPermissionsAsync();
  if (!perms.granted) return { registered: false, unsupported: false };

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    const { error } = await supabase.from('push_tokens').upsert({ token, user_id: userId }, { onConflict: 'token' });
    if (error) {
      console.error('registerPushToken: push_tokens upsert failed:', error.message);
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

// Mounted once at the app root (see PushTokenSync in app/_layout.js).
// Registers this device's push token whenever a signed-in session exists —
// on mount, and again whenever the session's user changes (sign-out/
// sign-in or switching accounts on the same device).
export function usePushTokenSync() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    registerPushToken(userId);
  }, [userId]);
}
