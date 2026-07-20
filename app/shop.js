import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, CircleDollarSign, Check, Snowflake, Lock, TrendingUp, TrendingDown } from 'lucide-react-native';
import CardThemeSurface from '../components/CardThemeSurface';
import AmountText from '../components/AmountText';
import { colors as staticColors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../lib/AuthContext';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useToast } from '../components/Toast';
import { formatMoney } from '../lib/currency';
import useCardThemes from '../hooks/useCardThemes';
import useRewards from '../hooks/useRewards';
import { CARD_THEMES, TIERS, LOCKED_TIERS, TIER_LABELS, getTheme } from '../lib/cardThemes';
import { FREEZE_COST, FREEZE_CAP } from '../lib/rewards';
import { COIN_PACKS } from '../lib/coins';
import { buyTheme, equipTheme } from '../lib/cardThemeMutations';
import { buyFreeze } from '../lib/rewardsMutations';
import { lighten } from '../lib/color';

// 'freeze' tab renamed to 'general' (22-coin-store-and-reward-tiering.md
// Phase 3) — it now holds coin packs AND the streak freeze, not just the
// freeze.
const TABS = [
  { key: 'cards', label: 'Cards' },
  { key: 'general', label: 'General' },
];

// Placeholder figures for the preview card only — the Shop isn't scoped to
// any one real account, so it shows what a theme looks like, not real data
// (19-card-themes.md Phase 1). Mirrors AccountHeroCarousel's own layout
// (In Hand + Income/Expense stats row) so the preview is an honest match
// for what the theme actually looks like on Home.
const PREVIEW_BALANCE = 42500;
const PREVIEW_INCOME = 18200;
const PREVIEW_EXPENSE = 9650;

// Legendary themes (Phase 2) have no `cost` — describes how they're actually
// obtained, shown wherever a cost would otherwise go. The old 'chest' unlock
// type was retired in 20-milestone-spin-wheel.md Phase 1 — every Legendary
// theme is now a direct milestone grant.
function unlockCaption(theme) {
  if (!theme.unlock) return null;
  if (theme.unlock.type === 'milestone') return `Day ${theme.unlock.day} streak`;
  // 'trophy' unlock (22-coin-store-and-reward-tiering.md Phase 1) — an
  // achievement-tier theme earned by claiming a specific trophy; `label` is a
  // human name for it (e.g. "Perfect Month"), set on the theme's `unlock`.
  if (theme.unlock.type === 'trophy') return `Earn: ${theme.unlock.label}`;
  return null;
}

export default function Shop() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useAuth();
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();
  const { coins, ownedIds, equippedId, loading, refetch } = useCardThemes();
  const { freezes, refetch: refetchRewards } = useRewards();
  const [tab, setTab] = useState('cards');
  const [selectedId, setSelectedId] = useState(null);
  const [working, setWorking] = useState(false);
  const [buyingFreeze, setBuyingFreeze] = useState(false);
  // Custom buy dialog (replaces Alert.alert per direct feedback) —
  // null | 'confirm' | 'bought'. Always about `selected` (the currently
  // previewed theme), so no separate "which theme" state is needed.
  const [buyDialogStage, setBuyDialogStage] = useState(null);

  const selected = getTheme(selectedId ?? equippedId);
  const selectedOwned = ownedIds.has(selected.id);
  const selectedEquipped = equippedId === selected.id;
  const canAfford = coins >= selected.cost;
  const freezeAtCap = freezes >= FREEZE_CAP;
  const freezeCantAfford = coins < FREEZE_COST;
  // Same derivation as AccountHeroCarousel — both trend icons share one
  // lightened tint from the theme's own accent (chipColor); darkening
  // expense separately was tried and dropped per direct feedback (it never
  // read as reliably legible across every theme). Ink is the exception —
  // its chipColor is hardcoded lime, ignoring the app's selected Primary
  // Color; `colors.brand` fixes that for both light/dark app mode at once.
  // See AccountHeroCarousel's own comment for the full history.
  const previewAccentSource = selected.id === 'ink' ? colors.brand : selected.chipColor;
  const previewIncomeColor = lighten(previewAccentSource, 0.65);
  const previewExpenseColor = previewIncomeColor;

  async function handleEquip() {
    setWorking(true);
    const { error } = await equipTheme(session?.user?.id, selected.id);
    setWorking(false);
    if (error) {
      showToast({ message: 'Could not equip theme', variant: 'error' });
      return;
    }
    notifyChanged();
    showToast({ message: `${selected.name} equipped`, variant: 'success' });
  }

  // Custom dialog, not Alert.alert — per direct feedback, shows the theme
  // itself (a real CardThemeSurface preview), and stays open across the
  // purchase to become the "you bought it" confirmation instead of a
  // separate toast, with Equip as the natural next action right there.
  function handleBuyPress() {
    setBuyDialogStage('confirm');
  }

  async function confirmBuy() {
    setWorking(true);
    const { error } = await buyTheme(selected.id);
    setWorking(false);
    if (error) {
      showToast({ message: 'Could not buy theme', variant: 'error' });
      setBuyDialogStage(null);
      return;
    }
    notifyChanged();
    refetch();
    setBuyDialogStage('bought');
  }

  function handleDialogClose() {
    setBuyDialogStage(null);
  }

  async function handleDialogEquip() {
    setBuyDialogStage(null);
    await handleEquip();
  }

  // Coin-pack Buy is STUBBED (22-coin-store-and-reward-tiering.md Phase 3) —
  // same "no paywall yet" treatment as the Pro subscription (app/pro.js's
  // handleUpgrade): an info toast, no real Play Billing / crediting. `pack` is
  // accepted so the copy can name it later, but nothing is charged today.
  function handleBuyCoins() {
    showToast({
      message: "Coin purchases aren't live yet. You'll be the first to know when they launch.",
      variant: 'info',
    });
  }

  function handleBuyFreezePress() {
    Alert.alert('Buy freeze', `Spend ${FREEZE_COST} coins for 1 streak freeze?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Buy', onPress: confirmBuyFreeze },
    ]);
  }

  async function confirmBuyFreeze() {
    setBuyingFreeze(true);
    const { error } = await buyFreeze();
    setBuyingFreeze(false);
    if (error) {
      showToast({ message: 'Could not buy freeze', variant: 'error' });
      return;
    }
    notifyChanged();
    refetch();
    refetchRewards();
    showToast({ message: 'Freeze bought', variant: 'success' });
  }

  // Shared tile renderer — identical swatch/selection/equipped-badge shape
  // for every tier; only the caption under the name differs (a price for
  // TIERS, an unlock condition for LOCKED_TIERS), passed in as `metaFor`.
  // `showCoin` (TIERS only) puts a coin glyph beside an unowned tile's price
  // — "Free"/"Owned"/"Equipped"/unlock captions are never coin amounts, so
  // it's suppressed for those automatically, not just when the caller omits
  // it. `locked` (LOCKED_TIERS only) dims the swatch and shows a lock badge
  // for a not-yet-earned theme — added per direct feedback so a buyable
  // Common/Rare tile and a milestone/chest-only tile read as visibly
  // different things at a glance, not just via the small caption text.
  function renderTile(t, metaFor, { showCoin = false, locked = false } = {}) {
    const owned = ownedIds.has(t.id);
    const equipped = equippedId === t.id;
    const isSelected = selected.id === t.id;
    const meta = owned ? (equipped ? 'Equipped' : 'Owned') : metaFor(t);
    const showCoinIcon = showCoin && !owned && t.cost > 0;
    const showLock = locked && !owned;
    return (
      <Pressable key={t.id} style={styles.tile} onPress={() => setSelectedId(t.id)}>
        <CardThemeSurface theme={t} style={[styles.tileSwatchShape, isSelected && styles.tileSwatchSelected]}>
          {showLock && (
            <View style={styles.tileLockScrim}>
              <Lock size={16} color="#FFFFFF" strokeWidth={2.4} />
            </View>
          )}
          {equipped && (
            <View style={styles.tileBadge}>
              <Check size={11} color={staticColors.ink} strokeWidth={3} />
            </View>
          )}
        </CardThemeSurface>
        <Text style={styles.tileName} numberOfLines={1}>
          {t.name}
        </Text>
        <View style={styles.tileMetaRow}>
          {owned && <Check size={10} color={colors.income} strokeWidth={3} />}
          {showCoinIcon && <CircleDollarSign size={10} color={colors.coinGold} fill={colors.coinGold} strokeWidth={1.5} />}
          {showLock && <Lock size={9} color={colors.mutedMid} strokeWidth={2.6} />}
          <Text style={[styles.tileMeta, owned && { color: colors.income }]}>{meta}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.headerTitle}>Shop</Text>
        <View style={styles.coinPill}>
          <CircleDollarSign size={16} color={colors.coinGold} fill={colors.coinGold} strokeWidth={1.5} />
          <Text style={styles.coinPillText}>{loading ? '···' : coins.toLocaleString('en-IN')}</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable key={t.key} style={[styles.tab, active && styles.tabActive]} onPress={() => setTab(t.key)}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'general' ? (
        // General tab (22-coin-store-and-reward-tiering.md Phase 3) — coin
        // packs (default focus, first) + the streak freeze, in one scroll.
        // Coin-pack Buy is stubbed to a toast (no payments yet); the freeze is
        // a real coin spend and works normally.
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.generalScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>Coin Packs</Text>
          <Text style={styles.generalHint}>Top up coins to unlock themes and more.</Text>
          <View style={styles.packGrid}>
            {COIN_PACKS.map((pack) => (
              <Pressable key={pack.id} style={styles.packCard} onPress={() => handleBuyCoins(pack)}>
                {pack.popular && (
                  <View style={styles.packBadge}>
                    <Text style={styles.packBadgeText}>Popular</Text>
                  </View>
                )}
                {/* Placeholder icon — swap for pack illustrations later (one
                    line here). */}
                <CircleDollarSign size={26} color={colors.coinGold} fill={colors.coinGold} strokeWidth={1.5} />
                <Text style={styles.packCoins}>{pack.coins.toLocaleString('en-IN')}</Text>
                <Text style={styles.packCoinsLabel}>coins</Text>
                <View style={styles.packBuyBtn}>
                  <Text style={styles.packBuyText}>{pack.price}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Streak Freeze</Text>
          <View style={styles.freezeCard}>
            <View style={styles.freezeIconTile}>
              <Snowflake size={22} color={colors.iceBlue} fill={colors.iceBlue} strokeWidth={2.2} />
            </View>
            <View style={styles.freezeTextWrap}>
              <Text style={styles.freezeTitle}>Streak Freeze</Text>
              <Text style={styles.freezeSubtitle}>
                {freezeAtCap ? `You're holding the max (${FREEZE_CAP})` : `${FREEZE_COST} coins · hold up to ${FREEZE_CAP}`}
              </Text>
              <Text style={styles.freezeCount}>You have {freezes}</Text>
            </View>
            <Pressable
              style={[styles.actionButton, (buyingFreeze || freezeAtCap || freezeCantAfford) && styles.actionButtonDisabled]}
              onPress={handleBuyFreezePress}
              disabled={buyingFreeze || freezeAtCap || freezeCantAfford}
            >
              {buyingFreeze ? (
                <ActivityIndicator size="small" color={staticColors.ink} />
              ) : (
                <Text style={styles.actionButtonText}>Buy for {FREEZE_COST}</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <>
          {/* Pinned — stays on screen while the grid below scrolls, per
              direct feedback: picking a theme and previewing it shouldn't
              need re-scrolling back up every time. Same pinned-top/
              scroll-middle shape MenuSheet already uses. */}
          <View style={styles.pinnedPreview}>
            <CardThemeSurface theme={selected} style={styles.previewShape}>
              <View style={styles.previewContent}>
                <Text style={[styles.previewName, { color: selected.textColor }]}>Flo</Text>
                <Text style={[styles.previewLabel, { color: selected.mutedColor }]}>In Hand</Text>
                {/* AmountText + currencyColor, not a plain formatMoney string
                    — matches AccountHeroCarousel's own muted-₹ treatment
                    exactly, per direct feedback that the preview should use
                    the same currency-symbol tint as the real card. */}
                <AmountText
                  value={PREVIEW_BALANCE}
                  type="neutral"
                  dark
                  muteCurrency
                  currency="INR"
                  currencyColor={selected.mutedColor}
                  size={fontSize.amountLg}
                  style={[styles.previewBalance, { color: selected.textColor }]}
                />
                {/* Same layout as AccountHeroCarousel's own stats row —
                    placeholder figures only, so the preview honestly shows
                    what the theme looks like on the real Home card. */}
                <View style={styles.previewStatsRow}>
                  <View style={styles.previewStat}>
                    <TrendingUp size={11} color={previewIncomeColor} strokeWidth={2.8} />
                    <View style={styles.previewStatTextGroup}>
                      <Text style={[styles.previewStatValue, { color: selected.textColor }]}>{formatMoney(PREVIEW_INCOME, 'INR')}</Text>
                      <Text style={[styles.previewStatLabel, { color: selected.mutedColor }]}>Income</Text>
                    </View>
                  </View>
                  <View style={styles.previewStat}>
                    <TrendingDown size={11} color={previewExpenseColor} strokeWidth={2.8} />
                    <View style={styles.previewStatTextGroup}>
                      <Text style={[styles.previewStatValue, { color: selected.textColor }]}>{formatMoney(PREVIEW_EXPENSE, 'INR')}</Text>
                      <Text style={[styles.previewStatLabel, { color: selected.mutedColor }]}>Expenses</Text>
                    </View>
                  </View>
                </View>
              </View>
            </CardThemeSurface>

            <View style={styles.previewNameRow}>
              <Text style={styles.previewTitle}>{selected.name}</Text>
              {selectedEquipped && <Check size={16} color={colors.brand} strokeWidth={2.8} />}
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {TIERS.map((tier) => (
              <View key={tier}>
                <Text style={styles.sectionLabel}>{TIER_LABELS[tier]}</Text>
                <View style={styles.grid}>
                  {CARD_THEMES.filter((t) => t.tier === tier).map((t) =>
                    renderTile(t, (theme) => (theme.cost === 0 ? 'Free' : theme.cost.toLocaleString('en-IN')), { showCoin: true })
                  )}
                </View>
              </View>
            ))}

            {/* Legendary + Chest-exclusive (Phase 2) — never purchasable, so
                each tile shows how it's actually unlocked instead of a price.
                Still tappable for a preview, same as every other tile. */}
            {LOCKED_TIERS.map((tier) => (
              <View key={tier}>
                <Text style={styles.sectionLabel}>{TIER_LABELS[tier]}</Text>
                <View style={styles.grid}>
                  {CARD_THEMES.filter((t) => t.tier === tier).map((t) => renderTile(t, unlockCaption, { locked: true }))}
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {/* Floating, not inline under the preview card — per direct feedback,
          the buy/equip action reads better as a persistent bottom bar than
          competing with the preview/grid for scroll-top real estate. Only
          on the Cards tab; the General tab's coin packs and freeze carry
          their own inline Buy buttons. */}
      {tab === 'cards' && (
        <View style={[styles.floatingBar, { paddingBottom: spacing.md + insets.bottom }]}>
          <View style={styles.floatingNameWrap}>
            <Text style={styles.floatingName} numberOfLines={1}>
              {selected.name}
            </Text>
            {selectedEquipped && <Check size={15} color={colors.brand} strokeWidth={2.8} />}
          </View>
          {selectedEquipped ? (
            <View style={[styles.actionButton, styles.actionButtonDisabled]}>
              <Text style={styles.actionButtonText}>Equipped</Text>
            </View>
          ) : selectedOwned ? (
            <Pressable style={styles.actionButton} onPress={handleEquip} disabled={working}>
              {working ? <ActivityIndicator size="small" color={staticColors.ink} /> : <Text style={styles.actionButtonText}>Equip</Text>}
            </Pressable>
          ) : selected.unlock ? (
            <View style={[styles.actionButton, styles.actionButtonDisabled]}>
              <Text style={styles.actionButtonText}>{unlockCaption(selected)}</Text>
            </View>
          ) : canAfford ? (
            <Pressable style={styles.actionButton} onPress={handleBuyPress} disabled={working}>
              {working ? (
                <ActivityIndicator size="small" color={staticColors.ink} />
              ) : (
                <View style={styles.actionButtonRow}>
                  <Text style={styles.actionButtonText}>Buy for </Text>
                  <CircleDollarSign size={13} color={colors.ink} fill={colors.ink} strokeWidth={1.5} />
                  <Text style={styles.actionButtonText}> {selected.cost.toLocaleString('en-IN')}</Text>
                </View>
              )}
            </Pressable>
          ) : (
            // Not enough coins — instead of a dead "Need X more" label, a live
            // Buy-coins shortcut that jumps to the General tab's packs
            // (22-coin-store-and-reward-tiering.md Phase 3). Still shows the
            // shortfall so the user knows how short they are.
            <Pressable style={styles.actionButton} onPress={() => setTab('general')}>
              <Text style={styles.actionButtonText}>Buy coins</Text>
              <Text style={styles.buyCoinsHint}>Need {(selected.cost - coins).toLocaleString('en-IN')} more</Text>
            </Pressable>
          )}
        </View>
      )}

      <Modal visible={!!buyDialogStage} transparent animationType="fade" onRequestClose={handleDialogClose}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <CardThemeSurface theme={selected} style={styles.dialogPreviewShape}>
              <View style={styles.dialogPreviewContent}>
                <Text style={[styles.previewName, { color: selected.textColor }]}>Flo</Text>
                {buyDialogStage === 'bought' && (
                  <View style={styles.dialogBoughtBadge}>
                    <Check size={12} color={staticColors.ink} strokeWidth={3} />
                  </View>
                )}
              </View>
            </CardThemeSurface>

            {buyDialogStage === 'confirm' ? (
              <>
                <Text style={styles.dialogTitle}>{selected.name}</Text>
                <Text style={styles.dialogBody}>
                  Spend {selected.cost?.toLocaleString('en-IN')} coins to buy this theme?
                </Text>
                <Pressable style={styles.dialogPrimaryButton} onPress={confirmBuy} disabled={working}>
                  {working ? (
                    <ActivityIndicator size="small" color={staticColors.ink} />
                  ) : (
                    <View style={styles.actionButtonRow}>
                      <Text style={styles.dialogPrimaryButtonText}>Buy for </Text>
                      <CircleDollarSign size={13} color={colors.ink} fill={colors.ink} strokeWidth={1.5} />
                      <Text style={styles.dialogPrimaryButtonText}> {selected.cost?.toLocaleString('en-IN')}</Text>
                    </View>
                  )}
                </Pressable>
                <Pressable style={styles.dialogSecondaryButton} onPress={handleDialogClose} disabled={working}>
                  <Text style={styles.dialogSecondaryButtonText}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.dialogTitle}>You bought {selected.name}</Text>
                <Text style={styles.dialogBody}>Equip it now, or do it later from the shop.</Text>
                <Pressable style={styles.dialogPrimaryButton} onPress={handleDialogEquip}>
                  <Text style={styles.dialogPrimaryButtonText}>Equip</Text>
                </Pressable>
                <Pressable style={styles.dialogSecondaryButton} onPress={handleDialogClose}>
                  <Text style={styles.dialogSecondaryButtonText}>Not now</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
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
    coinPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 36,
      paddingHorizontal: 12,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    coinPillText: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.md,
      color: colors.ink,
      fontVariant: ['tabular-nums'],
    },
    // Same segmented-toggle shape as Settings' report-cadence picker
    // (reportSegmentWrap/reportSegment/reportSegmentActive) — Cards vs
    // Freeze, added per direct feedback so the freeze purchase (previously
    // only reachable from RewardsHistorySheet) also lives in the Shop.
    tabRow: {
      flexDirection: 'row',
      marginHorizontal: spacing.xl,
      marginBottom: spacing.md,
      backgroundColor: colors.chipBg,
      borderRadius: 14,
      padding: 4,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 9,
      borderRadius: 11,
    },
    tabActive: {
      backgroundColor: colors.ink,
    },
    tabText: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.base,
      color: colors.muted,
    },
    tabTextActive: {
      fontFamily: fontFamily.extrabold,
      color: colors.surface,
    },
    freezeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.card,
      padding: spacing.lg,
      // No own horizontal margin — it now lives inside the General tab's
      // padded ScrollView (22-coin-store-and-reward-tiering.md Phase 3), which
      // supplies the horizontal inset via generalScroll's contentContainerStyle.
    },
    // General tab (coin packs + freeze) — its own scroll, horizontally padded
    // like the Cards grid so both tabs sit at the same inset.
    generalScroll: {
      paddingHorizontal: spacing.xl,
      paddingBottom: 60,
    },
    generalHint: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      marginBottom: spacing.md,
    },
    sectionLabelSpaced: {
      marginTop: spacing.xl,
    },
    packGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    packCard: {
      width: '47%',
      flexGrow: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.card,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      gap: 2,
    },
    packBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: colors.brand,
      borderRadius: radii.pill,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    packBadgeText: {
      fontFamily: fontFamily.extrabold,
      fontSize: 9,
      letterSpacing: 0.3,
      color: colors.ink,
      textTransform: 'uppercase',
    },
    packCoins: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.xl,
      letterSpacing: -0.4,
      color: colors.ink,
      marginTop: 6,
      fontVariant: ['tabular-nums'],
    },
    packCoinsLabel: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xs,
      color: colors.mutedMid,
    },
    packBuyBtn: {
      marginTop: spacing.md,
      backgroundColor: colors.brand,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: 8,
      alignSelf: 'stretch',
      alignItems: 'center',
    },
    packBuyText: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.md,
      color: colors.ink,
    },
    buyCoinsHint: {
      fontFamily: fontFamily.semibold,
      fontSize: 9,
      color: colors.ink,
      marginTop: 1,
      opacity: 0.7,
    },
    freezeIconTile: {
      width: 44,
      height: 44,
      borderRadius: radii.iconTileLg,
      backgroundColor: colors.iceBlueBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    freezeTextWrap: {
      flex: 1,
    },
    freezeTitle: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.lg,
      color: colors.ink,
    },
    freezeSubtitle: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      marginTop: 1,
    },
    freezeCount: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.xs,
      color: colors.mutedMid,
      marginTop: 4,
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      // Extra clearance under the floating bar (Cards tab only) so the last
      // grid row never sits behind it — the General tab has no floating bar
      // so its own content only needs the plain 60.
      paddingBottom: 110,
    },
    // Pinned wrapper (preview card + name row) — sits above the scrollable
    // grid instead of scrolling with it. Own horizontal padding since it's
    // no longer inside the ScrollView's contentContainerStyle.
    pinnedPreview: {
      paddingHorizontal: spacing.xl,
    },
    // No fixed height (was 150, clipped once the stats row was added) —
    // matches AccountHeroCarousel's own heroCard, which is never given an
    // explicit height either: content + padding define it intrinsically,
    // so it grows safely if a future preview needs more room.
    previewShape: {},
    previewContent: {
      paddingVertical: 20,
      paddingHorizontal: 22,
    },
    previewName: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.lg,
      letterSpacing: -0.1,
    },
    previewLabel: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.base,
      marginTop: spacing.md,
    },
    previewBalance: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.amountLg,
      letterSpacing: -0.4,
      marginTop: -4,
    },
    previewStatsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.lg,
      marginTop: spacing.lg,
    },
    previewStat: {
      flexDirection: 'row',
      // Centered against the text group — same fix as AccountHeroCarousel's
      // heroStat (bottom-aligning the icon too made it read as "sinking").
      alignItems: 'center',
      gap: 7,
    },
    previewStatTextGroup: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 7,
    },
    previewStatValue: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.md,
      letterSpacing: -0.2,
    },
    previewStatLabel: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.sm,
    },
    previewNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: spacing.lg,
      marginBottom: spacing.xl,
    },
    previewTitle: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.heading,
      color: colors.ink,
    },
    // Floating bottom bar (Cards tab only) — replaces the old inline
    // previewActionRow per direct feedback; a persistent bar reachable
    // regardless of scroll position, rather than a button that scrolls
    // away with the preview card.
    floatingBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    floatingNameWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 1,
    },
    floatingName: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.lg,
      color: colors.ink,
      flexShrink: 1,
    },
    actionButton: {
      minWidth: 96,
      height: 42,
      borderRadius: radii.pill,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    actionButtonDisabled: {
      backgroundColor: colors.chipBg,
    },
    actionButtonText: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.sm,
      color: colors.ink,
    },
    actionButtonRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sectionLabel: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginTop: spacing.md,
      marginBottom: spacing.md,
      marginLeft: spacing.xs,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    tile: {
      width: '30%',
    },
    tileSwatchShape: {
      height: 64,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    tileSwatchSelected: {
      borderColor: colors.brand,
    },
    tileBadge: {
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
    // Not-yet-earned Legendary/Chest tile — a dark scrim + centered lock
    // glyph over the swatch, so it reads as "locked" at a glance rather
    // than looking like any other buyable tile with unusual price text.
    tileLockScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.38)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileName: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.sm,
      color: colors.ink,
      marginTop: 6,
    },
    tileMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginTop: 1,
    },
    tileMeta: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xs,
      color: colors.mutedMid,
    },
    // Custom buy dialog (replaces Alert.alert) — same centered-overlay
    // shape as Settings' delete-confirm Modal, but shows the actual themed
    // card instead of a generic warning icon, and stays open across the
    // purchase to become the "bought" confirmation (Equip/Not now) instead
    // of handing off to a separate toast.
    dialogOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    dialogCard: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: radii.cardLg,
      padding: spacing.xl,
      alignItems: 'center',
    },
    dialogPreviewShape: {
      width: '100%',
      height: 110,
      marginBottom: spacing.lg,
    },
    dialogPreviewContent: {
      flex: 1,
      padding: spacing.md,
    },
    dialogBoughtBadge: {
      position: 'absolute',
      top: spacing.md,
      right: spacing.md,
      width: 24,
      height: 24,
      borderRadius: radii.pill,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dialogTitle: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.title,
      color: colors.ink,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    dialogBody: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.base,
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    dialogPrimaryButton: {
      width: '100%',
      height: 52,
      borderRadius: radii.buttonSm + 4,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dialogPrimaryButtonText: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.lg,
      color: colors.ink,
    },
    dialogSecondaryButton: {
      width: '100%',
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.xs,
    },
    dialogSecondaryButtonText: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.md,
      color: colors.muted,
    },
  });
}
