import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Image } from 'react-native';
import { BottomSheetModal, BottomSheetFlatList, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { X, CircleDollarSign, PiggyBank, Snowflake } from 'lucide-react-native';
import { format } from 'date-fns';
import { colors as staticColors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { supabase } from '../lib/supabase';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import useRewards from '../hooks/useRewards';
import ProgressBar from './ProgressBar';
import { buyFreeze } from '../lib/rewardsMutations';
import { FREEZE_COST, FREEZE_CAP, RANKS, RANK_BADGE_ART, RANK_BADGE_ART_LOCKED, rankFromXp, levelFromXp } from '../lib/rewards';
import { useDataRefresh } from '../lib/DataRefreshContext';

// Every source this ledger will ever record, across every phase of
// 18-gamification-ritual-and-ledger.md — not just the ones Phase 2 earns yet.
// A row with a source this sheet doesn't recognise (a future addition landing
// before this map is updated) falls back to the raw string rather than
// crashing or rendering blank.
const SOURCE_LABELS = {
  daily_log: 'Logged a transaction',
  no_spend: 'No-spend day',
  milestone: 'Streak milestone',
  freeze_buy: 'Bought a freeze',
  freeze_used: 'Freeze used',
  freeze_comeback: 'Welcome back',
  chest: 'Milestone chest',
};

function labelFor(source) {
  return SOURCE_LABELS[source] ?? source;
}

const RewardsHistorySheetContext = createContext(null);

export function RewardsHistorySheetProvider({ children }) {
  const sheetRef = useRef(null);
  const openRewardsHistory = useCallback(() => sheetRef.current?.open(), []);

  return (
    <RewardsHistorySheetContext.Provider value={{ openRewardsHistory }}>
      {children}
      <RewardsHistorySheet ref={sheetRef} />
    </RewardsHistorySheetContext.Provider>
  );
}

export function useRewardsHistorySheet() {
  const ctx = useContext(RewardsHistorySheetContext);
  if (!ctx) throw new Error('useRewardsHistorySheet must be used within RewardsHistorySheetProvider');
  return ctx;
}

// The Rewards hub (25-rewards-hub-sheet.md) — opened from Home's header
// coins/freeze/level chip. Started as a coin-only ledger + freeze-buy card
// (18-gamification-ritual-and-ledger.md Phase 4); now the one place for the
// whole reward economy: coins (+ where to get more), freezes (+ why they
// matter), and XP/Level/Rank (+ the rank ladder, moved here from MenuSheet's
// old level card — see that file's own history). Same
// Provider/Context/forwardRef shape throughout; every existing call site
// (`useRewardsHistorySheet().openRewardsHistory()`) is unaffected.
const RewardsHistorySheet = forwardRef(function RewardsHistorySheet(_props, ref) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const modalRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef);
  const { coins, freezes, xp, level, nextLevelAt, xpIntoLevel, xpForNext, progress: levelProgress } = useRewards();
  const { notifyChanged } = useDataRefresh();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);

  const { current: rank } = rankFromXp(xp);
  // Which level each rank's own XP threshold lands in — computed here, not
  // stored anywhere. This is the direct answer to "how do level and rank
  // relate": they don't share a curve, so a rank's start level has to be
  // derived from levelFromXp(rank.minXp) every time, not assumed.
  const rankLadder = useMemo(() => RANKS.map((r) => ({ ...r, atLevel: levelFromXp(r.minXp).level })), []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reward_events')
      .select('id, source, coins, xp, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    setEvents(error ? [] : (data ?? []));
    setLoading(false);
  }, []);

  useImperativeHandle(ref, () => ({
    open() {
      load();
      modalRef.current?.present();
    },
  }));

  const atCap = freezes >= FREEZE_CAP;
  const cantAfford = coins < FREEZE_COST;

  function handleBuyPress() {
    Alert.alert('Buy freeze', `Spend ${FREEZE_COST} coins for 1 streak freeze?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Buy', onPress: confirmBuy },
    ]);
  }

  async function confirmBuy() {
    setBuying(true);
    const { error } = await buyFreeze();
    setBuying(false);
    if (error) return;
    notifyChanged();
    load();
  }

  // Dismiss first — pushing a route while a sheet is presented would leave
  // it stacked underneath Shop instead of returning to a clean Home.
  function handleBuyCoinsPress() {
    modalRef.current?.dismiss();
    router.push('/shop?tab=general');
  }

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    []
  );

  // Pinned above the list (title + close), same "short, fixed" role as
  // MenuSheet's own headerRow — everything else scrolls together as the
  // FlatList's ListHeaderComponent below, since it's grown too tall
  // (Coins + Freeze + a 9-row rank ladder) to pin without crowding the
  // ledger itself down to almost nothing.
  function ListHeader() {
    return (
      <View>
        {/* Coins */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Coins</Text>
        </View>
        <View style={styles.balanceRow}>
          <CircleDollarSign size={22} color={colors.coinGold} fill={colors.coinGold} strokeWidth={1.5} />
          <Text style={styles.balanceText}>{coins.toLocaleString('en-IN')}</Text>
        </View>
        <Text style={styles.explainerText}>
          Coins buy card themes in the Shop — Common through Legendary.
        </Text>
        <Pressable style={styles.buyButton} onPress={handleBuyCoinsPress}>
          <Text style={styles.buyButtonText}>Buy coins</Text>
        </Pressable>

        {/* Freeze */}
        <View style={[styles.sectionHeaderRow, styles.sectionSpacing]}>
          <Text style={styles.sectionTitle}>Streak Freeze</Text>
        </View>
        <Text style={styles.explainerText}>Protects your streak on a day you miss.</Text>
        <View style={styles.shopCard}>
          <View style={styles.shopIcon}>
            <Snowflake size={20} color={colors.iceBlue} fill={colors.iceBlue} strokeWidth={2.4} />
          </View>
          <View style={styles.shopTextWrap}>
            <Text style={styles.shopTitle}>{freezes} held</Text>
            <Text style={styles.shopSubtitle}>
              {atCap ? `You're holding the max (${FREEZE_CAP})` : `${FREEZE_COST} coins · hold up to ${FREEZE_CAP}`}
            </Text>
          </View>
          <Pressable
            style={[styles.smallBuyButton, (buying || atCap || cantAfford) && styles.buyButtonDisabled]}
            onPress={handleBuyPress}
            disabled={buying || atCap || cantAfford}
          >
            {buying ? (
              <ActivityIndicator size="small" color={staticColors.ink} />
            ) : (
              <Text style={styles.smallBuyButtonText}>Buy</Text>
            )}
          </Pressable>
        </View>

        {/* XP / Level / Rank */}
        <View style={[styles.sectionHeaderRow, styles.sectionSpacing]}>
          <Text style={styles.sectionTitle}>XP & Rank</Text>
        </View>
        <View style={styles.levelCard}>
          <View style={styles.levelIconTile}>
            <Image source={RANK_BADGE_ART[rank.id]} style={styles.levelBadgeArt} resizeMode="contain" />
          </View>
          <View style={styles.levelContent}>
            <View style={styles.levelTopRow}>
              <Text style={styles.levelLabel}>{rank.title}</Text>
              <Text style={styles.levelNumber}>Level {level}</Text>
            </View>
            <ProgressBar progress={levelProgress} status="healthy" dark height={6} />
            <View style={styles.levelBottomRow}>
              <Text style={styles.levelRemaining}>
                {Math.max(0, xpForNext - xpIntoLevel).toLocaleString('en-IN')} XP to next level
              </Text>
              <Text style={styles.levelXp}>
                {xp.toLocaleString('en-IN')}/{nextLevelAt.toLocaleString('en-IN')} XP
              </Text>
            </View>
          </View>
        </View>

        {/* Rank ladder — the direct answer to "how do level and rank relate":
            each rank spans a very different number of levels (its `atLevel`
            is computed from levelFromXp, not a clean 1-rank-per-level
            mapping), so the list is what actually shows that, not a claim in
            copy. */}
        <View style={styles.ladder}>
          {rankLadder.map((r) => {
            const reached = xp >= r.minXp;
            const isCurrent = r.id === rank.id;
            return (
              <View key={r.id} style={[styles.ladderRow, isCurrent && styles.ladderRowCurrent]}>
                <Image
                  source={reached ? RANK_BADGE_ART[r.id] : RANK_BADGE_ART_LOCKED[r.id]}
                  style={styles.ladderBadge}
                  resizeMode="contain"
                />
                <Text style={[styles.ladderTitle, !reached && styles.ladderTitleLocked]} numberOfLines={1}>
                  {r.title}
                </Text>
                <Text style={styles.ladderLevel}>Level {r.atLevel}</Text>
              </View>
            );
          })}
        </View>

        <View style={[styles.sectionHeaderRow, styles.sectionSpacing]}>
          <Text style={styles.sectionTitle}>Activity</Text>
        </View>
      </View>
    );
  }

  return (
    <BottomSheetModal
      ref={modalRef}
      onChange={handleSheetChange}
      snapPoints={useMemo(() => ['92%'], [])}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: staticColors.ink, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
      handleIndicatorStyle={{ backgroundColor: '#3a3a3a', width: 44 }}
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Rewards</Text>
        <Pressable style={styles.closeButton} onPress={() => modalRef.current?.dismiss()}>
          <X size={16} color={staticColors.surface} strokeWidth={2.6} />
        </Pressable>
      </View>

      <BottomSheetFlatList
        data={loading ? [] : events}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={staticColors.surface} style={styles.loading} />
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <PiggyBank size={26} color={colors.coinGold} strokeWidth={2} />
              </View>
              <Text style={styles.emptyText}>Log a transaction to start earning coins.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowMid}>
              <Text style={styles.rowTitle}>{labelFor(item.source)}</Text>
              <Text style={styles.rowSub}>{format(new Date(item.created_at), 'd MMM, h:mm a')}</Text>
            </View>
            {item.coins !== 0 && (
              <Text style={[styles.rowAmount, item.coins < 0 && styles.rowAmountNegative]}>
                {item.coins > 0 ? '+' : ''}
                {item.coins}
              </Text>
            )}
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </BottomSheetModal>
  );
});

