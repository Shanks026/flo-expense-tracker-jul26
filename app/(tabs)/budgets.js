import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Plus, Wallet } from 'lucide-react-native';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import IconTile from '../../components/IconTile';
import ProgressBar from '../../components/ProgressBar';
import Pill from '../../components/Pill';
import CategoryIcon from '../../components/CategoryIcon';
import { colors, fontFamily, fontSize, spacing, radii } from '../../theme/tokens';
import useBudgets, { budgetStatus } from '../../hooks/useBudgets';
import { useAddBudgetSheet } from '../../components/AddBudgetSheet';

const STATUS_STYLES = {
  healthy: { cardVariant: 'default', iconTone: 'income', pill: null, remainingColor: colors.income, trackColor: colors.brand },
  warn: { cardVariant: 'warn', iconTone: 'warn', pill: { label: 'Almost out', tone: 'warn' }, remainingColor: colors.warn, trackColor: colors.warnStrong },
  over: { cardVariant: 'danger', iconTone: 'danger', pill: { label: 'Over budget', tone: 'danger' }, remainingColor: colors.danger, trackColor: colors.dangerStrong },
};

export default function Budgets() {
  const { budgets } = useBudgets();
  const { openAddBudget } = useAddBudgetSheet();

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Budgets</Text>
        <Pressable style={styles.newButton} onPress={() => openAddBudget()}>
          <Plus size={15} color={colors.brand} strokeWidth={3} />
          <Text style={styles.newButtonText}>New Budget</Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {budgets.length === 0 ? (
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={styles.emptyText}>No budgets yet. Tap "New Budget" to set a spending limit.</Text>
          </Card>
        ) : (
          budgets.map((b) => {
            const status = budgetStatus(b.spent, b.amount);
            const s = STATUS_STYLES[status];
            const progress = b.amount > 0 ? b.spent / b.amount : 0;

            return (
              <Pressable key={b.id} onPress={() => openAddBudget(b)}>
                <Card variant={s.cardVariant} style={styles.budgetCard}>
                  <View style={styles.rowBetween}>
                    <View style={styles.rowLeft}>
                      <IconTile tone={s.iconTone} size={42} radius={13}>
                        {b.category_icon ? (
                          <CategoryIcon icon={b.category_icon} size={20} color={s.remainingColor} />
                        ) : (
                          <Wallet size={20} color={s.remainingColor} strokeWidth={2} />
                        )}
                      </IconTile>
                      <View>
                        <Text style={styles.budgetName}>{b.name}</Text>
                        <Text style={styles.budgetPeriod}>{b.period === 'week' ? 'This Week' : 'This Month'}</Text>
                      </View>
                    </View>
                    {s.pill && <Pill label={s.pill.label} tone={s.pill.tone} />}
                  </View>

                  <View style={styles.progressWrap}>
                    <ProgressBar progress={progress} status={status} />
                  </View>

                  <View style={styles.rowBetween}>
                    <Text style={styles.spentText}>
                      Spent <Text style={styles.spentValue}>₹{Math.round(b.spent).toLocaleString('en-IN')}</Text> of ₹
                      {Math.round(b.amount).toLocaleString('en-IN')}
                    </Text>
                    {status === 'over' ? (
                      <Text style={[styles.remainingText, { color: s.remainingColor }]}>
                        −₹{Math.round(Math.abs(b.remaining)).toLocaleString('en-IN')}
                      </Text>
                    ) : (
                      <Text style={[styles.remainingText, { color: s.remainingColor }]}>
                        ₹{Math.round(b.remaining).toLocaleString('en-IN')} left
                      </Text>
                    )}
                  </View>
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.display,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.ink,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: radii.pill,
  },
  newButtonText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: colors.surface,
  },
  scroll: {
    paddingTop: spacing.lg,
    paddingBottom: 120,
    gap: spacing.md,
  },
  emptyText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
    color: colors.muted,
    textAlign: 'center',
  },
  budgetCard: {
    marginBottom: spacing.md,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  budgetName: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: colors.ink,
  },
  budgetPeriod: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginTop: 1,
  },
  progressWrap: {
    marginVertical: spacing.lg,
  },
  spentText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.muted,
    flexShrink: 1,
  },
  spentValue: {
    fontFamily: fontFamily.extrabold,
    color: colors.ink,
  },
  remainingText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
  },
});
