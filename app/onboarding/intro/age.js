import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import OnboardingScreen from '../../../components/OnboardingScreen';
import ChoiceList from '../../../components/OnboardingChoice';
import { getIntroNext, getIntroPosition } from '../../../lib/onboarding';
import { getDraft, setDraftAnswer } from '../../../lib/onboardingDraft';

// Screen 5 — age. Redesigned as engaging full-width stacked cards (the plain
// 2x2 grid was rejected). Drives which aha-stat variant shows next; stored for
// later callbacks.
const OPTIONS = [
  { key: '18-24', emoji: '🌱', label: '18 – 24', hint: 'Just getting started' },
  { key: '25-34', emoji: '🚀', label: '25 – 34', hint: 'Finding my feet' },
  { key: '35-44', emoji: '⚖️', label: '35 – 44', hint: 'Juggling a lot' },
  { key: '45+', emoji: '🎯', label: '45 and up', hint: 'Playing the long game' },
];

export default function Age() {
  const router = useRouter();
  const pos = getIntroPosition('age');
  const [value, setValue] = useState(null);

  useEffect(() => {
    getDraft().then((d) => d.age_range && setValue(d.age_range));
  }, []);

  async function handleNext() {
    await setDraftAnswer('age_range', value);
    router.replace(getIntroNext('age'));
  }

  return (
    <OnboardingScreen
      bg="light"
      progress={pos.index / pos.total}
      title="Which of these is you?"
      primaryLabel="Continue"
      primaryDisabled={!value}
      onPrimary={handleNext}
    >
      <ChoiceList options={OPTIONS} value={value} onChange={setValue} />
    </OnboardingScreen>
  );
}
