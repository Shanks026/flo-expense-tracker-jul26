import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingScreen from '../../../components/OnboardingScreen';
import OnboardingMascot from '../../../components/OnboardingMascot';
import { useToast } from '../../../components/Toast';
import { colors, fontFamily, fontSize, spacing } from '../../../theme/tokens';
import { useAuth } from '../../../lib/AuthContext';
import { setIntroSeen } from '../../../lib/onboardingDraft';
import { track, trackStepViewed } from '../../../lib/track';
import useAnalyticsConsent from '../../../hooks/useAnalyticsConsent';

const KOBAN_WAVE = require('../../../assets/mascot/hey_screen.png');

// The opener (35-onboarding-v3.md) — the whole pre-auth intro now. Koban, one
// line of value, and Continue with Google; email sign-up sits behind "Other
// options", and "I have an account" goes to sign-in. No questions: the
// account, INR, categories and weekly report are set up at sign-up, and the
// gate takes a new account straight on to the post-auth steps.
//
// It also carries the analytics opt-in (33-product-analytics.md), unticked by
// default. Signed out, the choice is held on the phone and the events it lets
// through wait in the queue; the first sign-in copies it to a new account's
// profile (lib/track.js).
export default function Opener() {
  const router = useRouter();
  const { showToast } = useToast();
  const { signInWithGoogle } = useAuth();
  const { consent, setConsent } = useAnalyticsConsent();
  const [googleLoading, setGoogleLoading] = useState(false);

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

  // A backed-out browser sheet returns normally (AuthContext), so only a real
  // failure shows. On success there's nothing to do here: the session lands,
  // RootNavigator marks the intro seen, and OnboardingGate routes the user.
  async function handleGoogle() {
    setGoogleLoading(true);
    trackStepViewed('auth');
    try {
      await signInWithGoogle();
    } catch (err) {
      showToast({ message: err.message, variant: 'error' });
    } finally {
      setGoogleLoading(false);
    }
  }

  async function goToSignIn(mode) {
    await setIntroSeen();
    router.replace(mode === 'signup' ? '/sign-in?mode=signup' : '/sign-in');
  }

  return (
    <OnboardingScreen
      bg="light"
      hero={
        <View style={styles.heroWrap}>
          <OnboardingMascot image={KOBAN_WAVE} size={190} style={styles.mascotSpacing} />
          <Text style={styles.value}>Know where your money goes, a few seconds a day.</Text>
        </View>
      }
      primaryLabel="Continue with Google"
      onPrimary={handleGoogle}
      primaryLoading={googleLoading}
      secondaryLabel="Other options"
      onSecondary={() => goToSignIn('signup')}
      footerNote={
        <Pressable style={styles.link} onPress={() => goToSignIn('signin')} disabled={googleLoading}>
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
  value: {
    fontFamily: fontFamily.extrabold,
    fontSize: 26,
    lineHeight: 33,
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
