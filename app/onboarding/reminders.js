import { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { Moon } from 'lucide-react-native';
import Illustration from '../../components/ledger/Illustration';
import ListRow from '../../components/ledger/ListRow';
import PinnedFooter from '../../components/ledger/PinnedFooter';
import { useToast } from '../../components/Toast';
import { useLedger, ledgerType, ledgerSpace } from '../../theme/ledger';
import { useAuth } from '../../lib/AuthContext';
import { useOnboarding } from '../../lib/onboarding';
import useProfile from '../../hooks/useProfile';
import { requestPermission, setNotificationEnabled } from '../../lib/notifications';
import { registerPushToken } from '../../lib/pushToken';
import { timeOnToday, toTimeColumn, isEveningTime, EVENING_DEFAULT } from '../../lib/reminderTime';
import { trackStepViewed } from '../../lib/track';

// The reminder ask (spec 35, on the ledger kit in spec 47): the last
// onboarding step. Both answers finish onboarding — finish() writes
// onboarded_at and the gate takes the person Home — so a refused or blocked
// permission never strands anyone here.
//
// "Allow notifications" asks for the OS permission. On a grant the nightly
// nudge stays on, the picked time becomes profiles.evening_reminder_time, and
// the push token is registered right away, because usePushTokenSync only
// registers when the signed-in user changes, which happened before the
// permission existed. "Maybe later", or a refused permission, turns the nudge
// off explicitly so the server doesn't count a nudge never agreed to, and
// the time isn't saved. Bill reminders keep their column default; without a
// token nothing is delivered anyway.
export default function OnboardingReminders() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  // Set by the first-expense step after a save, for the "Logged." opener.
  const { logged } = useLocalSearchParams();
  const { updateProfile } = useProfile();
  const { finish, working: finishing } = useOnboarding();
  const { showToast } = useToast();
  const [asking, setAsking] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // On today's date, never 1899 (the Madras-time note in lib/reminderTime.js).
  const [time, setTime] = useState(() => timeOnToday(EVENING_DEFAULT.hour, EVENING_DEFAULT.minute));

  useEffect(() => {
    trackStepViewed('reminder_ask');
  }, []);

  function handlePicked(_event, selected) {
    setPickerOpen(false);
    if (!selected) return;
    // Settings' rule: the evening nudge is in the PM half.
    if (!isEveningTime(selected)) {
      showToast({ message: 'Pick a time after 12 PM', variant: 'error' });
      return;
    }
    setTime(selected);
  }

  // Both answers end here. `asking` stays up until finish() is done, so a
  // second tap can't start a second prompt; on success the gate unmounts the
  // screen first.
  async function finishWith(fields) {
    await updateProfile(fields, { silent: true });
    await finish();
    setAsking(false);
  }

  async function handleAllow() {
    if (busy) return;
    setAsking(true);
    const permission = await requestPermission();
    if (!permission.granted) return finishWith({ reminders_enabled: false });
    await setNotificationEnabled(true);
    const userId = session?.user?.id ?? null;
    if (userId) await registerPushToken(userId);
    return finishWith({ reminders_enabled: true, evening_reminder_time: toTimeColumn(time) });
  }

  function handleLater() {
    if (busy) return;
    setAsking(true);
    finishWith({ reminders_enabled: false });
  }

  const busy = asking || finishing;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.body}>
        <View style={styles.intro}>
          <Illustration name="whistle" size="large" style={styles.object} />
          <Text style={[ledgerType.title, styles.center, { color: c.ink }]} accessibilityRole="header">
            {logged ? 'Logged. Want a nightly nudge?' : 'Want a nightly nudge?'}
          </Text>
          {/* Not "one reminder": send-push still sends the morning nudge too
              until spec 39 removes it. */}
          <Text style={[ledgerType.body, styles.center, styles.sub, { color: c.muted }]}>
            A reminder to log your day, so your streak keeps going.
          </Text>
        </View>
        <ListRow
          icon={Moon}
          title="Remind me at"
          right={format(time, 'h:mm a')}
          trailing="chevron"
          onPress={() => setPickerOpen(true)}
          disabled={busy}
          divider={false}
        />
      </View>
      {pickerOpen && <DateTimePicker value={time} mode="time" display="default" onChange={handlePicked} />}
      <PinnedFooter
        secondary={{ title: 'Maybe later', onPress: handleLater, disabled: busy }}
        primary={{ title: 'Allow notifications', onPress: handleAllow, loading: busy }}
      />
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.canvas,
    },
    body: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: ledgerSpace.gutter,
    },
    intro: {
      alignItems: 'center',
      marginBottom: ledgerSpace.section,
    },
    object: {
      marginBottom: ledgerSpace.section,
    },
    center: {
      textAlign: 'center',
    },
    sub: {
      marginTop: ledgerSpace.sm,
    },
  });
}
