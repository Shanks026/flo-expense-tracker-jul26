import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingScreen from '../../../components/OnboardingScreen';
import OnboardingMascot from '../../../components/OnboardingMascot';
import { colors, fontFamily } from '../../../theme/tokens';
import { getIntroNext, getIntroPosition } from '../../../lib/onboarding';

const KOBAN_WAVE = require('../../../assets/mascot/hey_screen.png');

// Screen 3 — the promise. The payoff clause is a plain colour change now (no
// marker-style background pill) — same mascot size/placement as opener and
// problem so all three "hero, no body content" intro screens read as one beat.
export default function Solution() {
  const router = useRouter();
  const pos = getIntroPosition('solution');

  return (
    <OnboardingScreen
      bg="light"
      progress={pos.index / pos.total}
      hero={<OnboardingMascot image={KOBAN_WAVE} size={200} />}
      title={
        <Text style={styles.titleCenter}>
          Let's find out together.{'\n'}All it takes is just 2 minutes a day to{' '}
          <Text style={styles.mark}>know where your money goes</Text>.
        </Text>
      }
      titleSize={22}
      primaryLabel="Show me"
      onPrimary={() => router.replace(getIntroNext('solution'))}
    />
  );
}

const styles = StyleSheet.create({
  titleCenter: {
    textAlign: 'center',
  },
  mark: {
    fontFamily: fontFamily.extrabold,
    color: colors.income,
  },
});
