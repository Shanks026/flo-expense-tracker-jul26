import { View, Text, StyleSheet } from 'react-native';
import { PartyPopper } from 'lucide-react-native';
import Confetti from '../../components/Confetti';
import OnboardingScaffold from '../../components/OnboardingScaffold';
import { useAuth } from '../../lib/AuthContext';
import useProfile from '../../hooks/useProfile';
import { useOnboarding } from '../../lib/onboarding';
import { colors, spacing, fontFamily, fontSize } from '../../theme/tokens';

export default function OnboardingDone() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const { finish } = useOnboarding();

  const fullName = profile?.full_name ?? session?.user?.user_metadata?.full_name ?? '';
  const firstName = fullName.trim().split(' ')[0];

  return (
    <View style={styles.root}>
      <Confetti />
      <OnboardingScaffold
        primaryLabel="Start tracking"
        onPrimary={finish}
      >
        <View style={styles.center}>
          <PartyPopper size={104} color={colors.ink} strokeWidth={1.6} />
          <Text style={styles.title}>
            {firstName ? `You're all set, ${firstName}` : "You're all set"}
          </Text>
          <Text style={styles.body}>Add transactions anytime — everything updates instantly.</Text>
        </View>
      </OnboardingScaffold>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
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
