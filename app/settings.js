import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Modal, ActivityIndicator, Linking, AppState, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ChevronLeft, ChevronRight, CircleDollarSign, Grid2x2, Palette, SunMedium, Bell, FileText, Receipt, Landmark, BatteryWarning, Trash2, TriangleAlert, Send } from 'lucide-react-native';
import { format } from 'date-fns';
import Card from '../components/Card';
import Switch from '../components/Switch';
import { colors as staticColors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import { useAuth } from '../lib/AuthContext';
import useProfile from '../hooks/useProfile';
import useEntitlement from '../hooks/useEntitlement';
import { useEditProfileSheet } from '../components/EditProfileSheet';
import { useToast } from '../components/Toast';
import CurrencyPicker from '../components/CurrencyPicker';
import { DEFAULT_CURRENCY } from '../lib/currency';
import ProBadge from '../components/ProBadge';
import ColorPicker from '../components/ColorPicker';
import AppearanceToggle from '../components/AppearanceToggle';
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
  const { profile, avatarUrl, updateProfile } = useProfile();
  const { openEditProfile } = useEditProfileSheet();
  const { accentId, modeId, setAccent, setMode, colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { isPro } = useEntitlement();
  const { showToast } = useToast();

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
      { text: 'Clear', style: 'destructive', onPress: clearDetectionDebugLog },
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

  async function handleReminderTimeChange(_event, selected) {
    const field = timePickerField;
    setTimePickerField(null);
    if (!selected || !field) return;
    const hh = String(selected.getHours()).padStart(2, '0');
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

  // Only the default for NEW accounts — existing accounts keep their own
  // currency (immutable once they have transactions; see AddAccountSheet).
  async function handleCurrencyChange(code) {
    const { error } = await updateProfile({ currency: code });
    if (error) {
      showToast({ message: error.message, variant: 'error' });
      return;
    }
    showToast({ message: 'Default currency updated', variant: 'success' });
  }

  // Same dual-write shape onboarding/currency.js uses: instant local
  // application via setAccent()/setMode() (AsyncStorage-backed, no network
  // round trip needed to see the change) plus the durable profile write so
  // it follows the user across devices/reinstalls. Two independent fields
  // (profiles.theme_accent/theme_mode) now, not one — see 16-app-themes.md's
  // 2026-07-18 restructuring.
  async function handleAccentChange(id) {
    setAccent(id);
    const { error } = await updateProfile({ theme_accent: id }, { silent: true });
    if (error) {
      showToast({ message: error.message, variant: 'error' });
      return;
    }
    showToast({ message: 'Color updated', variant: 'success' });
  }

  async function handleModeChange(id) {
    setMode(id);
    const { error } = await updateProfile({ theme_mode: id }, { silent: true });
    if (error) {
      showToast({ message: error.message, variant: 'error' });
      return;
    }
    showToast({ message: 'Appearance updated', variant: 'success' });
  }

  async function handleDelete() {
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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable onPress={openEditProfile}>
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

        <Card style={styles.rowsCard}>
          <CurrencyPicker
            value={profile?.currency ?? DEFAULT_CURRENCY}
            onChange={handleCurrencyChange}
            variant="dialog"
            renderTrigger={(selected, toggle) => (
              <Pressable style={[styles.row, styles.rowBorder]} onPress={toggle}>
                <View style={styles.rowIcon}>
                  <CircleDollarSign size={20} color={colors.ink} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Currency</Text>
                  <Text style={styles.rowHint}>Default for new accounts</Text>
                </View>
                <Text style={styles.rowValue}>
                  {selected.symbol} {selected.code}
                </Text>
              </Pressable>
            )}
          />

          <Pressable style={[styles.row, styles.rowBorder]} onPress={() => router.push('/manage-categories')}>
            <View style={styles.rowIcon}>
              <Grid2x2 size={20} color={colors.ink} strokeWidth={2} />
            </View>
            <Text style={styles.rowTitle}>Manage Categories</Text>
            <ChevronRight size={18} color={colors.chevron} strokeWidth={2.4} />
          </Pressable>

          <ColorPicker
            value={accentId}
            onChange={handleAccentChange}
            renderTrigger={(selected, toggle) => (
              <Pressable style={[styles.row, styles.rowBorder]} onPress={toggle}>
                <View style={styles.rowIcon}>
                  <Palette size={20} color={colors.ink} strokeWidth={2} />
                </View>
                <Text style={styles.rowTitle}>Primary Color</Text>
                <Text style={styles.rowValue}>{selected.name}</Text>
              </Pressable>
            )}
          />

          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <SunMedium size={20} color={colors.ink} strokeWidth={2} />
            </View>
            <Text style={styles.rowTitle}>Appearance</Text>
            <AppearanceToggle value={modeId} onChange={handleModeChange} />
          </View>
        </Card>

        <Text style={styles.sectionLabel}>Notifications</Text>
        <Card style={styles.rowsCard}>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowIcon}>
              <Bell size={20} color={colors.ink} strokeWidth={2} />
            </View>
            <Text style={styles.rowTitle}>Notifications</Text>
            <Switch value={notifEnabled} onValueChange={handleToggleNotifications} />
          </View>

          {permissionBlocked && (
            <Pressable style={[styles.row, styles.rowBorder]} onPress={() => Linking.openSettings()}>
              <Text style={styles.permissionHint}>Notifications are blocked. Tap to open system settings.</Text>
            </Pressable>
          )}

          <Pressable style={[styles.row, styles.rowBorder]} onPress={handleOpenBatterySettings}>
            <View style={styles.rowIcon}>
              <BatteryWarning size={20} color={colors.ink} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Battery settings</Text>
              <Text style={styles.rowHint}>
                Reminders may be delayed or dropped by your phone's battery manager. Set FLO to
                "Don't optimize" here — on Vivo/iQOO also check Settings → Battery → High
                background power consumption, and Settings → Apps → Autostart.
              </Text>
            </View>
          </Pressable>

          <View style={[styles.row, styles.rowBorder, !notifEnabled && styles.rowDisabled]}>
            <View style={styles.rowIcon}>
              <SunMedium size={20} color={colors.ink} strokeWidth={2} />
            </View>
            <Text style={styles.rowTitle}>Daily Reminders</Text>
            <Switch
              value={profile?.reminders_enabled ?? true}
              onValueChange={handleToggleDailyReminders}
              disabled={!notifEnabled}
            />
          </View>
          {notifEnabled && (profile?.reminders_enabled ?? true) && (
            <>
              <Pressable style={[styles.subRow, styles.rowBorder]} onPress={() => setTimePickerField('morning')}>
                <Text style={styles.subRowLabel}>Morning</Text>
                <Text style={styles.subRowValue}>
                  {format(timeOnTodayFromString(profile?.morning_reminder_time, 8, 0), 'h:mm a')}
                </Text>
              </Pressable>
              <Pressable style={[styles.subRow, styles.rowBorder]} onPress={() => setTimePickerField('evening')}>
                <Text style={styles.subRowLabel}>Evening</Text>
                <Text style={styles.subRowValue}>
                  {format(timeOnTodayFromString(profile?.evening_reminder_time, 21, 0), 'h:mm a')}
                </Text>
              </Pressable>
            </>
          )}

          <View style={[styles.row, styles.rowBorder, !notifEnabled && styles.rowDisabled]}>
            <View style={styles.rowIcon}>
              <Receipt size={20} color={colors.ink} strokeWidth={2} />
            </View>
            <Text style={styles.rowTitle}>Bill Reminders</Text>
            <Switch value={billReminders.enabled} onValueChange={handleToggleBillReminders} disabled={!notifEnabled} />
          </View>
          {notifEnabled && billReminders.enabled && (
            <View style={[styles.subRow, styles.rowBorder]}>
              <Text style={styles.subRowLabel}>Remind me</Text>
              <View style={styles.daysBeforeGroup}>
                {DAYS_BEFORE_OPTIONS.map((days) => {
                  const selected = billReminders.daysBefore === days;
                  return (
                    <Pressable
                      key={days}
                      style={[styles.dayChip, selected && styles.dayChipSelected]}
                      onPress={() => handleDaysBeforeChange(days)}
                    >
                      <Text style={[styles.dayChipText, selected && styles.dayChipTextSelected]}>{days}d before</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {notifEnabled && (
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Send size={20} color={colors.ink} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Push notifications</Text>
                <Text style={styles.rowHint}>
                  {pushStatus.checking
                    ? 'Checking…'
                    : pushStatus.unsupported
                      ? 'Needs a development build, not Expo Go.'
                      : pushStatus.registered
                        ? 'This device is registered.'
                        : 'Not registered yet — reopen the app, or check your connection.'}
                </Text>
              </View>
              <Pressable onPress={handleSendTestPush} disabled={sendingTestPush || !pushStatus.registered} hitSlop={8}>
                <Text style={[styles.pushTestLink, (sendingTestPush || !pushStatus.registered) && styles.pushTestLinkDisabled]}>
                  {sendingTestPush ? 'Sending…' : 'Send test'}
                </Text>
              </Pressable>
            </View>
          )}
        </Card>
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

        <Text style={styles.sectionLabel}>Reports</Text>
        <Card style={styles.rowsCard}>
          <View style={[styles.reportCadenceBlock, reportSettings.cadence !== 'off' && styles.rowBorder]}>
            <View style={styles.reportCadenceTop}>
              <View style={styles.rowIcon}>
                <FileText size={20} color={colors.ink} strokeWidth={2} />
              </View>
              <Text style={styles.rowTitle}>Cadence</Text>
            </View>
            <View style={styles.reportSegmentWrap}>
              {CADENCE_OPTIONS.map((c) => (
                <Pressable
                  key={c.value}
                  style={[styles.reportSegment, reportSettings.cadence === c.value && styles.reportSegmentActive]}
                  onPress={() => persistReportSettings({ cadence: c.value })}
                >
                  <Text style={[styles.reportSegmentText, reportSettings.cadence === c.value && styles.reportSegmentTextActive]}>
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {reportSettings.cadence === 'weekly' && (
            <View style={[styles.reportDayBlock, styles.rowBorder]}>
              <Text style={styles.subRowLabel}>Day</Text>
              <View style={styles.weekdayRow}>
                {WEEKDAY_CHIPS.map((d) => (
                  <Pressable
                    key={d.value}
                    style={[styles.weekdayChip, reportSettings.weekday === d.value && styles.weekdayChipActive]}
                    onPress={() => persistReportSettings({ weekday: d.value })}
                  >
                    <Text style={[styles.weekdayChipText, reportSettings.weekday === d.value && styles.weekdayChipTextActive]}>
                      {d.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {reportSettings.cadence === 'monthly' && (
            <View style={[styles.subRow, styles.rowBorder]}>
              <Text style={styles.subRowLabel}>Day of month</Text>
              <View style={styles.dayStepper}>
                <Pressable onPress={() => persistReportSettings({ dayOfMonth: Math.max(1, reportSettings.dayOfMonth - 1) })}>
                  <ChevronLeft size={16} color={colors.ink} strokeWidth={2.4} />
                </Pressable>
                <Text style={styles.dayStepperValue}>{reportSettings.dayOfMonth}</Text>
                <Pressable onPress={() => persistReportSettings({ dayOfMonth: Math.min(31, reportSettings.dayOfMonth + 1) })}>
                  <ChevronRight size={16} color={colors.ink} strokeWidth={2.4} />
                </Pressable>
              </View>
            </View>
          )}

          {reportSettings.cadence !== 'off' && (
            <Pressable style={styles.subRow} onPress={() => setShowReportTimePicker(true)}>
              <Text style={styles.subRowLabel}>At</Text>
              <Text style={styles.subRowValue}>{format(timeOnToday(reportSettings.hour, reportSettings.minute), 'h:mm a')}</Text>
            </Pressable>
          )}
        </Card>

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

        {isAutoDetectVariant() && (
          <>
            <Text style={styles.sectionLabel}>Transaction Detection</Text>
            <Card style={styles.rowsCard}>
              {!isDetectSupported() ? (
                <View style={styles.row}>
                  <Text style={styles.permissionHint}>Android only, and needs a development build (not Expo Go).</Text>
                </View>
              ) : (
                <>
                  <Pressable style={[styles.row, styles.rowBorder]} onPress={openNotificationAccessSettings}>
                    <View style={styles.rowIcon}>
                      <Landmark size={20} color={colors.ink} strokeWidth={2} />
                    </View>
                    <Text style={styles.rowTitle}>Notification access</Text>
                    <Text style={styles.rowValue}>{detectAccess ? 'Granted' : 'Tap to grant'}</Text>
                  </Pressable>

                  <View style={[styles.row, detectEnabled && styles.rowBorder, !detectAccess && styles.rowDisabled]}>
                    <View style={styles.rowIcon}>
                      <Bell size={20} color={colors.ink} strokeWidth={2} />
                    </View>
                    <Text style={styles.rowTitle}>Enable detection</Text>
                    <Switch value={detectEnabled} onValueChange={handleToggleDetect} disabled={!detectAccess} />
                  </View>

                  {detectEnabled && (
                    <Pressable style={[styles.row, styles.rowBorder]} onPress={handleShowDetectionLog}>
                      <View style={styles.rowIcon}>
                        <Receipt size={20} color={colors.ink} strokeWidth={2} />
                      </View>
                      <Text style={styles.rowTitle}>What FLO has seen</Text>
                      <ChevronRight size={18} color={colors.chevron} strokeWidth={2.4} />
                    </Pressable>
                  )}

                  {detectEnabled && (
                    <View style={styles.watchedAppsRow}>
                      <Text style={styles.watchedAppsText}>
                        Watches {Object.values(WATCHED_APP_LABELS).join(', ')} for debit/credit
                        alerts, so FLO can prompt you to log them. Reads only these apps'
                        notifications — nothing else on the device.
                      </Text>
                    </View>
                  )}
                </>
              )}
            </Card>
          </>
        )}

        <Pressable style={styles.deleteButton} onPress={() => { setDeleteError(null); setConfirmVisible(true); }}>
          <Trash2 size={19} color={colors.danger} strokeWidth={2.2} />
          <Text style={styles.deleteText}>Delete Account</Text>
        </Pressable>

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
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.title,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 60,
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
    // Sits on the theme-accent avatar bg — pinned dark, same assumption as
    // Button's primary-text pin (every accent is light enough for dark text).
    color: staticColors.ink,
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
    color: staticColors.mutedMid,
    marginTop: 2,
  },
  rowsCard: {
    padding: 0,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 17,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.iconTileBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  rowHint: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.muted,
    lineHeight: 18,
    marginTop: 2,
  },
  rowValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    color: colors.muted,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  pushTestLink: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
    color: colors.brand,
  },
  pushTestLinkDisabled: {
    color: colors.mutedMid,
  },
  sectionLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  permissionHint: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.dangerStrong,
    paddingVertical: spacing.sm,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingLeft: 52,
  },
  subRowLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.mutedDarker,
  },
  subRowValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  reportCadenceBlock: {
    paddingVertical: spacing.md,
  },
  reportCadenceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  reportSegmentWrap: {
    flexDirection: 'row',
    backgroundColor: colors.chipBg,
    borderRadius: 14,
    padding: 4,
  },
  reportSegment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 11,
  },
  reportSegmentActive: {
    backgroundColor: colors.ink,
  },
  reportSegmentText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: colors.muted,
  },
  reportSegmentTextActive: {
    fontFamily: fontFamily.extrabold,
    color: colors.surface,
  },
  reportDayBlock: {
    paddingVertical: spacing.md,
    paddingLeft: 52,
    gap: spacing.sm,
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: 6,
  },
  weekdayChip: {
    width: 36,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayChipActive: {
    backgroundColor: colors.ink,
  },
  weekdayChipText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: colors.mutedDarker,
  },
  weekdayChipTextActive: {
    color: colors.surface,
  },
  dayStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dayStepperValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.base,
    color: colors.ink,
    minWidth: 20,
    textAlign: 'center',
  },
  watchedAppsRow: {
    paddingLeft: 52,
    paddingRight: spacing.xs,
    paddingVertical: spacing.md,
  },
  watchedAppsText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.muted,
    lineHeight: 18,
  },
  daysBeforeGroup: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dayChip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    backgroundColor: colors.iconTileBg,
  },
  dayChipSelected: {
    backgroundColor: colors.ink,
  },
  dayChipText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.mutedDarker,
  },
  dayChipTextSelected: {
    color: colors.surface,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    height: 56,
    borderRadius: radii.buttonSm + 4,
    borderWidth: 1.5,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.surface,
    marginTop: spacing.lg,
  },
  deleteText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    color: colors.danger,
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
    fontSize: fontSize.sm,
    color: colors.mutedLight,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  });
}
