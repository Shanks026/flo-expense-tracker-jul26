import { useState } from 'react';
import { View, Text, Switch, Pressable, Linking, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Receipt, Flame } from 'lucide-react-native';
import OnboardingScaffold from '../../components/OnboardingScaffold';
import { useToast } from '../../components/Toast';
import useBills from '../../hooks/useBills';
import { colors, radii, spacing, fontFamily, fontSize } from '../../theme/tokens';
import { useAuth } from '../../lib/AuthContext';
import { getNextRoute } from '../../lib/onboarding';
import {
  requestPermission,
  setNotificationEnabled,
  setDailyReminderSettings,
  setBillReminderSettings,
  rescheduleAll,
} from '../../lib/notifications';

// Design 04, plus the framing the design couldn't have: the nightly nudge
// exists to serve the streak (05-koban-engagement.md). Without saying that,
// "remind me every night" is just nagging with no payoff attached.
//
// The streak copy here is deliberately static. A brand-new user's streak is 0,
// and rendering a live useStreak() read on this screen would sell nothing.
const DEFAULT_HOUR = 20;
const DEFAULT_MINUTE = 0;
const DEFAULT_DAYS_BEFORE = 2;

export default function OnboardingReminders() {
  const router = useRouter();
  const { session } = useAuth();
  const { bills } = useBills();
  const { showToast } = useToast();

  const [billsOn, setBillsOn] = useState(true);
  const [nudgeOn, setNudgeOn] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [working, setWorking] = useState(false);

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

    // Persist BEFORE rescheduling — rescheduleAll reads settings straight from
    // AsyncStorage and cancels everything first, so calling it against
    // not-yet-written settings silently schedules nothing. This ordering is a
    // documented requirement in lib/notifications.js, not a preference.
    await setDailyReminderSettings({ enabled: nudgeOn, hour: DEFAULT_HOUR, minute: DEFAULT_MINUTE });
    await setBillReminderSettings({ enabled: billsOn, daysBefore: DEFAULT_DAYS_BEFORE });
    await setNotificationEnabled(true);
    await rescheduleAll({ bills, userId: session?.user?.id ?? null });

    setWorking(false);
    router.replace(next);
  }

  return (
    <OnboardingScaffold
      stepKey="reminders"
      hero={
        <View style={styles.heroTile}>
          <Bell size={30} color={colors.incomeAccent} strokeWidth={2} />
        </View>
      }
      title="Never miss a bill"
      subtitle="A heads-up before bills are due, and a nightly nudge to log your day."
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
            <Text style={styles.cardTitle}>Nightly nudge</Text>
            <Text style={styles.cardBody}>8:00 PM</Text>
          </View>
          <Switch value={nudgeOn} onValueChange={setNudgeOn} />
        </View>
      </View>

      <Text style={styles.streakNote}>
        Log something every day and your streak grows. The nightly nudge is what keeps it alive —
        miss a day and it resets to zero.
      </Text>

      {blocked && (
        <Pressable onPress={() => Linking.openSettings()}>
          <Text style={styles.blockedHint}>Notifications are blocked. Tap to open system settings.</Text>
        </Pressable>
      )}
    </OnboardingScaffold>
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
