import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import OnboardingScreen from '../../../components/OnboardingScreen';
import OnboardingMascot from '../../../components/OnboardingMascot';
import ChoiceList from '../../../components/OnboardingChoice';
import { colors, radii, spacing, fontFamily, fontSize } from '../../../theme/tokens';
import { getIntroNext, getIntroPosition } from '../../../lib/onboarding';
import { getDraft, setDraftAnswer } from '../../../lib/onboardingDraft';

const KOBAN_CLIPBOARD = require('../../../assets/mascot/waht_would_screen.png');

// Screen 6 — income band. Sizes the first budget (Act 2) AND is now persisted
// to profiles.onboarding_answers for later personalisation/analytics (decision
// 2026-07-22, reversing the earlier "never stored" call). It's a coarse BAND,
// not an exact figure, in the user's own RLS-protected row — low sensitivity,
// far less than the transaction ledger already stored. The badge copy below no
// longer claims "we never store this" (it would be a lie now); it reassures
// without over-claiming. `income_band` is in DURABLE_KEYS (lib/onboardingDraft.js).
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
      scrollable
      hero={<OnboardingMascot image={KOBAN_CLIPBOARD} size={200} />}
      title="Roughly how much comes in each month?"
      titleSize={24}
      primaryLabel="Continue"
      primaryDisabled={!value}
      onPrimary={handleNext}
    >
      <View style={styles.badge}>
        <Lock size={14} color={colors.income} strokeWidth={2.5} />
        <Text style={styles.badgeText}>Private to you. Helps size your first budget and tailor your experience.</Text>
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
