import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Square, SquareCheck } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO, subDays, startOfDay, isBefore } from 'date-fns';
import ScreenHeader from '../../../components/ledger/ScreenHeader';
import ListRow from '../../../components/ledger/ListRow';
import Chip from '../../../components/ledger/Chip';
import AmountText from '../../../components/ledger/AmountText';
import PinnedFooter, { PINNED_FOOTER_HEIGHT } from '../../../components/ledger/PinnedFooter';
import CategoryIcon from '../../../components/CategoryIcon';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius } from '../../../theme/ledger';
import { formatMoney } from '../../../lib/currency';
import useSplit from '../../../hooks/useSplit';
import useCurrency from '../../../hooks/useCurrency';
import useSplitCandidates from '../../../hooks/useSplitCandidates';
import useCategories from '../../../hooks/useCategories';
import { createEntriesFromTransactions } from '../../../lib/splits';
import { useDataRefresh } from '../../../lib/DataRefreshContext';
import { useToast } from '../../../components/Toast';

// "Add from my transactions" — the mirror image of app/plan/[id]/history.js,
// and deliberately built to the same shape (same filters, same select-all row,
// same footer that names what's about to happen).
//
// The difference in what it DOES matters, though: the plan version bulk-updates
// `transactions.plan_id`, one column on rows that already exist. This one
// CREATES split entries from those transactions — the transactions themselves
// are never modified. A split entry is a different object living beside the
// ledger, not a tag on it.
// On the ledger kit (spec 48, ticket 08): date fields, category Chips, a
// select-all row, rows with a check, and a pinned footer naming what happens.
export default function SplitHistory() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();
  const { split, entries, loading: splitLoading } = useSplit(id);
  const { expenseCategories } = useCategories();
  const currency = useCurrency();

  const [from, setFrom] = useState(() => subDays(startOfDay(new Date()), 30));
  const [to, setTo] = useState(() => startOfDay(new Date()));
  const [showPicker, setShowPicker] = useState(null); // 'start' | 'end' | null
  const [categoryId, setCategoryId] = useState(null);
  const [selected, setSelected] = useState({});
  const [saving, setSaving] = useState(false);

  // Seed the window from the split's own date — the whole reason it has one.
  // Once only, so a later manual change isn't stomped on a refetch. A split is
  // a single-day event far more often than a plan is, so the window opens as
  // that day ± a week rather than the day itself: a train ticket booked three
  // days earlier is still part of the trip.
  const seededRef = useRef(false);
  useEffect(() => {
    if (split && !seededRef.current) {
      seededRef.current = true;
      if (split.occurredOn) {
        const day = parseISO(split.occurredOn);
        setFrom(subDays(day, 7));
        setTo(day);
      }
    }
  }, [split]);

  useEffect(() => {
    if (!splitLoading && !split) router.back();
  }, [splitLoading, split]);

  // Anything already pulled in shouldn't be offered again.
  const alreadyLinkedIds = useMemo(
    () => entries.map((e) => e.transactionId).filter(Boolean),
    [entries]
  );

  const { transactions, loading } = useSplitCandidates(split, {
    from: format(from, 'yyyy-MM-dd'),
    to: format(to, 'yyyy-MM-dd'),
    categoryId,
    alreadyLinkedIds,
  });

  const selectedIds = Object.keys(selected);
  const selectedCount = selectedIds.length;
  const selectedTotal = selectedIds.reduce((sum, sid) => sum + Number(selected[sid].amount), 0);
  const allVisibleSelected = transactions.length > 0 && transactions.every((t) => selected[t.id]);

  function toggle(tx) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[tx.id]) delete next[tx.id];
      else next[tx.id] = tx;
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = { ...prev };
      if (allVisibleSelected) transactions.forEach((t) => delete next[t.id]);
      else transactions.forEach((t) => (next[t.id] = t));
      return next;
    });
  }

  async function handleSave() {
    if (selectedCount === 0 || !split) return;
    setSaving(true);
    const { created, error } = await createEntriesFromTransactions({
      splitId: split.id,
      transactions: selectedIds.map((sid) => selected[sid]),
    });
    setSaving(false);

    // Partial success is real here — entries are written one at a time — so
    // report what actually landed rather than implying all or nothing.
    if (error) {
      notifyChanged();
      showToast({
        message: created
          ? `Added ${created} of ${selectedCount}, then stopped: ${error.message}`
          : error.message,
        variant: 'error',
      });
      return;
    }
    notifyChanged();
    showToast({
      message: `Added ${created} ${created === 1 ? 'entry' : 'entries'} to ${split.name}`,
      variant: 'success',
    });
    router.back();
  }

  if (splitLoading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="" />
        <View style={styles.loading}>
          <ActivityIndicator color={c.ink} />
        </View>
      </View>
    );
  }

  if (!split) return null;

  // Category chips draw the category's own icon through the Chip's `icon` slot.
  const categoryIcon = (key) => (props) => <CategoryIcon icon={key} {...props} />;

  return (
    <View style={styles.screen}>
      <ScreenHeader title={`Add to ${split.name}`} />

      <View style={styles.filters}>
        <View style={styles.dateRow}>
          <Pressable style={styles.dateField} onPress={() => setShowPicker('start')} accessibilityRole="button" accessibilityLabel={`From ${format(from, 'd MMMM yyyy')}`}>
            <Text style={styles.dateLabel}>From</Text>
            <Text style={styles.dateValue}>{format(from, 'd MMM yyyy')}</Text>
          </Pressable>
          <Pressable style={styles.dateField} onPress={() => setShowPicker('end')} accessibilityRole="button" accessibilityLabel={`To ${format(to, 'd MMMM yyyy')}`}>
            <Text style={styles.dateLabel}>To</Text>
            <Text style={styles.dateValue}>{format(to, 'd MMM yyyy')}</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
          <Chip label="All" selected={categoryId === null} onPress={() => setCategoryId(null)} />
          {expenseCategories.map((cat) => (
            <Chip key={cat.id} label={cat.name} icon={categoryIcon(cat.icon)} selected={categoryId === cat.id} onPress={() => setCategoryId(cat.id)} />
          ))}
        </ScrollView>
      </View>

      {showPicker && (
        <DateTimePicker
          value={showPicker === 'start' ? from : to}
          mode="date"
          display="default"
          onChange={(_event, picked) => {
            setShowPicker(null);
            if (!picked) return;
            const day = startOfDay(picked);
            if (showPicker === 'start') {
              setFrom(day);
              if (isBefore(to, day)) setTo(day);
            } else {
              setTo(day);
              if (isBefore(day, from)) setFrom(day);
            }
          }}
        />
      )}

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        style={styles.flex}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          transactions.length > 0 ? (
            <ListRow
              icon={allVisibleSelected ? SquareCheck : Square}
              title={allVisibleSelected ? 'Clear all' : 'Select all'}
              right={`${transactions.length} ${transactions.length === 1 ? 'result' : 'results'}`}
              onPress={toggleAll}
            />
          ) : null
        }
        ListEmptyComponent={loading ? null : <Text style={styles.empty}>No expenses left to add in this range.</Text>}
        ListFooterComponent={selectedCount > 0 ? <Text style={styles.note}>Added as entries you paid, split equally. Editable after.</Text> : null}
        renderItem={({ item, index }) => {
          const isSelected = !!selected[item.id];
          return (
            <ListRow
              tone={item.category?.color}
              renderIcon={(tint) => <CategoryIcon icon={item.category?.icon} size={18} color={tint} strokeWidth={1.75} />}
              title={item.note?.trim() || item.category?.name || 'Uncategorized'}
              sub={`${format(parseISO(item.occurred_at), 'd MMM')}${item.note?.trim() && item.category?.name ? ` · ${item.category.name}` : ''}`}
              right={<AmountText value={item.amount} currency={currency} />}
              trailing={
                <View style={[styles.check, isSelected ? { backgroundColor: c.ink, borderColor: c.ink } : { borderColor: c.hairline }]}>
                  {isSelected && <Check size={14} color={c.inkOnInk} strokeWidth={2.5} />}
                </View>
              }
              onPress={() => toggle(item)}
              accessibilityLabel={`${item.note?.trim() || item.category?.name || 'Uncategorized'}${isSelected ? ', selected' : ''}`}
              divider={index < transactions.length - 1}
            />
          );
        }}
      />

      <PinnedFooter
        primary={{
          title: selectedCount === 0
            ? 'Select transactions'
            : `Add ${selectedCount} ${selectedCount === 1 ? 'entry' : 'entries'} · ${formatMoney(selectedTotal, currency)}`,
          onPress: handleSave,
          disabled: selectedCount === 0,
          loading: saving,
        }}
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
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filters: {
      paddingHorizontal: ledgerSpace.gutter,
      paddingTop: ledgerSpace.sm,
      gap: ledgerSpace.md,
    },
    dateRow: {
      flexDirection: 'row',
      gap: ledgerSpace.md,
    },
    dateField: {
      flex: 1,
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: ledgerSpace.lg,
      paddingVertical: ledgerSpace.sm,
      borderRadius: ledgerRadius.input,
      backgroundColor: c.surfaceSunk,
    },
    dateLabel: {
      ...ledgerType.caption,
      color: c.muted,
    },
    dateValue: {
      ...ledgerType.rowTitle,
      color: c.ink,
    },
    // Bleeds to the screen's edges so the chips scroll edge to edge.
    chipScroll: {
      marginHorizontal: -ledgerSpace.gutter,
    },
    chipRow: {
      gap: ledgerSpace.sm,
      paddingHorizontal: ledgerSpace.gutter,
      paddingBottom: ledgerSpace.sm,
    },
    listContent: {
      paddingHorizontal: ledgerSpace.gutter,
      paddingBottom: PINNED_FOOTER_HEIGHT + ledgerSpace.section,
    },
    check: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: ledgerSpace.md,
    },
    empty: {
      ...ledgerType.body,
      color: c.muted,
      textAlign: 'center',
      marginTop: ledgerSpace.section,
    },
    note: {
      ...ledgerType.caption,
      color: c.muted,
      textAlign: 'center',
      marginTop: ledgerSpace.lg,
    },
  });
}
