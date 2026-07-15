import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { DataRefreshProvider } from '../lib/DataRefreshContext';
import { AccountProvider } from '../lib/AccountContext';
import { ToastProvider, useToast } from '../components/Toast';
import { AddTransactionSheetProvider, useAddTransactionSheet } from '../components/AddTransactionSheet';
import { AddBudgetSheetProvider } from '../components/AddBudgetSheet';
import { AddPlanSheetProvider } from '../components/AddPlanSheet';
import { AddBillSheetProvider } from '../components/AddBillSheet';
import { PayBillSheetProvider } from '../components/PayBillSheet';
import DueBillsModal from '../components/DueBillsModal';
import StreakCelebration from '../components/StreakCelebration';
import { EditProfileSheetProvider } from '../components/EditProfileSheet';
import { AddCategorySheetProvider } from '../components/AddCategorySheet';
import { AddAccountSheetProvider } from '../components/AddAccountSheet';
import { AccountSwitcherSheetProvider } from '../components/AccountSwitcherSheet';
import { MenuSheetProvider } from '../components/MenuSheet';
import { AlertsSheetProvider } from '../components/AlertsSheet';
import useIncomingShare from '../hooks/useIncomingShare';
import useProfile from '../hooks/useProfile';
import { parseTransactionSms } from '../lib/smsParser';
import { useNotificationSync } from '../lib/notifications';
import { isDetectionEnabled, hasNotificationAccess, drainDetections } from '../lib/detect';
import { getIntroSeen, setIntroSeen as persistIntroSeen } from '../lib/onboardingDraft';

SplashScreen.preventAutoHideAsync();

// Rendered inside the sheet providers (unlike RootNavigator itself, which
// defines them) so it can actually call useAddTransactionSheet().
function ShareIntentHandler() {
  const { session } = useAuth();
  const { sharedText, clearSharedText } = useIncomingShare();
  const { openAdd } = useAddTransactionSheet();

  useEffect(() => {
    if (!sharedText || !session) return;
    const parsed = parseTransactionSms(sharedText);
    openAdd(parsed ? { amount: parsed.amount, type: parsed.type } : { note: sharedText });
    clearSharedText();
  }, [sharedText, session]);

  return null;
}

// Sibling of <Stack> (same reasoning as ShareIntentHandler) — keeps scheduled
// notifications in sync with live bills/settings and handles tap routing.
function NotificationSync() {
  useNotificationSync();
  return null;
}

// Sibling of <Stack>, same placement/reason as ShareIntentHandler — drains
// the native detection queue (06-transaction-auto-detect.md) on cold start
// and whenever the app returns to the foreground, since a bank notification
// may have arrived while FLO was closed. Guarded on session for the same
// reason ShareIntentHandler is: opening the sheet over the sign-in screen
// with no categories/account loaded would be broken, not just unhelpful.
//
// Only the first pending detection is opened. If more than one arrived, the
// rest are surfaced as a toast, not queued — AddTransactionSheet has no
// dismiss callback to open() against, and adding one is out of scope here
// (see the doc's 3.5: "AddTransactionSheet — None — don't add a new open()
// shape"). This is the doc's own pre-authorized fallback; the tradeoff is
// real and worth being honest about: any "N more" beyond the first are
// dropped from the queue, not persisted — the toast is the only record, and
// the user re-enters those manually. Multiple detections between one app
// open and the next should be rare.
function DetectedTransactionHandler() {
  const { session } = useAuth();
  const { openAdd } = useAddTransactionSheet();
  const { showToast } = useToast();

  const drain = useCallback(() => {
    if (!session) return;
    if (!isDetectionEnabled() || !hasNotificationAccess()) return;

    const pending = drainDetections();
    if (!pending.length) return;

    const [first, ...rest] = pending;
    openAdd({ amount: first.amount, type: first.type });
    if (rest.length) {
      showToast({ message: `${rest.length} more detected — add them manually`, variant: 'info' });
    }
  }, [session, openAdd, showToast]);

  useEffect(() => {
    drain();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') drain();
    });
    return () => subscription.remove();
  }, [drain]);

  return null;
}

