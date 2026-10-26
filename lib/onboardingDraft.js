import AsyncStorage from '@react-native-async-storage/async-storage';

// The device "introSeen" flag. Deliberately NOT user-scoped: it exists before
// a user identity does.
//
// The pre-auth answer draft that used to live here went with the intro
// questions (35-onboarding-v3.md). An older build may have left its key
// ('flo.onboarding.draft') on the phone; nothing reads it.
const INTRO_SEEN_KEY = 'flo.onboarding.introSeen';

// introSeen: '1' once the opener has handed off to sign-in on this device, OR
// once any session has been established (set in RootNavigator). Read by
// RootNavigator to decide, while signed out, between the opener and the
// sign-in screen. The DB flag profiles.onboarded_at — not this — is the true
// one-time guarantee; this only spares a returning user on a fresh device the
// opener, and even if it's wiped, the opener's "Sign in" link and
// onboarded_at cover it.
export async function getIntroSeen() {
  return (await AsyncStorage.getItem(INTRO_SEEN_KEY)) === '1';
}

export async function setIntroSeen() {
  await AsyncStorage.setItem(INTRO_SEEN_KEY, '1');
}
