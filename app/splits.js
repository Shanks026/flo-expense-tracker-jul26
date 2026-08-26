import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Check } from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import Card from '../components/Card';
import IconTile from '../components/IconTile';
import CategoryIcon from '../components/CategoryIcon';
import Pill from '../components/Pill';
import Button from '../components/Button';
import Skeleton from '../components/Skeleton';
import FadeIn from '../components/FadeIn';
import { fontFamily, fontSize, spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import useSplits from '../hooks/useSplits';
import { useAddSplitSheet } from '../components/AddSplitSheet';
import { supabase } from '../lib/supabase';
import useEntitlement from '../hooks/useEntitlement';
import { useProUpsellSheet } from '../components/ProUpsellSheet';
import { FREE_LIMITS } from '../lib/pro';
import { formatMoney } from '../lib/currency';
import useCurrency from '../hooks/useCurrency';

// Pushed from the Menu sheet, same shape as Plans/Bills/Settings — its own back
// button and SafeAreaView, no tab slot (the skill's navigation rule: new global
// destinations go in the menu, not a 6th tab).
export default function Splits() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { openSplits, closedSplits, loading } = useSplits();
  const { openAddSplit } = useAddSplitSheet();
  const { isPro } = useEntitlement();
  const { openProUpsell } = useProUpsellSheet();
  const currency = useCurrency();

  // Create-time gate only, per the standing Pro rule — never access-time, never
  // a data-model change. The limit counts OPEN splits, not splits ever created:
  // a Free user can run trip after trip by closing each one first, so the gate
  // caps concurrency rather than usage. Same count-then-gate shape as
  // plans.js's own handleNewPlan.
  async function handleNewSplit() {
    if (!isPro) {
      const { count } = await supabase
        .from('splits')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open');
      if ((count ?? 0) >= FREE_LIMITS.splits) {
        openProUpsell('Free includes 1 open split');
        return;
      }
    }
    openAddSplit();
  }

  function positionLabel(myNet) {
    if (myNet > 0) return { text: `You're owed ${formatMoney(myNet, currency)}`, color: colors.income };
    if (myNet < 0) return { text: `You owe ${formatMoney(Math.abs(myNet), currency)}`, color: colors.danger };
    return { text: 'Settled up', color: colors.mutedMid };
  }

  function renderSplit(split, { closed }) {
    const position = positionLabel(split.myNet);
    // A split with no entries is not "settled up" — there's nothing to settle.
    // Saying so in the big position type was actively misleading on a split
    // that had just been created.
    const isEmpty = split.entryCount === 0;
    return (
      <Pressable key={split.id} onPress={() => router.push(`/split/${split.id}`)}>
        <Card variant={closed ? 'completed' : 'default'} style={styles.splitCard}>
          <View style={styles.rowBetween}>
            <View style={styles.rowLeft}>
              <IconTile tone={closed ? 'completed' : 'brandSolid'} size={44} radius={13}>
                {closed ? (
                  <Check size={21} color={colors.muted} strokeWidth={2} />
                ) : (
                  <CategoryIcon icon={split.icon ?? 'travel'} size={21} color={colors.brandText} strokeWidth={2} />
                )}
              </IconTile>
              <View style={{ flex: 1 }}>
                <Text style={closed ? styles.splitNameMuted : styles.splitName} numberOfLines={1}>
                  {split.name}
                </Text>
                <Text style={styles.splitSub}>
                  {format(parseISO(split.occurredOn), 'd MMM')} · {split.memberCount} people
                  {isEmpty ? '' : ` · ${formatMoney(split.total, currency)}`}
                </Text>
              </View>
            </View>
            {closed && <Pill label="Closed" tone="completed" />}
          </View>

          <View style={styles.positionRow}>
            {isEmpty ? (
              <Text style={styles.emptyPosition}>
                {closed ? 'Nothing was added' : 'Nothing added yet'}
              </Text>
            ) : (
              <Text style={[styles.positionText, { color: position.color }]}>{position.text}</Text>
            )}
          </View>
        </Card>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.title}>Splits</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <>
            {[0, 1].map((i) => (
              <Card key={i} style={styles.splitCard}>
                <View style={styles.rowLeft}>
                  <Skeleton width={44} height={44} radius={13} />
                  <View>
                    <Skeleton width={130} height={18} radius={6} style={{ marginBottom: 6 }} />
                    <Skeleton width={90} height={12} radius={6} />
                  </View>
                </View>
                <View style={{ marginTop: spacing.lg }}>
                  <Skeleton width={120} height={14} radius={6} />
                </View>
              </Card>
            ))}
          </>
        ) : openSplits.length === 0 && closedSplits.length === 0 ? (
          <FadeIn>
            <Card style={{ marginTop: spacing.lg }}>
              <Text style={styles.emptyTitle}>Split something</Text>
              <Text style={styles.emptyText}>
                A trip, a dinner, rent. Add who was there and what each thing cost — FLO works out who
                owes whom. Nothing touches your ledger until you settle up.
              </Text>
            </Card>
          </FadeIn>
        ) : (
          <FadeIn>
            {openSplits.map((s) => renderSplit(s, { closed: false }))}

            {closedSplits.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Closed</Text>
                {closedSplits.map((s) => renderSplit(s, { closed: true }))}
              </>
            )}
          </FadeIn>
        )}
      </ScrollView>

      {/* Bottom, thumb-reachable, clearing the device gesture bar — same
          formula plans.js uses (no tab bar on a pushed screen). */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button title="New Split" onPress={handleNewSplit} />
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
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: 60,
    },
    footer: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
    },
    splitCard: {
      marginBottom: spacing.md,
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      flex: 1,
    },
    splitName: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.xxl,
      color: colors.ink,
    },
    splitNameMuted: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.xxl,
      color: colors.mutedDarker,
    },
    splitSub: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      marginTop: 1,
    },
    positionRow: {
      marginTop: spacing.lg,
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    positionText: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.heading,
      letterSpacing: -0.2,
    },
    // Deliberately quiet and normal-weight: an empty split has no number worth
    // shouting, so it shouldn't borrow the position type's emphasis.
    emptyPosition: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.md,
      color: colors.mutedMid,
    },
    sectionLabel: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      marginTop: spacing.lg,
      marginBottom: spacing.md,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    emptyTitle: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.heading,
      color: colors.ink,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    emptyText: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.md,
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 21,
    },
  });
}
