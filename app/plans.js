import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, Flag, Check } from 'lucide-react-native';
import { format } from 'date-fns';
import Card from '../components/Card';
import IconTile from '../components/IconTile';
import ProgressBar from '../components/ProgressBar';
import Pill from '../components/Pill';
import { colors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import usePlans from '../hooks/usePlans';
import { useAddPlanSheet } from '../components/AddPlanSheet';

function dateRangeLabel(plan) {
  if (!plan.start_date && !plan.end_date) return null;
  if (plan.start_date && plan.end_date) {
    return `${format(new Date(plan.start_date), 'MMM d')} – ${format(new Date(plan.end_date), 'd')}`;
  }
  return format(new Date(plan.start_date ?? plan.end_date), 'MMM d, yyyy');
}

export default function Plans() {
  const router = useRouter();
  const { plans } = usePlans();
  const { openAddPlan } = useAddPlanSheet();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.headerTitle}>Plans</Text>
        <Pressable style={styles.addButton} onPress={() => openAddPlan()}>
          <Plus size={16} color={colors.surface} strokeWidth={3} />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {plans.length === 0 ? (
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={styles.emptyText}>No plans yet. Tap "+" to start one.</Text>
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
    flex: 1,
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.title,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 60,
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
