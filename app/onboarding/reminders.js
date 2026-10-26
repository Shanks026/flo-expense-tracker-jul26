import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Bell } from 'lucide-react-native';
import OnboardingScreen from '../../components/OnboardingScreen';
import { colors, radii } from '../../theme/tokens';
import { useAuth } from '../../lib/AuthContext';
import { useOnboarding } from '../../lib/onboarding';
import useProfile from '../../hooks/useProfile';
import { requestPermission, setNotificationEnabled } from '../../lib/notifications';
import { registerPushToken } from '../../lib/pushToken';
import { trackStepViewed } from '../../lib/track';

// The reminder ask (35-onboarding-v3.md): the last onboarding step. Both
// answers finish onboarding — finish() writes onboarded_at and the gate takes
// the user to Home — so a refused or blocked permission never strands anyone
// here.
//
// "Turn on" asks for the OS permission; on a grant the nightly nudge stays on
// (profiles.reminders_enabled defaults to true) and the push token is
// registered right away, because usePushTokenSync only registers when the
// signed-in user changes, which happened before the permission existed.
// "Not now", or a refused permission, turns the nudge off explicitly so the
// server doesn't count a nudge the user never agreed to. Bill reminders keep
// their column default; without a token nothing is delivered anyway.
export default function OnboardingReminders() {
  const { session } = useAuth();
  // Set by the first-expense step after a save, for the "Logged." opener.
  const { logged } = useLocalSearchParams();
  const { updateProfile } = useProfile();
  const { finish, working: finishing } = useOnboarding();
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    trackStepViewed('reminder_ask');
  }, []);

  async function finishWithReminders(on) {
    await updateProfile({ reminders_enabled: on }, { silent: true });
    await finish();
  }

  // `asking` stays up until finish() is done, so a second tap can't start a
  // second prompt; on success the gate unmounts the screen first.
  async function handleTurnOn() {
    setAsking(true);
    const permission = await requestPermission();
    if (permission.granted) {
      await setNotificationEnabled(true);
      const userId = session?.user?.id ?? null;
      if (userId) await registerPushToken(userId);
    }
    await finishWithReminders(permission.granted);
    setAsking(false);
  }

  const busy = asking || finishing;

  return (
    <OnboardingScreen
      bg="light"
      hero={
        <View style={styles.heroTile}>
          <Bell size={30} color={colors.incomeAccent} strokeWidth={2} />
        </View>
      }
      title={logged ? 'Logged. Want a 9 pm nudge?' : 'Want a 9 pm nudge?'}
      // Not "one reminder": send-push still sends the morning nudge too
      // until spec 39 removes it.
      subtitle="A reminder to log your day, so your streak keeps going. You can change it anytime in Settings."
      primaryLabel="Turn on"
      onPrimary={handleTurnOn}
      primaryLoading={busy}
      secondaryLabel="Not now"
      onSecondary={() => {
        if (!busy) finishWithReminders(false);
      }}
    />
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
});
