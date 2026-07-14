import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Check } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO, subDays, startOfDay, isBefore } from 'date-fns';
import Card from '../../../components/Card';
import IconTile from '../../../components/IconTile';
import CategoryIcon from '../../../components/CategoryIcon';
import AmountText from '../../../components/AmountText';
import Pill from '../../../components/Pill';
import Button from '../../../components/Button';
import { colors, fontFamily, fontSize, spacing, radii } from '../../../theme/tokens';
import { formatMoney } from '../../../lib/money';
import { usePlan } from '../../../hooks/usePlans';
import usePlanCandidates from '../../../hooks/usePlanCandidates';
import useCategories from '../../../hooks/useCategories';
import { supabase } from '../../../lib/supabase';
import { useDataRefresh } from '../../../lib/DataRefreshContext';
import { useToast } from '../../../components/Toast';

export default function PlanHistory() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();
  const { plan, loading: planLoading } = usePlan(id);
  const { expenseCategories } = useCategories();

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

  if (!plan) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Add to {plan?.name ?? 'plan'}
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
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
          loading ? null : (
            <Text style={styles.emptyText}>No expenses in this range.</Text>
          )
        }
        renderItem={({ item }) => {
          const isSelected = !!selected[item.id];
          const otherPlan = item.plan && item.plan.id !== plan?.id ? item.plan : null;
          return (
            <Pressable style={styles.row} onPress={() => toggle(item)}>
              <IconTile tone="neutral">
                <CategoryIcon icon={item.category?.icon} size={20} color={colors.ink} />
              </IconTile>
              <View style={styles.rowMid}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.category?.name ?? 'Uncategorized'}
                </Text>
                <View style={styles.rowSubRow}>
                  <Text style={styles.rowSub}>{format(parseISO(item.occurred_at), 'd MMM')}</Text>
                  {item.note ? (
                    <Text style={styles.rowSub} numberOfLines={1}>
                      · {item.note}
                    </Text>
                  ) : null}
                </View>
                {otherPlan && <Pill label={otherPlan.name} tone="completed" style={styles.otherPlanPill} />}
              </View>
              <AmountText value={item.amount} type="neutral" />
              <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
                {isSelected && <Check size={15} color={colors.ink} strokeWidth={3} />}
              </View>
            </Pressable>
          );
        }}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          title={
            selectedCount === 0
              ? 'Select transactions'
              : `Add ${selectedCount} ${selectedCount === 1 ? 'transaction' : 'transactions'} · ${formatMoney(selectedTotal)}`
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
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      {icon && (
        <CategoryIcon icon={icon} size={15} color={active ? colors.ink : colors.mutedDarker} strokeWidth={2} />
      )}
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
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
    fontSize: fontSize.title,
    letterSpacing: -0.3,
    color: colors.ink,
    flex: 1,
  },
  filters: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  dateField: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
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
    gap: spacing.sm,
    paddingRight: spacing.xl,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.chipBg,
  },
  chipActive: {
    backgroundColor: colors.brand,
  },
  chipLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: colors.mutedDarker,
  },
  chipLabelActive: {
    color: colors.ink,
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
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  rowSubRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 1,
  },
  rowSub: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    flexShrink: 1,
  },
  otherPlanPill: {
    marginTop: 6,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
    marginTop: spacing.xl,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
});
