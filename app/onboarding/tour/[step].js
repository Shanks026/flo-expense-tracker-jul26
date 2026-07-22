import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams, Redirect } from 'expo-router';
import {
  Home, List, Plus, ChartColumn, Menu as MenuIcon, Wallet, Flag, Receipt,
  Sparkles, Palette, Tags, ChevronRight, CircleDollarSign, Snowflake, Star,
} from 'lucide-react-native';
import TourScreen from '../../../components/TourScreen';
import { colors, spacing, radii, fontFamily, fontSize } from '../../../theme/tokens';
import { getTourStep, getTourPosition, getTourNext, BUNDLE_ROUTE } from '../../../lib/onboarding';

// "Know your space" tour cards (28-onboarding-welcome-bundle.md Phase 2). One
// dynamic route for all the informational cards — content from TOUR_STEPS
// (lib/onboarding.js). NOTE: adding this new `tour/` route directory needs a
// Metro restart with `npx expo start -c` (Expo Router builds its tree from a
// require.context over app/; a server started before the dir existed won't
// know the route — see 00-index.md's standing note).
const ICONS = {
  Home, List, Plus, ChartColumn, Menu: MenuIcon, Wallet, Flag, Receipt, Sparkles, Palette,
};

// The three things logging earns you — the `currency` card's segmented body.
const CURRENCY_ROWS = [
  { key: 'coins', Icon: CircleDollarSign, color: colors.coinGold, label: 'Coins', body: 'Earned by logging — spend them on card designs in the Shop.' },
  { key: 'freeze', Icon: Snowflake, color: colors.iceBlue, label: 'Streak freezes', body: 'Protect your streak on a day you miss.' },
  { key: 'xp', Icon: Star, color: colors.brand, label: 'XP', body: 'Builds your Level and Rank as you keep going.' },
];

export default function TourStep() {
  const router = useRouter();
  const { step: stepKey } = useLocalSearchParams();
  const step = getTourStep(stepKey);

  // Bad/unknown param — don't render a broken card; fall through to the reward.
  if (!step) return <Redirect href={BUNDLE_ROUTE} />;

  const pos = getTourPosition(step.key);
  const isLast = pos.index === pos.total;
  const Icon = ICONS[step.icon] ?? Home;

  function goNext() {
    router.replace(getTourNext(step.key));
  }
  function skip() {
    // Skip the rest of the tour, but still land on the reward reveal — a
    // skipping user shouldn't miss their welcome bundle.
    router.replace(BUNDLE_ROUTE);
  }

  return (
    <TourScreen
      progress={pos.index / pos.total}
      stepLabel={`${pos.index} of ${pos.total}`}
      eyebrow="Quick Tour"
      Icon={Icon}
      title={step.title}
      subtitle={step.body}
      primaryLabel={isLast ? 'Continue' : 'Next'}
      onPrimary={goNext}
      // No "Skip tour" on the last card — its Continue already leads onward.
      secondaryLabel={isLast ? undefined : 'Skip tour'}
      onSecondary={isLast ? undefined : skip}
    >
      {/* Currency card — three segments (coins / freezes / XP) in one screen. */}
      {step.currency ? (
        <View style={styles.rows}>
          {CURRENCY_ROWS.map((r) => (
            <View key={r.key} style={styles.currencyRow}>
              <View style={styles.currencyIcon}>
                <r.Icon size={20} color={r.color} fill={r.color} strokeWidth={1.6} />
              </View>
              <View style={styles.currencyText}>
                <Text style={styles.currencyLabel}>{r.label}</Text>
                <Text style={styles.currencyBody}>{r.body}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Hub card — optional deep-links to the REAL screens (no duplicate UI).
          They push on top of this card; backing out returns here. */}
      {step.hub ? (
        <View style={styles.rows}>
          <Pressable style={styles.actionRow} onPress={() => router.push('/personalize')}>
            <View style={styles.actionIcon}>
              <Palette size={18} color={colors.ink} strokeWidth={2.2} />
            </View>
            <Text style={styles.actionLabel}>Personalize</Text>
            <ChevronRight size={18} color={colors.mutedLight} strokeWidth={2.2} />
          </Pressable>
          <Pressable style={styles.actionRow} onPress={() => router.push('/manage-categories')}>
            <View style={styles.actionIcon}>
              <Tags size={18} color={colors.ink} strokeWidth={2.2} />
            </View>
            <Text style={styles.actionLabel}>Set up categories</Text>
            <ChevronRight size={18} color={colors.mutedLight} strokeWidth={2.2} />
          </Pressable>
        </View>
      ) : null}
    </TourScreen>
  );
}

const styles = StyleSheet.create({
  rows: {
    gap: spacing.sm,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  currencyIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.iconTile,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyText: {
    flex: 1,
  },
  currencyLabel: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  currencyBody: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.chipBg,
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.iconTile,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: colors.ink,
  },
});
