import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingScreen from '../../../components/OnboardingScreen';
import { colors, fontFamily } from '../../../theme/tokens';
import { getIntroNext, getIntroPosition } from '../../../lib/onboarding';

// Screen 3 — the promise. "2 minutes a day" gets a marker-style highlight
// (pale-lime background behind deep-lime extrabold text) — decoration, not an
// underline: it must never read as a tappable link. Rendered via `title` (not
// a bespoke headline) so it shares the same titleSize as every other
// "text + subtitle only" hero screen in the intro.
export default function Solution() {
  const router = useRouter();
  const pos = getIntroPosition('solution');

  return (
    <OnboardingScreen
      bg="light"
      progress={pos.index / pos.total}
      arrowMotif="bottom"
      title={
        <>
          All it takes is <Text style={styles.mark}> 2 minutes a day </Text> to know where your money
          goes.
        </>
      }
      titleSize={28}
      primaryLabel="Show me"
      onPrimary={() => router.replace(getIntroNext('solution'))}
    />
  );
}

const styles = StyleSheet.create({
  mark: {
    fontFamily: fontFamily.extrabold,
    color: colors.income,
    backgroundColor: colors.incomeBg,
  },
});
