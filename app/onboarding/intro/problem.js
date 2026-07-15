import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingScreen from '../../../components/OnboardingScreen';
import { colors, fontFamily } from '../../../theme/tokens';
import { getIntroNext, getIntroPosition } from '../../../lib/onboarding';

// Screen 2 — the hook. A QUESTION first (para 1), then the turn (para 2). Short,
// warm, and never shaming: it blames the medium, not the person.
//
// titleSize is the shared value across every "text + subtitle only" hero
// screen in the intro (problem/solution/ready/journey) — kept literal per
// call site rather than a shared constant so each screen's JSX stays
// self-contained, but the number itself must stay in sync across all four.
export default function Problem() {
  const router = useRouter();
  const pos = getIntroPosition('problem');

  return (
    <OnboardingScreen
      bg="light"
      progress={pos.index / pos.total}
      arrowMotif="top"
      title={
        <>
          Ever reach month-end and wonder… <Text style={styles.emphasis}>where did it all go?</Text>
        </>
      }
      titleSize={36}
      subtitle={
        <>
          You're not bad with money. You just <Text style={styles.subtitleEmphasis}>never had it all in one place</Text>
        </>
      }
      subtitleEmphasis
      primaryLabel="Yeah, That's me"
      onPrimary={() => router.replace(getIntroNext('problem'))}
    />
  );
}

const styles = StyleSheet.create({
  emphasis: {
    fontFamily: fontFamily.extrabold,
    color: colors.income,
  },
  subtitleEmphasis: {
    fontFamily: fontFamily.semibold,
    color: colors.income,
  },
});
