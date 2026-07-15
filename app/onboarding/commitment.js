import { useState } from 'react';
import { useRouter } from 'expo-router';
import OnboardingScreen from '../../components/OnboardingScreen';
import ChoiceList from '../../components/OnboardingChoice';
import useProfile from '../../hooks/useProfile';
import { getNextRoute, getStepPosition } from '../../lib/onboarding';

// 12-personal-onboarding.md Phase 3, screen 22 — MCQ cards WITH emojis, light
// bg, matching the other question screens exactly (goal/leak/habit) — not the
// design's big stacked buttons, and not a dark hero either. The title calls
// out that this is the LAST question, so it reads as the end of onboarding
// coming into view rather than one more unlabelled question in the middle of
// the flow. Writes `commitment` into onboarding_answers (merged, not
// overwritten — account.js already flushed age_range/goal/leak_category/
// tracking_habit) which sets Koban's nudge tone (lib/koban.js toneFromCommitment).
const OPTIONS = [
  { key: 'all_in', emoji: '🔥', label: 'All in' },
  { key: 'committed', emoji: '👍', label: 'Pretty committed' },
  { key: 'will_try', emoji: '🌱', label: 'I’ll give it a shot' },
];

export default function OnboardingCommitment() {
  const router = useRouter();
  const { profile, updateProfile } = useProfile();
  const pos = getStepPosition('commitment');
  const next = getNextRoute('commitment');

  const [value, setValue] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleNext() {
    setSaving(true);
    await updateProfile({
      onboarding_answers: { ...(profile?.onboarding_answers ?? {}), commitment: value },
    });
    setSaving(false);
    router.replace(next);
  }

  return (
    <OnboardingScreen
      bg="light"
      progress={pos ? pos.index / pos.total : undefined}
      title="One last question: how committed are you?"
      primaryLabel="Continue"
      primaryDisabled={!value}
      primaryLoading={saving}
      onPrimary={handleNext}
    >
      <ChoiceList options={OPTIONS} value={value} onChange={setValue} />
    </OnboardingScreen>
  );
}
