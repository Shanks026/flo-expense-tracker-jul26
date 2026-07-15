import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import OnboardingScreen from '../../../components/OnboardingScreen';
import ChoiceList from '../../../components/OnboardingChoice';
import { colors, radii, spacing, fontFamily, fontSize } from '../../../theme/tokens';
import { getIntroNext, getIntroPosition } from '../../../lib/onboarding';
import { getDraft, setDraftAnswer } from '../../../lib/onboardingDraft';

// Screen 6 — income band. Used ONLY in-session to size the first budget (Act 2).
// Never stored (the "we never store this" badge is literally true — the Phase 2
// flush whitelists the durable keys and omits income_band).
const OPTIONS = [
  { key: 'lt_30k', label: 'Under ₹30k' },
  { key: '30_75k', label: '₹30k – 75k' },
  { key: '75_150k', label: '₹75k – 1.5L' },
  { key: 'gt_150k', label: '₹1.5L and up' },
];

export default function Income() {
  const router = useRouter();
  const pos = getIntroPosition('income');
  const [value, setValue] = useState(null);

  useEffect(() => {
    getDraft().then((d) => d.income_band && setValue(d.income_band));
  }, []);

  async function handleNext() {
    await setDraftAnswer('income_band', value);
    router.replace(getIntroNext('income'));
  }

  return (
    <OnboardingScreen
      bg="light"
      progress={pos.index / pos.total}
      title="Roughly how much comes in each month?"
      primaryLabel="Continue"
      primaryDisabled={!value}
      onPrimary={handleNext}
    >
      <View style={styles.badge}>
        <Lock size={14} color={colors.income} strokeWidth={2.5} />
        <Text style={styles.badgeText}>We never store this. It just helps us size your first budget.</Text>
      </View>
      <ChoiceList options={OPTIONS} value={value} onChange={setValue} />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.incomeBg,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  badgeText: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.income,
  },
});
