import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SetupQuestion from '../../components/onboarding/SetupQuestion';
import Segmented from '../../components/ledger/Segmented';
import DayOfMonthPicker from '../../components/ledger/DayOfMonthPicker';
import { useToast } from '../../components/Toast';
import { useLedger, ledgerType, ledgerSpace } from '../../theme/ledger';
import { useOnboardingDraft } from '../../lib/OnboardingDraftContext';
import { MONTH_START_CHOICES, monthStartFromProfile, planMonthStart } from '../../lib/setupPlan';
import useProfile from '../../hooks/useProfile';

// Set-up question 2 (spec 47): "When does your month start?" The 1st keeps
// the calendar month; "My salary day" reveals the 1–31 grid and makes Home's
// totals a salary-day month (ticket 05). Next writes the profile through the
// same updateProfile Settings → Summary period uses; Skip leaves monthly.
export default function OnboardingMonthStart() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { profile, loading, updateProfile } = useProfile();
  const { draft, setAnswer } = useOnboardingDraft();
  const { showToast } = useToast();

  // { start, day }, or null until seeded.
  const [answer, setLocalAnswer] = useState(draft.monthStart ?? null);

  // First open this session: seed from the saved profile, so a relaunch
  // mid-flow shows the salary day already chosen.
  useEffect(() => {
    if (answer === null && !loading) setLocalAnswer(monthStartFromProfile(profile));
  }, [answer, loading, profile]);

  useEffect(() => {
    if (answer !== null) setAnswer('monthStart', answer);
  }, [answer, setAnswer]);

  const patch = answer ? planMonthStart(answer) : null;

  async function handleNext() {
    if (!patch) return false;
    const unchanged = Object.entries(patch).every(([k, v]) => profile?.[k] === v);
    if (unchanged) return true;
    const { error } = await updateProfile(patch);
    if (error) {
      showToast({ message: 'Could not save when your month starts', variant: 'error' });
      return false;
    }
    return true;
  }

  return (
    <SetupQuestion
      stepKey="month_start"
      title="When does your month start?"
      note="Home's totals start again on this day"
      nextDisabled={!patch || loading}
      onNext={handleNext}
    >
      <Segmented
        accessibilityLabel="Month starts on"
        options={MONTH_START_CHOICES}
        value={(answer ?? monthStartFromProfile(null)).start}
        onChange={(start) => setLocalAnswer((a) => ({ ...(a ?? monthStartFromProfile(null)), start }))}
        style={styles.segmented}
      />
      {answer?.start === 'salary_day' && (
        <View style={styles.days}>
          <Text style={styles.label}>Which day does it arrive?</Text>
          <DayOfMonthPicker value={answer.day} onChange={(day) => setLocalAnswer((a) => ({ ...a, day }))} accessibilityLabel="Salary day" />
          <Text style={styles.hint}>
            In a shorter month, a day past its end means its last day.
          </Text>
        </View>
      )}
    </SetupQuestion>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    segmented: {
      marginTop: ledgerSpace.section,
    },
    days: {
      marginTop: ledgerSpace.section,
    },
    label: {
      ...ledgerType.rowTitle,
      color: c.ink,
      marginBottom: ledgerSpace.sm,
    },
    hint: {
      ...ledgerType.caption,
      color: c.muted,
      marginTop: ledgerSpace.md,
    },
  });
}
