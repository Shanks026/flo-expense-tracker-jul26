import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import OnboardingScreen from '../../../components/OnboardingScreen';
import ChoiceList from '../../../components/OnboardingChoice';
import { getIntroNext, getIntroPosition } from '../../../lib/onboarding';
import { getDraft, setDraftAnswer } from '../../../lib/onboardingDraft';

// Screen 10 — the leak. Pre-creates a real budget in this category (Act 2). The
// most consequential question in the intro, so it should feel like one.
const OPTIONS = [
  { key: 'food', emoji: '🍔', label: 'Food & eating out' },
  { key: 'shopping', emoji: '🛍️', label: 'Shopping' },
  { key: 'subscriptions', emoji: '🔁', label: 'Subscriptions' },
  { key: 'dont_know', emoji: '🤷', label: 'I honestly don’t know' },
];

export default function Leak() {
  const router = useRouter();
  const pos = getIntroPosition('leak');
  const [value, setValue] = useState(null);

  useEffect(() => {
    getDraft().then((d) => d.leak_category && setValue(d.leak_category));
  }, []);

  async function handleNext() {
    await setDraftAnswer('leak_category', value);
    router.replace(getIntroNext('leak'));
  }

  return (
    <OnboardingScreen
      bg="light"
      progress={pos.index / pos.total}
      title="Where do you think your money quietly leaks?"
      primaryLabel="Continue"
      primaryDisabled={!value}
      onPrimary={handleNext}
    >
      <ChoiceList options={OPTIONS} value={value} onChange={setValue} />
    </OnboardingScreen>
  );
}
