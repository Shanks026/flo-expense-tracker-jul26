import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingScreen from '../../../components/OnboardingScreen';
import OnboardingMascot from '../../../components/OnboardingMascot';
import { colors, fontFamily } from '../../../theme/tokens';
import { getIntroNext, getIntroPosition } from '../../../lib/onboarding';

// The waving hey_screen art (not the clipboard) — the clipboard mascot is
// reserved for the actual multiple-choice question screens (age/income/goal/
// leak/habit); this is a rhetorical hook, not a question with answers, so it
// uses the same placeholder art as opener/solution/name for now.
const KOBAN_WAVE = require('../../../assets/mascot/hey_screen.png');

// Screen 2 — the hook. A rhetorical question, no subtitle — the mascot +
// question stand alone, matching the same size/placement as the opener
// (screen 1) and solution (screen 3) so the three "hero, no body content"
// intro screens read as one consistent beat, not three different layouts.
export default function Problem() {
  const router = useRouter();
  const pos = getIntroPosition('problem');

  return (
    <OnboardingScreen
      bg="light"
      progress={pos.index / pos.total}
      hero={<OnboardingMascot image={KOBAN_WAVE} size={200} />}
      title={
        <Text style={styles.titleCenter}>
          Ever reach month-end and wonder… <Text style={styles.emphasis}>where did it all go?</Text>
        </Text>
      }
      titleSize={26}
      primaryLabel="Yeah, That's me"
      onPrimary={() => router.replace(getIntroNext('problem'))}
    />
  );
}

const styles = StyleSheet.create({
  titleCenter: {
    textAlign: 'center',
  },
  emphasis: {
    fontFamily: fontFamily.extrabold,
    color: colors.income,
  },
});
