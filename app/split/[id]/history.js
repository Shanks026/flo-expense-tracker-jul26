import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Check } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO, subDays, startOfDay, isBefore } from 'date-fns';
import IconTile from '../../../components/IconTile';
import CategoryIcon from '../../../components/CategoryIcon';
import AmountText from '../../../components/AmountText';
import Button from '../../../components/Button';
import { fontFamily, fontSize, spacing, radii } from '../../../theme/tokens';
import { useTheme } from '../../../theme/ThemeContext';
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
export default function SplitHistory() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.ink} />
        </View>
      </SafeAreaView>
    );
  }

  if (!split) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Add to {split.name}
        </Text>
      </View>

      <View style={styles.filters}>
        <View style={styles.dateRow}>
          <Pressable style={styles.dateField} onPress={() => setShowPicker('start')}>
            <Text style={styles.dateLabel}>From</Text>
            <Text style={styles.dateValue}>{format(from, 'd MMM yyyy')}</Text>
          </Pressable>
          <Pressable style={styles.dateField} onPress={() => setShowPicker('end')}>
            <Text style={styles.dateLabel}>To</Text>
            <Text style={styles.dateValue}>{format(to, 'd MMM yyyy')}</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <CategoryChip label="All" active={categoryId === null} onPress={() => setCategoryId(null)} />
          {expenseCategories.map((cat) => (
            <CategoryChip
              key={cat.id}
              label={cat.name}
              icon={cat.icon}
              active={categoryId === cat.id}
              onPress={() => setCategoryId(cat.id)}
            />
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
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          transactions.length > 0 ? (
            <Pressable style={styles.selectAllRow} onPress={toggleAll}>
              <Text style={styles.selectAllText}>
                {allVisibleSelected ? 'Clear all' : 'Select all'} · {transactions.length}{' '}
                {transactions.length === 1 ? 'result' : 'results'}
              </Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          loading ? null : <Text style={styles.emptyText}>No expenses left to add in this range.</Text>
        }
        renderItem={({ item }) => {
          const isSelected = !!selected[item.id];
          return (
            <Pressable style={styles.row} onPress={() => toggle(item)}>
              <IconTile tone="neutral">
                <CategoryIcon icon={item.category?.icon} size={20} color={colors.ink} />
              </IconTile>
              <View style={styles.rowMid}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.note?.trim() || item.category?.name || 'Uncategorized'}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {format(parseISO(item.occurred_at), 'd MMM')}
                  {item.note?.trim() && item.category?.name ? ` · ${item.category.name}` : ''}
                </Text>
              </View>
              <AmountText value={item.amount} type="neutral" currency={currency} />
              <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
                {isSelected && <Check size={15} color={colors.brandText} strokeWidth={3} />}
              </View>
            </Pressable>
          );
        }}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {/* Says plainly that these become entries you paid for — the defaults
            createEntriesFromTransactions applies — so the split-equally,
            you-are-the-payer assumption isn't a surprise afterwards. */}
        {selectedCount > 0 && (
          <Text style={styles.footerNote}>
            Added as entries you paid, split equally. Editable after.
          </Text>
        )}
        <Button
          title={
            selectedCount === 0
              ? 'Select transactions'
              : `Add ${selectedCount} ${selectedCount === 1 ? 'entry' : 'entries'} · ${formatMoney(selectedTotal, currency)}`
          }
          onPress={handleSave}
          disabled={selectedCount === 0}
          loading={saving}
        />
      </View>
    </SafeAreaView>
  );
}

function CategoryChip({ label, icon, active, onPress }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      {icon && (
        <CategoryIcon icon={icon} size={15} color={active ? colors.brandText : colors.mutedDarker} strokeWidth={2} />
      )}
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    header: {
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.xl,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
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
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.display,
      letterSpacing: -0.3,
      color: colors.ink,
      flexShrink: 1,
    },
    filters: {
      paddingHorizontal: spacing.xl,
      gap: spacing.md,
    },
    dateRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    dateField: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.xs,
    },
    dateLabel: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
    },
    dateValue: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.md,
      color: colors.ink,
    },
    chipRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingBottom: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.brand,
      borderColor: colors.brand,
    },
    chipLabel: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.base,
      color: colors.mutedDarker,
    },
    chipLabelActive: {
      color: colors.brandText,
    },
    listContent: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl,
    },
    selectAllRow: {
      paddingVertical: spacing.md,
    },
    selectAllText: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.base,
      color: colors.mutedDarker,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    rowMid: {
      flex: 1,
    },
    rowTitle: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.md,
      color: colors.ink,
    },
    rowSub: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xs,
      color: colors.mutedMid,
      marginTop: 1,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: colors.chevron,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxOn: {
      backgroundColor: colors.brand,
      borderColor: colors.brand,
    },
    emptyText: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.md,
      color: colors.muted,
      textAlign: 'center',
      marginTop: spacing.xxl,
    },
    footer: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      gap: spacing.sm,
    },
    footerNote: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      textAlign: 'center',
    },
  });
}
