import AsyncStorage from '@react-native-async-storage/async-storage';

// A split invite code parked across a sign-in or a whole first-run onboarding.
//
// The common path for a shared split is the WORST case for routing: a friend
// taps `flo://join/CODE` in WhatsApp, doesn't have FLO, installs it, and lands
// in onboarding. By the time they're signed in, the deep link that brought them
// there is long gone — so the join screen writes the code here on arrival and
// PendingInviteHandler picks it up once there's a session.
//
// Deliberately NOT wired into RootNavigator or OnboardingGate's redirect logic.
// Those two own routing split strictly by session (`!session` vs `session`) and
// 07-onboarding.md documents at length why adding a third opinion there causes
// route-flash bugs. This stays a separate headless component that only ever
// pushes AFTER the gate has settled.

const KEY = 'flo.pendingSplitInvite';

export async function setPendingInvite(code) {
  try {
    await AsyncStorage.setItem(KEY, code);
  } catch {
    // A lost invite code means one extra tap on the link — never worth
    // breaking the screen that was trying to store it.
  }
}

export async function getPendingInvite() {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function clearPendingInvite() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
