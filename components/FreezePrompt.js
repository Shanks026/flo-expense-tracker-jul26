import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { Snowflake } from 'lucide-react-native';
import { colors as staticColors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../lib/AuthContext';
import useRewards from '../hooks/useRewards';
import useMissedDays from '../hooks/useMissedDays';
import { useFreezeForDates } from '../lib/rewardsMutations';
import { useDataRefresh } from '../lib/DataRefreshContext';

// User-scoped, same standing rule as StreakCelebration's own
// lastCelebrated key (00-index.md) — this device may have more than one
// account signed in across sessions.
const storageKey = (userId) => `flo.freezePrompt.lastShown.${userId}`;

// The return prompt — 18-gamification-ritual-and-ledger.md Phase 4. Same
// "once per mount, once per day" shape as DueBillsModal (that file's own
// comment is the precedent): a missed gap doesn't change WHILE the app stays
// open the way "logged today" does, so this doesn't need StreakCelebration's
// fully-reactive re-check, just a single gate on mount.
//
// Deliberately conscious, never a silent auto-consume — hiding the decision
// is wrong for an app about awareness (the doc's own framing). Shown only
// when there's a real gap AND the user actually holds a freeze; a user with
// zero freezes just sees their streak reset naturally, no prompt, nothing to
// offer.
export default function FreezePrompt() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useAuth();
  const { freezes, loading: rewardsLoading } = useRewards();
  const { missedDates, loading: missedLoading } = useMissedDays();
  const { notifyChanged } = useDataRefresh();

  const [visible, setVisible] = useState(false);
  const [using, setUsing] = useState(false);
  const checkedRef = useRef(false);

  const userId = session?.user?.id ?? null;
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const loading = rewardsLoading || missedLoading;

  useEffect(() => {
    if (!session || !userId || loading || checkedRef.current) return;
    checkedRef.current = true;

    if (missedDates.length === 0 || freezes < 1) return;

    AsyncStorage.getItem(storageKey(userId))
      .catch(() => null)
      .then((lastShown) => {
        if (lastShown === todayStr) return;
        AsyncStorage.setItem(storageKey(userId), todayStr).catch(() => {});
        setVisible(true);
      });
  }, [session, userId, loading, missedDates.length, freezes, todayStr]);

  if (missedDates.length === 0 || freezes < 1) return null;

  // Closest-to-today subset when only partially covering — see
  // useMissedDays.js's own comment on why this ordering matters for
  // computeStreak's `current` to actually benefit.
  const coverCount = Math.min(freezes, missedDates.length);
  const datesToUse = missedDates.slice(-coverCount);
  const isPartial = coverCount < missedDates.length;

  async function handleUseFreeze() {
    setUsing(true);
    const { error } = await useFreezeForDates(datesToUse, todayStr);
    setUsing(false);
    setVisible(false);
    if (!error) notifyChanged();
  }

  function handleStartFresh() {
    setVisible(false);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <Snowflake size={26} color={colors.iceBlue} strokeWidth={2.2} />
          </View>
          <Text style={styles.title}>
            You missed {missedDates.length} day{missedDates.length === 1 ? '' : 's'}
          </Text>
          <Text style={styles.body}>
            {isPartial
              ? `You have ${freezes} freeze${freezes === 1 ? '' : 's'} — enough to cover ${coverCount} of ${missedDates.length}. Your streak still resets, but those days won't look empty.`
              : `Use ${coverCount} freeze${coverCount === 1 ? '' : 's'} to keep your streak going, or start fresh today?`}
          </Text>

          <Pressable style={styles.useButton} onPress={handleUseFreeze} disabled={using}>
            {using ? (
              <ActivityIndicator size="small" color={staticColors.ink} />
            ) : (
              <Text style={styles.useButtonText}>
                Use {coverCount} freeze{coverCount === 1 ? '' : 's'}
              </Text>
            )}
          </Pressable>
          <Pressable style={styles.later} onPress={handleStartFresh} disabled={using}>
            <Text style={styles.laterText}>Start fresh</Text>
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
    icon: {
      width: 56,
      height: 56,
      borderRadius: radii.pill,
      backgroundColor: colors.iceBlueBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    title: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.title,
      color: colors.ink,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    body: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.base,
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    useButton: {
      width: '100%',
      height: 52,
      borderRadius: radii.button,
      backgroundColor: colors.iceBlue,
      alignItems: 'center',
      justifyContent: 'center',
    },
    useButtonText: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.md,
      color: staticColors.ink,
    },
    later: {
      width: '100%',
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
    },
    laterText: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.md,
      color: colors.muted,
    },
  });
}
