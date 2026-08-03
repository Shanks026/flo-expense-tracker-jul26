import { View, Text, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Confetti from '../../components/Confetti';
import Button from '../../components/Button';
import OnboardingReveal from '../../components/OnboardingReveal';
import { useAuth } from '../../lib/AuthContext';
import useProfile from '../../hooks/useProfile';
import { useOnboarding } from '../../lib/onboarding';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';

const KOBAN_YOU_ARE_SET = require('../../assets/mascot/you-are-set.png');

// The "you're all set" closer (12-personal-onboarding.md, reworked
// 28-onboarding-welcome-bundle.md). White background + ink text (was full-bleed
// brand lime). The welcome bundle now has its OWN screen just before this
// (app/onboarding/welcome-bundle.js), so this screen is a clean send-off — no
// reward block here anymore. finish() still grants the bundle
// (claimWelcomeBundle) and writes onboarded_at, and deliberately does NOT
// navigate — the gate moves the user once the refetched profile says onboarded
// (07 fix #14); re-introducing an imperative router call here would reopen that
// exact bug.
//
// Pinned to the STATIC default palette (theme/tokens `colors`), like the rest
// of onboarding and sign-in — a pre-Home screen shouldn't read the active
// account theme.
export default function OnboardingDone() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const { finish, working } = useOnboarding();

  const fullName = profile?.full_name ?? session?.user?.user_metadata?.full_name ?? '';
  const firstName = fullName.trim().split(' ')[0];

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.hero}>
          <OnboardingReveal style={styles.heroContent}>
            <Image source={KOBAN_YOU_ARE_SET} style={styles.mascot} resizeMode="contain" />
            <Text style={styles.title}>{firstName ? `You're all set, ${firstName}!` : "You're all set!"}</Text>
            <Text style={styles.subtitle}>2 minutes a day. Time to <Text style={styles.subtitleEmphasis}>LOCK IN</Text>!</Text>
          </OnboardingReveal>
        </View>

        <View style={styles.footer}>
          <Button
            title="Go to my money"
            onPress={finish}
            loading={working}
            variant="primary"
            style={[styles.primary, { backgroundColor: colors.brand }]}
          />
        </View>
      </SafeAreaView>

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
  heroContent: {
    alignItems: 'center',
  },
  mascot: {
    width: 205,
    height: 205,
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: 26,
    lineHeight: 26 * 1.2,
    letterSpacing: -0.3,
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.lg,
    color: colors.muted,
    marginTop: spacing.sm,
    lineHeight: 24,
    textAlign: 'center',
  },
  subtitleEmphasis: {
    fontFamily: fontFamily.extrabold,
  },
  footer: {
    paddingBottom: spacing.sm,
  },
  primary: {
    height: 58,
  },
});
