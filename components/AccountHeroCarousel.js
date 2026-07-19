import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import ReAnimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { ChevronDown, ChevronRight, Plus, TrendingUp, TrendingDown } from 'lucide-react-native';
import Card from './Card';
import CardThemeSurface from './CardThemeSurface';
import AmountText from './AmountText';
import Skeleton from './Skeleton';
import AccountDots from './AccountDots';
import { useAddAccountSheet } from './AddAccountSheet';
import { useProUpsellSheet } from './ProUpsellSheet';
import useEntitlement from '../hooks/useEntitlement';
import { FREE_LIMITS } from '../lib/pro';
import { colors as staticColors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { formatMoney } from '../lib/currency';
import { getTheme } from '../lib/cardThemes';
import { lighten } from '../lib/color';

// Gap between adjacent cards in the row — small enough that the neighbor
// reads as "the next card," not a separate unrelated block.
const GAP = 14;
const SWIPE_THRESHOLD = 56;
const EMPTY_SUMMARY = { in_hand_balance: 0, month_income: 0, month_expense: 0 };

function formatAmount(value, currency) {
  const rounded = Math.round(Math.abs(value));
  return `${value < 0 ? '−' : ''}${formatMoney(rounded, currency)}`;
}

// A real horizontal carousel — every account gets its own fully-rendered
// Card (own name/color bar/balance/stats), laid out side by side, so
// dragging the current one out of the way genuinely reveals the next/
// previous account's actual card underneath rather than swapping content
// inside a single fixed shell. This is only workable because every
// account's numbers are prefetched together (useAllAccountSummaries)
// instead of fetched one at a time on switch — otherwise the neighbor
// peeking in mid-drag would just be a skeleton, defeating the point.
//
// With exactly one account (the common state right after sign-up), a
// second, non-real "Add another account" slide is appended so the swipe
// gesture has something to teach itself on day one — otherwise nothing
// about a single, un-swipeable card hints that switching is even a thing.
// Tapping it reuses the exact same free-tier gate AccountSwitcherSheet's
// own "+ New Account" button already enforces (FREE_LIMITS.accounts), so
// behavior stays identical however the add-account flow is reached.
//
// `visualIndex` (local state) is the single source of truth for which
// slide is centered — separate from `activeAccountId`, because viewing the
// teaser slide must NOT change which account is actually active. Swiping
// onto a REAL account slide calls `onSwitchAccount`; swiping onto the
// teaser slide doesn't touch the account at all.
export default function AccountHeroCarousel({
  accounts,
  activeAccountId,
  onSwitchAccount,
  onOpenSwitcher,
  summaries,
  summariesLoading,
  currency,
  cardTheme,
}) {
  const { colors } = useTheme();
  // Falls back to Ink (today's pre-feature look) if no theme is resolved
  // yet — 19-card-themes.md Phase 1. Ink is the free default so this is
  // never visibly wrong, just a safe placeholder during the first render.
  const theme = cardTheme ?? getTheme('ink');
  // Trend-icon colors derive from the card's own accent (chipColor), not a
  // fixed semantic green/red. Both icons share the SAME lightened tint —
  // per direct feedback (2026-07-20), darkening expense separately (tried
  // at two different amounts) never read as reliably legible across every
  // theme's background, so both just use the one tint already confirmed to
  // work. Income/expense are still told apart by the trend direction (arrow
  // up/down) and the amount itself, not by icon hue.
  const incomeIconColor = lighten(theme.chipColor, 0.65);
  const expenseIconColor = incomeIconColor;
  const styles = makeStyles(colors);
  const { isPro } = useEntitlement();
  const { openAddAccount } = useAddAccountSheet();
  const { openProUpsell } = useProUpsellSheet();
  const [viewportWidth, setViewportWidth] = useState(0);

  const showAddCard = accounts.length === 1;
  const slideCount = accounts.length + (showAddCard ? 1 : 0);
  const activeRealIndex = Math.max(
    accounts.findIndex((a) => a.id === activeAccountId),
    0
  );
  const [visualIndex, setVisualIndex] = useState(activeRealIndex);

  const cardWidth = useSharedValue(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    cardWidth.value = viewportWidth;
    translateX.value = -(visualIndex * (viewportWidth + GAP));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportWidth]);

  // Fires only when the ACTIVE ACCOUNT changes from outside this component
  // (AccountSwitcherSheet) — browsing the teaser slide never touches
  // activeAccountId, so it never fights with a user mid-swipe there. Drives
  // the settle animation directly (UI thread) rather than waiting on a
  // second render pass, same reasoning as the gesture's own onEnd below.
  useEffect(() => {
    setVisualIndex(activeRealIndex);
    translateX.value = withTiming(-(activeRealIndex * (cardWidth.value + GAP)), { duration: 260 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRealIndex]);

  function handleSlideChange(target) {
    setVisualIndex(target);
    if (target < accounts.length && accounts[target].id !== activeAccountId) {
      onSwitchAccount(accounts[target].id);
    }
  }

  function handleAddAccountPress() {
    if (!isPro && accounts.length >= FREE_LIMITS.accounts) {
      openProUpsell('Free includes 1 account');
    } else {
      openAddAccount();
    }
  }

  const swipeGesture = Gesture.Pan()
    .enabled(slideCount > 1)
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      const atStart = visualIndex <= 0;
      const atEnd = visualIndex >= slideCount - 1;
      let dx = e.translationX;
      if ((dx > 0 && atStart) || (dx < 0 && atEnd)) dx *= 0.35;
      translateX.value = -(visualIndex * (cardWidth.value + GAP)) + dx;
    })
    .onEnd((e) => {
      let target = visualIndex;
      if (e.translationX <= -SWIPE_THRESHOLD && visualIndex < slideCount - 1) target = visualIndex + 1;
      else if (e.translationX >= SWIPE_THRESHOLD && visualIndex > 0) target = visualIndex - 1;

      // Animate immediately on the UI thread regardless of source — don't
      // wait for the JS-thread account switch (and everything it triggers:
      // AccountContext state, transactions/trend refetches for the new
      // account) to round-trip back before the card finishes sliding. That
      // round trip is what read as "a minor slowing down" — the visual
      // settle was gated behind React's commit instead of running
      // independently of it.
      translateX.value = withTiming(-(target * (cardWidth.value + GAP)), { duration: 220 });
      if (target !== visualIndex) {
        scheduleOnRN(handleSlideChange, target);
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View>
      <View style={styles.viewport} onLayout={(e) => setViewportWidth(e.nativeEvent.layout.width)}>
        <GestureDetector gesture={swipeGesture}>
          <ReAnimated.View style={[styles.row, rowStyle]}>
            {accounts.map((account) => {
              const summary = summaries[account.id] ?? EMPTY_SUMMARY;
              return (
                <View key={account.id} style={[styles.slot, { width: viewportWidth || undefined, marginRight: GAP }]}>
                  <CardThemeSurface theme={theme} style={styles.heroCardShape}>
                    <View style={styles.heroCardContent}>
                      <View style={styles.heroTopRow}>
                        <Pressable style={styles.accountHeading} onPress={onOpenSwitcher} hitSlop={6}>
                          <View style={[styles.accountColorLine, { backgroundColor: account.color }]} />
                          <View style={styles.accountNameRow}>
                            <Text style={[styles.accountName, { color: theme.textColor }]} numberOfLines={1}>
                              {account.name}
                            </Text>
                            <ChevronDown size={14} color={theme.mutedColor} strokeWidth={2.4} />
                          </View>
                        </Pressable>
                      </View>

                      <Text style={[styles.heroLabel, { color: theme.mutedColor }]}>In Hand</Text>
                      {summariesLoading ? (
                        <Skeleton width={160} height={fontSize.amountLg} radius={8} style={{ marginTop: spacing.xs, backgroundColor: 'rgba(128,128,128,0.25)' }} />
                      ) : (
                        <AmountText
                          value={summary.in_hand_balance}
                          type="neutral"
                          dark
                          muteCurrency
                          currency={currency}
                          currencyColor={theme.mutedColor}
                          size={fontSize.amountLg}
                          style={[styles.heroBalance, { color: theme.textColor }]}
                        />
                      )}
                      {summariesLoading ? (
                        <View style={styles.heroStatsRow}>
                          <Skeleton width={90} height={fontSize.md} radius={6} style={{ backgroundColor: 'rgba(128,128,128,0.25)' }} />
                          <Skeleton width={90} height={fontSize.md} radius={6} style={{ backgroundColor: 'rgba(128,128,128,0.25)' }} />
                        </View>
                      ) : (
                        <View style={styles.heroStatsRow}>
                          <View style={styles.heroStat}>
                            <TrendingUp size={11} color={incomeIconColor} strokeWidth={2.8} />
                            <Text style={[styles.heroStatValue, { color: theme.textColor }]}>{formatAmount(summary.month_income, currency)}</Text>
                            <Text style={[styles.heroStatLabel, { color: theme.mutedColor }]}>Income</Text>
                          </View>
                          <View style={styles.heroStat}>
                            <TrendingDown size={11} color={expenseIconColor} strokeWidth={2.8} />
                            <Text style={[styles.heroStatValue, { color: theme.textColor }]}>{formatAmount(summary.month_expense, currency)}</Text>
                            <Text style={[styles.heroStatLabel, { color: theme.mutedColor }]}>Expenses</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </CardThemeSurface>
                </View>
              );
            })}

            {showAddCard && (
              <View style={[styles.slot, { width: viewportWidth || undefined, marginRight: GAP }]}>
                <Pressable style={styles.addPressable} onPress={handleAddAccountPress}>
                  <Card dark style={[styles.heroCard, styles.addCardFill]}>
                    <View>
                      <View style={styles.addIconTile}>
                        <Plus size={20} color={colors.brand} strokeWidth={2.4} />
                      </View>
                      <Text style={styles.addTitle}>Split work from personal</Text>
                      <Text style={styles.addSubtitle}>Add another account to keep every rupee where it belongs.</Text>
                    </View>
                    <View style={styles.addCta}>
                      <Text style={styles.addCtaText}>Add account</Text>
                      <ChevronRight size={14} color={colors.brand} strokeWidth={2.6} />
                    </View>
                  </Card>
                </Pressable>
              </View>
            )}
          </ReAnimated.View>
        </GestureDetector>
      </View>

      <View style={styles.dotsRow}>
        <AccountDots count={slideCount} activeIndex={visualIndex} />
      </View>
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    viewport: {
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
    },
    slot: {
      flexShrink: 0,
    },
    heroCard: {
      borderRadius: radii.cardLg,
      paddingVertical: 22,
      paddingHorizontal: 24,
    },
    // Themed hero cards (19-card-themes.md) split shape from content —
    // CardThemeSurface's own `style` prop must carry no padding (see its
    // comment on why), so the real padding lives on this inner wrapper
    // instead. The "Add account" teaser slide is deliberately NOT themed
    // and keeps using `heroCard` directly on `<Card dark>` above.
    heroCardShape: {
      borderRadius: radii.cardLg,
    },
    heroCardContent: {
      paddingVertical: 22,
      paddingHorizontal: 24,
    },
    heroTopRow: {
      marginBottom: spacing.md,
    },
    accountHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 1,
      paddingRight: spacing.sm,
    },
    // A left-border accent beside the name instead of a bar stacked above
    // it — same 3px thickness as before, just rotated into a vertical
    // border and sized to the name's own line height so it reads as
    // "attached to the text" rather than a separate floating element.
    accountColorLine: {
      width: 3,
      height: fontSize.lg,
      borderRadius: radii.pill,
    },
    accountNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 1,
    },
    accountName: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.lg,
      lineHeight: fontSize.lg,
      letterSpacing: -0.1,
      color: staticColors.surface,
      flexShrink: 1,
    },
    heroLabel: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.base,
      color: staticColors.mutedMid,
    },
    heroBalance: {
      marginTop: 0,
    },
    // flexWrap lets Expenses drop to its own line below Income on narrow
    // screens instead of overflowing the card's right edge — confirmed via
    // real pixel math that two stats plus icons/gaps can exceed a 320px
    // card's content width. Deliberately NOT solved with numberOfLines/
    // truncation on the amount itself — a clipped money figure ("₹45,2…")
    // is actively misleading, not just a cosmetic miss, so wrapping to a
    // second row (or, worst case, the value text wrapping within its own
    // block via flexShrink below) is the only acceptable fallback here.
    heroStatsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.lg,
      marginTop: spacing.xl,
    },
    heroStat: {
      flexDirection: 'row',
      // flex-end, not center — per direct feedback: heroStatValue (md) and
      // heroStatLabel (sm) are different font sizes, so center-aligning
      // left them visually offset from each other instead of sharing a
      // baseline. Bottom-aligning the row reads as one coherent line.
      alignItems: 'flex-end',
      flexShrink: 1,
      gap: 7,
    },
    heroStatValue: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.md,
      letterSpacing: -0.2,
      color: staticColors.surface,
      flexShrink: 1,
    },
    heroStatLabel: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.sm,
      color: staticColors.mutedMid,
      flexShrink: 1,
    },
    // Fills the slot's full stretched height (matched to the real hero
    // card next to it, the row's tallest natural child) rather than
    // sitting at its own shorter natural content height — otherwise the
    // two cards in the carousel would visibly change height as you swipe
    // between them. `space-between` then spends that extra height as one
    // deliberate gap between the copy and the CTA, not evenly-distributed
    // slivers between every line — the same top-content/bottom-action
    // split most "empty state" cards use.
    addPressable: {
      flex: 1,
    },
    addCardFill: {
      flex: 1,
      justifyContent: 'space-between',
    },
    addIconTile: {
      width: 40,
      height: 40,
      borderRadius: radii.iconTile,
      backgroundColor: colors.brandBgDark,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    addTitle: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.lg,
      letterSpacing: -0.1,
      color: staticColors.surface,
      marginBottom: 4,
    },
    addSubtitle: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.sm,
      color: staticColors.mutedMid,
      lineHeight: fontSize.sm * 1.4,
    },
    addCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    addCtaText: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.sm,
      color: colors.brand,
    },
    dotsRow: {
      alignItems: 'center',
      marginTop: spacing.md,
    },
  });
}