// Sibling of <Stack>, same placement/reason as ShareIntentHandler — and here
// the constraint is absolute, not stylistic: this needs useProfile(), which
// needs useDataRefresh(), and RootNavigator *defines* DataRefreshProvider, so
// it is not a descendant of it and cannot consume it. Routing a new signup
// into onboarding therefore cannot live in RootNavigator's own redirect
// effect (07-onboarding.md Phase 1).
//
// profiles.onboarded_at is the flag: NULL means the flow hasn't been
// finished. It's in the DB rather than AsyncStorage so it follows the user
// across reinstalls and devices instead of re-triggering on every dev build.
function OnboardingGate() {
  const { session } = useAuth();
  const { profile, loading } = useProfile();
  const segments = useSegments();
  const router = useRouter();

  const onboardedAt = profile?.onboarded_at ?? null;

  useEffect(() => {
    if (!session || loading) return;
    // profile is briefly null right after signUp — handle_new_user's trigger
    // row may not have landed yet. Waiting is correct; treating a null
    // profile as "not onboarded" would redirect on a race and drag an
    // already-onboarded user back through the flow.
    if (!profile) return;

    const inOnboarding = segments[0] === 'onboarding';
    const onSignIn = segments[0] === 'sign-in';

    // This gate — not RootNavigator — owns where an authenticated user lands.
    // RootNavigator only knows about `session`, so if it sent signed-in users
    // to '/' it would paint Home for a frame before this effect could redirect
    // a new user into onboarding. Sending them from sign-in straight to the
    // right destination, once the profile that determines it has actually
    // loaded, is the only way to avoid that flash.
    if (!onboardedAt) {
      // Post-auth resume point is Act 2's first step — a signed-in user is
      // already past the pre-auth intro (12-personal-onboarding.md).
      if (!inOnboarding) router.replace('/onboarding/account');
    } else if (inOnboarding || onSignIn) {
      router.replace('/');
    }
  }, [session, loading, profile, onboardedAt, segments]);

  return null;
}

function RootNavigator() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [introSeen, setIntroSeen] = useState(null); // null = still reading the flag

  useEffect(() => {
    getIntroSeen().then(setIntroSeen);
  }, []);

  // Once any session exists (sign-in, sign-up, or a restored session), the intro
  // has served its purpose on this device — remember it, so a later signed-out
  // state (e.g. after a sign-out) goes straight to sign-in and never back
  // through the sales intro. The DB flag profiles.onboarded_at is the true
  // one-time guarantee across devices; this is just the device-local shortcut.
  useEffect(() => {
    if (session) persistIntroSeen();
  }, [session]);

  // Only the signed-OUT rule lives here. Where a signed-IN user goes depends on
  // profiles.onboarded_at, which this component cannot read (it defines
  // DataRefreshProvider, so it can't consume it) — so OnboardingGate owns that
  // half. Keep the two disjoint by session (07's flicker fix): RootNavigator
  // owns all of !session, the gate owns all of session.
  //
  // The signed-out choice is now two-way: a user who hasn't seen the intro on
  // this device gets the pre-auth Introduction; everyone else gets sign-in.
  // Already being on sign-in, or anywhere under /onboarding (the pre-auth intro
  // lives there), is left alone.
  useEffect(() => {
    if (loading || session) return;
    if (introSeen === null) return; // wait for the flag — deciding now would flash the wrong screen
    const first = segments[0];
    if (first === 'sign-in' || first === 'onboarding') return;
    router.replace(introSeen ? '/sign-in' : '/onboarding/intro/opener');
  }, [session, loading, introSeen, segments]);

  if (loading) return null;
  // Don't mount the Stack (and let it paint whatever its default route is)
  // until we know where a signed-out user should land. Without this, there's
  // a one-frame gap between the tree mounting and the redirect effect firing
  // where the Stack's own default route (or a stale dev-reload route) flashes
  // visibly — the exact bug class 07's original flicker fix addressed for the
  // signed-in half; this is the same fix for the signed-out half.
  if (!session && introSeen === null) return null;

  return (
    <DataRefreshProvider>
      <AccountProvider>
        <ToastProvider>
          <BottomSheetModalProvider>
            <AddAccountSheetProvider>
              <AccountSwitcherSheetProvider>
                <AddTransactionSheetProvider>
                  <AddBudgetSheetProvider>
                    <AddPlanSheetProvider>
                      <AddBillSheetProvider>
                        <PayBillSheetProvider>
                          <EditProfileSheetProvider>
                            <AddCategorySheetProvider>
                              <MenuSheetProvider>
                                <AlertsSheetProvider>
                                  <OnboardingGate />
                                  <ShareIntentHandler />
                                  <NotificationSync />
                                  <DetectedTransactionHandler />
                                  <DueBillsModal />
                                  <StreakCelebration />
                                  <Stack screenOptions={{ headerShown: false }} />
                                </AlertsSheetProvider>
                              </MenuSheetProvider>
                            </AddCategorySheetProvider>
                          </EditProfileSheetProvider>
                        </PayBillSheetProvider>
                      </AddBillSheetProvider>
                    </AddPlanSheetProvider>
                  </AddBudgetSheetProvider>
                </AddTransactionSheetProvider>
              </AccountSwitcherSheetProvider>
            </AddAccountSheetProvider>
          </BottomSheetModalProvider>
        </ToastProvider>
      </AccountProvider>
    </DataRefreshProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (fontsLoaded) {
      setReady(true);
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
