import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingScreen from '../../../components/OnboardingScreen';
import OnboardingMascot from '../../../components/OnboardingMascot';
import { colors, fontFamily, fontSize, spacing } from '../../../theme/tokens';
import { getIntroNext } from '../../../lib/onboarding';
import { setIntroSeen } from '../../../lib/onboardingDraft';

const KOBAN_WAVE = require('../../../assets/mascot/hey_screen.png');

// Screen 1 — the warm opener. Koban (the app's mascot) waves hello; the "Sign
// in" escape hatch keeps a returning user from ever seeing a question.
export default function Opener() {
  const router = useRouter();

  async function handleSignIn() {
    await setIntroSeen();
    router.replace('/sign-in');
  }

  return (
    <OnboardingScreen
      bg="light"
      hero={
        <View style={styles.heroWrap}>
          <OnboardingMascot image={KOBAN_WAVE} size={210} style={styles.mascotSpacing} />
          <Text style={styles.hey}>Hi there, I'm Koban!</Text>
        </View>
      }
      primaryLabel="Dive In"
      onPrimary={() => router.replace(getIntroNext('opener'))}
      footerNote={
        <Pressable style={styles.link} onPress={handleSignIn}>
          <Text style={styles.linkText}>
            Already have an account? <Text style={styles.linkBold}>Sign in</Text>
          </Text>
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  // `alignSelf: 'stretch'` overrides OnboardingScreen's hero box (which
  // shrink-wraps to content via `alignItems: 'flex-start'`) so this group
  // centres against the FULL screen width, not just against its own children.
  heroWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  mascotSpacing: {
    marginBottom: spacing.lg,
  },
  hey: {
    fontFamily: fontFamily.extrabold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: colors.ink,
    textAlign: 'center',
  },
  link: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  linkText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  linkBold: {
    fontFamily: fontFamily.extrabold,
  },
});
