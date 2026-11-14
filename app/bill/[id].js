import { useEffect, useMemo } from 'react';
import { View, Text, Animated, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pencil } from 'lucide-react-native';
import ScreenHeader, { LargeTitle, useHeaderScroll } from '../../components/ledger/ScreenHeader';
import SectionHeader from '../../components/ledger/SectionHeader';
import AmountText from '../../components/ledger/AmountText';
import Timeline from '../../components/ledger/Timeline';
import PinnedFooter, { PINNED_FOOTER_HEIGHT } from '../../components/ledger/PinnedFooter';
import Callout from '../../components/ledger/Callout';
import { toneColors } from '../../components/ledger/ListRow';
import CategoryIcon from '../../components/CategoryIcon';
import { billIconKey } from '../../lib/billIcons';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, ledgerSize } from '../../theme/ledger';
import useBillDetail from '../../hooks/useBillDetail';
import { useAddBillSheet } from '../../components/AddBillSheet';
import { usePayBillSheet } from '../../components/PayBillSheet';
import { billTerms } from '../../lib/billGroups';
import { billTimeline } from '../../lib/billTimeline';

// A bill, read first (spec 48, ticket 04): a sunk band with its icon, the
// amount, and "Monthly · Due 12 Dec", then the payment timeline (next due,
// each linked payment opening its entry, "Last paid" from before payment
// history, "Added"). Mark paid is pinned; Edit is the pencil. A paused bill
// has no Mark paid. A failed load offers Retry instead of leaving
// (spec 49, ticket 02): only a bill that's really gone sends the screen back.
export default function BillDetail() {
  const { c, modeId } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { scrollY, onScroll } = useHeaderScroll();
  const { bill, payments, loading, error, missing, refetch } = useBillDetail(id);
  const { openAddBill } = useAddBillSheet();
  const { openPayBill } = usePayBillSheet();

  // Deleting the bill from its sheet leaves this screen on a dead id, and a
  // link may carry no id at all: go back. A failed read stays (Retry below).
  useEffect(() => {
    if (missing) router.back();
  }, [missing]);

  const steps = useMemo(
    () =>
      bill
        ? billTimeline(bill, payments).map((s) => (s.txId ? { ...s, onPress: () => router.push(`/transaction/${s.txId}`) } : s))
        : [],
    [bill, payments]
  );

  if (error) {
    return (
      <View style={styles.screen}>
        <ScreenHeader />
        <View style={styles.scroll}>
          <Callout tone="danger" text="Couldn't load this bill" actionLabel="Retry" onAction={refetch} style={styles.error} />
        </View>
      </View>
    );
  }

  if (loading || !bill) {
    return (
      <View style={styles.screen}>
        <ScreenHeader />
        <View style={styles.loading}>
          <ActivityIndicator color={c.ink} />
        </View>
      </View>
    );
  }

  const terms = billTerms(bill);
  const overdue = terms.tone === 'danger';
  // Canvas unless there's a colour to wash: a sunk circle would vanish on the band.
  const tint = overdue ? toneColors(c.danger, c, modeId) : bill.category?.color ? toneColors(bill.category.color, c, modeId) : { bg: c.canvas, fg: c.ink };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={bill.name}
        scrollY={scrollY}
        actions={[{ icon: Pencil, onPress: () => openAddBill(bill), accessibilityLabel: 'Edit bill' }]}
      />
      <Animated.ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scroll, bill.is_active && { paddingBottom: PINNED_FOOTER_HEIGHT + ledgerSpace.section }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <LargeTitle title={bill.name} scrollY={scrollY} />

        <View style={styles.band}>
          <View style={[styles.circle, { backgroundColor: tint.bg }]}>
            <CategoryIcon icon={billIconKey(bill)} size={20} color={tint.fg} strokeWidth={1.75} />
          </View>
          <AmountText value={bill.amount} size="display" currency={bill.currency} />
          <Text style={[styles.line, terms.tone === 'danger' && { color: c.danger }]}>{terms.text}</Text>
        </View>

        <SectionHeader title="Payments" style={styles.section} />
        <Timeline steps={steps} />
      </Animated.ScrollView>

      {bill.is_active && <PinnedFooter primary={{ title: 'Mark paid', onPress: () => openPayBill(bill) }} />}
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
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: {
      paddingHorizontal: ledgerSpace.gutter,
      paddingBottom: ledgerSpace.section * 2,
    },
    band: {
      marginTop: ledgerSpace.md,
      padding: ledgerSpace.gutter,
      borderRadius: ledgerRadius.card,
      backgroundColor: c.surfaceSunk,
      alignItems: 'center',
      gap: ledgerSpace.sm,
    },
    circle: {
      width: ledgerSize.iconCircle + 8,
      height: ledgerSize.iconCircle + 8,
      borderRadius: ledgerRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: ledgerSpace.xs,
    },
    line: {
      ...ledgerType.body,
      color: c.muted,
    },
    error: {
      marginTop: ledgerSpace.md,
    },
    section: {
      marginTop: ledgerSpace.section,
      marginBottom: ledgerSpace.md,
    },
  });
}
