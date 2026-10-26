import { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingScreen from '../../../components/OnboardingScreen';
import OnboardingMascot from '../../../components/OnboardingMascot';
import { colors, fontFamily, fontSize, spacing } from '../../../theme/tokens';
import { getIntroNext } from '../../../lib/onboarding';
import { setIntroSeen } from '../../../lib/onboardingDraft';
import { track } from '../../../lib/track';
import useAnalyticsConsent from '../../../hooks/useAnalyticsConsent';

const KOBAN_WAVE = require('../../../assets/mascot/hey_screen.png');

// Screen 1 — the warm opener. Koban (the app's mascot) waves hello; the "Sign
// in" escape hatch keeps a returning user from ever seeing a question.
//
// It also carries the analytics opt-in (33-product-analytics.md), unticked by
// default. Signed out, the choice is held on the phone and the events it lets
// through wait in the queue; the first sign-in copies it to a new account's
// profile (lib/track.js). Spec 35 rebuilds this screen and keeps the switch.
export default function Opener() {
  const router = useRouter();
  const { consent, setConsent } = useAnalyticsConsent();

  // Counted once per visit: on arrival if consent is already on, otherwise
  // the moment the switch is turned on. Turning it off drops the queued
  // event, so turning it back on counts the view again.
  const viewTracked = useRef(false);
  useEffect(() => {
    if (!consent) {
      viewTracked.current = false;
      return;
    }
    if (viewTracked.current) return;
    viewTracked.current = true;
    track('onboarding_step_viewed', { step: 'opener' });
  }, [consent]);

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
    >
      <View style={styles.consentRow}>
        <Text style={styles.consentText}>Share anonymous usage to help improve FLO</Text>
        <Switch
          value={consent}
          onValueChange={setConsent}
          // Pinned to the static default palette like the rest of this
          // pre-auth screen (see OnboardingScreen), which is the theme a
          // signed-out user sees.
          trackColor={{ false: colors.mutedLight, true: colors.brand }}
          thumbColor={colors.surface}
          accessibilityLabel="Share anonymous usage to help improve FLO"
        />
      </View>
    </OnboardingScreen>
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
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.md,
  },
  consentText: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.mutedDarker,
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
