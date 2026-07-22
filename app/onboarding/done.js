import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Confetti from '../../components/Confetti';
import Button from '../../components/Button';
import OnboardingReveal from '../../components/OnboardingReveal';
import { useAuth } from '../../lib/AuthContext';
import useProfile from '../../hooks/useProfile';
import { useOnboarding } from '../../lib/onboarding';
import { colors, fontFamily, fontSize, spacing } from '../../theme/tokens';

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
          <OnboardingReveal>
            <Text style={styles.title}>{firstName ? `You're set,\n${firstName}.` : "You're set."}</Text>
            <Text style={styles.subtitle}>Two minutes a day. That's the whole trick.</Text>
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
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: 46,
    lineHeight: 46 * 1.15,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.lg,
    color: colors.muted,
    marginTop: spacing.md,
    lineHeight: 24,
  },
  footer: {
    paddingBottom: spacing.sm,
  },
  primary: {
    height: 58,
  },
});
