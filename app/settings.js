import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Modal, ActivityIndicator, Switch, Linking, AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ChevronLeft, ChevronRight, CircleDollarSign, Grid2x2, SunMedium, Bell, Receipt, Landmark, Trash2, TriangleAlert } from 'lucide-react-native';
import { format } from 'date-fns';
import Card from '../components/Card';
import { colors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import { useAuth } from '../lib/AuthContext';
import useProfile from '../hooks/useProfile';
import useBills from '../hooks/useBills';
import { useEditProfileSheet } from '../components/EditProfileSheet';
import { useToast } from '../components/Toast';
import {
  getNotificationSettings,
  setNotificationEnabled,
  setDailyReminderSettings,
  setBillReminderSettings,
  requestPermission,
  getPermissionStatus,
  rescheduleAll,
  sendTestNotification,
} from '../lib/notifications';
import {
  isSupported as isDetectSupported,
  hasNotificationAccess,
  openNotificationAccessSettings,
  isDetectionEnabled,
  setDetectionEnabled,
  setAllowedPackages,
  DEFAULT_ALLOWED_PACKAGES,
} from '../lib/detect';

const DAYS_BEFORE_OPTIONS = [1, 2, 3];

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

// Human-readable labels for DEFAULT_ALLOWED_PACKAGES (lib/detect.js) — this
// is a read-only display list (06-transaction-auto-detect.md Phase 3: "no
// user-editable allowlist UI this round"), so it only needs to be readable,
// not exhaustive of every package field. Must stay in sync with
// lib/detect.js's actual list — this text is the "explicit user consent"
// disclosure, so it needs to be true, not just reassuring; a stale list here
// would make the disclosure a lie. Messages is the personal-use-only entry
// (see lib/detect.js's PERSONAL_USE_EXTRA_PACKAGES) — remove this line too
// if that one gets removed before a store build.
const WATCHED_APP_LABELS = {
  'com.google.android.apps.nbu.paisa.user': 'Google Pay',
  'com.phonepe.app': 'PhonePe',
  'net.one97.paytm': 'Paytm',
  'com.google.android.apps.messaging': 'Messages',
};

export default function Settings() {
  const router = useRouter();
  const { session, deleteAccount } = useAuth();
  const { profile, avatarUrl } = useProfile();
  const { openEditProfile } = useEditProfileSheet();
  const { bills } = useBills();
  const { showToast } = useToast();

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const [notifEnabled, setNotifEnabled] = useState(false);
  const [dailyReminder, setDailyReminder] = useState({ enabled: false, hour: 20, minute: 0 });
  const [billReminders, setBillReminders] = useState({ enabled: true, daysBefore: 2 });
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Transaction Detection (06-transaction-auto-detect.md). Notification
  // access is granted outside the app (system settings), with no callback —
  // same reason getPermissionStatus() exists for OS notifications below —
  // so this re-checks on mount AND on every foreground (AppState → active),
  // not just mount: a pushed screen like Settings doesn't remount when the
  // app merely backgrounds to system settings and comes back via the OS
  // back gesture, only when actually popped.
  const [detectAccess, setDetectAccess] = useState(false);
  const [detectEnabled, setDetectEnabled] = useState(false);

  const fullName = profile?.full_name ?? session?.user?.user_metadata?.full_name ?? '';
  const initial = fullName?.[0]?.toUpperCase() ?? '?';

  useEffect(() => {
    getNotificationSettings().then(async (s) => {
      setDailyReminder(s.dailyReminder);
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

  function handleToggleDetect(value) {
    if (value) {
      setAllowedPackages(DEFAULT_ALLOWED_PACKAGES);
    }
    setDetectionEnabled(value);
    setDetectEnabled(value);
  }

  async function sync(nextEnabled, nextDaily, nextBillReminders) {
    await rescheduleAll({
      bills,
      settings: { enabled: nextEnabled, dailyReminder: nextDaily, billReminders: nextBillReminders },
    });
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
    }
    setNotifEnabled(value);
    await setNotificationEnabled(value);
    await sync(value, dailyReminder, billReminders);
  }

  async function handleSendTest() {
    const result = await sendTestNotification();
    if (result.unsupported) {
      showToast({ message: 'Notifications need a development build, not Expo Go', variant: 'error' });
      return;
    }
    showToast({ message: 'Test notification in 3s — lock the screen or switch apps now', variant: 'info' });
  }

  async function handleToggleDaily(value) {
    const next = { ...dailyReminder, enabled: value };
    setDailyReminder(next);
    await setDailyReminderSettings(next);
    await sync(notifEnabled, next, billReminders);
  }

  async function handleTimeChange(_event, selected) {
    setShowTimePicker(false);
    if (!selected) return;
    const next = { ...dailyReminder, hour: selected.getHours(), minute: selected.getMinutes() };
    setDailyReminder(next);
    await setDailyReminderSettings(next);
    await sync(notifEnabled, next, billReminders);
  }

  async function handleToggleBillReminders(value) {
    const next = { ...billReminders, enabled: value };
    setBillReminders(next);
    await setBillReminderSettings(next);
    await sync(notifEnabled, dailyReminder, next);
  }

  async function handleDaysBeforeChange(daysBefore) {
    const next = { ...billReminders, daysBefore };
    setBillReminders(next);
    await setBillReminderSettings(next);
    await sync(notifEnabled, dailyReminder, next);
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
              <Text style={styles.profileName} numberOfLines={1}>
                {fullName || 'Add your name'}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {session?.user?.email}
              </Text>
            </View>
          </Card>
        </Pressable>

        <Card style={styles.rowsCard}>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowIcon}>
              <CircleDollarSign size={20} color={colors.ink} strokeWidth={2} />
            </View>
            <Text style={styles.rowTitle}>Currency</Text>
            <Text style={styles.rowValue}>₹ INR</Text>
          </View>

          <Pressable style={[styles.row, styles.rowBorder]} onPress={() => router.push('/manage-categories')}>
            <View style={styles.rowIcon}>
              <Grid2x2 size={20} color={colors.ink} strokeWidth={2} />
            </View>
            <Text style={styles.rowTitle}>Manage Categories</Text>
            <ChevronRight size={18} color={colors.chevron} strokeWidth={2.4} />
          </Pressable>

          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <SunMedium size={20} color={colors.ink} strokeWidth={2} />
            </View>
            <Text style={styles.rowTitle}>Appearance</Text>
            <Text style={styles.rowValue}>Light</Text>
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

          <Pressable
            style={[styles.row, styles.rowBorder, !notifEnabled && styles.rowDisabled]}
            onPress={handleSendTest}
            disabled={!notifEnabled}
          >
            <View style={styles.rowIcon}>
              <Bell size={20} color={colors.ink} strokeWidth={2} />
            </View>
            <Text style={styles.rowTitle}>Send test notification</Text>
            <ChevronRight size={18} color={colors.chevron} strokeWidth={2.4} />
          </Pressable>

          <View style={[styles.row, styles.rowBorder, !notifEnabled && styles.rowDisabled]}>
            <View style={styles.rowIcon}>
              <SunMedium size={20} color={colors.ink} strokeWidth={2} />
            </View>
            <Text style={styles.rowTitle}>Daily Reminder</Text>
            <Switch value={dailyReminder.enabled} onValueChange={handleToggleDaily} disabled={!notifEnabled} />
          </View>
          {notifEnabled && dailyReminder.enabled && (
            <Pressable style={[styles.subRow, styles.rowBorder]} onPress={() => setShowTimePicker(true)}>
              <Text style={styles.subRowLabel}>Remind me at</Text>
              <Text style={styles.subRowValue}>
                {format(timeOnToday(dailyReminder.hour, dailyReminder.minute), 'h:mm a')}
              </Text>
            </Pressable>
          )}

          <View style={[styles.row, !notifEnabled && styles.rowDisabled]}>
            <View style={styles.rowIcon}>
              <Receipt size={20} color={colors.ink} strokeWidth={2} />
            </View>
            <Text style={styles.rowTitle}>Bill Reminders</Text>
            <Switch value={billReminders.enabled} onValueChange={handleToggleBillReminders} disabled={!notifEnabled} />
          </View>
          {notifEnabled && billReminders.enabled && (
            <View style={styles.subRow}>
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
        </Card>
        {showTimePicker && (
          <DateTimePicker
            value={timeOnToday(dailyReminder.hour, dailyReminder.minute)}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )}

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
                <ActivityIndicator color={colors.surface} />
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

const styles = StyleSheet.create({
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
    color: colors.ink,
  },
  profileName: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.heading,
    color: colors.surface,
  },
  profileEmail: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    color: colors.mutedMid,
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
  rowValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    color: colors.muted,
  },
  rowDisabled: {
    opacity: 0.45,
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
    color: colors.surface,
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