function makeStyles(colors) {
  return StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.lg,
    },
    headerTitle: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.xxl,
      color: staticColors.surface,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      backgroundColor: staticColors.inkCard,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionHeaderRow: {
      paddingHorizontal: spacing.xl,
      marginBottom: spacing.sm,
    },
    sectionSpacing: {
      marginTop: spacing.xl,
    },
    sectionTitle: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.md,
      letterSpacing: 0.2,
      textTransform: 'uppercase',
      color: staticColors.mutedMid,
    },
    explainerText: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.sm,
      color: staticColors.mutedMid,
      paddingHorizontal: spacing.xl,
      marginBottom: spacing.md,
    },
    balanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      marginBottom: spacing.xs,
    },
    balanceText: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.display,
      color: staticColors.surface,
      fontVariant: ['tabular-nums'],
    },
    // Full-width brand pill — the coins Buy button is a bigger ask (leaves
    // the sheet entirely, into Shop) than the freeze card's own compact
    // trailing Buy, so it gets the app's standard full-width primary shape.
    buyButton: {
      marginHorizontal: spacing.xl,
      marginBottom: spacing.md,
      height: 48,
      borderRadius: radii.buttonSm + 4,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buyButtonText: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.md,
      color: colors.ink,
    },
    shopCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.md,
      backgroundColor: staticColors.inkCard,
      borderRadius: radii.card,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    shopIcon: {
      width: 40,
      height: 40,
      borderRadius: radii.iconTile,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    shopTextWrap: {
      flex: 1,
    },
    shopTitle: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.md,
      color: staticColors.surface,
    },
    shopSubtitle: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xs,
      color: staticColors.mutedMid,
      marginTop: 1,
    },
    // The freeze card's own compact trailing Buy — distinct from the
    // full-width coins buyButton above, same as before this sheet grew.
    smallBuyButton: {
      minWidth: 64,
      height: 36,
      borderRadius: radii.pill,
      backgroundColor: colors.iceBlue,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    buyButtonDisabled: {
      opacity: 0.4,
    },
    smallBuyButtonText: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.sm,
      color: staticColors.ink,
    },
    // Ported verbatim from MenuSheet's old level card (25-rewards-hub-sheet.md
    // — removed there, lives here now).
    levelCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: staticColors.inkCard,
      borderRadius: radii.card,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.md,
    },
    levelIconTile: {
      width: 56,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
    },
    levelBadgeArt: {
      width: 56,
      height: 56,
    },
    levelContent: {
      flex: 1,
      gap: 6,
    },
    levelTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    // Just the rank name now (per direct feedback) — Level moved to its own
    // trailing slot (levelNumber) instead of being folded into this same
    // line as "{rank.title} · Level {level}". Same fontSize.md as
    // levelNumber (per direct feedback: title bumped up, level brought down,
    // meeting in the middle) — neither should read as more important than
    // the other now that they're two separate, equal-weight pieces of info.
    levelLabel: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.md,
      color: staticColors.surface,
    },
    levelNumber: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.md,
      color: staticColors.surface,
    },
    // Below the progress bar, mirroring levelTopRow's row shape — remaining
    // XP (the "how much left" figure) at left, the absolute x/x fraction
    // (moved down from the top row) at right.
    levelBottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    levelRemaining: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xs,
      color: staticColors.mutedMid,
      fontVariant: ['tabular-nums'],
    },
    levelXp: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xs,
      color: staticColors.mutedMid,
      fontVariant: ['tabular-nums'],
    },
    ladder: {
      marginHorizontal: spacing.xl,
      backgroundColor: staticColors.inkCard,
      borderRadius: radii.card,
      paddingHorizontal: spacing.lg,
    },
    ladderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 10,
      borderRadius: radii.card,
    },
    // Subtle highlight only — the old Trophy Room "Current" text label was
    // dropped in favor of color-conveys-state everywhere else in this app's
    // badge grids; same idea here, just a tinted row instead of a tinted
    // badge (there's no separate locked/unlocked art distinction to carry it).
    ladderRowCurrent: {
      backgroundColor: 'rgba(255,255,255,0.06)',
      marginHorizontal: -spacing.md,
      paddingHorizontal: spacing.md,
    },
    ladderBadge: {
      width: 32,
      height: 32,
    },
    ladderTitle: {
      flex: 1,
      fontFamily: fontFamily.bold,
      fontSize: fontSize.sm,
      color: staticColors.surface,
    },
    ladderTitleLocked: {
      color: staticColors.mutedMid,
    },
    ladderLevel: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xs,
      color: staticColors.mutedMid,
      fontVariant: ['tabular-nums'],
    },
    loading: {
      marginTop: spacing.xl,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: radii.pill,
      backgroundColor: staticColors.inkCard,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    emptyText: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.lg,
      color: staticColors.mutedMid,
      textAlign: 'center',
      paddingHorizontal: spacing.xl,
    },
    listContent: {
      paddingBottom: spacing.xxl,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: spacing.xl,
    },
    rowMid: {
      flex: 1,
    },
    rowTitle: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.md,
      color: staticColors.surface,
    },
    rowSub: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xs,
      color: staticColors.mutedMid,
      marginTop: 1,
    },
    rowAmount: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.md,
      color: colors.coinGold,
      fontVariant: ['tabular-nums'],
    },
    rowAmountNegative: {
      color: staticColors.mutedMid,
    },
    separator: {
      height: 1,
      marginHorizontal: spacing.xl,
      backgroundColor: staticColors.inkCard,
    },
  });
}
