import { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { addDays, endOfDay, format } from 'date-fns';
import Illustration from './ledger/Illustration';
import StreakMark, { STREAK_MARK_LABELS } from './ledger/StreakMark';
import PinnedFooter from './ledger/PinnedFooter';
import useStreak from '../hooks/useStreak';
import { useAuth } from '../lib/AuthContext';
import { enqueue, PRIORITY } from '../lib/momentQueue';
import { track } from '../lib/track';
import { pickMilestoneLine } from '../lib/koban';
import { celebrationFor } from '../lib/celebrations';
import { MILESTONES } from '../lib/streak';
import { successHaptic } from '../lib/haptics';
import { useLedger, ledgerType, ledgerSpace, inter } from '../theme/ledger';

// Streak milestone celebrations as moment-queue moments (34-streak-only.md,
// restyled by spec 49 ticket 01): only the 7/30/100/365 milestones. The
// day-one moment is gone.
//
// Two parts, like components/DueBillsModal.js. StreakCelebrationSource
// (default export) is the headless sibling of <Stack> in app/_layout.js; it
// enqueues a celebration once the day's first log lands on a milestone
// (lib/celebrations.js decides). It stays reactive on `loggedToday`, since
// that flips mid-session. The queue decides when it shows: after bills due,
// never during onboarding or with the Add sheet open, within the session and
// day caps. The id holds the day, so each one shows once.
// StreakCelebrationMoment is what components/MomentHost.js renders; it works
// from the snapshot taken when it was enqueued, so a celebration that waited
// still describes the day that earned it.
export default function StreakCelebrationSource() {
  const { session } = useAuth();
  const { current, loading, loggedToday, history } = useStreak();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const celebration = loading ? null : celebrationFor({ current, loggedToday }, todayStr);

  useEffect(() => {
    if (!session || !celebration) return;
    enqueue({
      id: celebration.id,
      kind: 'streak',
      priority: PRIORITY.celebration,
      payload: { current, history: history.slice(-7) },
      // A celebration can wait a session, but not go stale: gone after tomorrow.
      expiresAt: endOfDay(addDays(new Date(), 1)).getTime(),
    });
  // The id holds the count and the day, so it changes exactly when a new
  // celebration is due; current and history are read from that render.
  }, [session, celebration?.id]);

  return null;
}

// One calm screen on the app's own background (redesign §4 Celebrations):
// the trophy animating in, the count, one line, the last seven days, and
// Continue. No confetti; text and marks appear in place. Reanimated's
// entering animation follows the system reduce-motion setting, so with it on
// the trophy just appears.
export function StreakCelebrationMoment({ payload, onDone }) {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { current, history = [] } = payload ?? {};
  // A day-one moment saved by an older build may still be in the queue:
  // give the takeover back rather than celebrate it.
  const isMilestone = MILESTONES.includes(current);
  const line = useMemo(() => pickMilestoneLine({ streak: current }).body, [current]);

  useEffect(() => {
    if (!isMilestone) {
      onDone({ skipped: true });
      return;
    }
    // The Kit gallery's preview (payload.preview) logs nothing.
    if (!payload?.preview) track('streak_milestone', { days: current });
    successHaptic();
  }, []);

  if (!isMilestone) return null;

  // Oldest on the left, today on the right (spec 49), like the calendar.
  const week = history.slice(-7);

  return (
    /* statusBarTranslucent — without it, Android doesn't draw this Modal's
       window edge-to-edge and leaves a gap at the top and bottom where the
       screen behind shows through. */
    <Modal visible statusBarTranslucent animationType="fade" onRequestClose={() => onDone()}>
      <View style={styles.screen}>
        <View style={styles.content}>
          {/* A short scale and fade (redesign §2.7), the only motion. */}
          <Animated.View entering={FadeIn.duration(220)} style={styles.object}>
            <Animated.View entering={ZoomIn.duration(220)}>
              <Illustration name="trophy" size="large" />
            </Animated.View>
          </Animated.View>

          <Text style={styles.count} accessibilityRole="header">
            {current}
          </Text>
          <Text style={styles.caption}>day streak</Text>
          <Text style={styles.line}>{line}</Text>

          <View style={styles.week} accessibilityLabel={`Last ${week.length} days`}>
            {week.map((day) => (
              <StreakMark
                key={day.date}
                type={day.type}
                size={28}
                accessibilityLabel={`${format(new Date(`${day.date}T00:00:00`), 'EEE d MMM')}: ${STREAK_MARK_LABELS[day.type] ?? 'Not logged'}`}
              />
            ))}
          </View>
        </View>

        <PinnedFooter primary={{ title: 'Continue', onPress: () => onDone() }} />
      </View>
    </Modal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.canvas,
    },
    // Centres the moment in the space above the pinned button.
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: ledgerSpace.gutter,
    },
    object: {
      marginBottom: ledgerSpace.section,
    },
    // Brand display type (redesign §2.3): Inter 700 at 36.
    count: {
      fontFamily: inter.bold,
      fontSize: 36,
      lineHeight: 42,
      letterSpacing: -0.8,
      fontVariant: ['tabular-nums'],
      color: c.ink,
    },
    caption: {
      ...ledgerType.caption,
      color: c.muted,
      marginBottom: ledgerSpace.lg,
    },
    line: {
      ...ledgerType.body,
      color: c.ink,
      textAlign: 'center',
      marginBottom: ledgerSpace.section,
    },
    week: {
      flexDirection: 'row',
      gap: ledgerSpace.sm,
    },
  });
}
