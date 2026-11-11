import { useEffect, useMemo } from 'react';
import { View, Text, Animated, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { Receipt, Check } from 'lucide-react-native';
import ScreenHeader, { LargeTitle, useHeaderScroll } from '../components/ledger/ScreenHeader';
import SectionHeader from '../components/ledger/SectionHeader';
import ListRow, { toneColors } from '../components/ledger/ListRow';
import PinnedFooter, { PINNED_FOOTER_HEIGHT } from '../components/ledger/PinnedFooter';
import EmptyState from '../components/ledger/EmptyState';
import CategoryIcon from '../components/CategoryIcon';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, inter } from '../theme/ledger';
import useBills from '../hooks/useBills';
import usePullToRefresh from '../hooks/usePullToRefresh';
import { useAddBillSheet } from '../components/AddBillSheet';
import { usePayBillSheet } from '../components/PayBillSheet';
import { groupBills, billLine } from '../lib/billGroups';
import { amountParts } from '../lib/currency';
import { track } from '../lib/track';

// Bills on the ledger kit (spec 48, ticket 03): grouped under Overdue, This
// week, Later and Paused (lib/billGroups.js), each a flat row with its icon,
// "Monthly · Due 12 Nov", the amount and a round green check (Mark paid). A tap
// opens the bill sheet (bill detail arrives in ticket 04). New bill is
// pinned.
export default function Bills() {
  const { c, modeId } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Which secondary features earn their place (38-home-insights-more.md).
  useEffect(() => {
    track('feature_opened', { feature: 'bills' });
  }, []);
  const { scrollY, onScroll } = useHeaderScroll();
  const { refreshing, onRefresh } = usePullToRefresh();
  const { bills, loading } = useBills();
  const { openAddBill } = useAddBillSheet();
  const { openPayBill } = usePayBillSheet();

  const groups = useMemo(() => groupBills(bills), [bills]);
  const subColor = { danger: c.danger, muted: c.muted };
  // Mark paid is a round check on a soft wash of the "paid" green (the
  // person's call, 2026-11-12), lighter than a text button on every row.
  const paidTint = toneColors(c.positive, c, modeId);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Bills" scrollY={scrollY} />
      <Animated.ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.ink} colors={[c.ink]} />}
      >
        <LargeTitle title="Bills" scrollY={scrollY} />

        {loading ? (
          [0, 1, 2].map((i) => <View key={i} style={styles.rowSkeleton} />)
        ) : bills.length === 0 ? (
          <EmptyState
            illustration="calendar"
            title="No bills yet"
            body="Add rent, subscriptions and anything else that repeats, and FLO reminds you."
            actionTitle="New bill"
            onAction={() => openAddBill()}
          />
        ) : (
          groups.map((g) => (
            <View key={g.key} style={styles.group}>
              <SectionHeader title={g.title} titleColor={g.key === 'overdue' ? c.danger : g.key === 'paused' ? c.muted : undefined} />
              {g.items.map((bill, i) => {
                const line = billLine(bill);
                const overdue = g.key === 'overdue';
                return (
                  <ListRow
                    key={bill.id}
                    // An overdue bill's circle washes in danger; otherwise its
                    // category's colour.
                    tone={overdue ? c.danger : bill.category?.color ?? undefined}
                    icon={bill.category?.icon ? undefined : Receipt}
                    renderIcon={bill.category?.icon ? (tint) => <CategoryIcon icon={bill.category.icon} size={18} color={tint} strokeWidth={1.75} /> : undefined}
                    title={bill.name}
                    sub={line.sub}
                    subColor={subColor[line.tone]}
                    right={
                      <Text style={[styles.money, !bill.is_active && { color: c.muted }]}>
                        {amountParts(bill.amount, { currency: bill.currency }).text}
                      </Text>
                    }
                    trailing={
                      bill.is_active ? (
                        <Pressable
                          onPress={() => openPayBill(bill)}
                          hitSlop={4}
                          style={({ pressed }) => [styles.paid, { backgroundColor: paidTint.bg }, pressed && styles.pressed]}
                          accessibilityRole="button"
                          accessibilityLabel={`Mark ${bill.name} paid`}
                        >
                          <Check size={20} color={paidTint.fg} strokeWidth={2.25} />
                        </Pressable>
                      ) : undefined
                    }
                    onPress={() => openAddBill(bill)}
                    divider={i < g.items.length - 1}
                  />
                );
              })}
            </View>
          ))
        )}
      </Animated.ScrollView>

      <PinnedFooter primary={{ title: 'New bill', onPress: () => openAddBill() }} />
    </View>
  );
}

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
      paddingBottom: PINNED_FOOTER_HEIGHT + ledgerSpace.section,
    },
    group: {
      marginTop: ledgerSpace.md,
    },
    money: {
      ...ledgerType.rowTitle,
      fontFamily: inter.semibold,
      fontVariant: ['tabular-nums'],
      color: c.ink,
    },
    // 40 dp, with hitSlop bringing the target to 48.
    paid: {
      width: 40,
      height: 40,
      borderRadius: ledgerRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: ledgerSpace.md,
    },
    pressed: {
      opacity: 0.7,
    },
    rowSkeleton: {
      height: 64,
      borderRadius: ledgerRadius.input,
      backgroundColor: c.surfaceSunk,
      marginTop: ledgerSpace.md,
    },
  });
}
