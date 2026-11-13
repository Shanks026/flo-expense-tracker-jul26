import { useEffect, useMemo } from 'react';
import { View, Text, Animated, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import ScreenHeader, { LargeTitle, useHeaderScroll } from '../components/ledger/ScreenHeader';
import SectionHeader from '../components/ledger/SectionHeader';
import ListRow from '../components/ledger/ListRow';
import AvatarStack from '../components/ledger/AvatarStack';
import PinnedFooter, { PINNED_FOOTER_HEIGHT } from '../components/ledger/PinnedFooter';
import EmptyState from '../components/ledger/EmptyState';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, inter } from '../theme/ledger';
import useSplits from '../hooks/useSplits';
import usePullToRefresh from '../hooks/usePullToRefresh';
import { useAddSplitSheet } from '../components/AddSplitSheet';
import { supabase } from '../lib/supabase';
import useEntitlement from '../hooks/useEntitlement';
import { useProUpsellSheet } from '../components/ProUpsellSheet';
import { FREE_LIMITS } from '../lib/pro';
import useCurrency from '../hooks/useCurrency';
import { splitNetText } from '../lib/splitNet';
import { track } from '../lib/track';

// Splits on the ledger kit (spec 48, ticket 07): open splits, then a muted
// Closed group. Each row: the members' AvatarStack, the name, the date and
// head count, and the person's position ("You're owed ₹600", "You owe ₹200",
// "Settled up") from lib/splitNet.js, worked out by useSplits with no query
// per split. New split is pinned, behind the free gate as before.
export default function Splits() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Which secondary features earn their place (38-home-insights-more.md).
  useEffect(() => {
    track('feature_opened', { feature: 'splits' });
  }, []);
  const router = useRouter();
  const { scrollY, onScroll } = useHeaderScroll();
  const { refreshing, onRefresh } = usePullToRefresh();
  const { openSplits, closedSplits, loading } = useSplits();
  const { openAddSplit } = useAddSplitSheet();
  const { hasPro } = useEntitlement();
  const { openProUpsell } = useProUpsellSheet();
  const currency = useCurrency();
  const toneColor = { positive: c.positive, ink: c.ink, muted: c.muted };

  // Create-time gate only, per the standing Pro rule. The limit counts OPEN
  // splits, so a Free user can run trip after trip by closing each one first.
  async function handleNewSplit() {
    if (!hasPro) {
      const { count } = await supabase.from('splits').select('id', { count: 'exact', head: true }).eq('status', 'open');
      if ((count ?? 0) >= FREE_LIMITS.splits) {
        openProUpsell('Free includes 1 open split');
        return;
      }
    }
    openAddSplit();
  }

  function row(split, i, list, closed) {
    const net = splitNetText(split, { closed, currency: split.currency ?? currency });
    return (
      <ListRow
        key={split.id}
        renderIcon={() => <AvatarStack members={split.members} max={3} size={18} ring={c.surfaceSunk} />}
        title={split.name}
        sub={`${format(parseISO(split.occurredOn), 'd MMM')} · ${split.memberCount} ${split.memberCount === 1 ? 'person' : 'people'}`}
        right={<Text style={[styles.net, { color: closed ? c.muted : toneColor[net.tone] }]}>{net.text}</Text>}
        trailing="chevron"
        onPress={() => router.push(`/split/${split.id}`)}
        divider={i < list.length - 1}
      />
    );
  }

  const empty = !loading && openSplits.length === 0 && closedSplits.length === 0;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Splits" scrollY={scrollY} />
      <Animated.ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.ink} colors={[c.ink]} />}
      >
        <LargeTitle title="Splits" scrollY={scrollY} />

        {loading ? (
          [0, 1].map((i) => <View key={i} style={styles.rowSkeleton} />)
        ) : empty ? (
          <EmptyState
            illustration="receipt"
            title="Split something"
            body="Add who was there and what it cost; FLO works out who owes whom."
            actionTitle="New split"
            onAction={handleNewSplit}
          />
        ) : (
          <>
            {openSplits.map((s, i, list) => row(s, i, list, false))}
            {closedSplits.length > 0 && (
              <View style={styles.group}>
                <SectionHeader title="Closed" titleColor={c.muted} />
                {closedSplits.map((s, i, list) => row(s, i, list, true))}
              </View>
            )}
          </>
        )}
      </Animated.ScrollView>

      <PinnedFooter primary={{ title: 'New split', onPress: handleNewSplit }} />
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
      marginTop: ledgerSpace.lg,
    },
    // One line on the right (the handoff's row rule): the position as the money.
    net: {
      ...ledgerType.rowTitle,
      fontFamily: inter.semibold,
      fontVariant: ['tabular-nums'],
    },
    rowSkeleton: {
      height: 64,
      borderRadius: ledgerRadius.input,
      backgroundColor: c.surfaceSunk,
      marginTop: ledgerSpace.md,
    },
  });
}
