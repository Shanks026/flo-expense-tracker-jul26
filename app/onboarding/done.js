import { View } from 'react-native';
import Confetti from '../../components/Confetti';
import OnboardingScreen from '../../components/OnboardingScreen';
import { useAuth } from '../../lib/AuthContext';
import useProfile from '../../hooks/useProfile';
import { useOnboarding } from '../../lib/onboarding';

// 12-personal-onboarding.md Phase 3, screen 23 — the new "you're all set"
// screen, replacing 07's version. Full-bleed brand lime (a hero, no progress
// bar). Matches the design's actual treatment: a big two-line stacked
// headline (52px) and Confetti only — no PartyPopper icon, which isn't part
// of the design and was cut per explicit feedback. finish() writes
// onboarded_at and clears the draft, and deliberately does NOT navigate — the
// gate moves the user once the refetched profile says onboarded (07 fix #14);
// re-introducing an imperative router call here would reopen that exact bug.
export default function OnboardingDone() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const { finish, working } = useOnboarding();

  const fullName = profile?.full_name ?? session?.user?.user_metadata?.full_name ?? '';
  const firstName = fullName.trim().split(' ')[0];

  return (
    <View style={{ flex: 1 }}>
      <OnboardingScreen
        bg="brand"
        title={firstName ? `You're set,\n${firstName}.` : "You're set."}
        titleSize={46}
        subtitle="Two minutes a day. That's the whole trick."
        primaryLabel="Go to my money"
        onPrimary={finish}
        primaryLoading={working}
      />

      {/* AFTER the screen, not before. Its SafeAreaView has an opaque
          background, and among absolutely-positioned siblings the later one
          paints on top — so rendering Confetti first hid it completely behind
          a solid sheet. It's pointerEvents="none", so sitting above the
          button costs nothing. */}
      <Confetti />
    </View>
  );
}
