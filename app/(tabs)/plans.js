import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Flag, Check } from 'lucide-react-native';
import { format } from 'date-fns';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import IconTile from '../../components/IconTile';
import ProgressBar from '../../components/ProgressBar';
import Pill from '../../components/Pill';
import { colors, fontFamily, fontSize, spacing, radii } from '../../theme/tokens';
import usePlans from '../../hooks/usePlans';
import { useAddPlanSheet } from '../../components/AddPlanSheet';

function dateRangeLabel(plan) {
  if (!plan.start_date && !plan.end_date) return null;
  if (plan.start_date && plan.end_date) {
    return `${format(new Date(plan.start_date), 'MMM d')} – ${format(new Date(plan.end_date), 'd')}`;
  }
  return format(new Date(plan.start_date ?? plan.end_date), 'MMM d, yyyy');
}

export default function Plans() {
  const { plans } = usePlans();
  const { openAddPlan } = useAddPlanSheet();
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Plans</Text>
        <Pressable style={styles.newButton} onPress={() => openAddPlan()}>
          <Plus size={15} color={colors.brand} strokeWidth={3} />
          <Text style={styles.newButtonText}>New Plan</Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {plans.length === 0 ? (
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={styles.emptyText}>No plans yet. Tap "New Plan" to start one.</Text>
          </Card>
        ) : (
          plans.map((plan) => {
            const isCompleted = plan.status === 'completed';
            const hasTarget = plan.target_amount != null;
            const progress = hasTarget && plan.target_amount > 0 ? plan.total_spent / plan.target_amount : 0;
            const dateLabel = dateRangeLabel(plan);

            if (isCompleted) {
              return (
                <Pressable key={plan.id} onPress={() => router.push(`/plan/${plan.id}`)}>
                  <Card variant="completed" style={styles.planCard}>
                    <View style={styles.rowBetween}>
                      <View style={styles.rowLeft}>
                        <IconTile tone="completed" size={44} radius={13}>
                          <Check size={21} color={colors.muted} strokeWidth={2} />
                        </IconTile>
                        <View>
                          <Text style={styles.planNameMuted}>{plan.name}</Text>
                          <Text style={styles.planSub}>Completed{dateLabel ? ` · ${dateLabel}` : ''}</Text>
                        </View>
                      </View>
                      <Pill label="Done" tone="completed" />
                    </View>
                    <View style={styles.progressWrap}>
                      <ProgressBar progress={1} status="completed" />
                    </View>
                    <Text style={styles.completedSpent}>
                      Spent <Text style={styles.completedSpentValue}>₹{Math.round(plan.total_spent).toLocaleString('en-IN')}</Text>
                      {hasTarget ? ` of ₹${Math.round(plan.target_amount).toLocaleString('en-IN')}` : ''}
                    </Text>
                  </Card>
                </Pressable>
              );
            }

            if (!hasTarget) {
              return (
                <Pressable key={plan.id} onPress={() => router.push(`/plan/${plan.id}`)}>
                  <Card style={styles.planCard}>
                    <View style={styles.rowLeft}>
                      <IconTile tone="neutral" size={44} radius={13}>
                        <Flag size={21} color={colors.ink} strokeWidth={2} />
                      </IconTile>
                      <View>
                        <Text style={styles.planName}>{plan.name}</Text>
                        <Text style={styles.planSub}>No target · Ongoing</Text>
                      </View>
                    </View>
                    <View style={styles.noTargetRow}>
                      <Text style={styles.planSub}>Total spent</Text>
                      <Text style={styles.noTargetAmount}>₹{Math.round(plan.total_spent).toLocaleString('en-IN')}</Text>
                    </View>
                  </Card>
                </Pressable>
              );
            }

            return (
              <Pressable key={plan.id} onPress={() => router.push(`/plan/${plan.id}`)}>
                <Card dark style={styles.planCard}>
                  <View style={styles.rowBetween}>
                    <View style={styles.rowLeft}>
                      <IconTile tone="brand" size={44} radius={13}>
                        <Flag size={21} color={colors.brand} strokeWidth={2} />
                      </IconTile>
                      <View>
                        <Text style={styles.planNameDark}>{plan.name}</Text>
                        {dateLabel && <Text style={styles.planSubDark}>{dateLabel}</Text>}
                      </View>
                    </View>
                    <Pill label="Active" tone="brand" />
                  </View>
                  <View style={styles.progressWrap}>
                    <ProgressBar progress={progress} dark status="healthy" />
                  </View>
                  <View style={styles.rowBetween}>
                    <Text style={styles.planSubDark}>
                      Spent <Text style={styles.spentValueDark}>₹{Math.round(plan.total_spent).toLocaleString('en-IN')}</Text> of ₹
                      {Math.round(plan.target_amount).toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.remainingDark}>₹{Math.round(plan.remaining).toLocaleString('en-IN')} left</Text>
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
  planCard: {
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
  planName: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xxl,
    color: colors.ink,
  },
  planNameMuted: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xxl,
    color: colors.mutedDarker,
  },
  planNameDark: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xxl,
    color: colors.surface,
  },
  planSub: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginTop: 1,
  },
  planSubDark: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.mutedMid,
    marginTop: 1,
  },
  progressWrap: {
    marginVertical: spacing.lg,
  },
  noTargetRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  noTargetAmount: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.display,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  spentValueDark: {
    fontFamily: fontFamily.extrabold,
    color: colors.surface,
  },
  remainingDark: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.base,
    color: colors.brand,
  },
  completedSpent: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.muted,
  },
  completedSpentValue: {
    fontFamily: fontFamily.extrabold,
    color: colors.mutedDarker,
  },
});
