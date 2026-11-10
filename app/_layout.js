import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
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
// Inter backs the Quiet Ledger redesign (theme/ledger.js); Manrope stays for
// screens not yet rebuilt.
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { ThemeProvider, useTheme, MODE_PREFERENCES, DEFAULT_MODE_PREFERENCE } from '../theme/ThemeContext';
import { DEFAULT_ACCENT_ID } from '../theme/themes';
import { fontFamily, type } from '../theme/tokens';
import { DataRefreshProvider } from '../lib/DataRefreshContext';
import { AccountProvider, useAccount } from '../lib/AccountContext';
import { ToastProvider, useToast } from '../components/Toast';
import { RewardBurstProvider } from '../components/RewardBurst';
import { AddTransactionSheetProvider, useAddTransactionSheet } from '../components/AddTransactionSheet';
import { AddBudgetSheetProvider } from '../components/AddBudgetSheet';
import { AddPlanSheetProvider } from '../components/AddPlanSheet';
import { AddSplitSheetProvider } from '../components/AddSplitSheet';
import { AddSplitEntrySheetProvider } from '../components/AddSplitEntrySheet';
import { AddSplitPersonSheetProvider } from '../components/AddSplitPersonSheet';
import { SettleUpSheetProvider } from '../components/SettleUpSheet';
import PendingInviteHandler from '../components/PendingInviteHandler';
import { AddBillSheetProvider } from '../components/AddBillSheet';
import { PayBillSheetProvider } from '../components/PayBillSheet';
import DueBillsSource from '../components/DueBillsModal';
import ShareUsageSource from '../components/ShareUsageAsk';
import MomentHost from '../components/MomentHost';
import { loadMomentsFor, setMomentBlocker, startMomentSession } from '../lib/momentQueue';
import StreakCelebrationSource from '../components/StreakCelebration';
import StreakFreezeSync from '../components/StreakFreezeSync';
import RankUpCelebration from '../components/RankUpCelebration';
import TrophyToast from '../components/TrophyToast';
import { EditProfileSheetProvider } from '../components/EditProfileSheet';
import { AddCategorySheetProvider } from '../components/AddCategorySheet';
import { RewardsHistorySheetProvider } from '../components/RewardsHistorySheet';
import { AddAccountSheetProvider } from '../components/AddAccountSheet';
import { AccountSwitcherSheetProvider } from '../components/AccountSwitcherSheet';
import { AlertsSheetProvider } from '../components/AlertsSheet';
import { ProUpsellSheetProvider } from '../components/ProUpsellSheet';
import AppErrorBoundary, { RecoveryHomeRedirect } from '../components/AppErrorBoundary';
import useIncomingShare from '../hooks/useIncomingShare';
import useProfile from '../hooks/useProfile';
import { parseTransactionSms } from '../lib/smsParser';
import { useNotificationSync } from '../lib/notifications';
import { usePushTokenSync } from '../lib/pushToken';
import { isDetectionEnabled, hasNotificationAccess, drainDetections } from '../lib/detect';
import { getIntroSeen, setIntroSeen as persistIntroSeen } from '../lib/onboardingDraft';
import { FIRST_STEP_ROUTE, isStepRoute } from '../lib/onboarding';
import { flushEvents, loadTrackingConsent, startTrackingSession, track } from '../lib/track';
import { FLAGS } from '../lib/flags';

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
    openAdd(
      parsed
        ? { amount: parsed.amount, type: parsed.type, source: 'share' }
        : { note: sharedText, source: 'share' }
    );
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

