import { Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingScreen from '../../../components/OnboardingScreen';
import { colors, fontFamily, fontSize, spacing } from '../../../theme/tokens';
import { getIntroNext } from '../../../lib/onboarding';
import { setIntroSeen } from '../../../lib/onboardingDraft';

// Screen 1 — the warm opener. Full lime, one huge word, and the "Sign in"
// escape hatch that keeps a returning user from ever seeing a question.
export default function Opener() {
  const router = useRouter();

  async function handleSignIn() {
    await setIntroSeen();
    router.replace('/sign-in');
  }

  return (
    <OnboardingScreen
      bg="brand"
      hero={<Text style={styles.hey}>Hey.</Text>}
      subtitle="Let's figure out where your money actually goes. Together, in just a couple of minutes."
      primaryLabel="Start"
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
  hey: {
    fontFamily: fontFamily.extrabold,
    // Deliberately larger than theme/tokens.js's fontSize scale tops out
    // (amountXl = 56) — this is the flow's single loudest word, matching the
    // design mock's actual value (104px) for this screen almost exactly.
    fontSize: 100,
    // MUST exceed fontSize, not sit below it — a lineHeight smaller than the
    // font size clips the glyph box itself (the descender on "y" was getting
    // cut off at 96). RN needs headroom above the em-square for a font this
    // large, not just leading between lines.
    lineHeight: 124,
    letterSpacing: -2,
    color: colors.ink,
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
