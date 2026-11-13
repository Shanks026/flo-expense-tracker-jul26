import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Redirect } from 'expo-router';
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
import { usePlan } from '../../../hooks/usePlans';
import useCurrency from '../../../hooks/useCurrency';
import { FLAGS } from '../../../lib/flags';
import usePlanCandidates from '../../../hooks/usePlanCandidates';
import useCategories from '../../../hooks/useCategories';
import { supabase } from '../../../lib/supabase';
import { useDataRefresh } from '../../../lib/DataRefreshContext';
import { useToast } from '../../../components/Toast';

// Plans flagged off (lib/flags.js): a deep link here lands on Home.
// On the ledger kit (spec 48, ticket 10; Plans stay flagged off): the same
// shape as a split's "Add from my transactions".
export default function PlanHistory() {
  if (!FLAGS.plans) return <Redirect href="/" />;
  return <PlanHistoryScreen />;
}

function PlanHistoryScreen() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();
  const { plan, loading: planLoading } = usePlan(id);
  const { expenseCategories } = useCategories();
  const currency = useCurrency();

  const [from, setFrom] = useState(() => subDays(startOfDay(new Date()), 30));
  const [to, setTo] = useState(() => startOfDay(new Date()));
  const [showPicker, setShowPicker] = useState(null); // 'start' | 'end' | null
  const [categoryId, setCategoryId] = useState(null);
  const [selected, setSelected] = useState({}); // id -> transaction
  const [saving, setSaving] = useState(false);

  // Seed the window from the plan's own dates the first time it loads — the
  // whole reason start_date/end_date exist on a plan. Only once, so the user's
  // later manual edits aren't stomped on a refetch.
  const seededRef = useRef(false);
  useEffect(() => {
    if (plan && !seededRef.current) {
      seededRef.current = true;
      if (plan.start_date) setFrom(parseISO(plan.start_date));
      if (plan.end_date) setTo(parseISO(plan.end_date));
    }
  }, [plan]);

  useEffect(() => {
    if (!planLoading && !plan) router.back();
  }, [planLoading, plan]);

  const { transactions, loading } = usePlanCandidates(plan, {
    from: format(from, 'yyyy-MM-dd'),
    to: format(to, 'yyyy-MM-dd'),
    categoryId,
  });

  const selectedIds = Object.keys(selected);
  const selectedCount = selectedIds.length;
  const selectedTotal = selectedIds.reduce((sum, sid) => sum + selected[sid].amount, 0);
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
    if (selectedCount === 0 || !plan) return;
    setSaving(true);
    const { error } = await supabase.from('transactions').update({ plan_id: plan.id }).in('id', selectedIds);
    setSaving(false);
    if (error) {
      showToast({ message: error.message, variant: 'error' });
      return;
    }
    notifyChanged();
    showToast({ message: `Added ${selectedCount} to ${plan.name}`, variant: 'success' });
    router.back();
  }

  // Same blank-screen bug fixed on Plan Detail/Budget Detail: this fell
  // straight through to `if (!plan) return null` with no loading branch.
  if (planLoading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="" />
        <View style={styles.loading}>
          <ActivityIndicator color={c.ink} />
        </View>
      </View>
    );
  }

  if (!plan) return null;

  // Category chips draw the category's own icon through the Chip's `icon` slot.
  const categoryIcon = (key) => (props) => <CategoryIcon icon={key} {...props} />;

  return (
    <View style={styles.screen}>
      <ScreenHeader title={`Add to ${plan.name}`} />

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
        ListEmptyComponent={loading ? null : <Text style={styles.empty}>No expenses in this range.</Text>}
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
            : `Add ${selectedCount} ${selectedCount === 1 ? 'transaction' : 'transactions'} · ${formatMoney(selectedTotal, currency)}`,
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
  });
}
