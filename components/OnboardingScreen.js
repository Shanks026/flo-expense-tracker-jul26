import { View, Text, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from './Button';
import OnboardingReveal from './OnboardingReveal';
import OnboardingArrowMotif from './OnboardingArrowMotif';
import { colors, spacing, radii, fontFamily, fontSize } from '../theme/tokens';

// The v2 onboarding scaffold. Two background modes, chosen per screen to make
// the flow "cut" like an edited video (see 12-personal-onboarding.md). No dark/
// black background anywhere in onboarding — a user's explicit call — so this
// is deliberately two modes, not three:
//
//   light — the workhorse (bg canvas, ink text). Emphasis words go `colors.income`
//           (deep lime) — raw `colors.brand` fails contrast on white, a rule
//           codified in theme/tokens.js. The thin progress bar lives here.
//   brand — full lime fill, ink text. Primary button is `dark` (a lime button on
//           lime is invisible). Emotional-peak screens.
//
// Vertical rhythm follows 07's hard-won v3 (see OnboardingScaffold): the whole
// group centres as one unit above the pinned footer; `scrollable` centres while
// short and scrolls once tall. The whole group animates in via OnboardingReveal.
const PALETTES = {
  light: { bg: colors.bg, title: colors.ink, subtitle: colors.muted, eyebrow: colors.income, primary: 'primary', secondary: colors.muted, track: colors.completedTrack, fill: colors.brand },
  brand: { bg: colors.brand, title: colors.ink, subtitle: colors.ink, eyebrow: colors.ink, primary: 'dark', secondary: colors.ink, track: colors.ink, fill: colors.ink },
};

export default function OnboardingScreen({
  bg = 'light',
  progress, // 0..1 → renders the thin top bar; omit to hide (heroes)
  // Decorative brand-arrow watermark, for the "text + subtitle only" hero
  // screens only (problem/solution/ready/journey) — 'top' | 'bottom' | omit.
  arrowMotif,
  eyebrow,
  hero,
  title,
  // Optional numeric override for a "hero statement" screen (e.g. the 2-minute
  // ask, the journey line, the final "you're set") — the default `title` size
  // (fontSize.hero) is right for a question but reads small for a single big
  // declarative sentence. Line height scales with it so it doesn't need a
  // second prop.
  titleSize,
  subtitle,
  // The problem screen pairs a QUESTION (title) with its ANSWER (subtitle) —
  // the answer needs to visually complement the question, not read as fine
  // print underneath it. Bigger, bolder, and ink rather than muted.
  subtitleEmphasis = false,
  scrollable = false,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  secondaryLabel,
  onSecondary,
  footerNote, // a node (e.g. the opener's "Sign in" escape hatch)
  children,
}) {
  const p = PALETTES[bg] ?? PALETTES.light;
  const showBar = typeof progress === 'number';
  // The arrow motif calls for a top/bottom SPLIT — the vector owns one half,
  // the text sits toward the other. But "toward" is not "flush against the
  // edge": asymmetric flex spacers around the content (not justifyContent:
  // flex-end/flex-start, which shoves it all the way to the footer or the
  // progress bar) land it somewhere between centre and that edge, with real
  // breathing room on both sides. Equal ratios (no motif) is exactly centred,
  // same as before.
  const [spacerBefore, spacerAfter] =
    arrowMotif === 'top' ? [8, 1] : arrowMotif === 'bottom' ? [2, 8] : [1, 1];

  const group = (
    <OnboardingReveal>
      {eyebrow ? <Text style={[styles.eyebrow, { color: p.eyebrow }]}>{eyebrow}</Text> : null}
      {hero ? <View style={styles.hero}>{hero}</View> : null}
      {title ? (
        <Text
          style={[
            styles.title,
            { color: p.title },
            // 1.25x, not a tight ~1.1x — a lineHeight too close to fontSize
            // clips a large extrabold glyph's descender (the exact bug found
            // on the opener's "Hey.", which needed the same fix).
            titleSize ? { fontSize: titleSize, lineHeight: titleSize * 1.25 } : null,
          ]}
        >
          {title}
        </Text>
      ) : null}
      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            subtitleEmphasis ? [styles.subtitleEmphasis, { color: p.title }] : { color: p.subtitle },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
      {children ? <View style={styles.body}>{children}</View> : null}
    </OnboardingReveal>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.bg }]} edges={['top', 'bottom']}>
      {arrowMotif ? <OnboardingArrowMotif position={arrowMotif} /> : null}

      {showBar ? (
        <View style={styles.barWrap}>
          <View style={[styles.barTrack, { backgroundColor: p.track }]}>
            <View style={[styles.barFill, { backgroundColor: p.fill, width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </View>
      ) : null}

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          {scrollable ? (
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.scrollGroup}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={{ flex: spacerBefore }} />
              {group}
              <View style={{ flex: spacerAfter }} />
            </ScrollView>
          ) : (
            <View style={styles.staticGroup}>
              <View style={{ flex: spacerBefore }} />
              {group}
              <View style={{ flex: spacerAfter }} />
            </View>
          )}

          <View style={styles.footer}>
            {primaryLabel ? (
              <Button
                title={primaryLabel}
                onPress={onPrimary}
                disabled={primaryDisabled}
                loading={primaryLoading}
                variant={p.primary}
                style={styles.primary}
              />
            ) : null}
            {secondaryLabel ? (
              <Pressable style={styles.secondary} onPress={onSecondary} disabled={primaryLoading}>
                <Text style={[styles.secondaryText, { color: p.secondary }]}>{secondaryLabel}</Text>
              </Pressable>
            ) : null}
            {footerNote ?? null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
  },
  barWrap: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
  },
  barTrack: {
    height: 5,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  barFill: {
    height: 5,
    borderRadius: radii.pill,
  },
  staticGroup: {
    flex: 1,
    justifyContent: 'center',
  },
  scrollGroup: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  eyebrow: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  hero: {
    marginBottom: spacing.xl,
    alignItems: 'flex-start',
  },
  title: {
    fontFamily: fontFamily.extrabold,
    // The DEFAULT size — for question pages (the MCQ/choice-list/input
    // screens: age, income, goal, leak, habit, commitment, name), which stay
    // at this smaller, question-appropriate size. The standalone "title +
    // subtitle only" hero screens (problem/solution/ready/journey) opt UP via
    // the `titleSize` prop instead — the enlargement is deliberately scoped to
    // those, not applied globally.
    fontSize: fontSize.hero,
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.lg,
    lineHeight: 22,
    marginTop: spacing.md,
  },
  subtitleEmphasis: {
    fontFamily: fontFamily.semibold,
    fontSize: 18,
    lineHeight: 24,
  },
  body: {
    marginTop: spacing.xxl,
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  primary: {
    height: 58,
  },
  secondary: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
  },
});
