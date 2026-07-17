import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Wallet } from 'lucide-react-native';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import IconTile from '../../components/IconTile';
import ProgressBar from '../../components/ProgressBar';
import Pill from '../../components/Pill';
import CategoryIcon from '../../components/CategoryIcon';
import Skeleton from '../../components/Skeleton';
import FadeIn from '../../components/FadeIn';
import { colors, fontFamily, fontSize, spacing, radii } from '../../theme/tokens';
import useBudgets, { budgetStatus } from '../../hooks/useBudgets';
import { formatPeriodLabel, isBudgetEnded } from '../../lib/budgets';
import { useAddBudgetSheet } from '../../components/AddBudgetSheet';
import { supabase } from '../../lib/supabase';
import useEntitlement from '../../hooks/useEntitlement';
import { useProUpsellSheet } from '../../components/ProUpsellSheet';
import { FREE_LIMITS } from '../../lib/pro';

const STATUS_STYLES = {
  healthy: { cardVariant: 'default', iconTone: 'income', pill: null, remainingColor: colors.income, trackColor: colors.brand },
  warn: { cardVariant: 'warn', iconTone: 'warn', pill: { label: 'Almost out', tone: 'warn' }, remainingColor: colors.warn, trackColor: colors.warnStrong },
  over: { cardVariant: 'danger', iconTone: 'danger', pill: { label: 'Over budget', tone: 'danger' }, remainingColor: colors.danger, trackColor: colors.dangerStrong },
};

export default function Budgets() {
  const router = useRouter();
  const { budgets, loading } = useBudgets();
  const { openAddBudget } = useAddBudgetSheet();
  const { isPro } = useEntitlement();
  const { openProUpsell } = useProUpsellSheet();

  async function handleNewBudget() {
    if (!isPro) {
      const { count } = await supabase.from('budgets').select('id', { count: 'exact', head: true });
      if ((count ?? 0) >= FREE_LIMITS.budgets) {
        openProUpsell('Free includes 2 budgets');
        return;
      }
    }
    openAddBudget();
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Budgets</Text>
        <Pressable style={styles.newButton} onPress={handleNewBudget}>
          <Plus size={15} color={colors.brand} strokeWidth={3} />
          <Text style={styles.newButtonText}>New Budget</Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <>
            {[0, 1].map((i) => (
              <Card key={i} style={styles.budgetCard}>
                <View style={styles.rowBetween}>
                  <View style={styles.rowLeft}>
                    <Skeleton width={42} height={42} radius={13} />
                    <View>
                      <Skeleton width={120} height={17} radius={6} style={{ marginBottom: 6 }} />
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
        ) : budgets.length === 0 ? (
          <FadeIn>
            <Card style={{ marginTop: spacing.lg }}>
              <Text style={styles.emptyText}>No budgets yet. Tap "New Budget" to set a spending limit.</Text>
            </Card>
          </FadeIn>
        ) : (
          <FadeIn>
          {budgets.map((b) => {
            const status = budgetStatus(b.spent, b.amount);
            const s = STATUS_STYLES[status];
            const progress = b.amount > 0 ? b.spent / b.amount : 0;
            // A custom budget doesn't recur, so once its end date passes its
            // spent figure is final. That has to read as deliberate, not as a
            // card that quietly stopped updating.
            const ended = isBudgetEnded(b);

            return (
              // Tapping a budget now opens its detail screen, not the editor —
              // matching Plans (list card → /plan/[id]). Editing lives behind
              // the pencil in the detail header.
              <Pressable key={b.id} onPress={() => router.push(`/budget/${b.id}`)}>
                <Card variant={ended ? 'default' : s.cardVariant} style={[styles.budgetCard, ended && styles.budgetCardEnded]}>
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
                        {/* The actual window `spent` is computed over. "This Week"
                            told the user nothing and left them guessing whether it
                            meant 7 days from creation — it doesn't. */}
                        <Text style={styles.budgetPeriod}>{formatPeriodLabel(b)}</Text>
                      </View>
                    </View>
                    {ended ? (
                      <Pill label="Ended" tone="completed" />
                    ) : (
                      s.pill && <Pill label={s.pill.label} tone={s.pill.tone} />
                    )}
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
          })}
          </FadeIn>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  budgetCardEnded: {
    opacity: 0.6,
  },
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
