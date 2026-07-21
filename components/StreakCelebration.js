import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { ZoomIn, FadeInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { Flame, CircleDollarSign, Snowflake, Star } from 'lucide-react-native';
import Button from './Button';
import Confetti from './Confetti';
import StreakDays from './StreakDays';
import useStreak from '../hooks/useStreak';
import { useRewardBurst } from './RewardBurst';
import { useAuth } from '../lib/AuthContext';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { pickRecap, recapEyebrow, recapCta } from '../lib/koban';
import { claimMilestone } from '../lib/rewardsMutations';
import { spinWheelFor, MILESTONE_REWARDS } from '../lib/rewards';
import { STREAK_BADGE_ART } from '../lib/trophies';
import MilestoneSpinWheel from './MilestoneSpinWheel';
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
//
// TEMP TESTING OVERRIDE — same idea as RankUpCelebration's own (per direct
// instruction, "display that screen for test like how you did for xp").
// Bypasses the AsyncStorage "already celebrated today" guard AND the real
// claimMilestone call entirely — reward shown is read from MILESTONE_REWARDS
// directly (real numbers, just not a live claim) so testing never touches
// the ledger or risks a duplicate-claim race. FLIP BACK TO FALSE BEFORE
// SHIPPING.
const FORCE_SHOW_FOR_TESTING = false;

export default function StreakCelebration() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { current, loading, loggedToday, isNewStreak, isMilestone, history } = useStreak();
  const { isBursting } = useRewardBurst();
  const { notifyChanged } = useDataRefresh();
  const [visible, setVisible] = useState(false);
  // Separate from `visible` (originally 19-card-themes.md Phase 2's chest,
  // now 20-milestone-spin-wheel.md Phase 1's bonus spin) — set at the same
  // moment as the celebration, but only actually SHOWN once the celebration
  // is dismissed (see the CTA's onPress below), so the two full-screen
  // Modals present sequentially, not stacked.
  const [wheelDay, setWheelDay] = useState(null);
  const [wheelVisible, setWheelVisible] = useState(false);
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
    if (FORCE_SHOW_FOR_TESTING) {
      if (loading) return;
      contentRef.current = {
        ...pickRecap({ streak: current, isNewStreak, isMilestone }),
        eyebrow: recapEyebrow({ streak: current, isNewStreak }),
        cta: recapCta(),
        reward: isMilestone && MILESTONE_REWARDS[current] ? MILESTONE_REWARDS[current] : null,
      };
      setWheelDay(null);
      setVisible(true);
      return;
    }
    if (!session || !userId || loading || !loggedToday) return;
    if (!worthCelebrating) return;
    // Ordering fix (18-gamification-ritual-and-ledger.md Phase 3, found on-
    // device): this is a full-screen Modal, which renders in its own native
    // layer above regular views regardless of JS-side z-index — if it showed
    // while RewardBurst's coins/XP overlay was still animating, it silently
    // covered the burst instead of the two coexisting. Deferring here (not
    // marking "already celebrated" until this check actually passes) means
    // the effect just re-evaluates once isBursting flips false, showing the
    // streak takeover right after the burst finishes rather than racing it.
    if (isBursting) return;

    const key = storageKey(userId);
    AsyncStorage.getItem(key)
      .catch(() => null)
      .then(async (lastCelebrated) => {
        if (lastCelebrated === todayStr) return;
        AsyncStorage.setItem(key, todayStr).catch(() => {});

        // Milestone payout (18-gamification-ritual-and-ledger.md Phase 5) —
        // isNewStreak (day 1) is never a MILESTONES tier, so this only ever
        // fires for a genuine milestone. claimMilestone's own `ref:
        // 'milestone:<day>'` is what actually prevents a double-pay (idempotent
        // forever, not just "already celebrated today") — this AsyncStorage
        // check above is a separate, purely presentational guard against
        // re-showing the SCREEN, not the source of payout correctness.
        let reward = null;
        if (isMilestone) {
          const { error, isNewClaim, coins, freezes } = await claimMilestone(current);
          if (!error && isNewClaim && (coins > 0 || freezes > 0)) {
            reward = { coins, freezes };
            notifyChanged();
          }
        }

        // Snapshot the content at the moment it's decided to show — streak
        // state could in principle keep changing (another transaction saved
        // right after this one) while the modal is animating in; freezing it
        // here means the celebration always describes what actually
        // triggered it, not whatever's true a render later.
        contentRef.current = {
          ...pickRecap({ streak: current, isNewStreak, isMilestone }),
          eyebrow: recapEyebrow({ streak: current, isNewStreak }),
          cta: recapCta(),
          reward,
        };
        // Wheel days chain into MilestoneSpinWheel right after this screen is
        // dismissed (see the CTA's onPress below) — set now, alongside the
        // celebration's own content, so both screens describe the same
        // milestone snapshot rather than re-reading `current` a beat later.
        // Gated purely on spinWheelFor(current), NOT `isMilestone &&` (Phase 1
        // required it since 30/50 were both milestones; Phase 2 added day 1,
        // which is a NEW STREAK, never a MILESTONES entry — see SPIN_WHEELS'
        // own comment in lib/rewards.js for why day 1 stays off that list).
        setWheelDay(spinWheelFor(current) ? current : null);
        setVisible(true);
      });
  }, [session, userId, loading, loggedToday, worthCelebrating, todayStr, isBursting]);

  // Dismissing the celebration hands off to the spin wheel (day 30/50 only,
  // wheelDay is null otherwise) instead of just closing — two sequential
  // full-screen Modals, not stacked; see wheelDay's own comment above.
  function handleCelebrationDismiss() {
    setVisible(false);
    if (wheelDay) setWheelVisible(true);
  }

  function handleWheelDone() {
    setWheelVisible(false);
    setWheelDay(null);
  }

  if (!visible && !wheelVisible) return null;

  return (
    <>
    {visible && contentRef.current && (
    <Modal visible={visible} animationType="fade" onRequestClose={handleCelebrationDismiss}>
      <View style={styles.screen}>
        <Confetti />
        {/* Content centers in the space ABOVE the button (per direct
            feedback, "place the button at the bottom of the screen") — the
            button itself lives in its own non-flex footer below, so it pins
            to the bottom edge instead of flowing right after the reward
            pill/calendar. Same split as RankUpCelebration/MilestoneSpinWheel. */}
        <View style={styles.content}>
          {/* The real illustrated streak badge (assets/streak/, STREAK_BADGE_ART
              — same art the Trophy Room shows) for a milestone day, not the
              generic Flame glyph this used before. Day 1 (isNewStreak) has no
              badge art (MILESTONES starts at 3), so it keeps the Flame-in-tile
              fallback — same "art if it exists, icon tile otherwise" rule
              app/trophies.js already uses for every badge-backed group. */}
          {STREAK_BADGE_ART[current] ? (
            <Animated.View entering={ZoomIn.duration(400)} style={styles.badgeWrap}>
              <Image source={STREAK_BADGE_ART[current]} style={styles.badgeArt} resizeMode="contain" />
            </Animated.View>
          ) : (
            <Animated.View entering={ZoomIn.duration(400)} style={styles.iconTile}>
              <Flame size={40} color={colors.streak} fill={colors.streak} strokeWidth={2} />
            </Animated.View>
          )}

          {/* Title + body only now (per direct feedback — "remove the top
              text... just the title and subtitle works"). recapEyebrow's
              own comment on what the eyebrow was FOR still applies to
              contentRef.current.eyebrow existing at all (kept in koban.js
              since notifications/other future surfaces may still want it),
              this screen just no longer renders it. */}
          <Animated.Text entering={FadeInDown.delay(150).duration(400)} style={styles.title}>
            {contentRef.current.title}
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(250).duration(400)} style={styles.body}>
            {contentRef.current.body}
          </Animated.Text>

          {/* Always the full 7-day window, same as Home — it used to render only
              as many cells as the streak was long, so a day-2 streak showed two
              lonely cells and the row meant something different every time you
              saw it. Per direct feedback ("add animation to display it one by
              one") — `animated` staggers each cell in individually instead of
              the whole row popping in as one block; `baseDelay` slots it into
              this screen's own sequence (right after title/body). Plain
              (unanimated) wrapping View now — the per-cell stagger lives
              inside StreakDays itself, so a second entrance animation on the
              row as a whole would just double up. */}
          <View style={styles.calendarRow}>
            <StreakDays history={history} size={38} dark animated baseDelay={400} />
          </View>
        </View>

        {/* Moved OUT of `content` (per direct feedback, "place it at the
            bottom close to the button") — content's own flex:1/centered
            children (badge/title/body/calendar) now center in whatever space
            is left ABOVE this, instead of this being just another item in
            that same centered stack. Sits as its own block directly above
            the button now, not vertically centered with the rest. */}
        {contentRef.current.reward && (
          <Animated.View entering={FadeInDown.delay(650).duration(400)} style={styles.rewardWrap}>
            <Text style={styles.rewardLabel}>You received</Text>
            <View style={styles.rewardRow}>
              <View style={styles.rewardEntry}>
                <CircleDollarSign size={18} color={colors.coinGold} fill={colors.coinGold} strokeWidth={1.5} />
                <Text style={styles.rewardAmount}>+{contentRef.current.reward.coins} coins</Text>
              </View>
              {/* XP added 27-rank-ladder-rework.md Phase 1 — milestones now
                  grant it, and it's the largest single component at most
                  tiers. Star/brand/filled and the coins→XP→freezes order both
                  match RewardBurst's existing treatment, so the same reward
                  reads identically wherever it surfaces. */}
              {contentRef.current.reward.xp > 0 && (
                <View style={styles.rewardEntry}>
                  <Star size={18} color={colors.brand} fill={colors.brand} strokeWidth={1.5} />
                  <Text style={styles.rewardAmount}>+{contentRef.current.reward.xp} XP</Text>
                </View>
              )}
              {contentRef.current.reward.freezes > 0 && (
                <View style={styles.rewardEntry}>
                  <Snowflake size={18} color={colors.iceBlue} fill={colors.iceBlue} strokeWidth={2.2} />
                  <Text style={styles.rewardAmount}>
                    +{contentRef.current.reward.freezes} freeze{contentRef.current.reward.freezes === 1 ? '' : 's'}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(900).duration(400)} style={[styles.buttonWrap, { paddingBottom: insets.bottom + spacing.lg }]}>
          {/* Ghost, not primary — per direct feedback: this is a plain
              acknowledge/dismiss, not a decision, so it shouldn't compete
              visually with a real action button (e.g. the spin wheel's own
              "Spin" CTA that can chain right after this screen). */}
          <Button variant="ghost" title={contentRef.current.cta} onPress={handleCelebrationDismiss} />
        </Animated.View>
      </View>
    </Modal>
    )}

    {wheelDay && (
      <MilestoneSpinWheel
        day={wheelDay}
        segments={spinWheelFor(wheelDay).segments}
        visible={wheelVisible}
        onDone={handleWheelDone}
      />
    )}
    </>
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
  iconTile: {
    width: 88,
    height: 88,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,107,44,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  // The illustrated badge's own art carries its circular medal shape/
  // background (same as every other badge slot in this app) — no tinted
  // fill/border-radius here, unlike iconTile's Flame-glyph fallback above.
  // Matches RankUpCelebration's own badge size (140px) — per direct
  // feedback, the earlier 80px (Trophy Room grid size) read as too small for
  // a full-screen celebration; 140px is the right scale for this screen.
  badgeWrap: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  badgeArt: {
    width: 140,
    height: 140,
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
    color: colors.mutedMid,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xxl,
  },
  calendarRow: {
    marginBottom: spacing.xxl,
  },
  // No pill/chip anymore (per direct feedback, same call as
  // RankUpCelebration's eyebrow) — plain text, coinGold still carries the
  // "this is a reward" meaning without a tinted background.
  // "You received" + icon/amount pairs (per direct feedback) — replaces the
  // old single coinGold pill-text line. Icons keep their semantic colors
  // (coinGold/iceBlue, matching Home header's own chip); the amount text
  // itself is plain white, not tinted.
  // paddingTop pushed further (per direct feedback, twice — "even more,
  // close to the button but not too close") past the spacing scale's own
  // largest named step (xxl/24), a plain 40 instead.
  // Now a standalone block right above the button (moved out of `content`),
  // so paddingTop is back to a normal gap from the calendar above it —
  // paddingBottom (per direct feedback, "add bottom padding") is what
  // actually creates the breathing room before the button now.
  rewardWrap: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    marginBottom: spacing.xxl,
  },
  rewardLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginBottom: spacing.xs,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  rewardEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rewardAmount: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    color: colors.surface,
  },
  buttonWrap: {
    width: '100%',
  },
});
