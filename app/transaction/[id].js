import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeftRight, Users, ChevronRight } from 'lucide-react-native';
import { format } from 'date-fns';
import ScreenHeader from '../../components/ledger/ScreenHeader';
import Segmented from '../../components/ledger/Segmented';
import AmountText from '../../components/ledger/AmountText';
import Timeline from '../../components/ledger/Timeline';
import PinnedFooter from '../../components/ledger/PinnedFooter';
import EmptyState from '../../components/ledger/EmptyState';
import { toneColors } from '../../components/ledger/ListRow';
import CategoryIcon from '../../components/CategoryIcon';
import { useAddTransactionSheet } from '../../components/AddTransactionSheet';
import { useToast } from '../../components/Toast';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, ledgerSize } from '../../theme/ledger';
import useTransactionDetail from '../../hooks/useTransactionDetail';
import { useAccount } from '../../lib/AccountContext';
import { useDataRefresh } from '../../lib/DataRefreshContext';
import { isTransfer } from '../../lib/transfers';
import { isSettlement, settlementLabel } from '../../lib/settlements';
import { deleteTransaction } from '../../lib/transactions';
import { sourceLabel, buildHistory } from '../../lib/entryDetail';
import { dateFromYmd } from '../../lib/activity';
import { destructiveHaptic } from '../../lib/haptics';
import { FLAGS } from '../../lib/flags';
import { DEFAULT_CURRENCY } from '../../lib/currency';