// Sibling of <Stack>, same placement/reason as NotificationSync —
// registers this device's Expo push token (17-server-push-notifications.md
// Phase 1). Deliberately separate from NotificationSync/lib/notifications.js:
// that file is local-scheduling only, this is the new server-push path, and
// keeping them in different files means Phase 2 can delete the local nudge
// scheduling later without touching push-token registration at all.
function PushTokenSync() {
  usePushTokenSync();
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
  const { activeAccountId } = useAccount();
  const { openAdd } = useAddTransactionSheet();
  const { showToast } = useToast();

  const drain = useCallback(() => {
    if (!session) return;
    // A session alone isn't enough: AccountContext nulls activeAccountId on
    // every userId change and only refills it once the accounts fetch and an
    // AsyncStorage read both resolve. Cold-starting into this handler beat
    // that, so the sheet opened with no account to save into. Bailing BEFORE
    // drainDetections() is the point — the detection stays queued rather than
    // being consumed into a sheet that can't save it, and activeAccountId is
    // in the dep list below, so resolving it re-runs this and drains then.
    if (!activeAccountId) return;
    if (!isDetectionEnabled() || !hasNotificationAccess()) return;

    const pending = drainDetections();
    if (!pending.length) return;

    const [first, ...rest] = pending;
    openAdd({ amount: first.amount, type: first.type, origin: 'auto_detect' });
    if (rest.length) {
      showToast({ message: `${rest.length} more detected — add them manually`, variant: 'info' });
    }
  }, [session, activeAccountId, openAdd, showToast]);

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
    const onStep = isStepRoute(`/${segments.join('/')}`);

    // This gate — not RootNavigator — owns where an authenticated user lands.
    // RootNavigator only knows about `session`, so if it sent signed-in users
    // to '/' it would paint Home for a frame before this effect could redirect
    // a new user into onboarding. Sending them from sign-in straight to the
    // right destination, once the profile that determines it has actually
    // loaded, is the only way to avoid that flash.
    if (!onboardedAt) {
      // Anywhere but a current post-auth step goes to the first one
      // (35-onboarding-v3.md) — including a screen from an older version of
      // the flow, so a user stuck partway through it restarts in the new one.
      if (!onStep) router.replace(FIRST_STEP_ROUTE);
    } else if (inOnboarding || onSignIn) {
      router.replace('/');
    }
  }, [session, loading, profile, onboardedAt, segments]);

  return null;
}

// Sibling of <Stack>, same placement/reason as OnboardingGate (needs
// useProfile(), which needs useDataRefresh(), which RootNavigator defines
// but doesn't consume). Reconciles the DB's durable theme choice into the
// (device-local, AsyncStorage-only) ThemeContext once a profile is
// available — this is what makes a theme picked on one device follow the
// user to another, or survive a reinstall. Two independent fields now
// (profiles.theme_accent/theme_mode), reconciled separately since a user
// could in principle have one synced and not the other (e.g. a write that
// partially failed).
//
// useProfile() is NOT a shared/context hook — this component's `profile` is
// its OWN independent copy, separate from Settings.js's own useProfile()
// call. Settings' accent/mode writes go through updateProfile's `silent`
// path specifically to avoid the app-wide refetch notifyChanged() would
// otherwise trigger (see 16-app-themes.md §3.7) — which means THIS copy of
// `profile` never refreshes when the user picks a new accent/mode here.
// `accentId`/`modeId` are deliberately NOT in the effect's deps for exactly
// that reason: if they were, this effect would re-run on every local
// selection, compare the just-picked value against this stale, never-
// refetched `profile`, see a "disagreement", and immediately revert the
// selection back — which is exactly what "the choice doesn't stick until I
// restart the app" was. Depending only on `profile` means this only ever
// reconciles when a genuine refetch happens (cold start, sign-in, or some
// other action's notifyChanged — e.g. syncing a change made on another
// device), not in reaction to the very state it's trying not to fight.
//
// ThemeContext's AsyncStorage cache is device-local, not per-user — same
// reasoning AccountContext's own activeAccountId cache uses, and the same
// gap it has to guard against: two different people signing into the same
// device see whoever most recently used it. AccountContext already solves
// this (resets activeAccountId to null the instant `userId` changes, then
// re-resolves against the newly-signed-in user's own accounts) — this does
// the equivalent for theme: on a LOGIN or account-switch (a new non-null
// user), reset to the default accent/mode immediately so account A's cached
// choice can't flash while account B's profile is still loading; the
// reconciliation effect above then takes over once B's own profile arrives.
// The reset is intentionally SKIPPED on logout (see the effect's own comment)
// so it doesn't repaint the outgoing authenticated screen a beat before the
// redirect to sign-in.
// Sibling of <Stack>, same placement/reason as ThemeProfileSync (needs
// useProfile(), which needs useDataRefresh(), which RootNavigator defines
// but doesn't consume) — and the same real gap that push-token registration
// had: profiles.timezone has a DB column and a hardcoded default
// ('Asia/Kolkata'), and send-push's cron reads it to decide when "morning"/
// "evening" local time actually is, but nothing anywhere in the client ever
// WROTE a real value into it. Every user, regardless of actual device
// timezone, was silently being scheduled as if they were in India — found
// via a real device test (VPN'd to Australia, a reminder set for a specific
// local time never arrived, because "local time" was being computed against
// a timezone the device was never in and the VPN doesn't change the OS
// timezone either way).
//
// Compares the device's real IANA timezone against the last-synced value on
// every profile refetch (cold start, and the many notifyChanged() calls
// normal app use already triggers) — not a dedicated poll/interval, since
// useProfile's own refetch cadence already gives this frequent-enough
// chances to catch a real change (the user travelling, or the timezone
// simply never having been set at all).
function TimezoneSync() {
  const { session } = useAuth();
  const { profile, updateProfile } = useProfile();
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (!userId || !profile) return;
    const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (deviceTimezone && deviceTimezone !== profile.timezone) {
      updateProfile({ timezone: deviceTimezone }, { silent: true });
    }
  }, [userId, profile, updateProfile]);

  return null;
}

