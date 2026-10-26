import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Modal, ActivityIndicator, Linking, AppState, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  CircleDollarSign,
  Grid2x2,
  Palette,
  SunMedium,
  SunMoon,
  Sunrise,
  Moon,
  Bell,
  FileText,
  Receipt,
  Landmark,
  BatteryWarning,
  Trash2,
  TriangleAlert,
  Send,
  ChartColumn,
  CalendarClock,
  CalendarDays,
  Clock,
  Minus,
  Plus,
  Cat,
} from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import Card from '../components/Card';
import Button from '../components/Button';
import IconButton from '../components/IconButton';
import Row, { RowGroup } from '../components/Row';
import SegmentedChoice from '../components/SegmentedChoice';
import Skeleton from '../components/Skeleton';
// Static palette (theme/tokens) only for text on the dark profile card and the danger button.
import { colors as staticColors, fontFamily, fontSize, spacing, radii, type } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useAccount } from '../lib/AccountContext';
import { useDataRefresh } from '../lib/DataRefreshContext';
import useProfile from '../hooks/useProfile';
import useCurrency from '../hooks/useCurrency';
import useEntitlement from '../hooks/useEntitlement';
import useAnalyticsConsent from '../hooks/useAnalyticsConsent';
import { useEditProfileSheet } from '../components/EditProfileSheet';
import { useToast } from '../components/Toast';
import CurrencyPicker from '../components/CurrencyPicker';
import ProBadge from '../components/ProBadge';
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
import { getReportSettings, setReportSettings, DEFAULT_REPORT_SETTINGS } from '../lib/reports';
import { getPushTokenStatus, sendTestPush, registerPushToken } from '../lib/pushToken';
import { RESET_PERIOD_OPTIONS } from '../lib/periods';
import AppearanceToggle from '../components/AppearanceToggle';
import { destructiveHaptic } from '../lib/haptics';

const DAYS_BEFORE_OPTIONS = [1, 2, 3];

const CADENCE_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

