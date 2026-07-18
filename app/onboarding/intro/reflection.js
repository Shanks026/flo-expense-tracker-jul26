import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, AccessibilityInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withSpring } from 'react-native-reanimated';
import Button from '../../../components/Button';
import OnboardingReveal from '../../../components/OnboardingReveal';
import { colors, radii, spacing, fontFamily, fontSize } from '../../../theme/tokens';
import { getDraft, setIntroSeen } from '../../../lib/onboardingDraft';

// Screen 12 — reflection. Brand-lime bg, the answers as BLACK cards with
// white text, title + subtitle right below them — cards and text read as ONE
// group, vertically centred together (not cards pinned to the top and text
// pinned to the bottom with dead space between, which is what this looked
// like before). This is "we heard you" — being heard, not a receipt. The
// receipt (a real budget) is Act 2's budget screen; this must not claim the
// setup is done yet.
//
// Each card's emoji reuses the exact same choice already made on that
// question's own screen (goal.js/leak.js/habit.js) — one emoji vocabulary for
// an answer, not a second one invented here.
//
// Card copy is deliberately two sentences, not one: a gentle, SPECULATIVE
// mirror of what this answer likely means ("chances are…", "if this is
// you…" — never a flat assertion, since we don't actually know), followed by
// a reassurance that it changes from here. This is the one place in the flow
// that comes close to naming a pattern back at the user — it must never read
// as a verdict, only as "that's okay, here's what happens now."
const GOAL_CARD = {
  see_where: {
    emoji: '🔍',
    t: 'See where it goes',
    w: 'If your balance feels like a mystery by month’s end, you’re far from the only one. That mystery ends here.',
  },
  stop_overspending: {
    emoji: '🛑',
    t: 'Stop overspending',
    w: 'Odds are it’s not one big splurge, just a bunch of small ones adding up quietly. Once you can see them, they’re easy to catch.',
  },
  save_goal: {
    emoji: '🎯',
    t: 'Save for something',
    w: 'It’s hard to save what you can’t see disappearing first. We’ll make sure you always can.',
  },
  feel_control: {
    emoji: '🧘',
    t: 'Feel in control',
    w: 'Feeling out of control is usually about visibility, not willpower. Give it a couple of weeks here and that feeling changes.',
  },
};
const LEAK_CARD = {
  food: {
    emoji: '🍔',
    t: 'Food & eating out',
    w: 'It’s the classic quiet leak. A little here, a little there, never enough at once to notice, yet it adds up faster than it feels like it should.',
  },
  shopping: {
    emoji: '🛍️',
    t: 'Shopping',
    w: 'It rarely feels like overspending in the moment, just one thing at a time. We’ll show you the total before it sneaks up on you.',
  },
  subscriptions: {
    emoji: '🔁',
    t: 'Subscriptions',
    w: 'They’re built to be forgotten. That’s sort of the whole business model. We’ll make sure yours don’t quietly outlive their use.',
  },
  dont_know: {
    emoji: '🤷',
    t: 'Not sure where it leaks',
    w: 'Not knowing exactly where it goes is more common than you’d think, and it’s genuinely not on you. That’s the gap we’re here to close.',
  },
};
const HABIT_CARD = {
  daily: {
    emoji: '📅',
    t: 'You already check often',
    w: 'Checking often is a great habit, but even careful trackers miss the small stuff between glances. A nightly nudge covers what a quick look can’t.',
  },
  weekly: {
    emoji: '🗓️',
    t: 'You check now and then',
    w: 'Checking in occasionally usually means the in-between days are a bit of a blind spot. A small nudge keeps those gaps from adding up.',
  },
  when_off: {
    emoji: '👀',
    t: 'You check when it feels off',
    w: 'Waiting until something feels off usually means it’s already happened by the time you notice. We’d rather catch it before that.',
  },
  never: {
    emoji: '😅',
    t: 'You don’t track yet',
    w: 'Never really tracking before is genuinely common, not a bad sign. One small nudge a day is really all it takes to change that.',
  },
};

// Each card drops in from above the screen and settles into its final tilt,
// staggered by index, rather than the generic OnboardingReveal pop-from-below
// used everywhere else in onboarding — this screen's cards are meant to read
// as a small stack being dealt into place, not just text fading up.
//
// Tuned slow and smooth deliberately, not snappy: low stiffness + higher mass
// means it takes noticeably longer to cover FALL_DISTANCE and settles gently
// rather than springing/bouncing into place.
const FALL_SPRING = { damping: 20, stiffness: 55, mass: 1.3 };
const FALL_STAGGER_MS = 260;
const FALL_DISTANCE = 420;

