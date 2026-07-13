import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import Animated, { ZoomIn, FadeInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { Flame } from 'lucide-react-native';
import Button from './Button';
import StreakDays from './StreakDays';
import useStreak from '../hooks/useStreak';
import { useAuth } from '../lib/AuthContext';
import { pickRecap, recapEyebrow, recapCta } from '../lib/koban';
import { colors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';

// Keyed BY USER, not per-device. It used to be a bare 'flo.streak.lastCelebrated',
// which meant the "already celebrated today" flag was shared by every account
// that had ever signed in on this phone — so if account A celebrated today,
// account B's very first transaction was silently swallowed. Found 2026-07-13
// when a fresh onboarding signup logged its first expense and no celebration
// appeared, because an earlier account had already celebrated that day.
const storageKey = (userId) => `flo.streak.lastCelebrated.${userId}`;

// Root-mounted sibling, same shape as DueBillsModal (see that file for the
// precedent this copies). One deliberate difference: DueBillsModal gates its
// check to run ONCE per mount (a `checkedRef`), since "bills due" doesn't
// need to react within a live session. This does — logging your first
// transaction of the day happens WHILE the app is open, flipping
// `loggedToday` from false to true mid-session, not just at cold start — so
// the effect is intentionally reactive on `loggedToday` itself, not gated to
// a single check. The AsyncStorage "already celebrated today" key is what
// still stops it from re-showing on the 2nd/3rd/... transaction the same
// day, or replaying on a same-day reopen after already being shown once.
export default function StreakCelebration() {
  const { session } = useAuth();
  const { current, loading, loggedToday, isNewStreak, isMilestone, history } = useStreak();
  const [visible, setVisible] = useState(false);
  const contentRef = useRef(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const userId = session?.user?.id ?? null;

  // The gate. It used to fire on the first transaction of EVERY day — a
  // full-screen takeover on an ordinary Tuesday, which trains the user to
  // dismiss it without reading and makes the day that actually matters land the
  // same as the one that doesn't. Now it only fires on days worth stopping for:
  // the day a streak starts, and the milestones (3, 7, 10, 30, 50, 100).
  //
  // Note this is `current`, the internal count — the Day-0 *label* is a copy-layer
  // relabel of the first day only (see lib/streak.js), so milestone 3 is the 3rd
  // logged day, not the 4th.
  const worthCelebrating = isNewStreak || isMilestone;

  useEffect(() => {
    if (!session || !userId || loading || !loggedToday) return;
    if (!worthCelebrating) return;

    const key = storageKey(userId);
    AsyncStorage.getItem(key)
      .catch(() => null)
      .then((lastCelebrated) => {
        if (lastCelebrated === todayStr) return;
        AsyncStorage.setItem(key, todayStr).catch(() => {});
        // Snapshot the content at the moment it's decided to show — streak
        // state could in principle keep changing (another transaction saved
        // right after this one) while the modal is animating in; freezing it
        // here means the celebration always describes what actually
        // triggered it, not whatever's true a render later.
        contentRef.current = {
          ...pickRecap({ streak: current, isNewStreak, isMilestone }),
          eyebrow: recapEyebrow({ streak: current, isNewStreak }),
          cta: recapCta(),
        };
        setVisible(true);
      });
  }, [session, userId, loading, loggedToday, worthCelebrating, todayStr]);

  if (!visible || !contentRef.current) return null;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.screen}>
        <Animated.View entering={ZoomIn.duration(400)} style={styles.iconTile}>
          <Flame size={40} color={colors.streak} fill={colors.streak} strokeWidth={2} />
        </Animated.View>

        {/* Says what this screen is, every time — the titles below rotate and
            can't be relied on to carry it. */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.eyebrow}>
          <Text style={styles.eyebrowText}>{contentRef.current.eyebrow}</Text>
        </Animated.View>

        <Animated.Text entering={FadeInDown.delay(150).duration(400)} style={styles.title}>
          {contentRef.current.title}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(250).duration(400)} style={styles.body}>
          {contentRef.current.body}
        </Animated.Text>

        {/* Always the full 7-day window, same as Home — it used to render only
            as many cells as the streak was long, so a day-2 streak showed two
            lonely cells and the row meant something different every time you
            saw it. */}
        <Animated.View entering={ZoomIn.delay(400).duration(400)} style={styles.calendarRow}>
          <StreakDays history={history} size={38} dark />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(900).duration(400)} style={styles.buttonWrap}>
          <Button variant="primary" title={contentRef.current.cta} onPress={() => setVisible(false)} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconTile: {
    width: 88,
    height: 88,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,107,44,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  eyebrow: {
    backgroundColor: 'rgba(255,107,44,0.16)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginBottom: spacing.md,
  },
  eyebrowText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xs,
    letterSpacing: 1.2,
    color: colors.streak,
  },
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.hero,
    lineHeight: 36,
    letterSpacing: -0.5,
    color: colors.surface,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.mutedMid,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xxl,
  },
  calendarRow: {
    marginBottom: spacing.xxl,
  },
  buttonWrap: {
    width: '100%',
  },
});
