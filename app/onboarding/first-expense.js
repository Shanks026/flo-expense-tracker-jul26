import { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Receipt } from 'lucide-react-native';
import OnboardingScreen from '../../components/OnboardingScreen';
import { useAddTransactionSheet } from '../../components/AddTransactionSheet';
import { colors, radii } from '../../theme/tokens';
import { trackStepViewed } from '../../lib/track';

const REMINDER_ASK = '/onboarding/reminders';

// The first expense (35-onboarding-v3.md): right after sign-in, the real Add
// sheet — the same one and the same categories used every day — opens over
// this screen. Saving logs it (`expense_logged {source: onboarding}`, with no
// reward burst or budget toasts); closing it is "Not now". Either way the user
// moves on to the reminder ask, which opens with "Logged." after a save.
//
// The buttons here only show if the sheet is closed without leaving (it never
// is in the normal flow, since closing moves on): one reopens it, one skips.
export default function FirstExpense() {
  const router = useRouter();
  const { openAdd } = useAddTransactionSheet();
  const leftRef = useRef(false);

  function moveOn(saved) {
    if (leftRef.current) return;
    leftRef.current = true;
    router.replace(saved ? `${REMINDER_ASK}?logged=1` : REMINDER_ASK);
  }

  function openSheet() {
    openAdd({ source: 'onboarding', onDone: ({ saved }) => moveOn(saved) });
  }

  // A beat after mount, so the screen's own fade-in settles before the sheet
  // slides up over it.
  useEffect(() => {
    trackStepViewed('first_expense');
    const timer = setTimeout(openSheet, 350);
    return () => clearTimeout(timer);
  }, []);

  return (
    <OnboardingScreen
      bg="light"
      hero={
        <View style={styles.heroTile}>
          <Receipt size={30} color={colors.incomeAccent} strokeWidth={2} />
        </View>
      }
      title="Log your first expense"
      subtitle="Anything you spent today. It takes a few seconds."
      primaryLabel="Add an expense"
      onPrimary={openSheet}
      secondaryLabel="Not now"
      onSecondary={() => moveOn(false)}
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
