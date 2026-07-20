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

// The "In Hand"/"Income"/"Expenses" labels and the muted ₹ currency symbol
// used theme.mutedColor (each theme's own textColor at reduced opacity) —
// technically theme-aware, but per direct feedback it didn't actually read
// right across the catalog. Simplified per direct instruction: a flat low-
// opacity white, so it blends into each card's own background directly
// instead of being derived from a per-theme color. Correct for the
// large majority of themes (white textColor); the handful of pale/light-
// background themes with dark textColor (Marble, Rose Gold, Copper, ...)
// are the accepted exception — simplicity over per-theme correctness here,
// per direct instruction.
const MUTED_LABEL_COLOR = 'rgba(255,255,255,0.55)';

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
  accountsLoading,
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
  //
  // Ink is the exception: it's the free DEFAULT (no theme bought/equipped),
  // and lib/cardThemes.js hardcodes its chipColor to lime — which silently
  // ignored the app's own selectable Primary Color (Settings' ColorPicker,
  // theme/ThemeContext.js) for anyone who'd picked something other than
  // lime. `colors.brand` already resolves to the selected accent
  // independent of light/dark app mode (theme/themes.js's `resolveColors`
  // sets `brand: accent.brand` unconditionally) — using it here for Ink
  // specifically fixes both modes in one change, per direct feedback.
  // Every OTHER card theme keeps reading its own fixed chipColor — a
  // bought/equipped cosmetic shouldn't shift when the app accent changes.
  const accentSource = theme.id === 'ink' ? colors.brand : theme.chipColor;
  const incomeIconColor = lighten(accentSource, 0.65);
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

  // No accounts to show yet (AccountContext still resolving, or the active
  // theme hasn't hydrated — see Home's own accountsLoading) — a real card
  // shape in skeleton form, not an empty viewport. Without this, the whole
  // hero section visibly vanished for the loading window (accounts.map over
  // an empty array renders nothing), then popped in once data arrived.
  if (accountsLoading) {
    return (
      <View>
        <View style={styles.viewport}>
          <View style={[styles.heroCardShape, styles.heroCardContent, styles.heroSkeletonCard]}>
            <View style={styles.heroTopRow}>
              <Skeleton width={120} height={fontSize.lg} radius={6} style={styles.heroSkeletonMuted} />
            </View>
            <Skeleton width={70} height={fontSize.base} radius={6} style={styles.heroSkeletonMuted} />
            <Skeleton
              width={160}
              height={fontSize.amountLg}
              radius={8}
              style={[styles.heroSkeletonMuted, { marginTop: spacing.xs, marginBottom: spacing.xl }]}
            />
            <View style={styles.heroStatsRow}>
              <Skeleton width={90} height={fontSize.md} radius={6} style={styles.heroSkeletonMuted} />
              <Skeleton width={90} height={fontSize.md} radius={6} style={styles.heroSkeletonMuted} />
            </View>
          </View>
        </View>
      </View>
    );
  }

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

                      <Text style={[styles.heroLabel, { color: MUTED_LABEL_COLOR }]}>In Hand</Text>
                      {summariesLoading ? (
                        <Skeleton width={160} height={fontSize.amountLg} radius={8} style={{ marginTop: spacing.xs, backgroundColor: 'rgba(128,128,128,0.25)' }} />
                      ) : (
                        <AmountText
                          value={summary.in_hand_balance}
                          type="neutral"
                          dark
                          muteCurrency
                          currency={currency}
                          currencyColor={MUTED_LABEL_COLOR}
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
                            <View style={styles.heroStatTextGroup}>
                              <Text style={[styles.heroStatValue, { color: theme.textColor }]}>{formatAmount(summary.month_income, currency)}</Text>
                              <Text style={[styles.heroStatLabel, { color: MUTED_LABEL_COLOR }]}>Income</Text>
                            </View>
                          </View>
                          <View style={styles.heroStat}>
                            <TrendingDown size={11} color={expenseIconColor} strokeWidth={2.8} />
                            <View style={styles.heroStatTextGroup}>
                              <Text style={[styles.heroStatValue, { color: theme.textColor }]}>{formatAmount(summary.month_expense, currency)}</Text>
                              <Text style={[styles.heroStatLabel, { color: MUTED_LABEL_COLOR }]}>Expenses</Text>
                            </View>
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
    // The loading-state stand-in for heroCardContent — full width (no
    // viewportWidth measurement needed, there's no carousel to swipe yet)
    // and a neutral themed surface instead of a card theme's own colors
    // (which the loading state, by definition, doesn't have yet either).
    heroSkeletonCard: {
      width: '100%',
      backgroundColor: colors.chipBg,
    },
    // Matches the muted-on-card-theme override the real balance/stats
    // Skeletons already use below (summariesLoading branch) — same visual
    // language whether the account itself or just its summary is loading.
    heroSkeletonMuted: {
      backgroundColor: 'rgba(128,128,128,0.25)',
    },
    // spacing.lg (16), up from spacing.md (12) — deliberately groups the
    // "which account" chrome (name + chevron) apart from the balance block
    // below it, so the eye reads them as two units (identity, then the
    // headline number) rather than one flat stack. The tighter label→balance
    // coupling (heroLabel.marginBottom) reinforces the same grouping from the
    // other side.
    heroTopRow: {
      marginBottom: spacing.lg,
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
    // A refined micro-kicker for the balance — smaller and lightly tracked
    // vs the old sentence-case 13px/no-tracking, which read as body text
    // rather than a label belonging to the number under it. Kept in the
    // label's OWN casing ("In Hand", capitalized, NOT uppercased) per direct
    // instruction. marginBottom (not a margin on the balance) owns the small,
    // deliberate gap that couples this label to the balance as one unit.
    heroLabel: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.xs,
      letterSpacing: 0.3,
      color: staticColors.mutedMid,
      marginBottom: 1,
    },
    heroBalance: {
      marginTop: 0,
      // Tighter than AmountText's shared -0.4 default. That default is an
      // ABSOLUTE point value applied to every amount app-wide, so on the 44px
      // hero balance it's proportionally almost nothing (~0.9%) — the big
      // number ended up the LOOSEST-tracked amount relative to its own size.
      // -1 (~2.3% of 44px) gives the tight, condensed set premium display
      // numerals want. Overrides the default here only (last in AmountText's
      // style array), leaving every smaller amount on -0.4.
      letterSpacing: -1,
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
      // Centered — the icon sits against the text group's full height, not
      // bottom-aligned with it (that read as the icon "sinking" below
      // center). Per direct feedback: only the value/label pair (different
      // font sizes) needs bottom-alignment for a shared baseline, not the
      // icon too — see heroStatTextGroup below.
      alignItems: 'center',
      flexShrink: 1,
      gap: 7,
    },
    heroStatTextGroup: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 7,
    },
    heroStatValue: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.md,
      letterSpacing: -0.2,
      color: staticColors.surface,
      flexShrink: 1,
    },
    // Same micro-label family as heroLabel above (capitalized, lightly
    // tracked), so "In Hand", "Income" and "Expenses" read as one consistent
    // labeling system rather than three ad-hoc treatments. Same 0.3 tracking
    // as heroLabel — matched, not a second value, since they're the same kind
    // of label.
    heroStatLabel: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xs,
      letterSpacing: 0.3,
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
