import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Illustration from './ledger/Illustration';
import Sheet from './ledger/Sheet';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import { useLedger, ledgerType, ledgerSpace } from '../theme/ledger';
import { useAuth } from '../lib/AuthContext';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { supabase } from '../lib/supabase';
import { enqueue, PRIORITY } from '../lib/momentQueue';
import useAnalyticsConsent from '../hooks/useAnalyticsConsent';

// The analytics opt-in ask (33-product-analytics.md, revised 2026-10-27). It
// used to be a switch on the opener, which felt like a hurdle before sign-up;
// now it's asked once, as a moment, after the 3rd expense. Settings → Data &
// export still has the switch.
//
// Same two parts as DueBillsModal. ShareUsageSource (default export) is the
// headless sibling of <Stack> that enqueues the moment once the user has 3
// expenses and hasn't answered. ShareUsageMoment is what MomentHost renders.
//
// Answered is remembered in its own key, not just the queue's doneIds: those
// are capped, and a daily bills-due id would eventually push this one out and
// bring the ask back.
const ASK_AFTER_EXPENSES = 3;
const MOMENT_ID = 'share-usage-ask';
const answeredKey = (userId) => `flo.shareUsageAsk.${userId}`;

export default function ShareUsageSource() {
  const { session } = useAuth();
  const { version } = useDataRefresh();
  const { consent } = useAnalyticsConsent();
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (!userId || consent) return;
    let cancelled = false;
    (async () => {
      const answered = await AsyncStorage.getItem(answeredKey(userId)).catch(() => null);
      if (cancelled || answered) return;
      const { count, error } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'expense');
      if (cancelled || error || (count ?? 0) < ASK_AFTER_EXPENSES) return;
      // Least urgent of the takeovers: bills and celebrations go first.
      enqueue({ id: MOMENT_ID, kind: 'share-usage', priority: PRIORITY.ambient });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, consent, version]);

  return null;
}

// A ledger Sheet in the "Stay in the know" shape (spec 49, ticket 04): the
// question as its title, one object, one line, Share usage / Not now. Closing it any
// other way (X, back, swipe) counts as Not now, as the old close did.
export function ShareUsageMoment({ onDone }) {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { session } = useAuth();
  const { consent, setConsent } = useAnalyticsConsent();
  const [saving, setSaving] = useState(false);
  const sheetRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(sheetRef);
  // Whether the person has answered (or consent arrived some other way), so
  // the close doesn't record a Not now over it.
  const answeredRef = useRef(false);
  const presentedRef = useRef(false);
  const userId = session?.user?.id ?? null;

  const saveAnswer = (yes) =>
    userId ? AsyncStorage.setItem(answeredKey(userId), yes ? '1' : '0').catch(() => {}) : Promise.resolve();

  // Sharing already on (turned on in Settings while the moment waited):
  // nothing to ask, so give the turn back. If it turns on while the sheet is
  // up (not by this sheet's own yes), close it.
  useEffect(() => {
    if (!consent) return;
    if (!presentedRef.current) {
      onDone({ skipped: true });
    } else if (!answeredRef.current) {
      answeredRef.current = true;
      sheetRef.current?.dismiss();
    }
  }, [consent]);

  useEffect(() => {
    if (consent) return;
    presentedRef.current = true;
    sheetRef.current?.present();
  }, []);

  async function answer(yes) {
    // Marked first: a close during the save mustn't record a Not now.
    answeredRef.current = true;
    setSaving(true);
    await saveAnswer(yes);
    if (yes) await setConsent(true);
    setSaving(false);
    sheetRef.current?.dismiss();
  }

  // Every close lands here: after an answer, or a close with no answer (X,
  // back, swipe), which is a Not now.
  async function handleDismiss() {
    if (!answeredRef.current) await saveAnswer(false);
    onDone();
  }

  return (
    <Sheet
      ref={sheetRef}
      title="Help improve FLO?"
      onChange={handleSheetChange}
      onDismiss={handleDismiss}
      footer={{
        primary: { title: 'Share usage', onPress: () => answer(true), loading: saving, disabled: saving },
        secondary: { title: 'Not now', onPress: () => answer(false), disabled: saving },
      }}
    >
      <View style={styles.body}>
        <Illustration name="spark" size="small" />
        <Text style={styles.line}>
          Share anonymous usage, like which screens you open. Never your amounts or notes. You can change this anytime
          in Settings.
        </Text>
      </View>
    </Sheet>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    body: {
      alignItems: 'center',
      gap: ledgerSpace.md,
      paddingBottom: ledgerSpace.lg,
    },
    line: {
      ...ledgerType.body,
      color: c.muted,
      textAlign: 'center',
    },
  });
}
