import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import OnboardingScaffold from '../../components/OnboardingScaffold';
import { CATEGORY_COLORS } from '../../components/CategoryIcon';
import { useToast } from '../../components/Toast';
import { colors, radii, spacing, fontFamily, fontSize } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import { useAccount } from '../../lib/AccountContext';
import { useDataRefresh } from '../../lib/DataRefreshContext';
import { getNextRoute } from '../../lib/onboarding';

export default function OnboardingAccount() {
  const router = useRouter();
  const { activeAccount, activeAccountId, loading } = useAccount();
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();

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
    router.push(next);
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  return (
    <OnboardingScaffold
      stepKey="account"
      title="Name your account"
      subtitle="Track separate spaces later — Personal, Business, Family. Start with one."
      primaryLabel="Continue"
      onPrimary={handleSave}
      primaryDisabled={!name.trim()}
      primaryLoading={saving}
      secondaryLabel="Keep as Personal"
      onSecondary={() => router.push(next)}
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
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
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
