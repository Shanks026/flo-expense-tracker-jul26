import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import Animated, { ZoomIn, FadeInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { Flame } from 'lucide-react-native';
import Button from './Button';
import useStreak from '../hooks/useStreak';
import { useAuth } from '../lib/AuthContext';
import { pickRecap } from '../lib/koban';
import { colors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';

const STORAGE_KEY = 'flo.streak.lastCelebrated';
const CELL_SIZE = 32;

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
  const { current, loading, loggedToday, isNewStreak, isMilestone, todayTotals, history } = useStreak();
  const [visible, setVisible] = useState(false);
  const contentRef = useRef(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!session || loading || !loggedToday) return;

    AsyncStorage.getItem(STORAGE_KEY)
      .catch(() => null)
      .then((lastCelebrated) => {
        if (lastCelebrated === todayStr) return;
        AsyncStorage.setItem(STORAGE_KEY, todayStr).catch(() => {});
        // Snapshot the content at the moment it's decided to show — streak
        // state could in principle keep changing (another transaction saved
        // right after this one) while the modal is animating in; freezing it
        // here means the celebration always describes what actually
        // triggered it, not whatever's true a render later.
        contentRef.current = pickRecap({ streak: current, isNewStreak, isMilestone, todayTotals });
        setVisible(true);
      });
  }, [session, loading, loggedToday, todayStr]);

  if (!visible || !contentRef.current) return null;

  const recentDays = history.slice(-Math.min(current, 7));

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.screen}>
        <Animated.View entering={ZoomIn.duration(400)} style={styles.iconTile}>
          <Flame size={40} color={colors.brand} strokeWidth={2} />
        </Animated.View>

        <Animated.Text entering={FadeInDown.delay(150).duration(400)} style={styles.title}>
          {contentRef.current.title}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(250).duration(400)} style={styles.body}>
          {contentRef.current.body}
        </Animated.Text>

        <View style={styles.calendarRow}>
          {recentDays.map((day, i) => (
            <Animated.View
              key={day.date}
              entering={ZoomIn.delay(400 + i * 120).duration(300)}
              style={[styles.cell, day.logged && styles.cellLogged]}
            />
          ))}
        </View>

        <Animated.View entering={FadeInDown.delay(400 + recentDays.length * 120 + 200).duration(400)} style={styles.buttonWrap}>
          <Button variant="primary" title="Nice!" onPress={() => setVisible(false)} />
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
    backgroundColor: 'rgba(187,220,18,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.amountLg,
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
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.xxl,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cellLogged: {
    backgroundColor: colors.brand,
  },
  buttonWrap: {
    width: '100%',
  },
});
