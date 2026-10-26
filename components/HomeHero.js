import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AmountText from './AmountText';
import Skeleton from './Skeleton';
// Static palette (theme/tokens) only for text on the pinned-dark plate.
import { colors as staticColors, fontFamily, fontSize, spacing, radii, type } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { formatMoney } from '../lib/currency';

// Seasonal skins are post-launch (38-home-insights-more.md); only the slot
// ships. A skin draws the card's background and nothing else. Whatever it
// draws, the money sits on the plate below, a fixed emphasis surface with
// white text (well over 4.5:1 in every theme), so no skin can hurt legibility.
// Add a skin here as { id: { background: (colors) => <View … /> } }.
const HERO_SKINS = {
  plain: { background: null },
};

export function resolveHeroSkin(id) {
  return HERO_SKINS[id] ?? HERO_SKINS.plain;
}

// How the hero names the spend window, from profiles.reset_period
// (30-summary-reset-period.md). Custom periods run from a chosen day, so they
// read as "this period".
const PERIOD_LABEL = {
  monthly: 'Spent this month',
  quarterly: 'Spent this quarter',
  yearly: 'Spent this year',
  custom: 'Spent this period',
};

// Home's money hero: what you've spent this period, the biggest thing on the
// screen, with "₹X left of budget" only when an overall budget covers today.
export default function HomeHero({ spent, budget, currency, resetPeriod, skin = 'plain', loading }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { background } = resolveHeroSkin(skin);

  if (loading) return <Skeleton height={148} radius={radii.card} style={styles.card} />;

  const left = budget ? budget.amount - budget.spent : null;

  return (
    <View style={styles.card}>
      {background ? <View style={StyleSheet.absoluteFill}>{background(colors)}</View> : null}
      <View style={styles.plate}>
        <Text style={styles.label}>{PERIOD_LABEL[resetPeriod] ?? PERIOD_LABEL.monthly}</Text>
        <AmountText value={spent} type="neutral" dark size={fontSize.amountLg} currency={currency} />
        {left !== null && (
          <Text style={[styles.budget, left < 0 && styles.budgetOver]}>
            {left >= 0
              ? `${formatMoney(left, currency)} left of budget`
              : `${formatMoney(-left, currency)} over budget`}
          </Text>
        )}
      </View>
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    card: {
      borderRadius: radii.card,
      backgroundColor: colors.emphasisBg,
      overflow: 'hidden',
      marginBottom: spacing.lg,
    },
    // The fixed-contrast plate. On the plain skin it's the same colour as the
    // card, so it's invisible; on a skin it's the readable island.
    plate: {
      margin: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderRadius: radii.card - spacing.xs,
      backgroundColor: colors.emphasisBg,
      alignSelf: 'flex-start',
    },
    label: {
      fontFamily: fontFamily.semibold,
      fontSize: type.body,
      color: staticColors.mutedOnDarkLight,
      marginBottom: spacing.xs,
    },
    budget: {
      fontFamily: fontFamily.bold,
      fontSize: type.body,
      color: staticColors.surface,
      marginTop: spacing.sm,
    },
    budgetOver: {
      color: staticColors.dangerStrong,
    },
  });
}
