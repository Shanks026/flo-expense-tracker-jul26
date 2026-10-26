import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Koban from './koban/Koban';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
import { radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useAuth } from '../lib/AuthContext';
import useProfile from '../hooks/useProfile';
import { useRewardBurst } from './RewardBurst';
import { useAnyMomentActive } from '../lib/momentQueue';


// Coach marks (35-onboarding-v3.md): a Koban moment that rings one element,
// says one line, and goes away on a tap — shown once per mark, per user, and
// only to users who finished onboarding after these shipped (anyone earlier
// already knows the app). They wait while any celebration is on screen.
//
// Seen-state lives on the phone, keyed per user, and is shared through a small
// cache so one mark can wait for another (`after`).
export const COACH_MARKS_SINCE = '2026-10-26T00:00:00Z';

const seenCache = new Map(); // `${userId}:${id}` → true | false
const seenListeners = new Set();

function seenKey(userId, id) {
  return `flo.coachMark.${id}.${userId}`;
}

function notifySeen() {
  seenListeners.forEach((fn) => fn());
}

function loadSeen(userId, id) {
  const cacheKey = `${userId}:${id}`;
  if (seenCache.has(cacheKey)) return;
  seenCache.set(cacheKey, null);
  AsyncStorage.getItem(seenKey(userId, id))
    .catch(() => null)
    .then((value) => {
      seenCache.set(cacheKey, value === '1');
      notifySeen();
    });
}

function markSeen(userId, id) {
  seenCache.set(`${userId}:${id}`, true);
  AsyncStorage.setItem(seenKey(userId, id), '1').catch(() => {});
  notifySeen();
}

function subscribeSeen(fn) {
  seenListeners.add(fn);
  return () => seenListeners.delete(fn);
}

// null while loading, then true/false.
function useSeen(userId, id) {
  useEffect(() => {
    if (userId && id) loadSeen(userId, id);
  }, [userId, id]);
  return useSyncExternalStore(subscribeSeen, () =>
    userId && id ? (seenCache.get(`${userId}:${id}`) ?? null) : null
  );
}

// `active`: the owning screen's own condition (e.g. "on Home", "has logged").
// `after`: another mark's id that must be seen first.
export default function CoachMark({ id, targetRef, text, active = true, after = null }) {
  const { colors, modeId } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { profile } = useProfile();
  const { isBursting } = useRewardBurst();
  const momentActive = useAnyMomentActive();
  const seen = useSeen(userId, id);
  const afterSeen = useSeen(userId, after);
  const [rect, setRect] = useState(null);

  const eligible =
    !!profile?.onboarded_at && new Date(profile.onboarded_at) >= new Date(COACH_MARKS_SINCE);
  const ready =
    active && eligible && seen === false && (!after || afterSeen === true) && !momentActive && !isBursting;

  // Measured once the mark is due, a beat after the screen settles, so the
  // ring lands where the element actually is.
  useEffect(() => {
    if (!ready) {
      setRect(null);
      return;
    }
    const timer = setTimeout(() => {
      targetRef.current?.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) setRect({ x, y, width, height });
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [ready, targetRef]);

  if (!ready || !rect) return null;

  const pad = 6;
  const ring = {
    left: rect.x - pad,
    top: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
  // The bubble sits on whichever side of the target has more room.
  const below = rect.y + rect.height / 2 < screenHeight / 2;
  const bubblePosition = below
    ? { top: ring.top + ring.height + spacing.md }
    : { bottom: screenHeight - ring.top + spacing.md };

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={() => markSeen(userId, id)}>
      <Pressable style={styles.backdrop} onPress={() => markSeen(userId, id)} accessibilityRole="button">
        <View style={[styles.ring, ring]} pointerEvents="none" />
        <View style={[styles.bubble, bubblePosition, { maxWidth: screenWidth - spacing.lg * 2 }]}>
          <Koban size={40} pose="tip" mood="happy" surface={modeId} style={styles.koban} />
          <View style={styles.bubbleBody}>
            <Text style={styles.text}>{text}</Text>
            <Text style={styles.hint}>Tap anywhere to continue</Text>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      // Same scrim as DueBillsModal / FreezePrompt; the themes have no token for it.
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    ring: {
      position: 'absolute',
      borderRadius: radii.card,
      borderWidth: 3,
      borderColor: colors.brand,
    },
    bubble: {
      position: 'absolute',
      left: spacing.lg,
      right: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.card,
      padding: spacing.lg,
    },
    koban: {
      alignSelf: 'flex-end',
    },
    bubbleBody: {
      flex: 1,
    },
    text: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.lg,
      color: colors.ink,
    },
    hint: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.sm,
      color: colors.muted,
      marginTop: 4,
    },
  });
}
