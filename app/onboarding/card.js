import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import SetupQuestion from '../../components/onboarding/SetupQuestion';
import AccountCardCarousel from '../../components/ledger/AccountCardCarousel';
import CardThemeSurface from '../../components/CardThemeSurface';
import { useToast } from '../../components/Toast';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius } from '../../theme/ledger';
import { useAuth } from '../../lib/AuthContext';
import { useAccount } from '../../lib/AccountContext';
import { useDataRefresh } from '../../lib/DataRefreshContext';
import { useOnboardingDraft } from '../../lib/OnboardingDraftContext';
import { CARD_THEMES, resolveEquippedTheme } from '../../lib/cardThemes';
import { equipTheme } from '../../lib/cardThemeMutations';
import { cardChoices } from '../../lib/setupPlan';
import useCardThemes from '../../hooks/useCardThemes';

const noop = () => {};

// Set-up question 4 (spec 47): "Pick your card". Home's card, with the
// person's first account, previews the pick above a two-column grid of the
// designs Cards offers (Day first, then seasonal skins). Next equips it
// through Cards' own write; Skip leaves the default, which shows Day.
// Left out of the flow with FLAGS.themes off (lib/onboarding.js).
export default function OnboardingCard() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { session } = useAuth();
  const { accounts, activeAccount } = useAccount();
  const { ownedIds, equippedId, loading } = useCardThemes();
  const { notifyChanged } = useDataRefresh();
  const { draft, setAnswer } = useOnboardingDraft();
  const { showToast } = useToast();

  const [picked, setPicked] = useState(draft.card ?? null);

  // First open this session: start on the saved card (Day for a new account).
  useEffect(() => {
    if (picked === null && !loading) setPicked(equippedId);
  }, [picked, loading, equippedId]);

  useEffect(() => {
    if (picked !== null) setAnswer('card', picked);
  }, [picked, setAnswer]);

  const choices = useMemo(() => cardChoices(CARD_THEMES.filter((t) => ownedIds.has(t.id))), [ownedIds]);
  const previewTheme = useMemo(() => resolveEquippedTheme(picked ?? equippedId), [picked, equippedId]);
  const previewAccount = activeAccount ?? accounts[0];

  async function handleNext() {
    if (!picked || picked === equippedId) return true;
    const { error } = await equipTheme(session?.user?.id, picked);
    if (error) {
      showToast({ message: 'Could not save your card', variant: 'error' });
      return false;
    }
    notifyChanged();
    return true;
  }

  return (
    <SetupQuestion
      stepKey="card"
      title="Pick your card"
      nextDisabled={loading}
      onNext={handleNext}
      pinned={
        <View style={styles.preview}>
          <AccountCardCarousel
            accounts={previewAccount ? [previewAccount] : []}
            activeAccountId={previewAccount?.id ?? null}
            onSwitchAccount={noop}
            cardTheme={previewTheme}
            loading={!previewAccount}
          />
        </View>
      }
    >
      <View style={styles.grid}>
        {choices.map((t) => {
          const selected = picked === t.id;
          return (
            <Pressable
              key={t.id}
              style={styles.tile}
              onPress={() => setPicked(t.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t.name}
            >
              <CardThemeSurface theme={t} animate={false} style={[styles.swatch, selected && styles.swatchSelected]}>
                {selected && (
                  <View style={styles.badge}>
                    <Check size={12} color={c.canvas} strokeWidth={3} />
                  </View>
                )}
              </CardThemeSurface>
              <Text style={[ledgerType.caption, styles.name]} numberOfLines={1}>
                {t.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SetupQuestion>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    preview: {
      marginTop: ledgerSpace.lg,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: ledgerSpace.lg,
      paddingTop: ledgerSpace.sm,
    },
    tile: {
      width: '48%',
    },
    swatch: {
      aspectRatio: 2,
      borderRadius: ledgerRadius.input,
      borderWidth: 2,
      borderColor: c.hairline,
    },
    swatchSelected: {
      borderColor: c.ink,
    },
    badge: {
      position: 'absolute',
      top: ledgerSpace.sm,
      right: ledgerSpace.sm,
      width: 20,
      height: 20,
      borderRadius: ledgerRadius.full,
      backgroundColor: c.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      color: c.ink,
      marginTop: ledgerSpace.xs,
    },
  });
}
