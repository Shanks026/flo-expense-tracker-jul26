import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Wallet } from 'lucide-react-native';
import Card from '../components/Card';
import Button from '../components/Button';
import IconTile from '../components/IconTile';
import ProgressBar from '../components/ProgressBar';
import Pill from '../components/Pill';
import CategoryIcon from '../components/CategoryIcon';
import Skeleton from '../components/Skeleton';
import FadeIn from '../components/FadeIn';
import { colors as staticColors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import useBudgets, { budgetStatus } from '../hooks/useBudgets';
import { formatPeriodLabel, isBudgetEnded } from '../lib/budgets';
import { useAddBudgetSheet } from '../components/AddBudgetSheet';
import { supabase } from '../lib/supabase';
import useEntitlement from '../hooks/useEntitlement';
import { useProUpsellSheet } from '../components/ProUpsellSheet';
import { FREE_LIMITS } from '../lib/pro';
import { formatMoney } from '../lib/currency';
import useCurrency from '../hooks/useCurrency';

export default function Budgets() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Healthy uses the active theme's accent (not the income green) — same
  // pattern Plans' active-plan card already uses (tone="brand"), so a
  // healthy budget's icon/bg/remaining-amount and its progress bar (which
  // was already colors.brand, see ProgressBar.js) read as one consistent
  // color instead of green text next to a lime bar. Can't live at module
  // scope since it needs the active theme's colors.
  const STATUS_STYLES = {
    healthy: { cardVariant: 'default', iconTone: 'brand', pill: null, remainingColor: colors.brand, trackColor: colors.brand },
    warn: { cardVariant: 'warn', iconTone: 'warn', pill: { label: 'Almost out', tone: 'warn' }, remainingColor: staticColors.warn, trackColor: staticColors.warnStrong },
    over: { cardVariant: 'danger', iconTone: 'danger', pill: { label: 'Over budget', tone: 'danger' }, remainingColor: staticColors.danger, trackColor: staticColors.dangerStrong },
  };
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { budgets, loading } = useBudgets();
  const { openAddBudget } = useAddBudgetSheet();
  const { isPro } = useEntitlement();
  const { openProUpsell } = useProUpsellSheet();
  const currency = useCurrency();

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
    // Pushed from the Menu sheet now, not a tab (2026-07-18 — swapped with
    // Analytics so the tab bar carries the more-frequently-used screen) — so
    // it needs its own back button and SafeAreaView, the same shape as
    // Plans/Bills/Settings.
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.title}>Budgets</Text>
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
                      Spent <Text style={styles.spentValue}>{formatMoney(b.spent, currency)}</Text> of{' '}
                      {formatMoney(b.amount, currency)}
                    </Text>
                    {status === 'over' ? (
                      <Text style={[styles.remainingText, { color: s.remainingColor }]}>
                        −{formatMoney(Math.abs(b.remaining), currency)}
                      </Text>
                    ) : (
                      <Text style={[styles.remainingText, { color: s.remainingColor }]}>
                        {formatMoney(b.remaining, currency)} left
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

      {/* Fixed at the bottom, thumb-reachable. No tab bar here (Budgets is a
          pushed screen), so the bottom safe area is handled explicitly —
          extra spacing.lg beyond the raw inset so it doesn't sit flush
          against the device's gesture bar (matches Plans' own footer). */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button title="New Budget" onPress={handleNewBudget} />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  budgetCardEnded: {
    opacity: 0.6,
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
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.display,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
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
}
