import { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { BottomSheetModal, BottomSheetFlatList, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { X, CircleDollarSign, PiggyBank, Snowflake } from 'lucide-react-native';
import { format } from 'date-fns';
import { colors as staticColors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { supabase } from '../lib/supabase';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import useRewards from '../hooks/useRewards';
import { buyFreeze } from '../lib/rewardsMutations';
import { FREEZE_COST, FREEZE_CAP } from '../lib/rewards';
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

// The coin chip's destination, pinned-dark chrome every non-form sheet in
// this app uses (AlertsSheet is the closest sibling: a read-only feed, not a
// form) — plus the one shop item that exists so far: the streak freeze
// (18-gamification-ritual-and-ledger.md Phase 4). Cosmetics/themes are a
// later, separate wave.
const RewardsHistorySheet = forwardRef(function RewardsHistorySheet(_props, ref) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const modalRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef);
  const { coins, freezes } = useRewards();
  const { notifyChanged } = useDataRefresh();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);

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

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    []
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      onChange={handleSheetChange}
      snapPoints={useMemo(() => ['70%'], [])}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: staticColors.ink, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
      handleIndicatorStyle={{ backgroundColor: '#3a3a3a', width: 44 }}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <CircleDollarSign size={20} color={colors.coinGold} fill={colors.coinGold} strokeWidth={1.5} />
          </View>
          <View>
            <Text style={styles.headerTitle}>{coins.toLocaleString('en-IN')} coins</Text>
            <Text style={styles.headerSubtitle}>Earned by logging</Text>
          </View>
        </View>
        <Pressable style={styles.closeButton} onPress={() => modalRef.current?.dismiss()}>
          <X size={16} color={staticColors.surface} strokeWidth={2.6} />
        </Pressable>
      </View>

      {/* The one shop item that exists so far — the anchor consumable, zero
          art needed. Cosmetics/themes are a later, separate wave. */}
      <View style={styles.shopCard}>
        <View style={styles.shopIcon}>
          <Snowflake size={20} color={colors.iceBlue} fill={colors.iceBlue} strokeWidth={2.4} />
        </View>
        <View style={styles.shopTextWrap}>
          <Text style={styles.shopTitle}>Streak Freeze</Text>
          <Text style={styles.shopSubtitle}>
            {atCap ? `You're holding the max (${FREEZE_CAP})` : `${FREEZE_COST} coins · hold up to ${FREEZE_CAP}`}
          </Text>
        </View>
        <Pressable
          style={[styles.buyButton, (buying || atCap || cantAfford) && styles.buyButtonDisabled]}
          onPress={handleBuyPress}
          disabled={buying || atCap || cantAfford}
        >
          {buying ? (
            <ActivityIndicator size="small" color={staticColors.ink} />
          ) : (
            <Text style={styles.buyButtonText}>Buy</Text>
          )}
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={staticColors.surface} style={styles.loading} />
      ) : events.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <PiggyBank size={26} color={colors.coinGold} strokeWidth={2} />
          </View>
          <Text style={styles.emptyText}>Log a transaction to start earning coins.</Text>
        </View>
      ) : (
        <BottomSheetFlatList
          data={events}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.listContent}
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
      )}
    </BottomSheetModal>
  );
});

function makeStyles(colors) {
  return StyleSheet.create({
    shopCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.lg,
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
    buyButton: {
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
    buyButtonText: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.sm,
      color: staticColors.ink,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.lg,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      flexShrink: 1,
    },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: staticColors.inkCard,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.xl,
      color: staticColors.surface,
    },
    headerSubtitle: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xs,
      color: staticColors.mutedMid,
      marginTop: 1,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      backgroundColor: staticColors.inkCard,
      alignItems: 'center',
      justifyContent: 'center',
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
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxl,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
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
      backgroundColor: staticColors.inkCard,
    },
  });
}
