import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Wallet, Target, Zap } from 'lucide-react-native';
import OnboardingScaffold from '../../components/OnboardingScaffold';
import { colors, radii, spacing, fontFamily, fontSize } from '../../theme/tokens';
import { getNextRoute, useOnboarding } from '../../lib/onboarding';

// The design's three feature rows sold balance / budgets / plans. Plans has
// since been demoted from a tab to the menu sheet, and the app's strongest
// feature — auto-detecting bank and UPI transactions — didn't exist when that
// design was drawn. These three are what the app actually leads with now.
//
// The auto-detect row is a promise Phase 3 has to keep. If that step is ever
// cut, this row goes with it.
const FEATURES = [
  { icon: Wallet, title: 'In-hand balance', body: 'Always up to date' },
  { icon: Target, title: 'Budgets & bills', body: 'Get warned before you overspend' },
  { icon: Zap, title: 'Auto-detect', body: 'FLO reads bank alerts and offers to log them' },
];

export default function OnboardingWelcome() {
  const router = useRouter();
  const { finish } = useOnboarding();

  return (
    <OnboardingScaffold
      title="Welcome to FLO"
      subtitle="Know where your money flows."
      primaryLabel="Get Started"
      onPrimary={() => router.replace(getNextRoute('welcome'))}
      secondaryLabel="Skip intro"
      onSecondary={finish}
    >
      <View style={styles.features}>
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <View key={title} style={styles.row}>
            <View style={styles.tile}>
              <Icon size={24} color={colors.incomeAccent} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{title}</Text>
              <Text style={styles.rowBody}>{body}</Text>
            </View>
          </View>
        ))}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  features: {
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  tile: {
    width: 50,
    height: 50,
    borderRadius: radii.iconTileLg,
    backgroundColor: colors.incomeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: colors.ink,
  },
  rowBody: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    color: colors.muted,
    marginTop: 2,
  },
});
