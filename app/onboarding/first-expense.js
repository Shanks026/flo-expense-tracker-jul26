import { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Illustration from '../../components/ledger/Illustration';
import PinnedFooter from '../../components/ledger/PinnedFooter';
import { useAddTransactionSheet } from '../../components/AddTransactionSheet';
import { useLedger, ledgerType, ledgerSpace } from '../../theme/ledger';
import { trackStepViewed } from '../../lib/track';
import { FLAGS } from '../../lib/flags';

const REMINDER_ASK = '/onboarding/reminders';

// The first expense (spec 35, on the ledger kit in spec 47): the real Add
// sheet, with its quick-add line, opens a beat after this screen mounts.
// A title strip teaches typing and voice at once. Saving logs it; closing is
// "Not now". Either way the person moves on to the reminder ask, which opens
// with "Logged." after a save.
//
// The buttons here only show if the sheet is closed without leaving (it never
// is in the normal flow, since closing moves on): one reopens it, one skips.
export default function FirstExpense() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { openAdd } = useAddTransactionSheet();
  const leftRef = useRef(false);

  function moveOn(saved) {
    if (leftRef.current) return;
    leftRef.current = true;
    router.replace(saved ? `${REMINDER_ASK}?logged=1` : REMINDER_ASK);
  }

  function openSheet() {
    openAdd({
      source: 'onboarding',
      quickAdd: true,
      // The quick-add line only exists with the AI flag on.
      intro: FLAGS.ai ? 'Log your first expense: type it or hold to say it' : 'Log your first expense',
      onDone: ({ saved }) => moveOn(saved),
    });
  }

  // A beat after mount, so the screen's own fade-in settles before the sheet
  // slides up over it.
  useEffect(() => {
    trackStepViewed('first_expense');
    const timer = setTimeout(openSheet, 350);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.body}>
        <Illustration name="receipt" size="large" style={styles.object} />
        <Text style={[ledgerType.title, styles.center, { color: c.ink }]} accessibilityRole="header">
          Log your first expense
        </Text>
        <Text style={[ledgerType.body, styles.center, styles.sub, { color: c.muted }]}>
          Anything you spent today. It takes a few seconds.
        </Text>
      </View>
      <PinnedFooter
        secondary={{ title: 'Not now', onPress: () => moveOn(false), variant: 'quiet' }}
        primary={{ title: 'Add an expense', onPress: openSheet }}
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
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: ledgerSpace.gutter,
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
