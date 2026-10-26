import { useEffect } from 'react';
import { View, StyleSheet, Modal, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { ZoomIn, FadeInDown } from 'react-native-reanimated';
import { addDays, endOfDay, format } from 'date-fns';
import Button from './Button';
import Confetti from './Confetti';
import StreakDays from './StreakDays';
import useStreak from '../hooks/useStreak';
import { useAuth } from '../lib/AuthContext';
import { enqueue, PRIORITY } from '../lib/momentQueue';
import { track } from '../lib/track';
import { pickRecap, recapCta } from '../lib/koban';
import { STREAK_BADGE_ART } from '../lib/trophies';

const KOBAN_STREAK = require('../assets/mascot/streak.png');
// Static palette (theme/tokens) a permanently dark celebration screen.
import { colors, fontFamily, fontSize, spacing } from '../theme/tokens';

// Streak celebrations as moment-queue moments (34-streak-only.md): the day a
// streak starts, and the 7/30/100/365 milestones (lib/streak.js MILESTONES).
// No reward, no spin wheel — the economy is flagged off.
//
// Two parts, like components/DueBillsModal.js. StreakCelebrationSource
// (default export) is the headless sibling of <Stack> in app/_layout.js; it
// enqueues a celebration once the day's first log makes today worth one. It
// stays reactive on `loggedToday`, since that flips mid-session. The queue
// decides when it shows: after bills due, never during onboarding or with the
// Add sheet open, within the session and day caps — otherwise it waits for
// the next session. The id holds the day, so each one shows once.
// StreakCelebrationMoment is what components/MomentHost.js renders; it works
// from the snapshot taken when it was enqueued, so a celebration that waited
// still describes the day that earned it.
export default function StreakCelebrationSource() {
  const { session } = useAuth();
  const { current, loading, loggedToday, isNewStreak, isMilestone, history } = useStreak();
  const worthCelebrating = isNewStreak || isMilestone;
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!session || loading || !loggedToday || !worthCelebrating) return;
    enqueue({
      id: isMilestone ? `streak-milestone:${current}:${todayStr}` : `streak-start:${todayStr}`,
      kind: 'streak',
      priority: PRIORITY.celebration,
      payload: { current, isNewStreak, isMilestone, history: history.slice(-7) },
      // A celebration can wait a session, but not go stale: gone after tomorrow.
      expiresAt: endOfDay(addDays(new Date(), 1)).getTime(),
    });
  }, [session, loading, loggedToday, worthCelebrating, current, todayStr]);

  return null;
}

export function StreakCelebrationMoment({ payload, onDone }) {
  const insets = useSafeAreaInsets();
  const { current, isNewStreak, isMilestone, history } = payload;
  const recap = pickRecap({ streak: current, isNewStreak, isMilestone });

  useEffect(() => {
    if (isMilestone) track('streak_milestone', { days: current });
  }, []);

  return (
    /* statusBarTranslucent — without it, Android doesn't draw this Modal's
       window edge-to-edge and leaves a gap at the top and bottom where the
       screen behind shows through. */
    <Modal visible statusBarTranslucent animationType="fade" onRequestClose={() => onDone()}>
      <View style={styles.screen}>
        <Confetti />
        {/* Content centers in the space above the button, which sits in its
            own footer pinned to the bottom edge. */}
        <View style={styles.content}>
          {/* The illustrated badge for a milestone day; day 1 has no badge, so
              it gets the Koban streak mascot. */}
          <Animated.View entering={ZoomIn.duration(400)} style={styles.badgeWrap}>
            <Image source={STREAK_BADGE_ART[current] ?? KOBAN_STREAK} style={styles.badgeArt} resizeMode="contain" />
          </Animated.View>

          <Animated.Text entering={FadeInDown.delay(150).duration(400)} style={styles.title}>
            {recap.title}
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(250).duration(400)} style={styles.body}>
            {recap.body}
          </Animated.Text>

          {/* The full 7-day row, each cell staggering in after the title. */}
          <View style={styles.calendarRow}>
            <StreakDays history={history} size={38} dark animated baseDelay={400} />
          </View>
        </View>

        <Animated.View entering={FadeInDown.delay(900).duration(400)} style={[styles.buttonWrap, { paddingBottom: insets.bottom + spacing.lg }]}>
          {/* Ghost, not primary: a plain acknowledgement, not a decision. */}
          <Button variant="ghost" title={recapCta()} onPress={() => onDone()} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.xl,
  },
  // Takes all the space ABOVE the pinned button, centering its own content
  // within that remaining area — see the button's own comment in the JSX.
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The illustrated badge's own art carries its circular medal shape/
  // background (same as every other badge slot in this app) — no tinted
  // fill/border-radius here. Was 140px (matching RankUpCelebration's own
  // badge size, up from the earlier 80px Trophy Room grid size, per direct
  // feedback at the time) — bumped again to 200px specifically for this
  // screen once the illustrated streak mascot (day 1's fallback, shares this
  // same style with the real STREAK_BADGE_ART medals) needed more presence.
  badgeWrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  badgeArt: {
    width: 200,
    height: 200,
  },
  // Dialed back from fontSize.hero (30) per direct feedback — the varied
  // recap titles run longer than a rank name ("Streak holds at day 30" etc.),
  // so a slightly smaller size reads better across the whole copy pool, not
  // just the short variants.
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.display,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: colors.surface,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.mutedOnDark,
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