// Android reports 'background' for any pause of the activity: the Google
// sign-in tab, a share sheet, a permission dialog, a detour to system
// settings. A return only counts as a new app open after this long away.
const NEW_OPEN_AFTER_MS = 30 * 1000;

// Sibling of <Stack>, same placement as TimezoneSync (needs useAuth()). Loads
// the profile's analytics consent into lib/track.js on sign-in and on every
// app open, and records one `app_open` per cold start and per real return
// from the background (33-product-analytics.md). Each open waits for the
// consent read, so it's judged against the real choice rather than the
// unknown-means-off default. Going to the background also sends whatever
// the offline queue is holding.
function AnalyticsSync() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const coldStartPending = useRef(true);

  useEffect(() => {
    let cancelled = false;
    startTrackingSession();
    startMomentSession();
    loadTrackingConsent(userId).then(() => {
      if (cancelled || !coldStartPending.current) return;
      coldStartPending.current = false;
      track('app_open');
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let backgroundedAt = null;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        backgroundedAt = Date.now();
        flushEvents();
        return;
      }
      if (next !== 'active' || backgroundedAt === null) return;
      const away = Date.now() - backgroundedAt;
      backgroundedAt = null;
      if (away < NEW_OPEN_AFTER_MS) return;
      const uid = userIdRef.current;
      startTrackingSession();
      startMomentSession();
      loadTrackingConsent(uid).then(() => {
        if (userIdRef.current === uid) track('app_open');
      });
    });
    return () => sub.remove();
  }, []);

  return null;
}

// Feeds the moment queue (lib/momentQueue.js) what it can't see itself: whose
// saved queue to load, and whether onboarding is on screen — no moment shows
// during onboarding (34-streak-only.md). A Stack sibling because it needs
// useProfile and the route segments. Sessions are started alongside the
// tracking session in AnalyticsSync.
function MomentQueueSync() {
  const { session } = useAuth();
  const { profile, loading } = useProfile();
  const segments = useSegments();
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    loadMomentsFor(userId);
  }, [userId]);

  // Held while the profile is unknown too, so nothing slips in before the
  // onboarding check can run.
  const onboarding = !!session && (loading || !profile?.onboarded_at || segments[0] === 'onboarding');
  useEffect(() => {
    setMomentBlocker('onboarding', onboarding);
  }, [onboarding]);

  return null;
}

