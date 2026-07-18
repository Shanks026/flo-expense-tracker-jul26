import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import OnboardingScreen from '../../components/OnboardingScreen';
import { CATEGORY_COLORS } from '../../components/CategoryIcon';
import { useToast } from '../../components/Toast';
import { colors, radii, spacing, fontFamily, fontSize } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import { useAccount } from '../../lib/AccountContext';
import { useDataRefresh } from '../../lib/DataRefreshContext';
import useProfile from '../../hooks/useProfile';
import { getNextRoute, getStepPosition } from '../../lib/onboarding';
import { getDraft, pickDurableAnswers } from '../../lib/onboardingDraft';

export default function OnboardingAccount() {
  const router = useRouter();
  const { activeAccount, activeAccountId } = useAccount();
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();
  const { profile, updateProfile } = useProfile();

  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  // handle_new_user already created a "Personal" account — this screen renames
  // that row, it does not create one. AccountContext resolves it a beat after
  // mount, so seed the fields once it lands, and don't clobber anything the
  // user has already typed if it resolves late.
  useEffect(() => {
    if (!activeAccount || touched) return;
    setName(activeAccount.name ?? '');
    setColor(activeAccount.color ?? CATEGORY_COLORS[0]);
  }, [activeAccount, touched]);

  // Entry point to Act 2 — flush the durable pre-auth draft answers into
  // profiles.onboarding_answers once, guarded on the column still being null
  // so a re-mount (or a user who arrived here from Settings' Replay onboarding,
  // with no draft at all) never overwrites an already-set value.
  useEffect(() => {
    if (!profile || profile.onboarding_answers) return;
    getDraft().then((draft) => {
      const durable = pickDurableAnswers(draft);
      if (Object.keys(durable).length) updateProfile({ onboarding_answers: durable });
    });
  }, [profile]);

  const pos = getStepPosition('account');
  const next = getNextRoute('account');

  async function handleSave() {
    if (!activeAccountId) return;
    setSaving(true);

    // UPDATE, never INSERT — an insert here would leave the user with two
    // accounts on day one.
    const { error } = await supabase
      .from('accounts')
      .update({ name: name.trim(), color })
      .eq('id', activeAccountId);

    setSaving(false);
    if (error) {
      showToast({ message: error.message, variant: 'error' });
      return;
    }
    notifyChanged();
    router.replace(next);
  }

  // No more full-screen spinner-then-swap here — that's what read as a
  // flicker (a blank/spinner frame, then the real screen popping in a beat
  // later, right as OnboardingReveal's own entrance animation should be
  // the only thing moving). Render the real screen immediately with its
  // default field values; the account-resolved useEffect above fills in
  // the real name/color a moment later if `loading` was ever true, which
  // in practice resolves fast enough to be invisible. `primaryDisabled`
  // covers the one real risk this removes protection for — tapping
  // Continue before activeAccountId has resolved.
  return (
    <OnboardingScreen
      bg="light"
      progress={pos ? pos.index / pos.total : undefined}
      title="Name your account"
      subtitle="Track separate spaces later, like Personal or Business. Start with one."
      primaryLabel="Continue"
      onPrimary={handleSave}
      primaryDisabled={!name.trim() || !activeAccountId}
      primaryLoading={saving}
      secondaryLabel="Keep as Personal"
      onSecondary={() => router.replace(next)}
    >
      <Text style={styles.label}>Account name</Text>
      <TextInput
        value={name}
        onChangeText={(text) => {
          setTouched(true);
          setName(text);
        }}
        placeholder="Personal"
        placeholderTextColor={colors.mutedLight}
        autoCapitalize="words"
        style={styles.input}
      />

      <Text style={[styles.label, styles.labelSpaced]}>Pick a colour</Text>
      <View style={styles.swatches}>
        {CATEGORY_COLORS.map((swatch) => {
          const selected = swatch === color;
          return (
            <Pressable
              key={swatch}
              onPress={() => {
                setTouched(true);
                setColor(swatch);
              }}
              style={[styles.swatch, { backgroundColor: swatch }, selected && styles.swatchSelected]}
            >
              {selected && <Check size={18} color={colors.surface} strokeWidth={3} />}
            </Pressable>
          );
        })}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: colors.mutedDarker,
    marginBottom: spacing.sm,
  },
  labelSpaced: {
    marginTop: spacing.xxl,
  },
  input: {
    height: 64,
    borderRadius: radii.button,
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    paddingHorizontal: spacing.lg,
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.display,
    color: colors.ink,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    borderWidth: 2.5,
    borderColor: colors.ink,
  },
});
