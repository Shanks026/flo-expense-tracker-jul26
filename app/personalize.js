import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated } from 'react-native';
import { Redirect } from 'expo-router';
import { Check, Lock } from 'lucide-react-native';
import ScreenHeader, { LargeTitle, useHeaderScroll } from '../components/ledger/ScreenHeader';
import SectionHeader from '../components/ledger/SectionHeader';
import PinnedFooter, { PINNED_FOOTER_HEIGHT } from '../components/ledger/PinnedFooter';
import { AccountCardFace, CARD_ASPECT } from '../components/ledger/AccountCardCarousel';
import CardThemeSurface from '../components/CardThemeSurface';
import { ColorSwatch } from '../components/ColorPicker';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius } from '../theme/ledger';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../lib/AuthContext';
import { useAccount } from '../lib/AccountContext';
import useProfile from '../hooks/useProfile';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useToast } from '../components/Toast';
import useCardThemes from '../hooks/useCardThemes';
import { CARD_THEMES, resolveEquippedTheme } from '../lib/cardThemes';
import { cardSections } from '../lib/cardSections';
import { ACCENT_LIST, DEFAULT_ACCENT_ID, accentSupportsMode, accentModeLabel } from '../theme/themes';
import { equipTheme } from '../lib/cardThemeMutations';
import { FLAGS } from '../lib/flags';

// Cards (was Personalize; 23-personalize-hub.md, on the ledger kit since spec
// 49, ticket 08). Draft-then-Equip, like an OS wallpaper picker: tapping a
// design only changes the large preview, and nothing reaches Home until
// Equip. The preview is Home's own card face with the active account's name
// and last 4, so it shows exactly what Home will. Seasonal designs come
// first, then every other one under All cards (lib/cardSections.js).
// The route stays /personalize (spec 49) so old links keep working.
// Themes flagged off (lib/flags.js, spec 43): a deep link here lands on Home.
export default function Cards() {
  if (!FLAGS.themes) return <Redirect href="/" />;
  return <CardsScreen />;
}

