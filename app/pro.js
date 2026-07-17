import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Crown, Check } from 'lucide-react-native';
import { colors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { PRO_PRICING } from '../lib/pro';
import useEntitlement from '../hooks/useEntitlement';
import ProBenefits from '../components/ProBenefits';
import { useToast } from '../components/Toast';

const PLAN_ORDER = ['monthly', 'annual', 'lifetime'];

// Doubles as the paywall placeholder (no payment integrated yet — see
// 14-subscription-pro.md). Reached from the menu's "Upgrade to Pro" row and
// from ProUpsellSheet's "Level up" button.
export default function Pro() {
  const router = useRouter();
  const { isPro } = useEntitlement();
  const { showToast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState('annual');

  function handleUpgrade() {
    showToast({
      message: "Payments aren't live yet. You'll be the first to know when Pro launches.",
      variant: 'info',
      duration: 4000,
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.surface} strokeWidth={2.4} />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.crownTile}>
            <Crown size={28} color={colors.ink} strokeWidth={2.2} fill={colors.ink} />
          </View>
          {isPro ? (
            <>
              <Text style={styles.title}>You're on Pro 👑</Text>
              <Text style={styles.subtitle}>Thanks for being here early.</Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>Meet FLO Pro</Text>
              <Text style={styles.subtitle}>Unlock the full potential of the app and yourself.</Text>
            </>
          )}
        </View>

        <ProBenefits style={styles.benefits} />

        {!isPro && (
          <>
            <View style={styles.plans}>
              {PLAN_ORDER.map((key) => {
                const plan = PRO_PRICING[key];
                const selected = selectedPlan === key;
                return (
                  <Pressable
                    key={key}
                    style={[styles.planCard, selected && styles.planCardSelected]}
                    onPress={() => setSelectedPlan(key)}
                  >
                    <View style={styles.planLeft}>
                      <View style={[styles.radio, selected && styles.radioSelected]}>
                        {selected && <Check size={12} color={colors.ink} strokeWidth={3} />}
                      </View>
                      <View>
                        <Text style={styles.planLabel}>{plan.label}</Text>
                        <Text style={styles.planSub}>{plan.sub}</Text>
                      </View>
                    </View>
                    <View style={styles.planPriceWrap}>
                      {plan.badge && (
                        <View style={styles.savingsBadge}>
                          <Text style={styles.savingsBadgeText}>{plan.badge}</Text>
                        </View>
                      )}
                      <Text style={styles.planPrice}>{plan.price}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.cta} onPress={handleUpgrade}>
              <Text style={styles.ctaText}>Upgrade to Pro</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.inkCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  hero: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xxl,
  },
  crownTile: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.hero,
    letterSpacing: -0.3,
    color: colors.surface,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.mutedMid,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  benefits: {
    marginBottom: spacing.xxl,
  },
  plans: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderColor: colors.inkCard,
    backgroundColor: colors.inkCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  planCardSelected: {
    borderColor: colors.brand,
  },
  planLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.mutedDarker,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  planLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.surface,
  },
  planSub: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginTop: 1,
  },
  planPriceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  planPrice: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: colors.surface,
  },
  savingsBadge: {
    backgroundColor: colors.brand,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  savingsBadgeText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: colors.ink,
  },
  cta: {
    height: 56,
    borderRadius: radii.button,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: colors.ink,
  },
});
