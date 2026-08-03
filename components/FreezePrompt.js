import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { colors as staticColors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../lib/AuthContext';
import useFreezeRecovery from '../hooks/useFreezeRecovery';

const KOBAN_FREEZE = require('../assets/general/freeze.png');
// Freeze illustration fills ~87.6% of its own square canvas — corrected so
// the visible shape matches the glyph size it's replacing.
const FREEZE_FILL_RATIO = 0.876;

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
  const { missedDates, freezes, loading, coverCount, isPartial, using, useFreeze } = useFreezeRecovery();

  const [visible, setVisible] = useState(false);
  const checkedRef = useRef(false);

  const userId = session?.user?.id ?? null;
  const todayStr = format(new Date(), 'yyyy-MM-dd');

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

  async function handleUseFreeze() {
    await useFreeze();
    setVisible(false);
  }

  function handleStartFresh() {
    setVisible(false);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <Image
              source={KOBAN_FREEZE}
              style={{ width: 26 / FREEZE_FILL_RATIO, height: 26 / FREEZE_FILL_RATIO }}
              resizeMode="contain"
            />
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