function CardsScreen() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { scrollY, onScroll } = useHeaderScroll();
  const { accentId, setAccent, modeId } = useTheme();
  const { session } = useAuth();
  const { activeAccount } = useAccount();
  const { updateProfile } = useProfile();
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();
  const { ownedIds, equippedId, loading: cardsLoading } = useCardThemes();

  const [draftAccent, setDraftAccent] = useState(accentId);
  // Starts null: the equipped card comes from an async fetch, so the draft
  // syncs to it once it loads and the preview shows the real equipped card.
  const [draftCard, setDraftCard] = useState(null);
  const [equipping, setEquipping] = useState(false);

  useEffect(() => {
    if (!cardsLoading && draftCard === null) setDraftCard(equippedId);
  }, [cardsLoading, equippedId, draftCard]);

  // Mode-lock rule (accents only): a drafted accent the mode doesn't support
  // snaps back to the default.
  useEffect(() => {
    setDraftAccent((current) => (accentSupportsMode(current, modeId) ? current : DEFAULT_ACCENT_ID));
  }, [modeId]);

  const previewTheme = useMemo(() => resolveEquippedTheme(draftCard ?? equippedId), [draftCard, equippedId]);
  // Locks follow whichever flag makes ownership real: useCardThemes reads
  // owned themes only while gating (or the economy) is on, else owns all.
  const sections = useMemo(
    () => cardSections(CARD_THEMES, { economy: FLAGS.economy || FLAGS.themeGating, ownedIds }),
    [ownedIds],
  );

  // The card just equipped, until useCardThemes refetches it, so Equip is
  // disabled at once instead of a second later.
  const [justEquipped, setJustEquipped] = useState(null);
  useEffect(() => setJustEquipped(null), [equippedId]);
  const currentCard = justEquipped ?? equippedId;

  const dirty = draftCard !== null && (draftAccent !== accentId || draftCard !== currentCard);

  async function handleEquip() {
    setEquipping(true);

    // The accent first, `silent` so it doesn't bump useDataRefresh's version:
    // it has to land before the card's notifyChanged() below, or
    // ThemeProfileSync's refetch could put the old theme_accent back (spec 43).
    // FLAGS.accents off (spec 46): never write theme_accent.
    if (FLAGS.accents && draftAccent !== accentId) {
      setAccent(draftAccent);
      const { error } = await updateProfile({ theme_accent: draftAccent }, { silent: true });
      if (error) {
        setEquipping(false);
        showToast({ message: error.message, variant: 'error' });
        return;
      }
    }

    if (draftCard !== equippedId) {
      const { error } = await equipTheme(session?.user?.id, draftCard);
      if (error) {
        setEquipping(false);
        showToast({ message: 'Could not equip theme', variant: 'error' });
        return;
      }
      setJustEquipped(draftCard);
      notifyChanged();
    }

    setEquipping(false);
    showToast({ message: 'Applied', variant: 'success' });
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Cards" scrollY={scrollY} />
      <Animated.ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <LargeTitle title="Cards" scrollY={scrollY} />

        {cardsLoading || draftCard === null ? (
          <View style={styles.previewSkeleton} />
        ) : (
          // Keyed by design so a seasonal scene mounts fresh and plays once.
          <AccountCardFace
            key={previewTheme.id}
            theme={previewTheme}
            name={activeAccount?.name ?? 'Account'}
            last4={activeAccount?.last4}
            animate
          />
        )}

        {/* FLAGS.accents off (spec 46): no swatches. */}
        {FLAGS.accents && (
          <View style={styles.section}>
            <SectionHeader title="Accent colour" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accentRow}>
              {ACCENT_LIST.map((a) => {
                const supported = accentSupportsMode(a, modeId);
                const isSelected = draftAccent === a.id;
                return (
                  <Pressable
                    key={a.id}
                    style={styles.accentOption}
                    onPress={() => supported && setDraftAccent(a.id)}
                    disabled={!supported}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected, disabled: !supported }}
                  >
                    <View style={[styles.accentRing, isSelected && styles.picked, !supported && styles.lockedFade]}>
                      <ColorSwatch id={`cards-${a.id}`} accent={a} size={40} />
                    </View>
                    <Text style={[styles.accentName, !supported && styles.mutedText]} numberOfLines={1}>
                      {supported ? a.name : accentModeLabel(a)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {sections.map((section) => (
          <View key={section.key} style={styles.section}>
            <SectionHeader title={section.title} />
            {pairs(section.themes).map((row) => (
              <View key={row.map((t) => t.id).join('-')} style={styles.gridRow}>
                {row.map((t) => (
                  <Swatch key={t.id} theme={t} selected={draftCard === t.id} onPress={() => setDraftCard(t.id)} styles={styles} />
                ))}
                {row.length === 1 && <View style={styles.tile} />}
              </View>
            ))}
          </View>
        ))}
      </Animated.ScrollView>

      <PinnedFooter primary={{ title: 'Equip', onPress: handleEquip, disabled: !dirty, loading: equipping }} />
    </View>
  );
}

function Swatch({ theme, selected, onPress, styles }) {
  const { c } = useLedger();
  return (
    <Pressable
      style={styles.tile}
      onPress={onPress}
      disabled={theme.locked}
      accessibilityRole="button"
      accessibilityLabel={theme.locked ? `${theme.name}, locked` : theme.name}
      accessibilityState={{ selected, disabled: theme.locked }}
    >
      <View style={[styles.ring, selected && styles.picked]}>
        <CardThemeSurface theme={theme} style={[styles.swatch, theme.locked && styles.lockedFade]}>
          {selected && (
            <View style={[styles.badge, styles.badgePicked]}>
              <Check size={12} color={c.inkOnInk} strokeWidth={3} />
            </View>
          )}
          {theme.locked && (
            <View style={[styles.badge, styles.badgeLocked]}>
              <Lock size={11} color={c.muted} strokeWidth={2.5} />
            </View>
          )}
        </CardThemeSurface>
      </View>
      <Text style={[styles.name, theme.locked && styles.mutedText]} numberOfLines={1}>
        {theme.name}
      </Text>
    </Pressable>
  );
}

// Two swatches a row; an odd last one keeps its half width.
function pairs(list) {
  const rows = [];
  for (let i = 0; i < list.length; i += 2) rows.push(list.slice(i, i + 2));
  return rows;
}

const RING = 2;
const RING_GAP = 2;

function makeStyles(c) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.canvas,
    },
    flex: {
      flex: 1,
    },
    scroll: {
      paddingHorizontal: ledgerSpace.gutter,
      paddingBottom: PINNED_FOOTER_HEIGHT + ledgerSpace.section * 2,
    },
    previewSkeleton: {
      aspectRatio: CARD_ASPECT,
      borderRadius: ledgerRadius.card,
      backgroundColor: c.surfaceSunk,
    },
    section: {
      marginTop: ledgerSpace.section,
    },
    gridRow: {
      flexDirection: 'row',
      gap: ledgerSpace.md,
      marginBottom: ledgerSpace.lg,
    },
    tile: {
      flex: 1,
    },
    // The 2 dp ink ring sits just outside the swatch, so picking one doesn't
    // shrink its art.
    ring: {
      borderWidth: RING,
      borderColor: 'transparent',
      borderRadius: ledgerRadius.input + RING + RING_GAP,
      padding: RING_GAP,
    },
    // A hairline edge so a dark design (Ink) still reads on the dark canvas.
    swatch: {
      aspectRatio: CARD_ASPECT,
      borderRadius: ledgerRadius.input,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
    },
    badge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 20,
      height: 20,
      borderRadius: ledgerRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    picked: {
      borderColor: c.ink,
    },
    badgePicked: {
      backgroundColor: c.ink,
    },
    badgeLocked: {
      backgroundColor: c.surfaceSunk,
    },
    mutedText: {
      color: c.muted,
    },
    accentName: {
      ...ledgerType.caption,
      color: c.ink,
    },
    lockedFade: {
      opacity: 0.45,
    },
    name: {
      ...ledgerType.rowTitle,
      color: c.ink,
      marginTop: ledgerSpace.xs,
      marginLeft: RING + RING_GAP,
    },
    accentRow: {
      gap: ledgerSpace.lg,
      paddingRight: ledgerSpace.xs,
    },
    accentOption: {
      alignItems: 'center',
      width: 60,
      gap: ledgerSpace.xs,
    },
    accentRing: {
      padding: 3,
      borderRadius: ledgerRadius.full,
      borderWidth: 2,
      borderColor: 'transparent',
    },
  });
}
