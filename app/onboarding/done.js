import { View, Text, StyleSheet } from 'react-native';
import Confetti from '../../components/Confetti';
import PartyPopper from '../../components/PartyPopper';
import OnboardingScaffold from '../../components/OnboardingScaffold';
import { useAuth } from '../../lib/AuthContext';
import useProfile from '../../hooks/useProfile';
import { useOnboarding } from '../../lib/onboarding';
import { colors, spacing, fontFamily, fontSize } from '../../theme/tokens';

export default function OnboardingDone() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const { finish, working } = useOnboarding();

  const fullName = profile?.full_name ?? session?.user?.user_metadata?.full_name ?? '';
  const firstName = fullName.trim().split(' ')[0];

  return (
    <View style={styles.root}>
      <OnboardingScaffold primaryLabel="Start tracking" onPrimary={finish} primaryLoading={working}>
        <View style={styles.center}>
          <PartyPopper size={104} />
          <Text style={styles.title}>
            {firstName ? `You're all set, ${firstName}` : "You're all set"}
          </Text>
          <Text style={styles.body}>Add transactions anytime — everything updates instantly.</Text>
        </View>
      </OnboardingScaffold>

      {/* AFTER the scaffold, not before. The scaffold's SafeAreaView has an
          opaque background, and among absolutely-positioned siblings the later
          one paints on top — so rendering Confetti first hid it completely
          behind a white sheet. It's pointerEvents="none", so sitting above the
          button costs nothing. */}
      <Confetti />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  // No flex:1 here. The scaffold's body sizes to its content (the whole group is
  // centred as a unit by the scaffold itself), so a flex:1 child inside it
  // resolves to zero height and silently swallows the popper and the text —
  // which is exactly what happened.
  center: {
    alignItems: 'center',
  },
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.hero,
    letterSpacing: -0.5,
    color: colors.ink,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  body: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.lg,
    lineHeight: 21,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.md,
    maxWidth: 280,
  },
});