function ThemeProfileSync() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const { modePreference, setModePreference, accentPreference, setAccent } = useTheme();
  const userId = session?.user?.id ?? null;
  const prevUserIdRef = useRef(userId);

  useEffect(() => {
    if (prevUserIdRef.current !== userId) {
      prevUserIdRef.current = userId;
      // Reset to default ONLY on a login / account-switch (new userId is
      // non-null) — giving the incoming account a clean default base before
      // its own profile theme loads. Deliberately NOT on logout (userId →
      // null): resetting there repaints the still-mounted authenticated
      // screen (e.g. Settings) to default lime for a beat before the redirect
      // to /sign-in lands — that was the reported logout flash. Pre-auth
      // screens are now pinned to the default palette themselves
      // (app/sign-in.js), so leaving the active theme on the outgoing
      // account's colors until that screen unmounts is invisible.
      if (userId) {
        setModePreference(DEFAULT_MODE_PREFERENCE);
        setAccent(DEFAULT_ACCENT_ID);
      }
    }
  }, [userId, setModePreference, setAccent]);

  useEffect(() => {
    if (MODE_PREFERENCES.includes(profile?.theme_mode) && profile.theme_mode !== modePreference) {
      setModePreference(profile.theme_mode);
    }
    // The accent is a choice again (spec 43); setAccent ignores unknown ids,
    // and ThemeContext keeps it on lime while FLAGS.themes is off.
    // Compared first, like the mode, so a profile refetch doesn't rewrite it.
    // FLAGS.accents off (spec 46): theme_accent isn't read at all.
    if (FLAGS.accents && profile?.theme_accent && profile.theme_accent !== accentPreference) setAccent(profile.theme_accent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, setModePreference, setAccent]);

  return null;
}

