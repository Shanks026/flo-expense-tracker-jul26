import { Children, cloneElement, isValidElement, useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Image, Modal, ActivityIndicator, Linking, AppState, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  CircleDollarSign,
  Palette,
  KeyRound,
  Download,
  Info,
  ShieldCheck,
  LogOut,
  SunMedium,
  SunMoon,
  Sunrise,
  Moon,
  Bell,
  Receipt,
  Landmark,
  BatteryWarning,
  Trash2,
  TriangleAlert,
  Send,
  ChartColumn,
  CalendarClock,
  CalendarDays,
  Sparkles,
  Mic,
  LayoutDashboard,
  Smartphone,
  Sun,
} from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import ScreenHeader, { LargeTitle, useHeaderScroll } from '../components/ledger/ScreenHeader';
import SectionHeader from '../components/ledger/SectionHeader';
import ListRow from '../components/ledger/ListRow';
import Segmented from '../components/ledger/Segmented';
import Callout from '../components/ledger/Callout';
import Button from '../components/ledger/Button';
import Skeleton from '../components/Skeleton';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, ledgerSize, inter } from '../theme/ledger';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useAccount } from '../lib/AccountContext';
import { useDataRefresh } from '../lib/DataRefreshContext';
import useProfile from '../hooks/useProfile';
import useCurrency from '../hooks/useCurrency';
import useEntitlement from '../hooks/useEntitlement';
import useAnalyticsConsent from '../hooks/useAnalyticsConsent';
import useVoiceLanguage from '../hooks/useVoiceLanguage';
import { voiceSupported, VOICE_LANGUAGES } from '../lib/voice';
import { useEditProfileSheet } from '../components/EditProfileSheet';
import { useToast } from '../components/Toast';
import CurrencyPicker from '../components/CurrencyPicker';
import ProBadge from '../components/ProBadge';
import { useProUpsellSheet } from '../components/ProUpsellSheet';
import { fetchAllTransactions, buildTransactionsCsv, shareCsv } from '../lib/export';
import { APP_VERSION, PRIVACY_POLICY_URL } from '../lib/about';
import { FLAGS } from '../lib/flags';
import { useTheme } from '../theme/ThemeContext';
import {
  getNotificationSettings,
  setNotificationEnabled,
  setBillReminderSettings,
  requestPermission,
  getPermissionStatus,
} from '../lib/notifications';
import {
  isSupported as isDetectSupported,
  isAutoDetectVariant,
  hasNotificationAccess,
  openNotificationAccessSettings,
  isDetectionEnabled,
  setDetectionEnabled,
  setAllowedPackages,
  getDetectionDebugLog,
  clearDetectionDebugLog,
  DEFAULT_ALLOWED_PACKAGES,
  WATCHED_APP_LABELS,
} from '../lib/detect';
import { getPushTokenStatus, sendTestPush, registerPushToken } from '../lib/pushToken';
import { RESET_PERIOD_OPTIONS } from '../lib/periods';
import { destructiveHaptic } from '../lib/haptics';

const DAYS_BEFORE_OPTIONS = [1, 2, 3];

// Appearance: System follows the phone's light/dark setting and is the default.
const APPEARANCE_OPTIONS = [
  { value: 'system', label: 'System', icon: Smartphone, accessibilityLabel: 'System appearance' },
  { value: 'light', label: 'Light', icon: Sun, accessibilityLabel: 'Light appearance' },
  { value: 'dark', label: 'Dark', icon: Moon, accessibilityLabel: 'Dark appearance' },
];

// A titled run of flat rows. The last row drops its hairline, whichever rows
// happen to be showing; a trailing callout doesn't count as a row. (A row
// wrapped in another component, like the currency picker, gets `divider`
// passed down and sets its own.)
function Group({ title, children }) {
  const items = Children.toArray(children).filter(isValidElement);
  let lastRow = -1;
  items.forEach((el, i) => {
    if (el.type !== Callout) lastRow = i;
  });
  return (
    <View style={{ marginTop: ledgerSpace.section }}>
      {!!title && <SectionHeader title={title} />}
      {items.map((el, i) => (i === lastRow ? cloneElement(el, { divider: false }) : el))}
    </View>
  );
}

