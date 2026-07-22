import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CircleDollarSign, Snowflake } from 'lucide-react-native';
import Confetti from '../../components/Confetti';
import Button from '../../components/Button';
import CardThemeSurface from '../../components/CardThemeSurface';
import OnboardingReveal from '../../components/OnboardingReveal';
import { DONE_ROUTE } from '../../lib/onboarding';
import { WELCOME_BUNDLE } from '../../lib/rewards';
import { getTheme } from '../../lib/cardThemes';
import { colors, fontFamily, fontSize, spacing, radii } from '../../theme/tokens';

// The welcome-bundle reveal (28-onboarding-welcome-bundle.md Phase 2) — its own
// dedicated screen after the tour, reached from the last tour card AND from
// "Skip tour" (so a skipping user still sees their reward). Confetti + the
// three rewards, then Continue → the done screen (which owns finish(): the
// grant + onboarded_at write). The amounts here come from the WELCOME_BUNDLE
// constant, not a live read — the actual grant happens at finish(), so this
// screen only needs to SHOW what's coming.
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
            <Text style={styles.eyebrow}>A gift to start</Text>
            <Text style={styles.title}>Here's your{'\n'}welcome bundle</Text>

            <View style={styles.rewards}>
              <View style={styles.rewardRow}>
                <View style={styles.rewardIcon}>
                  <CircleDollarSign size={22} color={colors.coinGold} fill={colors.coinGold} strokeWidth={1.5} />
                </View>
                <Text style={styles.rewardAmount}>+{WELCOME_BUNDLE.coins.toLocaleString('en-IN')}</Text>
                <Text style={styles.rewardName}>coins</Text>
              </View>

              <View style={styles.rewardRow}>
                <View style={styles.rewardIcon}>
                  <Snowflake size={22} color={colors.iceBlue} fill={colors.iceBlue} strokeWidth={2.2} />
                </View>
                <Text style={styles.rewardAmount}>+{WELCOME_BUNDLE.freezes}</Text>
                <Text style={styles.rewardName}>streak freeze{WELCOME_BUNDLE.freezes === 1 ? '' : 's'}</Text>
              </View>

              <View style={styles.rewardRow}>
                <CardThemeSurface theme={glitch} style={styles.themeSwatch}>
                  <View />
                </CardThemeSurface>
                <Text style={styles.rewardName}>the {glitch.name} card</Text>
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

      {/* After the SafeAreaView so it paints on top (its bg is opaque);
          pointerEvents="none". */}
      <Confetti />
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
  eyebrow: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.income,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: 40,
    lineHeight: 40 * 1.15,
    letterSpacing: -0.5,
    color: colors.ink,
    marginBottom: spacing.xxl,
  },
  rewards: {
    gap: spacing.lg,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rewardIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.iconTileLg,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardAmount: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  rewardName: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.muted,
  },
  themeSwatch: {
    width: 44,
    height: 30,
    borderRadius: 8,
    overflow: 'hidden',
  },
  footer: {
    paddingBottom: spacing.sm,
  },
  primary: {
    height: 58,
  },
});