function RootNavigator() {
  const { session, loading } = useAuth();
  const { colors, modeId } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const [introSeen, setIntroSeen] = useState(null); // null = still reading the flag

  useEffect(() => {
    getIntroSeen().then(setIntroSeen);
  }, []);

  // Android's 3-button nav bar never followed dark mode — nothing had ever
  // called any nav-bar API, so its icon contrast was left to the OS's own
  // edge-to-edge scrim, which app.json's `androidNavigationBar.enforceContrast:
  // false` (native config, needs a rebuild) hands control of back to us.
  // setButtonStyleAsync is a no-op on gesture-nav devices (no native API to
  // even detect that mode exists — Expo's own docs note this) and on iOS, so
  // this only ever affects Android 3-button-nav phones, which is exactly the
  // "sometimes" in the reported bug: gesture-nav devices were never the
  // problem, 3-button ones were. Same modeId-driven pattern as the StatusBar
  // fix right below.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    NavigationBar.setButtonStyleAsync(modeId === 'dark' ? 'light' : 'dark').catch(() => {});
  }, [modeId]);

  // Once any session exists (sign-in, sign-up, or a restored session), the intro
  // has served its purpose on this device — remember it, so a later signed-out
  // state (e.g. after a sign-out) goes straight to sign-in and never back
  // through the sales intro. The DB flag profiles.onboarded_at is the true
  // one-time guarantee across devices; this is just the device-local shortcut.
  //
  // Updates local state too, not just AsyncStorage: without this, signing out
  // in the same app session that just signed up (no full reload in between —
  // the common Expo Go testing loop) re-reads the stale `introSeen === false`
  // this component captured at its OWN mount, before the sign-up ever
  // happened, and wrongly sends a real returning user back through the
  // pre-auth sales intro instead of straight to sign-in.
  useEffect(() => {
    if (session) {
      persistIntroSeen();
      setIntroSeen(true);
    }
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
    <>
      {/* Nothing ever set this before — expo-status-bar wasn't imported
          anywhere in the app, so the OS fell back to app.json's
          userInterfaceStyle ("light"), a static native setting that has no
          idea FLO's own in-app Dark mode exists or reacts when it's
          toggled. Result: dark-mode status bar icons could render
          dark-on-dark (invisible) — worse right after a cold start, before
          anything happened to override the native default. Tied directly
          to modeId so it flips the instant the user switches modes, not
          just on next launch. */}
      <StatusBar style={modeId === 'dark' ? 'light' : 'dark'} />
      <DataRefreshProvider>
        <AccountProvider>
        <ToastProvider>
          <BottomSheetModalProvider>
            <RewardBurstProvider>
            <ProUpsellSheetProvider>
              <AddAccountSheetProvider>
                <AccountSwitcherSheetProvider>
                  <AddTransactionSheetProvider>
                    <AddBudgetSheetProvider>
                      <AddPlanSheetProvider>
                        {/* Split sheets (31-split-expenses.md). Plain
                            providers, NOT headless Stack siblings — they need
                            no useProfile()-style hook access, so they don't
                            belong in that group below. Person must wrap Split:
                            AddSplitSheet calls useAddSplitPersonSheet() so a
                            new person can be created and selected in one go. */}
                        <AddSplitPersonSheetProvider>
                        <AddSplitSheetProvider>
                        <AddSplitEntrySheetProvider>
                        <SettleUpSheetProvider>
                        <AddBillSheetProvider>
                          <PayBillSheetProvider>
                            <EditProfileSheetProvider>
                              <AddCategorySheetProvider>
                                <RewardsHistorySheetProvider>
                                  <AlertsSheetProvider>
                                    <OnboardingGate />
                                    <ThemeProfileSync />
                                    <TimezoneSync />
                                    <AnalyticsSync />
                                    <ShareIntentHandler />
                                    {FLAGS.splitInvites && <PendingInviteHandler />}
                                    <NotificationSync />
                                    <PushTokenSync />
                                    <DetectedTransactionHandler />
                                    <MomentQueueSync />
                                    <DueBillsSource />
                                    <ShareUsageSource />
                                    <MomentHost />
                                    <StreakCelebrationSource />
                                    <StreakFreezeSync />
                                    {FLAGS.economy && <RankUpCelebration />}
                                    {FLAGS.economy && <TrophyToast />}
                                    <RecoveryHomeRedirect />
                                    {/* contentStyle matches the active theme's screen bg —
                                        without it, React Navigation's native-stack default
                                        (always white) paints for a frame during every push
                                        transition before the destination screen's own themed
                                        background takes over. Invisible on Brand (already
                                        near-white) but a visible white flash on Dark. */}
                                    {/* Native headers (37-design-system-and-koban.md): off by
                                        default, themed here, and turned on per pushed screen
                                        below as each one drops its hand-drawn header. Tabs and
                                        full-screen flows (onboarding, sign-in) keep none. The
                                        native back button and the system back gesture come
                                        with it. */}
                                    <Stack
                                      screenOptions={{
                                        headerShown: false,
                                        contentStyle: { backgroundColor: colors.bg },
                                        headerStyle: { backgroundColor: colors.bg },
                                        headerTintColor: colors.ink,
                                        headerTitleStyle: { fontFamily: fontFamily.extrabold, fontSize: type.title, color: colors.ink },
                                        headerShadowVisible: false,
                                      }}
                                    >
                                      <Stack.Screen name="settings" options={{ headerShown: false }} />
                                      <Stack.Screen name="accounts" options={{ headerShown: true, title: 'Accounts' }} />
                                      <Stack.Screen name="streak" options={{ headerShown: true, title: 'Streak' }} />
                                      <Stack.Screen name="dev/ai-eval" options={{ headerShown: true, title: 'AI test set' }} />
                                      <Stack.Screen name="dev/kit" options={{ headerShown: false }} />
                                      <Stack.Screen name="transaction/[id]" options={{ headerShown: false }} />
                                      <Stack.Screen name="assistant" options={{ headerShown: true, title: 'Ask FLO' }} />
                                      <Stack.Screen name="assistant/history" options={{ headerShown: true, title: 'Past chats' }} />
                                    </Stack>
                                  </AlertsSheetProvider>
                                </RewardsHistorySheetProvider>
                              </AddCategorySheetProvider>
                            </EditProfileSheetProvider>
                          </PayBillSheetProvider>
                        </AddBillSheetProvider>
                        </SettleUpSheetProvider>
                        </AddSplitEntrySheetProvider>
                        </AddSplitSheetProvider>
                        </AddSplitPersonSheetProvider>
                      </AddPlanSheetProvider>
                    </AddBudgetSheetProvider>
                  </AddTransactionSheetProvider>
                </AccountSwitcherSheetProvider>
              </AddAccountSheetProvider>
            </ProUpsellSheetProvider>
            </RewardBurstProvider>
          </BottomSheetModalProvider>
        </ToastProvider>
      </AccountProvider>
    </DataRefreshProvider>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
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
      <ThemeProvider>
        {/* Root render-error boundary (32-safe-closed-test-build.md) — just
            below ThemeProvider so its recovery screen is themed. */}
        <AppErrorBoundary>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </AppErrorBoundary>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
