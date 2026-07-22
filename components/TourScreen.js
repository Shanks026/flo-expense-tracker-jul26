import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from './Button';
import OnboardingReveal from './OnboardingReveal';
import { colors, spacing, radii, fontFamily, fontSize } from '../theme/tokens';

// The "Know your space" tour card layout (28-onboarding-welcome-bundle.md
// Phase 2). A screen-image placeholder occupying the top ~2/3, then title +
// subtitle, then the CTA — the shape the user described. Distinct from
// OnboardingScreen (whose content is a centred group above the footer), which
// is why this is its own component rather than a prop on that one.
//
// Pinned to the STATIC default palette (theme/tokens `colors`), like the rest
// of onboarding and sign-in — a pre-Home screen shouldn't read the active
// account theme.
//
// `image` is optional and null for now — real screenshots get dropped in
// later (like the badge art). Until then the placeholder box shows the
// section's icon so it reads as intentional, not broken. When images arrive,
// pass a require()'d source and it renders in place of the placeholder.
export default function TourScreen({
  progress, // 0..1
  stepLabel, // e.g. "3 of 6"
  eyebrow, // small uppercase label above the title (e.g. "Quick Tour")
  Icon, // lucide component for the placeholder / hub
  image, // optional require()'d source; null → icon placeholder
  title,
  subtitle,
  children, // optional (hub action rows / currency segments)
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Progress — its own bar + explicit count, so the tour reads as finite
          (user: "the user might not feel when does this get over"). */}
      <View style={styles.top}>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${Math.round((progress ?? 0) * 100)}%` }]} />
        </View>
        {stepLabel ? <Text style={styles.stepLabel}>{stepLabel}</Text> : null}
      </View>

      {/* Top ~2/3: the screen preview (placeholder for now). */}
      <View style={styles.imageWrap}>
        <View style={styles.placeholder}>
          {Icon ? <Icon size={64} color={colors.income} strokeWidth={1.8} /> : null}
          <Text style={styles.placeholderHint}>Preview</Text>
        </View>
      </View>

      {/* Bottom third: text + CTA. */}
      <View style={styles.bottom}>
        <OnboardingReveal>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {children ? <View style={styles.children}>{children}</View> : null}
        </OnboardingReveal>

        <View style={styles.footer}>
          <Button
            title={primaryLabel}
            onPress={onPrimary}
            variant="primary"
            // Pin the fill to the static brand accent, not the active account
            // theme (same reasoning as OnboardingScreen / sign-in).
            style={[styles.primary, { backgroundColor: colors.brand }]}
          />
          {secondaryLabel ? (
            <Pressable style={styles.secondary} onPress={onSecondary}>
              <Text style={styles.secondaryText}>{secondaryLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface, // white
    paddingHorizontal: spacing.xxl,
  },
  top: {
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  barTrack: {
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.completedTrack,
    overflow: 'hidden',
  },
  barFill: {
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
  },
  stepLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
  },
  // The dominant top region — takes all space above the (content-sized)
  // bottom block, i.e. roughly the top two-thirds.
  imageWrap: {
    flex: 1,
    paddingVertical: spacing.xl,
  },
  placeholder: {
    flex: 1,
    borderRadius: radii.cardLg,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  placeholderHint: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.mutedLight,
  },
  bottom: {
    paddingBottom: spacing.sm,
  },
  eyebrow: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xs,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.income,
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: 28,
    lineHeight: 28 * 1.2,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.lg,
    lineHeight: 24,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  children: {
    marginTop: spacing.lg,
  },
  footer: {
    paddingTop: spacing.lg,
  },
  primary: {
    height: 58,
  },
  secondary: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  secondaryText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
});
