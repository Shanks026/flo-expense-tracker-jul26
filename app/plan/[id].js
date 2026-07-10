import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Pencil } from 'lucide-react-native';
import { format } from 'date-fns';
import Card from '../../components/Card';
import IconTile from '../../components/IconTile';
import ProgressBar from '../../components/ProgressBar';
import AmountText from '../../components/AmountText';
import Pill from '../../components/Pill';
import Button from '../../components/Button';
import CategoryIcon from '../../components/CategoryIcon';
import { colors, fontFamily, fontSize, spacing, radii } from '../../theme/tokens';
import { usePlan } from '../../hooks/usePlans';
import useTransactions from '../../hooks/useTransactions';
import { useAddTransactionSheet } from '../../components/AddTransactionSheet';
import { useAddPlanSheet } from '../../components/AddPlanSheet';
import { supabase } from '../../lib/supabase';
import { useDataRefresh } from '../../lib/DataRefreshContext';

function dateRangeLabel(plan) {
  if (!plan.start_date && !plan.end_date) return null;
  if (plan.start_date && plan.end_date) {
    return `${format(new Date(plan.start_date), 'MMM d')} – ${format(new Date(plan.end_date), 'd, yyyy')}`;
  }
  return format(new Date(plan.start_date ?? plan.end_date), 'MMM d, yyyy');
}

export default function PlanDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { plan, loading } = usePlan(id);
  const { transactions } = useTransactions({ planId: id });
  const { openAdd } = useAddTransactionSheet();
  const { openAddPlan } = useAddPlanSheet();
  const { notifyChanged } = useDataRefresh();

  useEffect(() => {
    if (!loading && !plan) {
      router.back();
    }
  }, [loading, plan]);

  if (!plan) return null;

  const hasTarget = plan.target_amount != null;
  const progress = hasTarget && plan.target_amount > 0 ? plan.total_spent / plan.target_amount : 0;
  const isCompleted = plan.status === 'completed';

  async function toggleStatus() {
    await supabase
      .from('plans')
      .update({ status: isCompleted ? 'active' : 'completed' })
      .eq('id', plan.id);
    notifyChanged();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.planName} numberOfLines={1}>
                {plan.name}
              </Text>
              <Pill label={isCompleted ? 'Completed' : 'Active'} tone={isCompleted ? 'completed' : 'income'} />
            </View>
            {dateRangeLabel(plan) && <Text style={styles.planDate}>{dateRangeLabel(plan)}</Text>}
          </View>
        </View>
        <Pressable style={styles.editButton} onPress={() => openAddPlan(plan)}>
          <Pencil size={16} color={colors.ink} strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card dark style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total spent</Text>
          <View style={styles.summaryAmountRow}>
            <AmountText value={plan.total_spent} type="neutral" dark size={40} />
            {hasTarget && <Text style={styles.targetText}> / ₹{Math.round(plan.target_amount).toLocaleString('en-IN')}</Text>}
          </View>
          {hasTarget && (
            <>
              <View style={styles.progressWrap}>
                <ProgressBar progress={progress} dark status="healthy" />
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.progressPercent}>{Math.round(progress * 100)}% of target</Text>
                <Text style={styles.remainingText}>₹{Math.round(plan.remaining).toLocaleString('en-IN')} remaining</Text>
              </View>
            </>
          )}
        </Card>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Expenses</Text>
          <Text style={styles.sectionCount}>{transactions.length} items</Text>
        </View>

        {transactions.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>No expenses linked yet.</Text>
          </Card>
        ) : (
          <Card style={styles.listCard}>
            {transactions.map((tx, idx) => (
              <Pressable
                key={tx.id}
                style={[styles.row, idx < transactions.length - 1 && styles.rowBorder]}
                onPress={() => openAdd(tx)}
              >
                <IconTile tone={tx.type === 'income' ? 'income' : 'neutral'}>
                  <CategoryIcon icon={tx.category?.icon} size={20} color={tx.type === 'income' ? colors.incomeAccent : colors.ink} />
                </IconTile>
                <View style={styles.rowMid}>
                  <Text style={styles.rowTitle}>{tx.category?.name ?? 'Uncategorized'}</Text>
                  <Text style={styles.rowSub}>{format(new Date(tx.occurred_at), 'd MMM')}</Text>
                </View>
                <AmountText value={tx.amount} type={tx.type} signed />
              </Pressable>
            ))}
          </Card>
        )}

        <Button
          title="Add Expense"
          onPress={() => openAdd({ plan_id: plan.id })}
          style={{ marginTop: spacing.lg }}
        />
        <Pressable style={styles.toggleStatusRow} onPress={toggleStatus}>
          <Text style={styles.toggleStatusText}>{isCompleted ? 'Reactivate Plan' : 'Mark as Complete'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    paddingRight: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
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
  planName: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.title,
    letterSpacing: -0.3,
    color: colors.ink,
    flexShrink: 1,
  },
  planDate: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 60,
  },
  summaryCard: {
    borderRadius: radii.cardLg,
    padding: 22,
    marginBottom: spacing.xl,
  },
  summaryLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.mutedMid,
  },
  summaryAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
  },
  targetText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.lg,
    color: colors.mutedDarker,
  },
  progressWrap: {
    marginVertical: spacing.lg,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressPercent: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.mutedMid,
  },
  remainingText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    color: colors.brand,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: colors.ink,
  },
  sectionCount: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: colors.muted,
  },
  emptyText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.muted,
    textAlign: 'center',
  },
  listCard: {
    padding: 0,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 13,
  },
  rowBorder: {
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
  rowSub: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginTop: 1,
  },
  toggleStatusRow: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  toggleStatusText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: colors.muted,
  },
});