// Transaction detail (spec 46, ticket 11): read first, then edit. A sunk top
// band (circle, amount, title, date and account), Details | History, and
// Edit / Delete pinned at the bottom. Opened from Home's recent rows and
// Activity; Back returns to the list as it was (Activity's filters are its
// own state).
export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { c, modeId } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { accounts } = useAccount();
  const { notifyChanged } = useDataRefresh();
  const { openAdd } = useAddTransactionSheet();
  const { showToast } = useToast();
  const { transaction: tx, counterpart, splitEntry, loading, error, refetch } = useTransactionDetail(typeof id === 'string' ? id : null);
  const [tab, setTab] = useState('details');
  const [deleting, setDeleting] = useState(false);
  // Set once the entry has been on screen. If it then disappears (deleted
  // from the Edit sheet, or here), the screen goes back instead of showing
  // "gone"; `leaving` keeps that frame blank.
  const seenRef = useRef(false);
  const [leaving, setLeaving] = useState(false);
  if (tx) seenRef.current = true;
  const vanished = !loading && !error && !tx && seenRef.current;
  useEffect(() => {
    if (vanished && !leaving) {
      setLeaving(true);
      router.back();
    }
  }, [vanished, leaving, router]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader />
        <View style={[styles.band, styles.bandSkeleton]} />
      </View>
    );
  }
  if (leaving || vanished) return <View style={styles.screen} />;
  if (error) {
    return (
      <View style={styles.screen}>
        <ScreenHeader />
        <EmptyState illustration="receipt" title="Couldn’t load this entry" body="Check your connection and try again." actionTitle="Try again" onAction={refetch} />
      </View>
    );
  }
  if (!tx) {
    // Opened on an id that no longer exists (an old link).
    return (
      <View style={styles.screen}>
        <ScreenHeader />
        <EmptyState illustration="receipt" title="This entry is gone" body="It was deleted or replaced." actionTitle="Back" onAction={() => router.back()} />
      </View>
    );
  }

  const transfer = isTransfer(tx);
  const settlement = isSettlement(tx);
  const accountName = (accountId) => accounts.find((a) => a.id === accountId)?.name ?? 'Deleted account';
  const currency = accounts.find((a) => a.id === tx.account_id)?.currency ?? DEFAULT_CURRENCY;
  const otherAccountId = counterpart?.account_id ?? tx.transfer_account_id;
  const fromId = tx.type === 'transfer_out' ? tx.account_id : otherAccountId;
  const toId = tx.type === 'transfer_out' ? otherAccountId : tx.account_id;

  const note = tx.note?.trim();
  const categoryName = tx.category?.name ?? (tx.type === 'income' ? 'Income' : 'Expense');
  const title = transfer
    ? `From ${accountName(fromId)} → To ${accountName(toId)}`
    : settlement
      ? settlementLabel(tx)
      : note || categoryName;
  const day = format(dateFromYmd(tx.occurred_at.slice(0, 10)), 'EEE d MMM yyyy');
  const toned = transfer || settlement ? toneColors(null, c, modeId) : toneColors(tx.category?.color, c, modeId);
  // An untinted circle is sunk, like the band under it: draw it on canvas.
  const circleBg = toned.bg === c.surfaceSunk ? c.canvas : toned.bg;
  const source = sourceLabel(tx.source);

  const rows = [
    transfer ? { key: 'from', label: 'From', value: accountName(fromId) } : null,
    transfer ? { key: 'to', label: 'To', value: accountName(toId) } : null,
    !transfer && !settlement ? { key: 'category', label: 'Category', value: categoryName } : null,
    !transfer ? { key: 'account', label: 'Account', value: accountName(tx.account_id) } : null,
    { key: 'date', label: 'Date', value: day },
    note ? { key: 'note', label: 'Note', value: note } : null,
    FLAGS.plans && tx.plan?.name ? { key: 'plan', label: 'Plan', value: tx.plan.name } : null,
    splitEntry?.split
      ? { key: 'split', label: 'Split', value: splitEntry.split.name, onPress: () => router.push(`/split/${splitEntry.split.id}`) }
      : null,
    source ? { key: 'source', label: 'Source', value: source } : null,
  ].filter(Boolean);
  if (rows.length) rows[rows.length - 1].last = true;

  const stamp = (iso) => format(new Date(iso), 'd MMM yyyy, h:mm a');
  const history = buildHistory(tx, splitEntry).map((s) => ({ ...s, sub: [s.sub, stamp(s.at)].filter(Boolean).join(' · ') }));

  function confirmDelete() {
    const what = transfer ? 'this transfer' : 'this entry';
    const body = transfer
      ? 'Both sides of the transfer are removed. This can’t be undone.'
      : splitEntry?.split
        ? `It stays in ${splitEntry.split.name}, just no longer linked. This can’t be undone.`
        : 'This can’t be undone.';
    Alert.alert(`Delete ${what}?`, body, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: handleDelete },
    ]);
  }

  async function handleDelete() {
    destructiveHaptic();
    setDeleting(true);
    const { error } = await deleteTransaction(tx);
    setDeleting(false);
    if (error) {
      showToast({ message: error.message, variant: 'error' });
      return;
    }
    setLeaving(true);
    notifyChanged();
    router.back();
    showToast({ message: transfer ? 'Transfer deleted' : 'Transaction deleted', variant: 'success' });
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader />
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.band}>
          <View style={[styles.circle, { backgroundColor: circleBg }]}>
            {transfer ? (
              <ArrowLeftRight size={24} color={toned.fg} strokeWidth={1.75} />
            ) : settlement ? (
              <Users size={24} color={toned.fg} strokeWidth={1.75} />
            ) : (
              <CategoryIcon icon={tx.category?.icon} size={24} color={toned.fg} strokeWidth={1.75} />
            )}
          </View>
          <AmountText value={tx.amount} type={transfer ? 'neutral' : tx.type} signed={!transfer} size="display" currency={currency} style={styles.amount} />
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.meta}>{transfer ? day : `${day} · ${accountName(tx.account_id)}`}</Text>
        </View>

        <Segmented
          options={[
            { value: 'details', label: 'Details' },
            { value: 'history', label: 'History' },
          ]}
          value={tab}
          onChange={setTab}
          accessibilityLabel="Details or history"
          style={styles.segmented}
        />

        {tab === 'details' ? (
          <View>
            {rows.map((r) => {
              const content = (
                <>
                  <Text style={styles.rowLabel}>{r.label}</Text>
                  <Text style={[styles.rowValue, r.onPress && styles.rowLink]} numberOfLines={3}>
                    {r.value}
                  </Text>
                  {r.onPress ? <ChevronRight size={18} color={c.muted} strokeWidth={1.75} /> : null}
                </>
              );
              const rowStyle = [styles.row, !r.last && styles.rowDivider];
              return r.onPress ? (
                <Pressable
                  key={r.key}
                  onPress={r.onPress}
                  style={({ pressed }) => [...rowStyle, pressed && { opacity: 0.6 }]}
                  accessibilityRole="link"
                  accessibilityLabel={`${r.label}: ${r.value}. Open the split`}
                >
                  {content}
                </Pressable>
              ) : (
                <View key={r.key} style={rowStyle} accessible accessibilityLabel={`${r.label}: ${r.value}`}>
                  {content}
                </View>
              );
            })}
          </View>
        ) : (
          <Timeline steps={history} style={styles.timeline} />
        )}
      </ScrollView>

      <PinnedFooter
        secondary={{ title: 'Delete', variant: 'danger', onPress: confirmDelete, loading: deleting }}
        primary={{ title: 'Edit', onPress: () => openAdd(tx), disabled: deleting }}
        style={styles.footer}
      />
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
      paddingBottom: ledgerSpace.section,
    },
    band: {
      alignItems: 'center',
      backgroundColor: c.surfaceSunk,
      borderRadius: ledgerRadius.card,
      paddingVertical: ledgerSpace.section,
      paddingHorizontal: ledgerSpace.lg,
      marginTop: ledgerSpace.sm,
    },
    bandSkeleton: {
      height: 220,
      marginHorizontal: ledgerSpace.gutter,
    },
    circle: {
      width: 56,
      height: 56,
      borderRadius: ledgerRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: ledgerSpace.md,
    },
    amount: {
      textAlign: 'center',
    },
    title: {
      ...ledgerType.section,
      color: c.ink,
      textAlign: 'center',
      marginTop: ledgerSpace.xs,
    },
    meta: {
      ...ledgerType.caption,
      color: c.muted,
      textAlign: 'center',
      marginTop: ledgerSpace.xs,
    },
    segmented: {
      marginTop: ledgerSpace.section,
      marginBottom: ledgerSpace.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ledgerSpace.md,
      minHeight: ledgerSize.hit + ledgerSpace.sm,
      paddingVertical: ledgerSpace.sm,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.hairline,
    },
    rowLabel: {
      ...ledgerType.body,
      color: c.muted,
      width: 88,
    },
    rowValue: {
      ...ledgerType.rowTitle,
      color: c.ink,
      flex: 1,
      textAlign: 'right',
    },
    rowLink: {
      textDecorationLine: 'underline',
    },
    timeline: {
      marginTop: ledgerSpace.lg,
    },
    footer: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.hairline,
    },
  });
}
