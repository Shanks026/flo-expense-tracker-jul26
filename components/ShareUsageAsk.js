import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from './Button';
import Illustration from './ledger/Illustration';
import { radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
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

export function ShareUsageMoment({ onDone }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useAuth();
  const { consent, setConsent } = useAnalyticsConsent();
  const [saving, setSaving] = useState(false);
  const userId = session?.user?.id ?? null;

  // Turned on in Settings while the moment waited: nothing left to ask. Not
  // while answering, where the yes itself turns consent on.
  useEffect(() => {
    if (consent && !saving) onDone({ skipped: true });
  }, [consent]);

  async function answer(yes) {
    setSaving(true);
    if (userId) await AsyncStorage.setItem(answeredKey(userId), yes ? '1' : '0').catch(() => {});
    if (yes) await setConsent(true);
    setSaving(false);
    onDone();
  }

  if (consent && !saving) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => answer(false)}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Illustration name="spark" size="small" style={styles.object} />
          <Text style={styles.title}>Help improve FLO?</Text>
          <Text style={styles.body}>
            Share anonymous usage, like which screens you open. Never your amounts or notes. You can change this
            anytime in Settings.
          </Text>
          <Button title="Share usage" onPress={() => answer(true)} loading={saving} disabled={saving} style={styles.yes} />
          <Pressable style={styles.later} onPress={() => answer(false)} disabled={saving}>
            <Text style={styles.laterText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.cardLg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  object: {
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.title,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  yes: {
    alignSelf: 'stretch',
  },
  later: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  laterText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.mutedMid,
  },
  });
}