// value follows JS/date-fns Date#getDay() convention (0=Sun..6=Sat), matching
// lib/reports.js's `weekday`. Displayed Monday-first, same convention as
// weekStartsOn:1 elsewhere in the app.
const WEEKDAY_CHIPS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

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
  const router = useRouter();
  const { session, deleteAccount } = useAuth();
  const { profile, avatarUrl, updateProfile, loading: profileLoading } = useProfile();
  const { activeAccountId } = useAccount();
  const { notifyChanged } = useDataRefresh();
  const currency = useCurrency();
  const { openEditProfile } = useEditProfileSheet();
  const { colors, modePreference, setModePreference } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { isPro } = useEntitlement();
  const { showToast } = useToast();

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

  const [reportSettings, setReportSettingsState] = useState(DEFAULT_REPORT_SETTINGS);
  const [showReportTimePicker, setShowReportTimePicker] = useState(false);

  // 30-summary-reset-period.md — governs the period Home's hero card and the
  // account switcher sum Income/Expenses over. Read straight off `profile`
  // (no local state mirror needed, unlike reportSettings above — this has no
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

  useEffect(() => {
    getReportSettings().then(setReportSettingsState);
  }, []);

  async function persistReportSettings(partial) {
    const next = await setReportSettings(partial);
    setReportSettingsState(next);
    // No local reschedule needed — setReportSettings mirrors to `profiles`
    // itself (17-server-push-notifications.md Phase 3), and the server
    // reads that directly on its own cron tick.
  }

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

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      {/* Flat grouped lists built from the shared Row/RowGroup
          (37-design-system-and-koban.md): 48dp+ targets, a role and label on
          every control, pressed feedback. The profile card stays the one
          emphasis surface. */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={openEditProfile}
          accessibilityRole="button"
          accessibilityLabel={`${fullName || 'Add your name'}, ${session?.user?.email ?? ''}`}
          accessibilityHint="Edit your profile"
          style={({ pressed }) => pressed && styles.pressedDim}
        >
          <Card dark style={styles.profileCard}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.profileNameRow}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {fullName || 'Add your name'}
                </Text>
                {isPro && <ProBadge variant="pill" />}
              </View>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {session?.user?.email}
              </Text>
            </View>
          </Card>
        </Pressable>

        <RowGroup title="General">
          {/* value is the EFFECTIVE display currency (useCurrency →
              activeAccount.currency), matching what the app actually shows,
              not profiles.currency (which only seeds new accounts). Hidden
              while the currency picker is flagged off (lib/flags.js). */}
          {FLAGS.currencyPicker && (
            <CurrencyPicker
              value={currency}
              onChange={handleCurrencyChange}
              variant="dialog"
              renderTrigger={(selected, toggle) => (
                <Row
                  icon={CircleDollarSign}
                  title="Currency"
                  hint="Shown across the app"
                  value={profileLoading ? <Skeleton width={54} height={16} radius={6} /> : `${selected.symbol} ${selected.code}`}
                  onPress={toggle}
                  chevron={false}
                />
              )}
            />
          )}
          <Row icon={Grid2x2} title="Manage Categories" onPress={() => router.push('/manage-categories')} />
          {/* Personalize is economy (lib/flags.js). */}
          {FLAGS.economy && <Row icon={Palette} title="Personalize" onPress={() => router.push('/personalize')} />}
        </RowGroup>

        {/* Appearance: System follows the phone's light/dark setting and is the
            default. Applied straight away and saved to the profile so it
            follows the account. */}
        <RowGroup title="Appearance">
          <Row icon={SunMoon} title="Theme">
            <AppearanceToggle value={modePreference} onChange={handleAppearanceChange} />
          </Row>
        </RowGroup>

        <RowGroup title="Notifications">
          <Row icon={Bell} title="Notifications" switchValue={notifEnabled} onSwitchChange={handleToggleNotifications} />
          {permissionBlocked && (
            <Row
              title="Notifications are blocked"
              hint="Tap to open system settings."
              tone="danger"
              onPress={() => Linking.openSettings()}
            />
          )}
          <Row
            icon={BatteryWarning}
            title="Battery settings"
            hint={'Reminders may be delayed or dropped by your phone\'s battery manager. Set FLO to "Don\'t optimize" here — on Vivo/iQOO also check Settings → Battery → High background power consumption, and Settings → Apps → Autostart.'}
            onPress={handleOpenBatterySettings}
          />
          <Row
            icon={SunMedium}
            title="Daily Reminders"
            switchValue={profile?.reminders_enabled ?? true}
            onSwitchChange={handleToggleDailyReminders}
            disabled={!notifEnabled}
          />
          {notifEnabled && (profile?.reminders_enabled ?? true) && (
            <Row
              icon={Sunrise}
              title="Morning"
              value={format(timeOnTodayFromString(profile?.morning_reminder_time, 8, 0), 'h:mm a')}
              onPress={() => setTimePickerField('morning')}
            />
          )}
          {notifEnabled && (profile?.reminders_enabled ?? true) && (
            <Row
              icon={Moon}
              title="Evening"
              value={format(timeOnTodayFromString(profile?.evening_reminder_time, 21, 0), 'h:mm a')}
              onPress={() => setTimePickerField('evening')}
            />
          )}
          <Row
            icon={Receipt}
            title="Bill Reminders"
            switchValue={billReminders.enabled}
            onSwitchChange={handleToggleBillReminders}
            disabled={!notifEnabled}
          />
          {notifEnabled && billReminders.enabled && (
            <Row icon={CalendarClock} title="Remind me">
              <SegmentedChoice
                accessibilityLabel="Remind me before a bill is due"
                options={DAYS_BEFORE_OPTIONS.map((d) => ({
                  value: d,
                  label: `${d}d before`,
                  accessibilityLabel: `${d} ${d === 1 ? 'day' : 'days'} before`,
                }))}
                value={billReminders.daysBefore}
                onChange={handleDaysBeforeChange}
              />
            </Row>
          )}
          {/* Dev-only: the push registration status + "Send test" link
              (32-safe-closed-test-build.md — no debug UI for testers). */}
          {__DEV__ && notifEnabled && (
            <Row
              icon={Send}
              title="Push notifications"
              hint={
                pushStatus.checking
                  ? 'Checking…'
                  : pushStatus.unsupported
                    ? 'Needs a development build, not Expo Go.'
                    : pushStatus.registered
                      ? 'This device is registered.'
                      : 'Not registered yet — reopen the app, or check your connection.'
              }
              right={
                <Button
                  variant="secondary"
                  title={sendingTestPush ? 'Sending…' : 'Send test'}
                  onPress={handleSendTestPush}
                  disabled={sendingTestPush || !pushStatus.registered}
                  style={styles.inlineButton}
                />
              }
            />
          )}
        </RowGroup>
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

        <RowGroup title="Reports">
          <Row icon={FileText} title="Cadence">
            <SegmentedChoice
              accessibilityLabel="Report cadence"
              options={CADENCE_OPTIONS}
              value={reportSettings.cadence}
              onChange={(cadence) => persistReportSettings({ cadence })}
            />
          </Row>
          {reportSettings.cadence === 'weekly' && (
            <Row icon={CalendarDays} title="Day">
              <SegmentedChoice
                accessibilityLabel="Report day"
                options={WEEKDAY_CHIPS}
                value={reportSettings.weekday}
                onChange={(weekday) => persistReportSettings({ weekday })}
              />
            </Row>
          )}
          {reportSettings.cadence === 'monthly' && (
            <Row
              icon={CalendarDays}
              title="Day of month"
              right={
                <View style={styles.dayStepper}>
                  <IconButton
                    icon={Minus}
                    size={18}
                    accessibilityLabel="Earlier day of month"
                    disabled={reportSettings.dayOfMonth <= 1}
                    onPress={() => persistReportSettings({ dayOfMonth: Math.max(1, reportSettings.dayOfMonth - 1) })}
                  />
                  <Text style={styles.dayStepperValue} accessibilityLabel={`Day ${reportSettings.dayOfMonth}`}>
                    {reportSettings.dayOfMonth}
                  </Text>
                  <IconButton
                    icon={Plus}
                    size={18}
                    accessibilityLabel="Later day of month"
                    disabled={reportSettings.dayOfMonth >= 31}
                    onPress={() => persistReportSettings({ dayOfMonth: Math.min(31, reportSettings.dayOfMonth + 1) })}
                  />
                </View>
              }
            />
          )}
          {reportSettings.cadence !== 'off' && (
            <Row
              icon={Clock}
              title="At"
              value={format(timeOnToday(reportSettings.hour, reportSettings.minute), 'h:mm a')}
              onPress={() => setShowReportTimePicker(true)}
            />
          )}
        </RowGroup>

        {showReportTimePicker && (
          <DateTimePicker
            value={timeOnToday(reportSettings.hour, reportSettings.minute)}
            mode="time"
            display="default"
            onChange={(_event, selected) => {
              setShowReportTimePicker(false);
              if (!selected) return;
              persistReportSettings({ hour: selected.getHours(), minute: selected.getMinutes() });
            }}
          />
        )}

        <RowGroup title="Summary Period">
          <Row icon={CircleDollarSign} title="Income & Expenses reset">
            <SegmentedChoice
              accessibilityLabel="Income and expenses reset"
              options={RESET_PERIOD_OPTIONS}
              value={resetPeriod}
              onChange={handleResetPeriodChange}
            />
          </Row>
          {resetPeriod === 'custom' && (
            <Row
              icon={CalendarDays}
              title="Starts from"
              value={format(resetCustomStart ? parseISO(resetCustomStart) : new Date(), 'd MMM yyyy')}
              onPress={() => setShowResetDatePicker(true)}
            />
          )}
        </RowGroup>

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
            <RowGroup title="Transaction Detection">
              <Row title="Not available" hint="Android only, and needs a development build (not Expo Go)." />
            </RowGroup>
          ) : (
            <RowGroup
              title="Transaction Detection"
              footer={
                detectEnabled
                  ? `Watches ${Object.values(WATCHED_APP_LABELS).join(', ')} for debit/credit alerts, so FLO can prompt you to log them. Reads only these apps' notifications — nothing else on the device.`
                  : null
              }
            >
              <Row
                icon={Landmark}
                title="Notification access"
                value={detectAccess ? 'Granted' : 'Tap to grant'}
                onPress={openNotificationAccessSettings}
              />
              <Row
                icon={Bell}
                title="Enable detection"
                switchValue={detectEnabled}
                onSwitchChange={handleToggleDetect}
                disabled={!detectAccess}
              />
              {/* Dev-only: the detection debug log. */}
              {__DEV__ && detectEnabled && <Row icon={Receipt} title="What FLO has seen" onPress={handleShowDetectionLog} />}
            </RowGroup>
          ))}

        <RowGroup title="Data & export">
          <Row
            icon={ChartColumn}
            title="Share anonymous usage"
            hint="Helps improve FLO. Only which features you use, never amounts, notes or names."
            switchValue={analyticsConsent}
            onSwitchChange={handleToggleAnalytics}
          />
        </RowGroup>

        {/* Dev-only: the Koban gallery (37-design-system-and-koban.md). */}
        {__DEV__ && (
          <RowGroup title="Developer">
            <Row icon={Cat} title="Koban gallery" onPress={() => router.push('/dev/koban')} />
          </RowGroup>
        )}

        <RowGroup>
          <Row
            icon={Trash2}
            title="Delete Account"
            tone="danger"
            chevron={false}
            onPress={() => {
              setDeleteError(null);
              setConfirmVisible(true);
            }}
          />
        </RowGroup>

        <Text style={styles.version}>FLO v1.0.0</Text>
      </ScrollView>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!deleting) setConfirmVisible(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <TriangleAlert size={26} color={colors.danger} strokeWidth={2.2} />
            </View>
            <Text style={styles.modalTitle}>Delete Account?</Text>
            <Text style={styles.modalBody}>
              This permanently deletes your account and everything in it — all
              accounts, transactions, budgets, plans and your profile. This
              cannot be undone.
            </Text>

            {deleteError && <Text style={styles.modalError}>{deleteError}</Text>}

            <Pressable
              style={[styles.modalDelete, deleting && styles.modalDeleteDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Delete everything"
              accessibilityState={{ disabled: deleting, busy: deleting }}
              onPress={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator color={staticColors.surface} />
              ) : (
                <Text style={styles.modalDeleteText}>Delete Everything</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.modalCancel}
              accessibilityRole="button"
              onPress={() => setConfirmVisible(false)}
              disabled={deleting}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
  pressedDim: {
    opacity: 0.85,
  },
  // The dev-only "Send test" text button, sized to sit inside a Row.
  inlineButton: {
    height: 40,
    paddingHorizontal: spacing.md,
  },
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    // The native header sits above; this is the gap below it.
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sectionLg,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    borderRadius: radii.cardLg,
    padding: 22,
    marginBottom: spacing.xl,
  },
  avatarImage: {
    width: 62,
    height: 62,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fontFamily.extrabold,
    fontSize: 24,
    // Sits on the theme-accent avatar bg — colors.brandText picks legible
    // dark/light text per-accent (theme/themes.js).
    color: colors.brandText,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  profileName: {
    flexShrink: 1,
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.heading,
    // Sits on Card's `dark` prop (permanently-dark surface) — pinned so it
    // doesn't invert under Dark theme.
    color: staticColors.surface,
  },
  profileEmail: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    color: staticColors.mutedOnDark,
    marginTop: 2,
  },
  dayStepper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayStepperValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: type.bodyLg,
    color: colors.ink,
    minWidth: 20,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.cardLg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.title,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  modalBody: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  modalError: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.dangerStrong,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  modalDelete: {
    width: '100%',
    height: 54,
    borderRadius: radii.buttonSm + 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDeleteDisabled: {
    opacity: 0.7,
  },
  modalDeleteText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    // Sits on the pinned-red delete button — always white.
    color: staticColors.surface,
  },
  modalCancel: {
    width: '100%',
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  modalCancelText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.muted,
  },
  version: {
    fontFamily: fontFamily.semibold,
    fontSize: type.caption,
    color: colors.mutedLight,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  });
}
