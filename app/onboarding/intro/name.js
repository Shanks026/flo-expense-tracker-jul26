import { useEffect, useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingScreen from '../../../components/OnboardingScreen';
import { colors, radii, spacing, fontFamily, fontSize } from '../../../theme/tokens';
import { getIntroNext, getIntroPosition } from '../../../lib/onboarding';
import { getDraft, setDraftAnswer } from '../../../lib/onboardingDraft';

// Screen 4 — name. Feeds signup metadata (Phase 2) → profiles.full_name.
export default function Name() {
  const router = useRouter();
  const pos = getIntroPosition('name');
  const [name, setName] = useState('');

  useEffect(() => {
    getDraft().then((d) => d.name && setName(d.name));
  }, []);

  async function handleNext() {
    await setDraftAnswer('name', name.trim());
    router.replace(getIntroNext('name'));
  }

  return (
    <OnboardingScreen
      bg="light"
      progress={pos.index / pos.total}
      title="First, what should we call you?"
      subtitle="No pressure. You can change it later."
      primaryLabel="Continue"
      primaryDisabled={!name.trim()}
      onPrimary={handleNext}
    >
      <View style={styles.inputRow}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={colors.mutedLight}
          autoCapitalize="words"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => name.trim() && handleNext()}
          style={styles.input}
        />
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    height: 60,
    borderRadius: radii.buttonSm,
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  input: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.display,
    color: colors.ink,
  },
});
