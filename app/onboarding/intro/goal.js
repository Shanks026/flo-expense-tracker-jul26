import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import OnboardingScreen from '../../../components/OnboardingScreen';
import OnboardingMascot from '../../../components/OnboardingMascot';
import ChoiceList from '../../../components/OnboardingChoice';
import { getIntroNext, getIntroPosition } from '../../../lib/onboarding';
import { getDraft, setDraftAnswer } from '../../../lib/onboardingDraft';

const KOBAN_FEEL_LIKE_WIN = require('../../../assets/mascot/feel-like-win.png');

// Screen 9 — the goal. Frames the streak explainer, the journey screen (Act 3),
// and later callbacks. Stored durably.
const OPTIONS = [
  { key: 'see_where', emoji: '🔍', label: 'Finally see where it goes' },
  { key: 'stop_overspending', emoji: '🛑', label: 'Stop overspending' },
  { key: 'save_goal', emoji: '🎯', label: 'Save for something' },
  { key: 'feel_control', emoji: '🧘', label: 'Just feel in control' },
];

export default function Goal() {
  const router = useRouter();
  const pos = getIntroPosition('goal');
  const [value, setValue] = useState(null);

  useEffect(() => {
    getDraft().then((d) => d.goal && setValue(d.goal));
  }, []);

  async function handleNext() {
    await setDraftAnswer('goal', value);
    router.replace(getIntroNext('goal'));
  }

  return (
    <OnboardingScreen
      bg="light"
      progress={pos.index / pos.total}
      scrollable
      hero={<OnboardingMascot image={KOBAN_FEEL_LIKE_WIN} size={195} />}
      title="What would feel like a win for you?"
      titleSize={24}
      primaryLabel="Continue"
      primaryDisabled={!value}
      onPrimary={handleNext}
    >
      <ChoiceList options={OPTIONS} value={value} onChange={setValue} />
    </OnboardingScreen>
  );
}
