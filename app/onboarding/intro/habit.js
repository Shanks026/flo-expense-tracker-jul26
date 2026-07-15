import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import OnboardingScreen from '../../../components/OnboardingScreen';
import ChoiceList from '../../../components/OnboardingChoice';
import { getIntroNext, getIntroPosition } from '../../../lib/onboarding';
import { getDraft, setDraftAnswer } from '../../../lib/onboardingDraft';

// Screen 11 — current habit. Sets the nightly-reminder default + framing on the
// reminders step (Act 2). Stored durably.
const OPTIONS = [
  { key: 'daily', emoji: '📅', label: 'Every day' },
  { key: 'weekly', emoji: '🗓️', label: 'Once a week-ish' },
  { key: 'when_off', emoji: '👀', label: 'Only when it feels off' },
  { key: 'never', emoji: '😅', label: 'Never, honestly' },
];

export default function Habit() {
  const router = useRouter();
  const pos = getIntroPosition('habit');
  const [value, setValue] = useState(null);

  useEffect(() => {
    getDraft().then((d) => d.tracking_habit && setValue(d.tracking_habit));
  }, []);

  async function handleNext() {
    await setDraftAnswer('tracking_habit', value);
    router.replace(getIntroNext('habit')); // null past reflection, but habit isn't last
  }

  return (
    <OnboardingScreen
      bg="light"
      progress={pos.index / pos.total}
      title="How often do you check your spending today?"
      primaryLabel="Continue"
      primaryDisabled={!value}
      onPrimary={handleNext}
    >
      <ChoiceList options={OPTIONS} value={value} onChange={setValue} />
    </OnboardingScreen>
  );
}
