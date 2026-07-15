import { useState } from 'react';
import { useRouter } from 'expo-router';
import OnboardingScreen from '../../components/OnboardingScreen';
import ChoiceList from '../../components/OnboardingChoice';
import { getNextRoute, getStepPosition } from '../../lib/onboarding';
import { setReportSettings } from '../../lib/reports';

// 12-personal-onboarding.md Phase 2, screen 18 — cadence only. Deliberately no
// preview graph card here (revision note removed the design's black card with
// a chart) — three plain choice cards, matching the other question screens.
//
// Defaults to 'weekly' pre-selected, not read back from getReportSettings() —
// onboarding is inherently a first-run screen, so there is nothing meaningful
// to read yet (a brand-new AsyncStorage key resolves to
// DEFAULT_REPORT_SETTINGS.cadence, 'off', which was silently overriding the
// intended 'weekly' pre-selection a beat after mount). The user still picks
// explicitly before Continue.
const OPTIONS = [
  { key: 'weekly', label: 'Every week', hint: 'A Monday recap of your week' },
  { key: 'monthly', label: 'Once a month', hint: 'The big picture, first of each month' },
  { key: 'off', label: 'I’ll check it myself', hint: 'No schedule, open it anytime from the menu' },
];

export default function OnboardingReports() {
  const router = useRouter();
  const pos = getStepPosition('reports');
  const next = getNextRoute('reports');
  const [cadence, setCadence] = useState('weekly');

  async function handleNext() {
    await setReportSettings({ cadence });
    router.replace(next);
  }

  return (
    <OnboardingScreen
      bg="light"
      progress={pos ? pos.index / pos.total : undefined}
      title="How often do you want a report on where it went?"
      primaryLabel="Continue"
      onPrimary={handleNext}
    >
      <ChoiceList options={OPTIONS} value={cadence} onChange={setCadence} />
    </OnboardingScreen>
  );
}