// NOT new Date(0, 0, 0, hour, minute) — that resolves to Dec 31, 1899, and
// India's timezone database applies the *historical* Madras Time offset
// (+5:21) for pre-1906 dates, not modern IST (+5:30). The JS-side
// getHours()/getMinutes() still read back correctly within the same
// environment, but the native Android time picker widget converts the
// underlying UTC timestamp using the *current* offset when rendering,
// producing a ~9-minute-ahead display — confirmed via TZ=Asia/Kolkata node
// repro during debugging (2026-07-12). Building on today's date sidesteps
// the whole historical-offset class of bug.
function timeOnToday(hour, minute) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

// profiles.morning_reminder_time/evening_reminder_time come back from
// Postgres as "HH:MM:SS" strings (the `time` column type) — parsed into a
// Date the same way DateTimePicker/timeOnToday already expect.
function timeOnTodayFromString(timeStr, fallbackHour, fallbackMinute) {
  if (!timeStr) return timeOnToday(fallbackHour, fallbackMinute);
  const [h, m] = timeStr.split(':').map(Number);
  return timeOnToday(h, m);
}

export default function Settings() {
  const { language: voiceLanguage, setLanguage: setVoiceLanguage } = useVoiceLanguage();
  const showVoiceLanguage = useMemo(() => voiceSupported(), []);
  const router = useRouter();
  const { session, deleteAccount, signOut } = useAuth();
  const { profile, avatarUrl, updateProfile, loading: profileLoading } = useProfile();
  const { activeAccountId, accounts } = useAccount();
  const { notifyChanged } = useDataRefresh();
  const currency = useCurrency();
  const { openEditProfile } = useEditProfileSheet();
  const { modePreference, setModePreference } = useTheme();
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll } = useHeaderScroll();
  const { isPro, hasPro } = useEntitlement();
  const { openProUpsell } = useProUpsellSheet();
  const { showToast } = useToast();
  const [exportingAll, setExportingAll] = useState(false);

  // How this account signs in, from Supabase's identity providers.
  const PROVIDER_LABEL = { email: 'Email', google: 'Google' };
  const signInMethods =
    (session?.user?.app_metadata?.providers ?? [session?.user?.app_metadata?.provider])
      .filter(Boolean)
      .map((p) => PROVIDER_LABEL[p] ?? p)
      .join(', ') || 'Email';

  // Every transaction in every account, as one CSV. Pro, like Insights' CSV
  // (open while the billing flag is off).
  async function handleExportAll() {
    if (!hasPro) {
      openProUpsell('CSV export is a Pro feature');
      return;
    }
    setExportingAll(true);
    try {
      const { transactions, error } = await fetchAllTransactions();
      if (error) throw error;
      const result = await shareCsv(`flo-transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`, buildTransactionsCsv(transactions, accounts));
      if (result.unsupported) showToast({ message: 'Sharing is not available on this device', variant: 'error' });
    } catch (err) {
      showToast({ message: 'Export failed', variant: 'error' });
    } finally {
      setExportingAll(false);
    }
  }

  // Applied on the device first, so the switch is instant, then saved to the
  // profile `silent` (no app-wide refetch). A failed save keeps the local
  // choice and says so.
  async function handleAppearanceChange(pref) {
    if (pref === modePreference) return;
    setModePreference(pref);
    const { error } = await updateProfile({ theme_mode: pref }, { silent: true });
    if (error) showToast({ message: error.message, variant: 'error' });
  }
  const { consent: analyticsConsent, setConsent: setAnalyticsConsent } = useAnalyticsConsent();

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const [notifEnabled, setNotifEnabled] = useState(false);
  const [billReminders, setBillReminders] = useState({ enabled: true, daysBefore: 2 });
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  // Which daily-reminder time picker is open, if any — 'morning' | 'evening'
  // | null. Two separate times now (17-server-push-notifications.md Phase
  // 2), not one, so a single boolean can't distinguish which field a
  // DateTimePicker result should write back to.
  const [timePickerField, setTimePickerField] = useState(null);

  // 30-summary-reset-period.md — governs the period Home's hero card and the
  // account switcher sum Income/Expenses over. Read straight off `profile`
  // (no local state mirror needed — this has no
  // AsyncStorage/server-cron side that needs a separate persisted copy).
  const [showResetDatePicker, setShowResetDatePicker] = useState(false);
  const resetPeriod = profile?.reset_period ?? 'monthly';
  const resetCustomStart = profile?.reset_custom_start ?? null;

  // Transaction Detection (06-transaction-auto-detect.md). Notification
  // access is granted outside the app (system settings), with no callback —
  // same reason getPermissionStatus() exists for OS notifications below —
  // so this re-checks on mount AND on every foreground (AppState → active),
  // not just mount: a pushed screen like Settings doesn't remount when the
  // app merely backgrounds to system settings and comes back via the OS
  // back gesture, only when actually popped.
  const [detectAccess, setDetectAccess] = useState(false);
  const [detectEnabled, setDetectEnabled] = useState(false);

  // Push status (17-server-push-notifications.md Phase 4) — the
  // confidence-building row: is this device actually registered, and a
  // button to fire a REAL push through send-push end to end rather than
  // waiting for the next scheduled cron window.
  const [pushStatus, setPushStatus] = useState({ checking: true, registered: false });
  const [sendingTestPush, setSendingTestPush] = useState(false);

  const fullName = profile?.full_name ?? session?.user?.user_metadata?.full_name ?? '';
  const initial = fullName?.[0]?.toUpperCase() ?? '?';

  // Switching INTO Custom for the first time (no anchor set yet) defaults the
  // start date to today, not null — lands on a concrete, immediately-visible
  // "fresh start" instead of an ambiguous empty state. Any other transition
  // just writes the new period; useAllAccountSummaries picks it up on its
  // next notifyChanged()-triggered refetch (updateProfile is non-silent here
  // on purpose — Home/the account switcher should actually update).
  async function handleResetPeriodChange(value) {
    if (value === 'custom' && !resetCustomStart) {
      await updateProfile({ reset_period: 'custom', reset_custom_start: format(new Date(), 'yyyy-MM-dd') });
    } else {
      await updateProfile({ reset_period: value });
    }
  }

  function handleResetCustomStartChange(_event, selected) {
    setShowResetDatePicker(false);
    if (!selected) return;
    // The date field IS the reset action for Custom mode — picking a new
    // anchor is how the user "starts fresh" (there's no separate button).
    updateProfile({ reset_custom_start: format(selected, 'yyyy-MM-dd') });
  }

  useEffect(() => {
    getNotificationSettings().then(async (s) => {
      setBillReminders(s.billReminders);
      if (s.enabled) {
        // The OS permission can be revoked from outside the app (system
        // settings) without FLO knowing — cross-check on open rather than
        // trusting the stored toggle blindly, so a silently-revoked
        // permission shows the "blocked" hint immediately, not only after
        // the user happens to retry the toggle.
        const status = await getPermissionStatus();
        setNotifEnabled(status.granted);
        // "Open system settings" wouldn't help in Expo Go (unsupported, not
        // a real OS permission denial) — only show that hint for a genuine
        // OS-level block.
        setPermissionBlocked(!status.unsupported && !status.granted && !status.canAskAgain);
      } else {
        setNotifEnabled(false);
      }
    });
  }, []);

  const refreshDetectStatus = useCallback(() => {
    setDetectAccess(hasNotificationAccess());
    setDetectEnabled(isDetectionEnabled());
  }, []);

  useEffect(() => {
    refreshDetectStatus();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshDetectStatus();
    });
    return () => subscription.remove();
  }, [refreshDetectStatus]);

  // Re-checked the same way (mount + every foreground) — registration
  // happens fire-and-forget at app boot (usePushTokenSync), so it may
  // genuinely still be in flight the first time this screen is opened.
  const refreshPushStatus = useCallback(async () => {
    const userId = session?.user?.id ?? null;
    setPushStatus((prev) => ({ ...prev, checking: true }));
    const status = await getPushTokenStatus(userId);
    setPushStatus({ checking: false, ...status });
  }, [session]);

  useEffect(() => {
    refreshPushStatus();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshPushStatus();
    });
    return () => subscription.remove();
  }, [refreshPushStatus]);

  async function handleSendTestPush() {
    setSendingTestPush(true);
    const result = await sendTestPush(session?.user?.id ?? null);
    setSendingTestPush(false);
    if (result.sent) {
      showToast({ message: 'Test push sent — check your notification shade', variant: 'success' });
    } else if (result.error) {
      showToast({ message: 'Could not send test push', variant: 'error' });
    } else {
      showToast({ message: 'No push token registered on this device yet', variant: 'error' });
    }
  }

  function handleToggleDetect(value) {
    if (value) {
      setAllowedPackages(DEFAULT_ALLOWED_PACKAGES);
    }
    setDetectionEnabled(value);
    setDetectEnabled(value);
  }

  // Debug — the ONLY way to see what the parser is actually choking on.
  // Failed parses never reach the queue, so without this a wrong/missing
  // income-vs-expense classification is invisible: you'd be guessing at
  // notification text you've never read.
  function handleShowDetectionLog() {
    const entries = getDetectionDebugLog();
    if (!entries.length) {
      Alert.alert('No notifications seen', 'Nothing from the watched apps has arrived since detection was enabled.');
      return;
    }
    const body = entries
      .slice()
      .reverse()
      .map((e) => {
        const parsed =
          e.outcome === 'no-parse'
            ? '→ COULD NOT PARSE'
            : `→ ₹${e.amount} ${e.type} (${e.outcome})`;
        return `"${e.title}"\n"${e.text}"\n${parsed}`;
      })
      .join('\n\n───\n\n');
    Alert.alert(`Last ${entries.length} seen`, body, [
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          destructiveHaptic();
          clearDetectionDebugLog();
        },
      },
      { text: 'Close', style: 'cancel' },
    ]);
  }

  async function handleToggleNotifications(value) {
    if (value) {
      const permission = await requestPermission();
      if (!permission.granted) {
        if (permission.unsupported) {
          showToast({ message: 'Notifications need a development build, not Expo Go', variant: 'error' });
          return;
        }
        setPermissionBlocked(!permission.canAskAgain);
        showToast({
          message: permission.canAskAgain ? 'Notification permission denied' : 'Enable notifications in system settings',
          variant: 'error',
        });
        return;
      }
      setPermissionBlocked(false);
      // Same gap onboarding's equivalent handler had: usePushTokenSync only
      // registers on a userId change, which already happened (before
      // permission existed) if notifications were off at sign-in. Without
      // this, granting permission here wouldn't actually get a token
      // registered until the app restarts.
      const userId = session?.user?.id ?? null;
      if (userId) {
        const result = await registerPushToken(userId);
        refreshPushStatus();
        if (!result.registered && !result.unsupported) {
          showToast({ message: 'Permission granted, but push registration failed — try again shortly', variant: 'error' });
        }
      }
    }
    setNotifEnabled(value);
    await setNotificationEnabled(value);
  }

  // Deep-links to the OS battery-optimization LIST — not a direct
  // exemption request (Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS),
  // which needs its own manifest permission that Google Play scrutinizes
  // similarly to notification-listener access. This needs no special
  // permission at all — same "deep-link to a system screen" pattern as
  // openNotificationAccessSettings() below. Only fixes stock Android's Doze;
  // OEM skins (Vivo/iQOO's OriginOS especially) layer their own separate
  // background-process killer on top with no public API — that part needs
  // the user to configure manually (Settings > Battery > High background
  // power consumption, and Settings > Apps > Autostart).
  function handleOpenBatterySettings() {
    if (Platform.OS !== 'android') return;
    Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(() => {
      Linking.openSettings();
    });
  }

  // Daily reminders are now server-sent (17-server-push-notifications.md
  // Phase 2), not locally scheduled — these write straight to `profiles`
  // (via `silent: true`, same reasoning as the theme picker's writes: no
  // fetched screen data depends on a reminder time, so there's no reason to
  // pay the app-wide refetch a non-silent notifyChanged() would trigger).
  // No sync()/rescheduleAll() call needed anymore; the server reads
  // `profiles` directly on its own cron tick.
  async function handleToggleDailyReminders(value) {
    await updateProfile({ reminders_enabled: value }, { silent: true });
  }

  async function handleToggleAnalytics(value) {
    const { error } = await setAnalyticsConsent(value);
    if (error) showToast({ message: 'Could not save your choice. Try again.', variant: 'error' });
  }

  async function handleReminderTimeChange(_event, selected) {
    const field = timePickerField;
    setTimePickerField(null);
    if (!selected || !field) return;

    // Confining morning to the AM half and evening to the PM half — not just
    // "must be before/after the other" — so the two can never collide (a
    // user could otherwise set both to the same time, or "morning" later in
    // the day than "evening") without needing a second cross-field check.
    const hours = selected.getHours();
    if (field === 'morning' && hours >= 12) {
      showToast({ message: 'Morning reminder must be before 12 PM', variant: 'error' });
      return;
    }
    if (field === 'evening' && hours < 12) {
      showToast({ message: 'Evening reminder must be after 12 PM', variant: 'error' });
      return;
    }

    const hh = String(hours).padStart(2, '0');
    const mm = String(selected.getMinutes()).padStart(2, '0');
    const column = field === 'morning' ? 'morning_reminder_time' : 'evening_reminder_time';
    await updateProfile({ [column]: `${hh}:${mm}:00` }, { silent: true });
  }

  // No local reschedule needed — setBillReminderSettings mirrors to
  // `profiles` itself (17-server-push-notifications.md Phase 3).
  async function handleToggleBillReminders(value) {
    const next = { ...billReminders, enabled: value };
    setBillReminders(next);
    await setBillReminderSettings(next);
  }

  async function handleDaysBeforeChange(daysBefore) {
    const next = { ...billReminders, daysBefore };
    setBillReminders(next);
    await setBillReminderSettings(next);
  }

  // App-wide display currency. Writes BOTH the ACTIVE account's currency —
  // which is what every screen actually displays via useCurrency() →
  // activeAccount.currency — AND profiles.currency (the default seeded into
  // future new accounts), so the two agree. (The old onboarding currency
  // screen did the same dual write.) Previously this wrote ONLY profiles.currency,
  // which nothing on screen reads, so the change never appeared anywhere —
  // the reported bug. Currency here is purely a display symbol (no FX
  // conversion), so re-labeling an existing account's amounts is intended.
  async function handleCurrencyChange(code) {
    if (!activeAccountId) return;
    const [{ error: accountError }, { error: profileError }] = await Promise.all([
      supabase.from('accounts').update({ currency: code }).eq('id', activeAccountId),
      updateProfile({ currency: code }, { silent: true }),
    ]);
    const error = accountError ?? profileError;
    if (error) {
      showToast({ message: error.message, variant: 'error' });
      return;
    }
    // Refetch accounts (AccountProvider subscribes to version) so useCurrency
    // picks up the new active-account currency app-wide.
    notifyChanged();
    showToast({ message: 'Currency updated', variant: 'success' });
  }

  async function handleDelete() {
    destructiveHaptic();
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      // On success, signOut inside deleteAccount flips the session to null and
      // the root navigator redirects to sign-in — nothing else to do here.
    } catch (err) {
      setDeleting(false);
      setDeleteError(err.message ?? 'Could not delete your account. Try again.');
    }
  }

  const dailyOn = profile?.reminders_enabled ?? true;
  const remindersOn = notifEnabled && dailyOn;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Settings" scrollY={scrollY} />
      {/* Flat grouped rows on the canvas under sentence-case section headers
          (spec 46). Sections in a fixed order: profile, Account, Appearance,
          Notifications, Preferences, Transaction detection, Data and export,
          About, Developer (dev builds only), then Delete account above Log
          out at the bottom. */}
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <LargeTitle title="Settings" scrollY={scrollY} />

        <View style={styles.profile}>
          <ListRow
            renderIcon={() =>
              avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <Text style={styles.avatarInitial}>{initial}</Text>
              )
            }
            title={fullName || 'Add your name'}
            sub={session?.user?.email}
            right={isPro ? <ProBadge variant="pill" /> : null}
            trailing="chevron"
            onPress={openEditProfile}
            divider={false}
            accessibilityLabel={`${fullName || 'Add your name'}, ${session?.user?.email ?? ''}`}
            accessibilityHint="Edit your profile"
          />
        </View>

        <Group title="Account">
          <ListRow icon={KeyRound} title="Signed in with" right={signInMethods} />
        </Group>

        {/* Applied straight away and saved to the profile so it follows the
            account. */}
        <Group title="Appearance">
          <ListRow icon={SunMoon} title="Theme">
            <Segmented
              accessibilityLabel="Appearance"
              options={APPEARANCE_OPTIONS}
              value={modePreference}
              onChange={handleAppearanceChange}
            />
          </ListRow>
          {/* Personalize: card themes (lib/flags.js, spec 43). */}
          {FLAGS.themes && <ListRow icon={Palette} title="Personalize" trailing="chevron" onPress={() => router.push('/personalize')} />}
        </Group>

        <Group title="Notifications">
          <ListRow icon={Bell} title="Notifications" switchValue={notifEnabled} onSwitchChange={handleToggleNotifications} />
          {permissionBlocked && (
            <Callout
              tone="danger"
              text="Notifications are blocked for FLO."
              actionLabel="Open system settings"
              onAction={() => Linking.openSettings()}
              style={styles.callout}
            />
          )}
          <ListRow
            icon={SunMedium}
            title="Daily reminders"
            switchValue={dailyOn}
            onSwitchChange={handleToggleDailyReminders}
            disabled={!notifEnabled}
          />
          {remindersOn && (
            <ListRow
              icon={Sunrise}
              title="Morning"
              right={format(timeOnTodayFromString(profile?.morning_reminder_time, 8, 0), 'h:mm a')}
              trailing="chevron"
              onPress={() => setTimePickerField('morning')}
            />
          )}
          {remindersOn && (
            <ListRow
              icon={Moon}
              title="Evening"
              right={format(timeOnTodayFromString(profile?.evening_reminder_time, 21, 0), 'h:mm a')}
              trailing="chevron"
              onPress={() => setTimePickerField('evening')}
            />
          )}
          <ListRow
            icon={Receipt}
            title="Bill reminders"
            switchValue={billReminders.enabled}
            onSwitchChange={handleToggleBillReminders}
            disabled={!notifEnabled}
          />
          {notifEnabled && billReminders.enabled && (
            <ListRow icon={CalendarClock} title="Remind me">
              <Segmented
                accessibilityLabel="Remind me before a bill is due"
                options={DAYS_BEFORE_OPTIONS.map((d) => ({
                  value: d,
                  label: `${d}d before`,
                  accessibilityLabel: `${d} ${d === 1 ? 'day' : 'days'} before`,
                }))}
                value={billReminders.daysBefore}
                onChange={handleDaysBeforeChange}
              />
            </ListRow>
          )}
          {/* Opens Android's Doze list (set FLO to "Don't optimize"). OEM
              skins such as Vivo/iQOO add their own killer with no public API
              (see handleOpenBatterySettings); callouts stay one line. */}
          {Platform.OS === 'android' && (
            <Callout
              tone="warn"
              icon={BatteryWarning}
              text="Battery saving can delay reminders."
              actionLabel="Open battery settings"
              onAction={handleOpenBatterySettings}
              style={styles.callout}
            />
          )}
        </Group>
        {timePickerField && (
          <DateTimePicker
            value={
              timePickerField === 'morning'
                ? timeOnTodayFromString(profile?.morning_reminder_time, 8, 0)
                : timeOnTodayFromString(profile?.evening_reminder_time, 21, 0)
            }
            mode="time"
            display="default"
            onChange={handleReminderTimeChange}
          />
        )}

        <Group title="Preferences">
          <ListRow icon={CircleDollarSign} title="Summary period" sub="When Home's spent and received totals reset">
            <Segmented
              accessibilityLabel="Summary period"
              options={RESET_PERIOD_OPTIONS}
              value={resetPeriod}
              onChange={handleResetPeriodChange}
            />
          </ListRow>
          {resetPeriod === 'custom' && (
            <ListRow
              icon={CalendarDays}
              title="Starts from"
              right={format(resetCustomStart ? parseISO(resetCustomStart) : new Date(), 'd MMM yyyy')}
              trailing="chevron"
              onPress={() => setShowResetDatePicker(true)}
            />
          )}
          {/* The quick-add mic's language (44-ai-assistant.md, Phase 2),
              kept on this device. */}
          {showVoiceLanguage && (
            <ListRow icon={Mic} title="Voice language" sub="What the quick-add mic listens for">
              <Segmented
                accessibilityLabel="Voice language"
                options={VOICE_LANGUAGES}
                value={voiceLanguage}
                onChange={setVoiceLanguage}
              />
            </ListRow>
          )}
          {/* right is the EFFECTIVE display currency (useCurrency →
              activeAccount.currency), matching what the app actually shows,
              not profiles.currency (which only seeds new accounts). Hidden
              while the currency picker is flagged off (lib/flags.js). */}
          {FLAGS.currencyPicker && (
            <CurrencyPicker
              value={currency}
              onChange={handleCurrencyChange}
              variant="dialog"
              renderTrigger={(selected, toggle) => (
                <ListRow
                  divider={false}
                  icon={CircleDollarSign}
                  title="Currency"
                  sub="Shown across the app"
                  right={profileLoading ? <Skeleton width={54} height={16} radius={6} /> : `${selected.symbol} ${selected.code}`}
                  onPress={toggle}
                />
              )}
            />
          )}
        </Group>

        {showResetDatePicker && (
          <DateTimePicker
            value={resetCustomStart ? parseISO(resetCustomStart) : new Date()}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={handleResetCustomStartChange}
          />
        )}

        {isAutoDetectVariant() &&
          (!isDetectSupported() ? (
            <Group title="Transaction detection">
              <ListRow icon={Landmark} title="Not available" sub="Android only, and needs a development build (not Expo Go)." subLines={2} />
            </Group>
          ) : (
            <Group title="Transaction detection">
              <ListRow
                icon={Landmark}
                title="Notification access"
                right={detectAccess ? 'Granted' : 'Tap to grant'}
                trailing="chevron"
                onPress={openNotificationAccessSettings}
              />
              <ListRow
                icon={Bell}
                title="Enable detection"
                sub={detectEnabled ? `Reads only ${Object.values(WATCHED_APP_LABELS).join(', ')} alerts` : undefined}
                subLines={2}
                switchValue={detectEnabled}
                onSwitchChange={handleToggleDetect}
                disabled={!detectAccess}
              />
              {/* Dev-only: the detection debug log. */}
              {__DEV__ && detectEnabled && (
                <ListRow icon={Receipt} title="What FLO has seen" trailing="chevron" onPress={handleShowDetectionLog} />
              )}
            </Group>
          ))}

        <Group title="Data and export">
          <ListRow
            icon={Download}
            title="Export all transactions"
            sub="A CSV of every account"
            onPress={handleExportAll}
            trailing={exportingAll ? <ActivityIndicator size="small" color={c.ink} /> : !hasPro ? <ProBadge variant="pill" /> : 'chevron'}
            disabled={exportingAll}
          />
          <ListRow
            icon={ChartColumn}
            title="Share anonymous usage"
            sub="Helps improve FLO. Only which features you use, never amounts, notes or names."
            subLines={2}
            switchValue={analyticsConsent}
            onSwitchChange={handleToggleAnalytics}
          />
        </Group>

        <Group title="About">
          <ListRow icon={Info} title="Version" right={APP_VERSION} />
          {PRIVACY_POLICY_URL && (
            <ListRow icon={ShieldCheck} title="Privacy policy" trailing="chevron" onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} />
          )}
        </Group>

        {/* Developer rows render in development builds only
            (32-safe-closed-test-build.md: no debug UI for testers). */}
        {__DEV__ && (
          <Group title="Developer">
            <ListRow icon={LayoutDashboard} title="Home preview (redesign)" trailing="chevron" onPress={() => router.push('/dev/home-preview')} />
            {FLAGS.ai && <ListRow icon={Sparkles} title="AI test set" trailing="chevron" onPress={() => router.push('/dev/ai-eval')} />}
            {notifEnabled && (
              <ListRow
                icon={Send}
                title="Push notifications"
                sub={
                  pushStatus.checking
                    ? 'Checking…'
                    : pushStatus.unsupported
                      ? 'Needs a development build, not Expo Go.'
                      : pushStatus.registered
                        ? 'This device is registered.'
                        : 'Not registered yet. Reopen the app, or check your connection.'
                }
                subLines={2}
                trailing={
                  <Button
                    variant="secondary"
                    compact
                    title={sendingTestPush ? 'Sending…' : 'Send test'}
                    onPress={handleSendTestPush}
                    disabled={sendingTestPush || !pushStatus.registered}
                  />
                }
              />
            )}
          </Group>
        )}

        <Group>
          <ListRow
            icon={Trash2}
            title="Delete account"
            danger
            onPress={() => {
              setDeleteError(null);
              setConfirmVisible(true);
            }}
          />
          <ListRow icon={LogOut} title="Log out" onPress={signOut} />
        </Group>
      </Animated.ScrollView>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!deleting) setConfirmVisible(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <TriangleAlert size={24} color={c.danger} strokeWidth={1.75} />
            </View>
            <Text style={styles.modalTitle}>Delete account?</Text>
            <Text style={styles.modalBody}>
              This permanently deletes your account and everything in it: all
              accounts, transactions, budgets, plans and your profile. This
              cannot be undone.
            </Text>

            {deleteError && <Text style={styles.modalError}>{deleteError}</Text>}

            <Button variant="danger" title="Delete everything" onPress={handleDelete} loading={deleting} style={styles.modalButton} />
            <Button
              variant="secondary"
              title="Cancel"
              onPress={() => setConfirmVisible(false)}
              disabled={deleting}
              style={[styles.modalButton, { marginTop: ledgerSpace.sm }]}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.canvas,
    },
    scroll: {
      paddingHorizontal: ledgerSpace.gutter,
    },
    profile: {
      marginTop: ledgerSpace.sm,
    },
    avatar: {
      width: ledgerSize.iconCircle,
      height: ledgerSize.iconCircle,
      borderRadius: ledgerRadius.full,
    },
    avatarInitial: {
      fontFamily: inter.semibold,
      fontSize: 16,
      color: c.ink,
    },
    callout: {
      marginTop: ledgerSpace.sm,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: c.scrim,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: ledgerSpace.gutter,
    },
    modalCard: {
      width: '100%',
      backgroundColor: c.surface,
      borderRadius: ledgerRadius.card,
      padding: ledgerSpace.gutter + 4,
      alignItems: 'center',
    },
    modalIcon: {
      width: 52,
      height: 52,
      borderRadius: ledgerRadius.full,
      backgroundColor: c.dangerSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: ledgerSpace.lg,
    },
    modalTitle: {
      ...ledgerType.title,
      color: c.ink,
      marginBottom: ledgerSpace.sm,
    },
    modalBody: {
      ...ledgerType.body,
      color: c.muted,
      textAlign: 'center',
      marginBottom: ledgerSpace.lg,
    },
    modalError: {
      ...ledgerType.body,
      fontFamily: inter.semibold,
      color: c.danger,
      textAlign: 'center',
      marginBottom: ledgerSpace.md,
    },
    modalButton: {
      alignSelf: 'stretch',
    },
  });
}