function FallingCard({ index, tilt, reduce, children }) {
  const fall = useSharedValue(0);

  // Animate-first, snap-on-reduce (same reasoning as OnboardingReveal): drop in
  // on mount without waiting on the async reduce-motion check — a slow native
  // call was leaving these cards parked off-screen and invisible for ~2s. If
  // reduce-motion resolves true, the second effect cuts to the settled frame.
  useEffect(() => {
    fall.value = withDelay(index * FALL_STAGGER_MS, withSpring(1, FALL_SPRING));
  }, []);

  useEffect(() => {
    if (reduce) fall.value = 1;
  }, [reduce]);

  const style = useAnimatedStyle(() => ({
    // Fades in a little ahead of the landing (×1.4) so the card isn't still
    // invisible for the first chunk of its fall — it should read as a solid
    // card dropping, not a ghost that appears only once it stops.
    opacity: Math.min(1, fall.value * 1.4),
    transform: [
      { translateY: (1 - fall.value) * -FALL_DISTANCE },
      { rotate: `${fall.value * tilt}deg` },
    ],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

export default function Reflection() {
  const router = useRouter();
  const [cards, setCards] = useState([]);
  const [name, setName] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false); // assume motion; correct to true only if the OS says so

  useEffect(() => {
    getDraft().then((d) => {
      setName(d.name || '');
      setCards(
        [GOAL_CARD[d.goal], LEAK_CARD[d.leak_category], HABIT_CARD[d.tracking_habit]].filter(Boolean)
      );
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => active && enabled && setReduceMotion(true))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function handleContinue() {
    await setIntroSeen();
    router.replace('/sign-in?mode=signup');
  }

  // Hold the reveal until the draft has loaded, so the entrance animation (which
  // depends on the card count for its stagger timing) runs exactly once instead
  // of re-triggering when the answers land a tick after mount.
  if (!loaded) return <SafeAreaView style={styles.safe} edges={['top', 'bottom']} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Cards centre within this flexible top region; title/subtitle/button
            flow normally after it, which pins them to the bottom exactly like
            the rest of onboarding's screens — only the cards float free.
            ScrollView (not a plain View) so three tall cards on a short
            device (iPhone SE-class) scroll instead of visually overlapping
            the text block below — RN's default overflow:visible means a
            plain View here would let overflow spill rather than clip. */}
        <ScrollView
          style={styles.cardsWrap}
          contentContainerStyle={styles.cardsWrapContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.cards}>
            {cards.map((c, i) => (
              // Alternating tilt (-1deg / +1deg by index) — a small, deliberate
              // imperfection so the stack reads as a fanned pile of cards
              // rather than three identical rectangles lined up. The tilt
              // itself animates in as part of the fall (see FallingCard).
              <FallingCard key={c.t} index={i} tilt={i % 2 === 0 ? -1 : 1} reduce={reduceMotion}>
                <View style={styles.card}>
                  <Text style={styles.cardEmoji}>{c.emoji}</Text>
                  <Text style={styles.cardTitle}>{c.t}</Text>
                  <Text style={styles.cardBody}>{c.w}</Text>
                </View>
              </FallingCard>
            ))}
          </View>
        </ScrollView>

        <OnboardingReveal delay={cards.length * FALL_STAGGER_MS + 200} style={styles.textBlock}>
          <Text style={styles.title}>We heard you{name ? `, ${name}` : ''}!</Text>
          <Text style={styles.subtitle}>You're in the right place. Now, let's make it real.</Text>
        </OnboardingReveal>

        <Button title="Let’s set it up" variant="dark" onPress={handleContinue} style={styles.primary} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.brand,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.sm,
  },
  // The cards float centred within all the space above the text/button —
  // title, subtitle, and the button below keep their normal bottom-anchored
  // flow (unaffected by this), same as every other onboarding screen.
  cardsWrap: {
    flex: 1,
  },
  cardsWrapContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  cards: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.inkCard,
    borderRadius: radii.card,
    padding: spacing.xl,
  },
  cardEmoji: {
    fontSize: 22,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: colors.surface,
  },
  cardBody: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    lineHeight: 20,
    color: colors.mutedLight,
    marginTop: spacing.xs,
  },
  textBlock: {
    marginTop: spacing.xl,
  },
  title: {
    fontFamily: fontFamily.extrabold,
    // Matches the reduced main-title size used everywhere else in onboarding
    // (OnboardingScreen's own `title`/`titleSize` — see journey.js/solution.js/
    // problem.js's own 32→28/36→32 reductions) — this screen has a bespoke
    // layout, so it doesn't inherit that automatically and had to be updated
    // by hand when the rest of onboarding's titles were sized down.
    fontSize: 30,
    letterSpacing: -0.5,
    lineHeight: 38,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.lg,
    color: colors.ink,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  primary: {
    height: 58,
  },
});
