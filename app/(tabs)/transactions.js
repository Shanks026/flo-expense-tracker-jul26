import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Search, X, CalendarDays, Wallet, Shapes, ListFilter } from 'lucide-react-native';
import { LargeTitle } from '../../components/ledger/ScreenHeader';
import Chip from '../../components/ledger/Chip';
import AmountText from '../../components/ledger/AmountText';
import EmptyState from '../../components/ledger/EmptyState';
import TransactionRow from '../../components/ledger/TransactionRow';
import ActivityFilterSheet, { TYPE_OPTIONS } from '../../components/ActivityFilterSheet';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, inter } from '../../theme/ledger';
import useActivity from '../../hooks/useActivity';
import useCategories from '../../hooks/useCategories';
import usePullToRefresh from '../../hooks/usePullToRefresh';
import { useAccount } from '../../lib/AccountContext';
import { dateGroupLabel } from '../../lib/dateLabels';
import { DEFAULT_CURRENCY } from '../../lib/currency';
import {
  DEFAULT_FILTERS,
  activityRange,
  rangeLabel,
  filterActivity,
  summarizeActivity,
  pairTransfers,
  groupEntries,
  transferTitle,
  isDefaultFilters,
  filtersFromLink,
} from '../../lib/activity';

// Activity (spec 46, ticket 10): a search field, then Type, Category,
// Account and Date chips, a one-line "Spent · Received" for what's in view,
// and the date-grouped list with each transfer as one ⇄ row.
//
// Filters live in this screen's state, so opening a row and coming back
// keeps them. The default is this month, the active account, all types; the
// account default is stored as null so it follows an account switch.
export default function Activity() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { accounts, activeAccountId, activeAccount } = useAccount();
  const { categories } = useCategories();
  const router = useRouter();
  const { refreshing, onRefresh } = usePullToRefresh();

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const params = useLocalSearchParams();

  // Opened from a link (an Insights category, spec 48): its filters replace
  // the current ones once per visit (`at` is fresh per tap); the chips then
  // work as normal.
  useEffect(() => {
    const linked = filtersFromLink(params);
    if (linked) setFilters(linked);
  }, [params.at]);
  const [sheetKind, setSheetKind] = useState(null);
  const sheetRef = useRef(null);

  const accountId = filters.accountId ?? activeAccountId;
  const allAccounts = accountId === 'all';
  const accountIds = useMemo(
    () => (allAccounts ? accounts.map((a) => a.id) : accountId ? [accountId] : []),
    [allAccounts, accounts, accountId]
  );
  const { from, to } = activityRange(filters.range);
  const { transactions, loading } = useActivity({ accountIds, from, to });

  const visible = useMemo(() => filterActivity(transactions, filters), [transactions, filters]);
  const summary = useMemo(() => summarizeActivity(visible), [visible]);
  const groups = useMemo(() => groupEntries(pairTransfers(visible)), [visible]);

  // All accounts sums in the active account's currency (a mixed-currency
  // total isn't meaningful; every account is INR today).
  const summaryCurrency = (allAccounts ? activeAccount : accounts.find((a) => a.id === accountId))?.currency ?? DEFAULT_CURRENCY;
  const accountName = (id) => accounts.find((a) => a.id === id)?.name;

  const update = (patch) => setFilters((f) => ({ ...f, ...patch }));
  function openSheet(kind) {
    setSheetKind(kind);
    sheetRef.current?.present();
  }

  const typeLabel = TYPE_OPTIONS.find((o) => o.value === filters.type)?.label ?? 'All types';
  const categoryLabel = categories.find((cat) => cat.id === filters.categoryId)?.name ?? 'All categories';
  const accountLabel = allAccounts ? 'All accounts' : accountName(accountId) ?? 'Account';
  const chips = [
    { kind: 'type', label: typeLabel, selected: filters.type !== 'all', name: 'Type', icon: ListFilter },
    { kind: 'category', label: categoryLabel, selected: filters.categoryId != null, name: 'Category', icon: Shapes },
    { kind: 'account', label: accountLabel, selected: filters.accountId != null, name: 'Account', icon: Wallet },
    { kind: 'range', label: rangeLabel(filters.range), selected: filters.range.preset !== 'this_month', name: 'Date range', icon: CalendarDays },
  ];

  const filtered = !isDefaultFilters(filters);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.top}>
        <LargeTitle title="Activity" />
        <View style={styles.search}>
          <Search size={18} color={c.muted} strokeWidth={1.75} />
          <TextInput
            value={filters.search}
            onChangeText={(search) => update({ search })}
            placeholder="Search notes, categories, amounts"
            placeholderTextColor={c.muted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search activity"
          />
          {!!filters.search && (
            <Pressable onPress={() => update({ search: '' })} hitSlop={15} accessibilityRole="button" accessibilityLabel="Clear search">
              <X size={18} color={c.muted} strokeWidth={1.75} />
            </Pressable>
          )}
        </View>
      </View>

      {/* The chips wrap inside the gutter rather than scrolling off the edge. */}
      <View style={styles.chips}>
        {chips.map((chip) => (
          <Chip
            key={chip.kind}
            label={chip.label}
            icon={chip.icon}
            caret
            selected={chip.selected}
            onPress={() => openSheet(chip.kind)}
            accessibilityLabel={`${chip.name}: ${chip.label}`}
            accessibilityHint="Opens a sheet to change it"
          />
        ))}
      </View>

      <Text style={styles.summary}>
        Spent <AmountText value={summary.spent} currency={summaryCurrency} style={styles.summaryAmount} /> · Received{' '}
        <AmountText value={summary.received} currency={summaryCurrency} style={styles.summaryAmount} />
      </Text>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.ink} colors={[c.ink]} />}
      >
        {loading ? (
          [0, 1, 2, 3].map((i) => <View key={i} style={styles.rowSkeleton} />)
        ) : groups.length === 0 ? (
          filtered ? (
            <EmptyState
              illustration="receipt"
              title="No matches"
              body="Nothing fits these filters."
              actionTitle="Clear filters"
              onAction={() => setFilters(DEFAULT_FILTERS)}
            />
          ) : (
            <EmptyState illustration="receipt" title="Nothing this month" body="Tap + to log what you spend." />
          )
        ) : (
          groups.map((g) => (
            <View key={g.key} style={styles.group}>
              <Text style={styles.groupLabel}>{dateGroupLabel(g.date)}</Text>
              {g.items.map((entry, i) => (
                <TransactionRow
                  key={entry.key}
                  tx={entry.tx}
                  accounts={accounts}
                  title={entry.kind === 'transfer' ? transferTitle(entry, accounts) : undefined}
                  // Across accounts, say which one (a paired transfer names both already).
                  accountName={allAccounts && entry.kind !== 'transfer' ? accountName(entry.tx.account_id) : undefined}
                  divider={i < g.items.length - 1}
                  onPress={() => router.push(`/transaction/${entry.tx.id}`)}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <ActivityFilterSheet
        ref={sheetRef}
        kind={sheetKind}
        filters={filters}
        accounts={accounts}
        activeAccountId={activeAccountId}
        categories={categories}
        onChange={update}
      />
    </SafeAreaView>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: c.canvas,
    },
    flex: {
      flex: 1,
    },
    top: {
      paddingHorizontal: ledgerSpace.gutter,
      paddingTop: ledgerSpace.sm,
    },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ledgerSpace.sm,
      height: 44,
      marginTop: ledgerSpace.md,
      paddingHorizontal: ledgerSpace.lg,
      borderRadius: ledgerRadius.field,
      backgroundColor: c.surfaceSunk,
    },
    searchInput: {
      flex: 1,
      ...ledgerType.body,
      color: c.ink,
      paddingVertical: 0,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ledgerSpace.sm,
      paddingHorizontal: ledgerSpace.gutter,
      paddingTop: ledgerSpace.lg,
      paddingBottom: ledgerSpace.lg,
    },
    summary: {
      ...ledgerType.body,
      color: c.muted,
      paddingHorizontal: ledgerSpace.gutter,
      paddingBottom: ledgerSpace.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.hairline,
    },
    summaryAmount: {
      fontFamily: inter.semibold,
      color: c.ink,
    },
    scroll: {
      paddingHorizontal: ledgerSpace.gutter,
      paddingBottom: 120,
    },
    group: {
      marginTop: ledgerSpace.sm,
    },
    groupLabel: {
      ...ledgerType.group,
      color: c.muted,
      marginTop: ledgerSpace.sm,
    },
    rowSkeleton: {
      height: 48,
      borderRadius: ledgerRadius.input,
      backgroundColor: c.surfaceSunk,
      marginTop: ledgerSpace.md,
    },
  });
}
