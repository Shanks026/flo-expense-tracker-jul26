import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Check, Lock } from 'lucide-react-native';
import Button from '../components/Button';
import CardThemeSurface from '../components/CardThemeSurface';
import PersonalizePreview from '../components/PersonalizePreview';
import AppearanceToggle from '../components/AppearanceToggle';
import { ColorSwatch } from '../components/ColorPicker';
import { colors as staticColors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../lib/AuthContext';
import useProfile from '../hooks/useProfile';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useToast } from '../components/Toast';
import useCardThemes from '../hooks/useCardThemes';
import { CARD_THEMES, getTheme } from '../lib/cardThemes';
import { ACCENT_LIST, DEFAULT_ACCENT_ID, accentSupportsMode, accentModeLabel, resolveColors } from '../theme/themes';
import { equipTheme } from '../lib/cardThemeMutations';

// Personalize hub — 23-personalize-hub.md Phase 1. Draft-then-commit, like an
// OS wallpaper/theme picker: Appearance, Accent color, and Card design are all
// EXPERIMENTED WITH freely (each tap only updates local draft state and the
// static preview above), and nothing reaches the real active theme or the
// equipped card until the single "Equip" button is pressed. This replaces
// Settings' old always-instant Primary Color + Appearance rows and becomes
// the primary place to switch card designs — the Shop stays the place you
// ACQUIRE cards (coins, prices, buying), this hub is where you EQUIP what you
// already own plus set the two free preferences, together, with one preview.
export default function Personalize() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accentId, modeId, setAccent, setMode, colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useAuth();
  const { updateProfile } = useProfile();
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();
  const { ownedIds, equippedId, loading: cardsLoading } = useCardThemes();

  const [draftAccent, setDraftAccent] = useState(accentId);
  const [draftMode, setDraftMode] = useState(modeId);
  // Starts null (the equipped card comes from an async DB fetch via
  // useCardThemes, unlike accent/mode which are already-hydrated context
  // values by the time this screen is reachable) — synced once, the first
  // time it loads, so a user who hasn't touched the Card design section yet
  // still previews their REAL equipped card, not a hardcoded default.
  const [draftCard, setDraftCard] = useState(null);
  const [equipping, setEquipping] = useState(false);

  useEffect(() => {
    if (!cardsLoading && draftCard === null) setDraftCard(equippedId);
  }, [cardsLoading, equippedId, draftCard]);

  // Mode-lock rule: if the mode being switched TO doesn't support the
  // currently-drafted accent (Ash/Cream are dark-only), snap the draft accent
  // back to the default in the same update — the draft must always be a
  // legible combination, and the accent row's own lock state (below) always
  // matches the mode actually shown in the preview.
  const handleModeChange = useCallback((id) => {
    setDraftMode(id);
    setDraftAccent((current) => (accentSupportsMode(current, id) ? current : DEFAULT_ACCENT_ID));
  }, []);

  const previewColors = useMemo(() => resolveColors(draftAccent, draftMode), [draftAccent, draftMode]);
  const previewCardTheme = useMemo(() => getTheme(draftCard ?? equippedId), [draftCard, equippedId]);

  const ownedThemes = useMemo(() => CARD_THEMES.filter((t) => ownedIds.has(t.id)), [ownedIds]);

  const dirty = draftCard !== null && (draftAccent !== accentId || draftMode !== modeId || draftCard !== equippedId);

  async function handleEquip() {
    setEquipping(true);

    if (draftCard !== equippedId) {
      const { error } = await equipTheme(session?.user?.id, draftCard);
      if (error) {
        setEquipping(false);
        showToast({ message: 'Could not equip theme', variant: 'error' });
        return;
      }
      notifyChanged();
    }

    // Same dual-write shape Settings used to own directly (AsyncStorage-
    // backed local apply via setAccent()/setMode(), plus the durable profile
    // write, `silent` so it doesn't bump useDataRefresh's version and flicker
    // every data hook in the app) — moved here since Equip is now the one
    // moment these fields actually change, not every tap.
    if (draftAccent !== accentId) {
      setAccent(draftAccent);
      const { error } = await updateProfile({ theme_accent: draftAccent }, { silent: true });
      if (error) {
        setEquipping(false);
        showToast({ message: error.message, variant: 'error' });
        return;
      }
    }

    if (draftMode !== modeId) {
      setMode(draftMode);
      const { error } = await updateProfile({ theme_mode: draftMode }, { silent: true });
      if (error) {
        setEquipping(false);
        showToast({ message: error.message, variant: 'error' });
        return;
      }
    }

    setEquipping(false);
    showToast({ message: 'Applied', variant: 'success' });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.headerTitle}>Personalize</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Not pinned (per direct feedback) — a full mini Home clone is a lot
            taller than the Shop's own hero-only preview, so keeping it in
            normal flow leaves the sections below actual room to scroll. */}
        <PersonalizePreview colors={previewColors} cardTheme={previewCardTheme} style={styles.preview} />

        <Text style={styles.sectionLabel}>Appearance</Text>
        <AppearanceToggle value={draftMode} onChange={handleModeChange} style={styles.appearanceToggle} />

        <Text style={styles.sectionLabel}>Accent color</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accentRow}>
          {ACCENT_LIST.map((a) => {
            const supported = accentSupportsMode(a, draftMode);
            const isSelected = draftAccent === a.id;
            const lockLabel = accentModeLabel(a);
            return (
              <Pressable
                key={a.id}
                style={styles.accentOption}
                onPress={() => supported && setDraftAccent(a.id)}
                disabled={!supported}
              >
                <View style={[styles.swatchRing, isSelected && styles.swatchRingActive, !supported && styles.swatchRingLocked]}>
                  <ColorSwatch id={`pz-${a.id}`} accent={a} size={40} />
                  {!supported && (
                    <View style={styles.swatchLockScrim}>
                      <Lock size={13} color="#FFFFFF" strokeWidth={2.6} />
                    </View>
                  )}
                </View>
                <Text style={[styles.accentName, !supported && styles.accentNameLocked]} numberOfLines={1}>
                  {supported ? a.name : lockLabel}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.cardHeaderRow}>
          <Text style={styles.sectionLabel}>Card design</Text>
          <Pressable onPress={() => router.push('/shop')}>
            <Text style={styles.getMoreText}>Get more →</Text>
          </Pressable>
        </View>
        <View style={styles.cardGrid}>
          {ownedThemes.map((t) => {
            const isSelected = draftCard === t.id;
            return (
              <Pressable key={t.id} style={styles.cardTile} onPress={() => setDraftCard(t.id)}>
                <CardThemeSurface theme={t} style={[styles.cardSwatchShape, isSelected && styles.cardSwatchSelected]}>
                  {isSelected && (
                    <View style={styles.cardBadge}>
                      <Check size={11} color={staticColors.ink} strokeWidth={3} />
                    </View>
                  )}
                </CardThemeSurface>
                <Text style={styles.cardName} numberOfLines={1}>
                  {t.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
        <Button title="Equip" onPress={handleEquip} disabled={!dirty} loading={equipping} />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.title,
      letterSpacing: -0.3,
      color: colors.ink,
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      // Extra clearance under the footer Equip button, same reasoning as
      // Shop's floating-bar `scroll` padding.
      paddingBottom: 110,
    },
    // Back inside the scroll's own contentContainerStyle (which already
    // supplies paddingHorizontal) — just needs separation from the section
    // below it.
    preview: {
      marginBottom: spacing.xl,
    },
    sectionLabel: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: spacing.md,
      marginLeft: spacing.xs,
    },
    appearanceToggle: {
      alignSelf: 'flex-start',
      marginBottom: spacing.xl,
    },
    accentRow: {
      gap: spacing.lg,
      paddingBottom: spacing.xl,
      paddingRight: spacing.xs,
    },
    accentOption: {
      alignItems: 'center',
      width: 60,
    },
    swatchRing: {
      padding: 3,
      borderRadius: radii.pill,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    swatchRingActive: {
      borderColor: colors.income,
    },
    swatchRingLocked: {
      opacity: 0.5,
    },
    swatchLockScrim: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: radii.pill,
      backgroundColor: 'rgba(0,0,0,0.38)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    accentName: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.xs,
      color: colors.ink,
      marginTop: 6,
      textAlign: 'center',
    },
    accentNameLocked: {
      color: colors.mutedLight,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    getMoreText: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.sm,
      color: colors.brand,
      marginBottom: spacing.md,
    },
    cardGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    cardTile: {
      width: '30%',
    },
    cardSwatchShape: {
      height: 64,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    cardSwatchSelected: {
      borderColor: colors.brand,
    },
    cardBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 18,
      height: 18,
      borderRadius: radii.pill,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardName: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.sm,
      color: colors.ink,
      marginTop: 6,
    },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
  });
}
