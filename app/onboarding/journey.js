import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingScreen from '../../components/OnboardingScreen';
import { colors, fontFamily } from '../../theme/tokens';
import { getNextRoute, getStepPosition } from '../../lib/onboarding';
import useProfile from '../../hooks/useProfile';

// 12-personal-onboarding.md Phase 3, screen 20 — short and punchy, NOT a
// timeline. The "where you are / where you're going / how FLO gets you there"
// framing from planning was context for understanding the goal, never meant
// to become three beats of screen content — one forward-looking line does the
// same job in a fraction of the words. Ties back to the goal answer (the
// honesty contract's one remaining "frames the journey screen" obligation —
// read from the now-flushed profiles.onboarding_answers, not the draft).
//
// Merged with the former standalone "free" screen (2026-07-15, user's call —
// one less screen) — the goal payoff and the "it's free" reassurance are one
// beat now, not two. Subtitle carries the free.js reassurance line;
// free.js/the `free` STEPS entry are both removed.
const GOAL_PHRASE = {
  see_where: 'know exactly where every rupee goes',
  stop_overspending: 'stop overspending, one entry at a time',
  save_goal: 'start saving without even trying',
  feel_control: 'feel in control of your money',
};
const DEFAULT_PHRASE = 'build a habit that changes how money feels';

export default function OnboardingJourney() {
  const router = useRouter();
  const { profile } = useProfile();
  const pos = getStepPosition('journey');
  const next = getNextRoute('journey');

  const firstName = (profile?.full_name ?? '').trim().split(' ')[0];
  const phrase = GOAL_PHRASE[profile?.onboarding_answers?.goal] ?? DEFAULT_PHRASE;

  return (
    <OnboardingScreen
      bg="light"
      progress={pos ? pos.index / pos.total : undefined}
      arrowMotif="bottom"
      title={
        <>
          You're about to <Text style={styles.emphasis}>{phrase}</Text>.{' '}
          <Text style={styles.emphasis}>For free</Text>
          {firstName ? `, ${firstName}` : ''}.
        </>
      }
      titleSize={28}
      subtitle="No card to start. No catch."
      primaryLabel="Almost there"
      onPrimary={() => router.replace(next)}
    />
  );
}

const styles = StyleSheet.create({
  emphasis: {
    fontFamily: fontFamily.extrabold,
    color: colors.income,
  },
});
