import { useState, useEffect } from 'react';
import { View, Text, Pressable, Linking, StyleSheet } from 'react-native';
import Switch from '../../components/Switch';
import { useRouter } from 'expo-router';
import { Bell, Receipt, Flame } from 'lucide-react-native';
import OnboardingScreen from '../../components/OnboardingScreen';
import { useToast } from '../../components/Toast';
import { colors, radii, spacing, fontFamily, fontSize } from '../../theme/tokens';
import { useAuth } from '../../lib/AuthContext';
import { getNextRoute, getStepPosition } from '../../lib/onboarding';
import { getDraft } from '../../lib/onboardingDraft';
import useProfile from '../../hooks/useProfile';
import { requestPermission, setNotificationEnabled, setBillReminderSettings } from '../../lib/notifications';
import { registerPushToken } from '../../lib/pushToken';

// Design 04, plus the framing the design couldn't have: the nightly nudge
// exists to serve the streak (05-koban-engagement.md). Without saying that,
// "remind me every night" is just nagging with no payoff attached.
//
// The streak copy here is deliberately static. A brand-new user's streak is 0,
// and rendering a live useStreak() read on this screen would sell nothing.
//
// The framing line varies by the intro's tracking-habit answer (screen 11) —
// the nudge itself always defaults on, but WHY it matters differs by what the
// user already told us about their habits.
const DEFAULT_DAYS_BEFORE = 2;

const STREAK_NOTE_BY_HABIT = {
  daily: 'You already check in often. The daily reminders just make sure the streak never breaks.',
  weekly: 'Log something every day and your streak grows. The daily reminders are what keep it from slipping between check-ins.',
  when_off: 'The reminders mean you won’t need to wait until something feels off. You’ll just know.',
  never: 'This is the fix. A couple of pings a day, and you’ll never lose track again. Miss a day and the streak resets to zero.',
};
const DEFAULT_STREAK_NOTE =
  'Log something every day and your streak grows. The daily reminders are what keep it alive. Miss a day and it resets to zero.';

export default function OnboardingReminders() {
  const router = useRouter();
  const { session } = useAuth();
  const { showToast } = useToast();
  const { updateProfile } = useProfile();

  const [billsOn, setBillsOn] = useState(true);
  const [nudgeOn, setNudgeOn] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [working, setWorking] = useState(false);
  const [streakNote, setStreakNote] = useState(DEFAULT_STREAK_NOTE);

  useEffect(() => {
    getDraft().then((d) => {
      if (d.tracking_habit) setStreakNote(STREAK_NOTE_BY_HABIT[d.tracking_habit] ?? DEFAULT_STREAK_NOTE);
    });
  }, []);

  const pos = getStepPosition('reminders');
  const next = getNextRoute('reminders');

  async function handleEnable() {
    setWorking(true);
    const permission = await requestPermission();

    if (!permission.granted) {
      setWorking(false);
      if (permission.unsupported) {
        showToast({ message: 'Notifications need a development build, not Expo Go', variant: 'error' });
        return;
      }
      setBlocked(!permission.canAskAgain);
      showToast({
        message: permission.canAskAgain
          ? 'Notification permission denied'
          : 'Enable notifications in system settings',
        variant: 'error',
      });
      return;
    }

    setBlocked(false);

    // Both reminders are server-sent now (17-server-push-notifications.md
    // Phases 2–3) — nudge flips profiles.reminders_enabled directly; bill
    // reminders go through setBillReminderSettings, which mirrors to
    // profiles itself. The DB's own column defaults already match what
    // this screen has always promised, so there's nothing else to set here
    // and no local reschedule call needed anymore.
    await updateProfile({ reminders_enabled: nudgeOn }, { silent: true });
    await setBillReminderSettings({ enabled: billsOn, daysBefore: DEFAULT_DAYS_BEFORE });
    await setNotificationEnabled(true);

    // Real gap this screen had until now: usePushTokenSync (app/_layout.js)
    // only registers a push token when the session's userId CHANGES — it
    // ran once already at mount, before permission existed, so it silently
    // no-opped. Nothing re-triggered a retry after requestPermission()
    // above actually granted it, which meant a brand-new signup got zero
    // server-sent reminders until the app happened to be fully restarted.
    // Registering explicitly here, right after the grant, is the fix.
    const userId = session?.user?.id ?? null;
    if (userId) await registerPushToken(userId);

    setWorking(false);
    router.replace(next);
  }

  return (
    <OnboardingScreen
      bg="light"
      progress={pos ? pos.index / pos.total : undefined}
      hero={
        <View style={styles.heroTile}>
          <Bell size={30} color={colors.incomeAccent} strokeWidth={2} />
        </View>
      }
      title="Never miss a bill"
      subtitle="A heads-up before bills are due, and daily reminders to log your day."
      primaryLabel="Enable Notifications"
      onPrimary={handleEnable}
      primaryLoading={working}
      secondaryLabel="Maybe later"
      onSecondary={() => router.replace(next)}
    >
      <View style={styles.cards}>
        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <Receipt size={21} color={colors.incomeAccent} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Bill reminders</Text>
            <Text style={styles.cardBody}>{DEFAULT_DAYS_BEFORE} days before due</Text>
          </View>
          <Switch value={billsOn} onValueChange={setBillsOn} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <Flame size={21} color={colors.incomeAccent} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Daily reminders</Text>
            <Text style={styles.cardBody}>8:00 AM & 9:00 PM — customizable later</Text>
          </View>
          <Switch value={nudgeOn} onValueChange={setNudgeOn} />
        </View>
      </View>

      <Text style={styles.streakNote}>{streakNote}</Text>

      {blocked && (
        <Pressable onPress={() => Linking.openSettings()}>
          <Text style={styles.blockedHint}>Notifications are blocked. Tap to open system settings.</Text>
        </Pressable>
      )}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  heroTile: {
    width: 66,
    height: 66,
    borderRadius: radii.card,
    backgroundColor: colors.incomeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cards: {
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.lg,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.iconTile,
    backgroundColor: colors.incomeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  cardBody: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: 2,
  },
  streakNote: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    lineHeight: 19,
    color: colors.muted,
    marginTop: spacing.lg,
  },
  blockedHint: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.dangerStrong,
    marginTop: spacing.lg,
  },
});
