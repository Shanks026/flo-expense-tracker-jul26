import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import OnboardingScreen from '../../../components/OnboardingScreen';
import ChoiceList from '../../../components/OnboardingChoice';
import { getIntroNext, getIntroPosition } from '../../../lib/onboarding';
import { getDraft, setDraftAnswer } from '../../../lib/onboardingDraft';

// Screen 5b — gender. Its ONLY job is to personalise the aha-stat line two
// screens later (stat.js) — an empowering, gender-specific note. Like income,
// it is used in-session and NEVER persisted (the Phase 2 flush whitelists the
// durable keys and omits it); a sensitive attribute we use once shouldn't be
// stored, especially right after telling the user we don't keep personal info.
//
// No emojis here (deliberately — unlike the other MCQ screens): gendered emoji
// read as clinical or risk mis-rendering, and there's no warm, unambiguous set.
// "Prefer not to say" is a real opt-out — it configures nothing, and stat.js
// falls back to the age-only line for it (never a dead end).
const OPTIONS = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'transgender', label: 'Transgender' },
  { key: 'prefer_not', label: 'Prefer not to say' },
];

export default function Gender() {
  const router = useRouter();
  const pos = getIntroPosition('gender');
  const [value, setValue] = useState(null);

  useEffect(() => {
    getDraft().then((d) => d.gender && setValue(d.gender));
  }, []);

  async function handleNext() {
    await setDraftAnswer('gender', value);
    router.replace(getIntroNext('gender'));
  }

  return (
    <OnboardingScreen
      bg="light"
      progress={pos.index / pos.total}
      title="How do you identify?"
      subtitle="Just so the next bit lands right for you. We don't store this."
      primaryLabel="Continue"
      primaryDisabled={!value}
      onPrimary={handleNext}
    >
      <ChoiceList options={OPTIONS} value={value} onChange={setValue} />
    </OnboardingScreen>
  );
}
