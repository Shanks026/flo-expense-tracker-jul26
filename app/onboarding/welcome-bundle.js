import { View, Text, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Snowflake } from 'lucide-react-native';
import Button from '../../components/Button';
import CardThemeSurface from '../../components/CardThemeSurface';
import OnboardingReveal from '../../components/OnboardingReveal';
import OnboardingMascot from '../../components/OnboardingMascot';
import { DONE_ROUTE } from '../../lib/onboarding';
import { WELCOME_BUNDLE } from '../../lib/rewards';
import { getTheme } from '../../lib/cardThemes';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';

const KOBAN_WELCOME_BUNDLE = require('../../assets/mascot/welcome-bundle.png');
const KOBAN_COIN = require('../../assets/general/coin.png');

// The welcome-bundle reveal (28-onboarding-welcome-bundle.md Phase 2) — its own
// dedicated screen after the tour, reached from the last tour card AND from
// "Skip tour" (so a skipping user still sees their reward). Koban + the three
// rewards, then Continue → the done screen (which owns finish(): the grant +
// onboarded_at write). The amounts here come from the WELCOME_BUNDLE constant,
// not a live read — the actual grant happens at finish(), so this screen only
// needs to SHOW what's coming.
//
// Confetti removed (2026-07-29, user's call) — the mascot now carries the
// celebratory beat instead of a particle effect.
//
// Pinned to the static default palette (white bg, ink text), like the rest of
// onboarding and sign-in.
export default function OnboardingWelcomeBundle() {
  const router = useRouter();
  const glitch = getTheme(WELCOME_BUNDLE.themeId);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.hero}>
          <OnboardingReveal>
            <OnboardingMascot image={KOBAN_WELCOME_BUNDLE} size={210} style={styles.mascotSpacing} />
            <Text style={styles.eyebrow}>A gift to start</Text>
            <Text style={styles.title}>Here's your welcome bundle</Text>

            <View style={styles.rewards}>
              <View style={styles.rewardCols}>
                <View style={styles.rewardCol}>
                  <Image source={KOBAN_COIN} style={styles.coinIcon} resizeMode="contain" />
                  <Text style={styles.rewardColText}>
                    <Text style={styles.rewardColAmount}>{WELCOME_BUNDLE.coins.toLocaleString('en-IN')}</Text> coins
                  </Text>
                </View>
                <View style={styles.rewardCol}>
                  <Snowflake size={36} color={colors.iceBlue} fill={colors.iceBlue} strokeWidth={2.2} />
                  <Text style={styles.rewardColText}>
                    <Text style={styles.rewardColAmount}>{WELCOME_BUNDLE.freezes}</Text> freeze
                    {WELCOME_BUNDLE.freezes === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>

              {/* Same rectangle-preview shape RankUpCelebration's own card
                  reveal uses (label above, full-width preview, name below) —
                  CardThemeSurface applies its own border radius internally,
                  so `themePreview` only needs to set the box's dimensions. */}
              <View style={styles.themeWrap}>
                <Text style={styles.themeLabel}>Card unlocked</Text>
                <CardThemeSurface theme={glitch} style={styles.themePreview}>
                  <View style={styles.themePreviewContent}>
                    <Text style={[styles.themePreviewName, { color: glitch.textColor }]}>{glitch.name}</Text>
                  </View>
                </CardThemeSurface>
              </View>
            </View>
          </OnboardingReveal>
        </View>

        <View style={styles.footer}>
          <Button
            title="Continue"
            onPress={() => router.replace(DONE_ROUTE)}
            variant="primary"
            style={[styles.primary, { backgroundColor: colors.brand }]}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface, // white
  },
  safe: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
  },
  mascotSpacing: {
    marginBottom: spacing.xl,
  },
  eyebrow: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.income,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  // Matches app/onboarding/done.js's title exactly ("You're all set" screen)
  // — same 26px/1.2 line-height/-0.3 letter-spacing, per direct request to
  // keep the two closing screens' headings visually consistent.
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: 26,
    lineHeight: 26 * 1.2,
    letterSpacing: -0.3,
    color: colors.ink,
    marginBottom: spacing.xxl,
    textAlign: 'center',
  },
  rewards: {
    gap: spacing.xxl,
  },
  rewardCols: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  // No icon tile/background — bare glyphs, per direct feedback. Each column
  // centers its icon over one combined line of text (amount + label) below
  // it, rather than the old icon-left/amount-right single-row shape.
  rewardCol: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  // 36 / 0.693 (the illustrated coin's measured ~69.3% canvas fill) — matches
  // the 36px Snowflake icon in the freeze column beside it.
  coinIcon: {
    width: 52,
    height: 52,
  },
  // includeFontPadding/textAlignVertical — Android's default extra font
  // padding otherwise makes this sit low against the icon above it.
  rewardColText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.muted,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  rewardColAmount: {
    fontFamily: fontFamily.extrabold,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  themeWrap: {
    width: '100%',
    alignItems: 'center',
  },
  themeLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: colors.mutedDarker,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  themePreview: {
    width: '78%',
    height: 84,
  },
  themePreviewContent: {
    flex: 1,
    padding: spacing.md,
  },
  themePreviewName: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
  },
  footer: {
    paddingBottom: spacing.sm,
  },
  primary: {
    height: 58,
  },
});
