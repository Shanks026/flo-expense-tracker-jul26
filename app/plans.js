import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, Flag, Check } from 'lucide-react-native';
import { format } from 'date-fns';
import Card from '../components/Card';
import IconTile from '../components/IconTile';
import ProgressBar from '../components/ProgressBar';
import Pill from '../components/Pill';
import Skeleton from '../components/Skeleton';
import FadeIn from '../components/FadeIn';
import { colors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import usePlans from '../hooks/usePlans';
import useCollectingPlan from '../hooks/useCollectingPlan';
import { useAddPlanSheet } from '../components/AddPlanSheet';
import { supabase } from '../lib/supabase';
import useEntitlement from '../hooks/useEntitlement';
import { useProUpsellSheet } from '../components/ProUpsellSheet';
import { FREE_LIMITS } from '../lib/pro';

function dateRangeLabel(plan) {
  if (!plan.start_date && !plan.end_date) return null;
  if (plan.start_date && plan.end_date) {
    return `${format(new Date(plan.start_date), 'MMM d')} – ${format(new Date(plan.end_date), 'd')}`;
  }
  return format(new Date(plan.start_date ?? plan.end_date), 'MMM d, yyyy');
}

export default function Plans() {
  const router = useRouter();
  const { plans, loading } = usePlans();
  const { plan: collectingPlan } = useCollectingPlan();
  const { openAddPlan } = useAddPlanSheet();
  const { isPro } = useEntitlement();
  const { openProUpsell } = useProUpsellSheet();

  async function handleNewPlan() {
    if (!isPro) {
      const { count } = await supabase.from('plans').select('id', { count: 'exact', head: true });
      if ((count ?? 0) >= FREE_LIMITS.plans) {
        openProUpsell('Free includes 1 plan');
        return;
      }
    }
    openAddPlan();
  }

  return (
    // Pushed from the Menu sheet now, not a tab (2026-07-14) — so it needs its
    // own back button and SafeAreaView, the same shape as Bills/Settings/Analytics.
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.title}>Plans</Text>
        </View>
        <Pressable style={styles.newButton} onPress={handleNewPlan}>
          <Plus size={15} color={colors.brand} strokeWidth={3} />
          <Text style={styles.newButtonText}>New Plan</Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <>
            {[0, 1].map((i) => (
              <Card key={i} style={styles.planCard}>
                <View style={styles.rowBetween}>
                  <View style={styles.rowLeft}>
                    <Skeleton width={44} height={44} radius={13} />
                    <View>
                      <Skeleton width={120} height={18} radius={6} style={{ marginBottom: 6 }} />
                      <Skeleton width={80} height={12} radius={6} />
                    </View>
                  </View>
                </View>
                <View style={styles.progressWrap}>
                  <Skeleton height={9} radius={radii.pill} />
                </View>
              </Card>
            ))}
          </>
        ) : plans.length === 0 ? (
          <FadeIn>
            <Card style={{ marginTop: spacing.lg }}>
              <Text style={styles.emptyText}>No plans yet. Tap "+" to start one.</Text>
            </Card>
          </FadeIn>
        ) : (
          <FadeIn>
          {plans.map((plan) => {
            const isCompleted = plan.status === 'completed';
            const hasTarget = plan.target_amount != null;
            const progress = hasTarget && plan.target_amount > 0 ? plan.total_spent / plan.target_amount : 0;
            const dateLabel = dateRangeLabel(plan);
            const isCollecting = plan.id === collectingPlan?.id;

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
                    <View style={styles.rowBetween}>
                      <View style={styles.rowLeft}>
                        <IconTile tone="neutral" size={44} radius={13}>
                          <Flag size={21} color={colors.ink} strokeWidth={2} />
                        </IconTile>
                        <View>
                          <Text style={styles.planName}>{plan.name}</Text>
                          <Text style={styles.planSub}>No target · Ongoing</Text>
                        </View>
                      </View>
                      {isCollecting && <Pill label="Collecting" tone="brand" />}
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
                    <Pill label={isCollecting ? 'Collecting' : 'Active'} tone="brand" />
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
          })}
          </FadeIn>
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
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
    color: colors.brand,
  },
  scroll: {
    // Screen used to supply the horizontal padding; a bare SafeAreaView
    // doesn't (same migration note as bills.js's own).
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
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
