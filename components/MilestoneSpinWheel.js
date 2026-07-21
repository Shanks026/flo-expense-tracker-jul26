import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, AccessibilityInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, ZoomIn, FadeInDown } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Gift, CircleDollarSign, Snowflake } from 'lucide-react-native';
import Button from './Button';
import CardThemeSurface from './CardThemeSurface';
import { claimSpin } from '../lib/rewardsMutations';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { getTheme } from '../lib/cardThemes';
import { lighten } from '../lib/color';
import { colors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';

// 20-milestone-spin-wheel.md Phase 1 — replaces components/MilestoneChest.js.
// The milestone's exclusive card theme is granted DIRECTLY elsewhere
// (claimMilestone's MILESTONE_THEME_GRANTS, StreakCelebration.js) — this
// component only spins for a BONUS coins/freezes segment from the pool
// StreakCelebration passes in (lib/rewards.js's SPIN_WHEELS). Two invariants
// enforced by construction: every segment is a real reward (no blank slice,
// enforced by whoever authors SPIN_WHEELS, not by this component), and a spin
// is earned by reaching the milestone — this component has no "spin again"
// or "buy a spin" path at all.
//
// Reuses the same thick-ring stroke-dasharray technique as DonutChart.js
// (alternating colored arcs around a circle) rather than inventing SVG path
// arc math — the ring is drawn once, then the whole ring+labels group is
// wrapped in one Animated.View and spun via a single rotation shared value.
// Sized up from an original 240 per direct feedback ("the spin wheel should
// be a bit large") — everything below derives from SIZE/STROKE_WIDTH/
// LABEL_SIZE, so this is the only place to retune the wheel's scale.
const SIZE = 300;
const STROKE_WIDTH = 68;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SEGMENT_GAP = 4;
const LABEL_SIZE = 66;
const SPIN_DURATION_MS = 3200;
const EXTRA_SPINS = 5;

const RING_COLOR_A = colors.inkCard;
const RING_COLOR_B = lighten(colors.inkCard, 0.35);

function segmentKind(segment) {
  return segment.freezes > 0 && !segment.coins ? 'freeze' : 'coins';
}

// Finds which segment a persisted claim's coins/freezes corresponds to, for
// landing the wheel visually on a REPLAYED result (see claimSpin's own
// comment — a replay reads back the original outcome rather than re-rolling).
// Falls back progressively because a freeze grant can have been clamped by
// FREEZE_CAP at the time of the original claim, so an exact match isn't
// always possible — the reward TEXT shown is always the real credited
// amount regardless of which segment the wheel visually lands on.
function findSegmentIndex(segments, coins, freezes) {
  let idx = segments.findIndex((s) => s.coins === coins && s.freezes === freezes);
  if (idx === -1) idx = segments.findIndex((s) => s.coins === coins && coins > 0);
  if (idx === -1) idx = segments.findIndex((s) => s.freezes > 0 && freezes > 0);
  return idx === -1 ? 0 : idx;
}

export default function MilestoneSpinWheel({ day, segments, visible, onDone }) {
  const insets = useSafeAreaInsets();
  const { notifyChanged } = useDataRefresh();
  const rotation = useSharedValue(0);
  // 'idle' (waiting for the Spin tap) | 'spinning' | 'done' — per direct
  // feedback, the wheel no longer auto-spins on open; a CTA button is the
  // real action, matching the wheel's own "earned only, no pay-to-spin"
  // rule (a deliberate tap, not a surprise that happens to you).
  const [phase, setPhase] = useState('idle');
  const [result, setResult] = useState(null); // { coins, freezes, themeId }
  const [reduceMotion, setReduceMotion] = useState(false);
  const segmentAngle = 360 / segments.length;

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => active && setReduceMotion(enabled))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function spin() {
    setPhase('spinning');
    const guessIndex = Math.floor(Math.random() * segments.length);
    const guess = segments[guessIndex];

    const { error, coins, freezes, themeId } = await claimSpin(day, guess);
    if (!error) notifyChanged();

    // On a genuine first claim this always matches guessIndex exactly; on a
    // replay it resolves to whichever segment the ORIGINAL spin actually won
    // (claimSpin already returned that outcome's coins/freezes, not a fresh
    // roll).
    const landedIndex = error ? guessIndex : findSegmentIndex(segments, coins, freezes);
    const landAngle = landedIndex * segmentAngle + segmentAngle / 2;
    const finalRotation = EXTRA_SPINS * 360 + (360 - landAngle);

    if (reduceMotion) {
      rotation.value = finalRotation;
    } else {
      rotation.value = withTiming(finalRotation, { duration: SPIN_DURATION_MS, easing: Easing.out(Easing.cubic) });
    }

    const revealDelay = reduceMotion ? 0 : SPIN_DURATION_MS;
    setTimeout(() => {
      setResult({ coins: error ? 0 : coins, freezes: error ? 0 : freezes, themeId: error ? null : themeId });
      setPhase('done');
    }, revealDelay);
  }

  function handleDone() {
    setResult(null);
    setPhase('idle');
    onDone();
  }

  const rotatorStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={() => {}}>
      <View style={styles.screen}>
        {/* Content centers in the space ABOVE the button (per direct
            feedback, "place the button at the bottom of the screen") — same
            split as StreakCelebration/RankUpCelebration. */}
        <View style={styles.content}>
        <Animated.View entering={ZoomIn.duration(400)} style={styles.iconTile}>
          <Gift size={38} color={colors.coinGold} strokeWidth={2} />
        </Animated.View>
        <Animated.Text entering={FadeInDown.delay(100).duration(400)} style={styles.title}>
          Day {day} bonus spin
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(180).duration(400)} style={styles.body}>
          {phase === 'idle' ? 'Spin for a bonus reward!' : phase === 'spinning' ? 'Watch it land...' : 'Nice spin!'}
        </Animated.Text>

        <Animated.View entering={FadeInDown.delay(280).duration(400)} style={styles.wheelWrap}>
          <View style={styles.pointer} />
          <Animated.View style={[styles.wheelRotator, rotatorStyle]}>
            <Svg width={SIZE} height={SIZE}>
              {segments.map((seg, i) => {
                const arcLen = CIRCUMFERENCE / segments.length;
                return (
                  <Circle
                    key={seg.id}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    stroke={i % 2 === 0 ? RING_COLOR_A : RING_COLOR_B}
                    strokeWidth={STROKE_WIDTH}
                    strokeDasharray={`${arcLen - SEGMENT_GAP} ${CIRCUMFERENCE}`}
                    strokeDashoffset={-(i * arcLen + SEGMENT_GAP / 2)}
                    strokeLinecap="butt"
                    fill="none"
                    rotation={-90}
                    originX={SIZE / 2}
                    originY={SIZE / 2}
                  />
                );
              })}
            </Svg>
            {segments.map((seg, i) => {
              const angle = i * segmentAngle + segmentAngle / 2;
              const rad = (angle * Math.PI) / 180;
              const x = SIZE / 2 + RADIUS * Math.sin(rad);
              const y = SIZE / 2 - RADIUS * Math.cos(rad);
              const kind = segmentKind(seg);
              return (
                <View
                  key={seg.id}
                  style={[
                    styles.label,
                    { left: x - LABEL_SIZE / 2, top: y - LABEL_SIZE / 2, transform: [{ rotate: `${angle}deg` }] },
                  ]}
                >
                  {kind === 'freeze' ? (
                    <Snowflake size={19} color={colors.iceBlue} fill={colors.iceBlue} strokeWidth={2.2} />
                  ) : (
                    <CircleDollarSign size={19} color={colors.coinGold} fill={colors.coinGold} strokeWidth={1.5} />
                  )}
                  <Text style={styles.labelText} numberOfLines={1}>
                    {seg.label}
                  </Text>
                </View>
              );
            })}
          </Animated.View>
          <View style={styles.hub}>
            <Gift size={24} color={colors.ink} strokeWidth={2.2} />
          </View>
        </Animated.View>

        {/* The theme is granted directly (not a wheel outcome — see
            claimSpin's own comment), so it gets its own real card preview —
            the same CardThemeSurface the Shop uses to show a theme, not just
            a name in a text string — with the wheel's coins/freezes as the
            separate bonus pill below it. */}
        {phase === 'done' && result?.themeId && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.themePreviewWrap}>
            <Text style={styles.themePreviewLabel}>New theme unlocked</Text>
            <CardThemeSurface theme={getTheme(result.themeId)} style={styles.themePreviewShape}>
              <View style={styles.themePreviewContent}>
                <Text style={[styles.themePreviewName, { color: getTheme(result.themeId).textColor }]}>
                  {getTheme(result.themeId).name}
                </Text>
              </View>
            </CardThemeSurface>
          </Animated.View>
        )}

        {phase === 'done' && result && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.rewardPill}>
            <Text style={styles.rewardText}>
              +{result.coins} coins
              {result.freezes > 0 ? ` · +${result.freezes} freeze${result.freezes === 1 ? '' : 's'}` : ''}
            </Text>
          </Animated.View>
        )}
        </View>

        {/* Spin is the real decision here — a deliberate tap, matching the
            wheel's own "earned only" rule (see the file's own top comment) —
            so it stays the loud primary CTA. "Nice" (once landed) is a plain
            acknowledge/dismiss, ghost per direct feedback. Nothing renders
            mid-spin; the wheel itself is the only thing to watch. */}
        {phase === 'idle' && (
          <Animated.View entering={FadeInDown.duration(300)} style={[styles.buttonWrap, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Button variant="primary" title="Spin" onPress={spin} />
          </Animated.View>
        )}

        {phase === 'done' && (
          <Animated.View entering={FadeInDown.duration(300)} style={[styles.buttonWrap, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Button variant="ghost" title="Nice" onPress={handleDone} />
          </Animated.View>
        )}
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
  iconTile: {
    width: 80,
    height: 80,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(224,169,48,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.hero,
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
    marginBottom: spacing.xxl,
  },
  wheelWrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  wheelRotator: {
    width: SIZE,
    height: SIZE,
  },
  pointer: {
    position: 'absolute',
    top: -7,
    left: SIZE / 2 - 11,
    width: 0,
    height: 0,
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderTopWidth: 17,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.coinGold,
    zIndex: 2,
  },
  label: {
    position: 'absolute',
    width: LABEL_SIZE,
    height: LABEL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    fontFamily: fontFamily.extrabold,
    fontSize: 12,
    color: colors.surface,
    marginTop: 4,
    textAlign: 'center',
  },
  hub: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.ink,
  },
  themePreviewWrap: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  themePreviewLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.mutedMid,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  themePreviewShape: {
    width: '100%',
    height: 100,
  },
  themePreviewContent: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'flex-end',
  },
  themePreviewName: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.heading,
    letterSpacing: -0.3,
  },
  rewardPill: {
    backgroundColor: 'rgba(224,169,48,0.16)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    marginBottom: spacing.xxl,
  },
  rewardText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    color: colors.coinGold,
  },
  buttonWrap: {
    width: '100%',
  },
});
