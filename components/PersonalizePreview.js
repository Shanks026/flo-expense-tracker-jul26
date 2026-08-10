import { View, Text, Image, StyleSheet } from 'react-native';
import {
  Bell,
  Trophy,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  Home,
  List,
  ChartColumn,
  Menu as MenuIcon,
  Plus,
  ChevronDown,
} from 'lucide-react-native';
import CardThemeSurface from './CardThemeSurface';
import AmountText from './AmountText';
import CategoryIcon from './CategoryIcon';
// Only the PURE helpers — ChartAxis/ChartGridlines themselves call useTheme()
// and would paint the real active theme instead of the draft one, the same
// reason Card/IconTile/AccountDots are hand-rolled below. niceAxisMax and
// formatAxisValue take no colors, so the preview's axis numbers round and
// abbreviate exactly like the real chart's.
import { niceAxisMax, formatAxisValue, AXIS_INTERVALS, AXIS_WIDTH } from './ChartAxis';
import { RANK_BADGE_ART } from '../lib/rewards';
import { fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import { formatMoney } from '../lib/currency';
import { lighten } from '../lib/color';

// The same koban art the real header uses — plain image assets, no theme
// dependency, so these are safe to reuse directly here.
const KOBAN_COIN = require('../assets/general/coin.png');
const KOBAN_FREEZE = require('../assets/general/freeze.png');
const KOBAN_STREAK_FLAME = require('../assets/general/streak.png');
// Fixed so the preview badge never changes with real progress (see PREVIEW_*
// below — this mock is entirely deterministic). `tycoon` is the id whose title
// is "Vanguard"; lib/rewards.js carries deliberate id/title drift, and the id
// is what keys RANK_BADGE_ART.
const PREVIEW_RANK_ID = 'tycoon';

// A genuine miniature CLONE of the real Home screen (app/(tabs)/index.js) —
// header chips, greeting, hero card, carousel dots, chart, half-visible
// Recent Transactions, and the tab bar — built at the SAME internal
// proportions as the real screen (real theme/tokens.js values throughout,
// same layout math), then uniformly shrunk with ONE transform: scale. Per
// direct feedback: "make the entire screen with the same scale but smaller
// on the whole" — not a redesigned, re-proportioned mini layout.
//
// Static, non-interactive (pointerEvents="none"), and driven ENTIRELY by
// props: `colors` is a fully-resolved DRAFT color set (theme/themes.js's
// resolveColors() is pure — this never touches the app's real active theme)
// and `cardTheme` is the draft card selection. This is also why several real
// components are hand-rolled here instead of reused directly — Card,
// IconTile, AccountDots, and IncomeExpenseChart all call useTheme()
// internally and would render the REAL active theme regardless of what's
// passed in. (AmountText and CategoryIcon ARE reused — both take every color
// they render as an explicit prop, no internal useTheme() dependency for the
// paths used here.)
const PREVIEW_BALANCE = 42500;
const PREVIEW_INCOME = 18200;
const PREVIEW_EXPENSE = 9650;
const PREVIEW_COINS = 3463;
const PREVIEW_FREEZES = 3;
// Vanguard spans levels 35–49 on lib/rewards.js's curve (its 45000 minXp lands
// at level 35), so the number beside the badge is picked from inside that band
// — a Vanguard badge next to "8" would contradict itself.
const PREVIEW_LEVEL = 38;
const PREVIEW_STREAK = 67;

// Fixed/deterministic — mirrors components/IncomeExpenseChart's own visual
// grammar (bars + day labels + y-axis + gridlines, real BAR_MAX_HEIGHT) but a
// fixed dataset, not live data or Math.random(), so the preview never jitters
// between renders. Real VALUES rather than the old 0–1 height fractions, so
// the axis can label them for real; niceAxisMax rounds these to exactly 1000,
// which reproduces the previous fractions (400/1000 = 0.4, …) — the bars look
// identical, they just now sit against a truthful scale.
const BAR_VALUES = [400, 700, 500, 900, 300, 600, 800];
const BAR_DAYS = ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'];
const BAR_MAX_HEIGHT = 110; // matches IncomeExpenseChart's real BAR_MAX_HEIGHT
const BAR_GAP = spacing.sm; // matches IncomeExpenseChart's real BAR_GAP
const BAR_AXIS_MAX = niceAxisMax(Math.max(...BAR_VALUES));

const PREVIEW_TRANSACTIONS = [
  { name: 'Shopping', sub: '19 Jul · Shopping', amount: 350, icon: 'shopping' },
  { name: 'Groceries', sub: '18 Jul · Groceries', amount: 359.52, icon: 'groceries' },
];

// Natural (pre-scale) device canvas, built at real proportions.
const DEVICE_WIDTH = 360;
// NAV_HEIGHT is the tab bar mock's own solid height (excludes the raised +
// button, which pokes above it). DEVICE_HEIGHT is tuned so the navbar's top
// edge — painted AFTER, so on top of, the content above it — lands about
// halfway down the second Recent Transactions row, matching the reference
// screenshot's "half visible, cut by the nav bar" look. Both are the two
// numbers to retune on-device if that's off (this can't be visually verified
// from here).
const NAV_HEIGHT = 90;
const DEVICE_HEIGHT = 802; // +12 for content's paddingTop bump (spacing.sm → spacing.xl)
const SCALE = 0.56;

export default function PersonalizePreview({ colors, cardTheme, style }) {
  // Same derivation as app/shop.js's own preview — Ink's chipColor is a
  // hardcoded lime that ignores the app's Primary Color, so it's swapped for
  // the DRAFT accent's brand color specifically (not the real active one).
  const accentSource = cardTheme.id === 'ink' ? colors.brand : cardTheme.chipColor;
  const trendColor = lighten(accentSource, 0.65);

  return (
    <View
      style={[styles.outer, { width: DEVICE_WIDTH * SCALE, height: DEVICE_HEIGHT * SCALE, borderColor: colors.border }, style]}
      pointerEvents="none"
    >
      <View
        style={[
          styles.device,
          {
            width: DEVICE_WIDTH,
            height: DEVICE_HEIGHT,
            backgroundColor: colors.bg,
            transform: [{ scale: SCALE }],
            // Array form must have exactly 3 entries (x, y, z) — RN's
            // _validateTransformOrigin throws otherwise; z is a plain number
            // (pixels), not a percent.
            transformOrigin: ['0%', '0%', 0],
          },
        ]}
      >
        <View style={styles.content}>
          {/* Bare counters and bare icon buttons — the real header dropped its
              surface/border chip pills, so this has none either. Left is one
              row of three koban entries (coins / freeze / rank badge + level);
              right is streak, Trophy, Shop, Bell. */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.itemStats}>
                <View style={styles.itemStatEntry}>
                  <Image source={KOBAN_COIN} style={styles.coinIcon} resizeMode="contain" />
                  <Text style={[styles.itemStatText, { color: colors.ink }]}>{PREVIEW_COINS.toLocaleString('en-IN')}</Text>
                </View>
                <View style={styles.itemStatEntry}>
                  <Image source={KOBAN_FREEZE} style={styles.freezeIcon} resizeMode="contain" />
                  <Text style={[styles.itemStatText, { color: colors.ink }]}>{PREVIEW_FREEZES}</Text>
                </View>
                <View style={styles.itemStatEntry}>
                  <Image source={RANK_BADGE_ART[PREVIEW_RANK_ID]} style={styles.levelRankBadge} resizeMode="contain" />
                  <Text style={[styles.itemStatText, { color: colors.ink }]}>{PREVIEW_LEVEL}</Text>
                </View>
              </View>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.streakChip}>
                <Image source={KOBAN_STREAK_FLAME} style={styles.streakFlameIcon} resizeMode="contain" />
                <Text style={[styles.streakCount, { color: colors.streakDeep }]}>{PREVIEW_STREAK}</Text>
              </View>
              <View style={styles.headerIconButton}>
                <Trophy size={16} color={colors.ink} strokeWidth={2} />
              </View>
              <View style={styles.headerIconButton}>
                <ShoppingBag size={16} color={colors.ink} strokeWidth={2} />
              </View>
              <View style={styles.headerIconButton}>
                <Bell size={16} color={colors.ink} strokeWidth={2} />
                <View style={[styles.bellDot, { backgroundColor: colors.rose, borderColor: colors.bg }]} />
              </View>
            </View>
          </View>

          {/* Greeting only — the avatar that used to lead this row is gone
              from the real Home screen too. */}
          <View style={styles.welcomeRow}>
            <View>
              <Text style={[styles.welcomeTitle, { color: colors.ink }]}>Good morning</Text>
              <Text style={[styles.welcomeSubtitle, { color: colors.muted }]}>Here's your money, at a glance.</Text>
            </View>
          </View>

          <CardThemeSurface theme={cardTheme} style={styles.heroShape}>
            <View style={styles.heroContent}>
              {/* Name + chevron, no leading colour stroke — the real hero card
                  dropped that stroke, and the whole card is the switcher
                  trigger now. */}
              <View style={styles.heroNameRow}>
                <Text style={[styles.heroName, { color: cardTheme.textColor }]} numberOfLines={1}>
                  Personal
                </Text>
                <ChevronDown size={14} color={cardTheme.mutedColor} strokeWidth={2.4} />
              </View>
              <Text style={[styles.heroLabel, { color: cardTheme.mutedColor }]}>In Hand</Text>
              <AmountText
                value={PREVIEW_BALANCE}
                type="neutral"
                dark
                muteCurrency
                currency="INR"
                currencyColor={cardTheme.mutedColor}
                size={fontSize.amountLg}
                style={[styles.heroBalance, { color: cardTheme.textColor }]}
              />
              <View style={styles.heroStatsRow}>
                <View style={styles.heroStat}>
                  <TrendingUp size={12} color={trendColor} strokeWidth={2.8} />
                  <Text style={[styles.heroStatValue, { color: cardTheme.textColor }]}>{formatMoney(PREVIEW_INCOME, 'INR')}</Text>
                  <Text style={[styles.heroStatLabel, { color: cardTheme.mutedColor }]}>Income</Text>
                </View>
                <View style={styles.heroStat}>
                  <TrendingDown size={12} color={trendColor} strokeWidth={2.8} />
                  <Text style={[styles.heroStatValue, { color: cardTheme.textColor }]}>{formatMoney(PREVIEW_EXPENSE, 'INR')}</Text>
                  <Text style={[styles.heroStatLabel, { color: cardTheme.mutedColor }]}>Expenses</Text>
                </View>
              </View>
            </View>
          </CardThemeSurface>

          {/* Carousel dots — hand-rolled (AccountDots reads the real active
              theme internally, no color-override prop) — a static two-dot
              mock (first active), same size/color roles, no animation. */}
          <View style={styles.dotsRow}>
            <View style={[styles.dot, styles.dotActive, { backgroundColor: colors.brand }]} />
            <View style={[styles.dot, { backgroundColor: colors.mutedMid }]} />
          </View>

          <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.chartHeaderRow}>
              <View style={styles.rangeTabs}>
                <Text style={[styles.rangeTab, { color: colors.ink, fontFamily: fontFamily.extrabold }]}>7D</Text>
                <Text style={[styles.rangeTab, { color: colors.mutedLight }]}>1M</Text>
                <Text style={[styles.rangeTab, { color: colors.mutedLight }]}>3M</Text>
              </View>
              {/* Expense-only, matching Home's own defaultVisible=
                  {expense:true, income:false}. */}
              <View style={styles.totalItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.brand }]} />
                <Text style={[styles.totalValue, { color: colors.ink }]}>{formatMoney(PREVIEW_EXPENSE, 'INR')}</Text>
              </View>
            </View>
            {/* Y-axis + dashed gridlines, hand-rolled against the DRAFT colors
                for the reason given at the top of this file. Same grammar as
                ChartAxis: 5 rules from baseline to max, labels centred on each
                rule, dashes as a clipped segment row. */}
            <View style={styles.plotRow}>
              <View style={[styles.axis, { height: BAR_MAX_HEIGHT }]}>
                {Array.from({ length: AXIS_INTERVALS + 1 }, (_, i) => (
                  <Text
                    key={i}
                    style={[
                      styles.axisLabel,
                      { top: (i / AXIS_INTERVALS) * BAR_MAX_HEIGHT - 7, color: colors.mutedLight },
                    ]}
                    numberOfLines={1}
                  >
                    {formatAxisValue(BAR_AXIS_MAX - (i / AXIS_INTERVALS) * BAR_AXIS_MAX)}
                  </Text>
                ))}
              </View>
              <View style={styles.plotArea}>
                <View style={[styles.gridWrap, { height: BAR_MAX_HEIGHT }]}>
                  {Array.from({ length: AXIS_INTERVALS + 1 }, (_, i) => (
                    <View key={i} style={[styles.gridRow, { top: (i / AXIS_INTERVALS) * BAR_MAX_HEIGHT }]}>
                      <View style={styles.dashLine}>
                        {Array.from({ length: 60 }, (_, d) => (
                          <View key={d} style={[styles.dash, { backgroundColor: colors.border }]} />
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
                <View style={styles.chartArea}>
                  {BAR_VALUES.map((value, i) => (
                    <View key={BAR_DAYS[i]} style={styles.barColumn}>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { height: Math.max((value / BAR_AXIS_MAX) * BAR_MAX_HEIGHT, 4), backgroundColor: colors.brand },
                          ]}
                        />
                      </View>
                      <Text style={[styles.barDayLabel, { color: colors.mutedMid }]}>{BAR_DAYS[i]}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>Recent Transactions</Text>
            <Text style={[styles.sectionAction, { color: colors.muted }]}>See all</Text>
          </View>
          {/* The nav bar mock below is absolutely positioned and painted
              AFTER this card, so it overlaps (and visually cuts) whatever
              content sits at the bottom of the device canvas — the second
              row here, by design (see DEVICE_HEIGHT's comment above). */}
          <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {PREVIEW_TRANSACTIONS.map((tx, idx) => (
              <View
                key={tx.name}
                style={[styles.row, idx < PREVIEW_TRANSACTIONS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderSoft }]}
              >
                <View style={[styles.rowIconTile, { backgroundColor: colors.iconTileBg }]}>
                  <CategoryIcon icon={tx.icon} size={20} color={colors.ink} />
                </View>
                <View style={styles.rowMid}>
                  <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>
                    {tx.name}
                  </Text>
                  <Text style={[styles.rowSub, { color: colors.mutedMid }]}>{tx.sub}</Text>
                </View>
                <Text style={[styles.rowAmount, { color: colors.ink }]}>{`−${formatMoney(tx.amount, 'INR')}`}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Tab bar mock — pinned to the bottom of the device canvas. */}
        <View style={[styles.navBar, { height: NAV_HEIGHT, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={styles.navItem}>
            <Home size={20} color={colors.ink} strokeWidth={2.2} />
          </View>
          <View style={styles.navItem}>
            <List size={20} color={colors.mutedLight} strokeWidth={2} />
          </View>
          <View style={[styles.navAddButton, { backgroundColor: colors.brand }]}>
            <Plus size={22} color={colors.brandText} strokeWidth={2.6} />
          </View>
          <View style={styles.navItem}>
            <ChartColumn size={20} color={colors.mutedLight} strokeWidth={2} />
          </View>
          <View style={styles.navItem}>
            <MenuIcon size={20} color={colors.mutedLight} strokeWidth={2} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignSelf: 'center',
    borderWidth: 1,
    // A touch tighter than radii.cardLg (26) — at this mock's scaled-down
    // size that curve read as too round for a "phone screen" frame.
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  // transformOrigin '0%,0%' pins the scaled content's top-left corner to
  // this View's own layout origin, which is also `outer`'s origin (its only
  // child) — so the painted result exactly fills `outer`'s
  // DEVICE_WIDTH*SCALE × DEVICE_HEIGHT*SCALE box with no manual centering
  // math needed.
  device: {
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: spacing.xl,
    // Matches the horizontal padding (per direct feedback — spacing.sm read
    // as noticeably thinner than the xl left/right gutters, unbalanced).
    paddingTop: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  // The header runs noticeably smaller than the real Home screen's own
  // token-accurate sizes — per direct feedback, the real proportions
  // overflowed/overlapped at this mock's DEVICE_WIDTH, and the real header has
  // since grown two more buttons (Trophy, Shop), so the budget is tighter
  // still: at real sizes the two clusters need ~370px of the 320px this canvas
  // has after its content padding. Everything else in this file stays
  // token-accurate; only these header metrics are scaled down.
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemStats: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    gap: 10,
  },
  itemStatEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemStatText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
    letterSpacing: -0.2,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  coinIcon: {
    width: 18,
    height: 18,
  },
  // Same /0.876 canvas-fill correction the real header applies — the freeze
  // art only fills ~87.6% of its own square, so a bare width would read
  // smaller than the coin beside it.
  freezeIcon: {
    width: 14 / 0.876,
    height: 14 / 0.876,
  },
  levelRankBadge: {
    width: 16,
    height: 16,
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 34,
  },
  // Matching /0.825 fill correction, same reason as freezeIcon.
  streakFlameIcon: {
    width: 14 / 0.825,
    height: 14 / 0.825,
  },
  streakCount: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
    letterSpacing: -0.2,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  headerIconButton: {
    height: 34,
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 6,
    // Negative, like the real one — headerIconButton is content-sized now
    // rather than a 34-wide centred box, so the dot hangs off the glyph's own
    // top-right corner.
    right: -2,
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  // A step down from the real Home screen's heading/base pair — without the
  // avatar beside it the greeting block was the heaviest thing on this mock
  // after the hero card, which isn't the hierarchy the real screen has.
  welcomeTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xxl,
    letterSpacing: -0.2,
  },
  welcomeSubtitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  heroShape: {},
  heroContent: {
    paddingVertical: 22,
    paddingHorizontal: 24,
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroName: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    letterSpacing: -0.1,
  },
  heroLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    marginTop: spacing.md,
  },
  heroBalance: {
    fontFamily: fontFamily.extrabold,
    letterSpacing: -0.4,
    marginTop: 0,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  heroStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  heroStatValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    letterSpacing: -0.2,
  },
  heroStatLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    marginLeft: -2,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginVertical: spacing.md,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  dotActive: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  chartCard: {
    marginTop: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 1,
    padding: spacing.lg,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  rangeTabs: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rangeTab: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
  },
  totalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
  },
  totalValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    letterSpacing: -0.2,
  },
  plotRow: {
    flexDirection: 'row',
  },
  plotArea: {
    flex: 1,
  },
  axis: {
    width: AXIS_WIDTH,
    flexShrink: 0,
  },
  axisLabel: {
    position: 'absolute',
    right: 8,
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    lineHeight: 14,
    textAlign: 'right',
  },
  gridWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  gridRow: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  dashLine: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  dash: {
    width: 3,
    height: 1,
    marginRight: 4,
  },
  // Gap between full-width columns, matching IncomeExpenseChart's own switch
  // away from centring a narrower track in each slot — so the first and last
  // bars sit flush with the gridline span.
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: BAR_GAP,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barTrack: {
    height: BAR_MAX_HEIGHT,
    width: '100%',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  barDayLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    marginTop: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xxl,
    letterSpacing: -0.2,
  },
  sectionAction: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
  },
  listCard: {
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 13,
  },
  rowIconTile: {
    width: 42,
    height: 42,
    borderRadius: radii.iconTile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMid: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
  },
  rowSub: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    marginTop: 1,
  },
  rowAmount: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    letterSpacing: -0.2,
  },
  navBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 14,
    paddingHorizontal: 10,
  },
  navItem: {
    width: 60,
    alignItems: 'center',
  },
  navAddButton: {
    width: 50,
    height: 50,
    borderRadius: radii.iconTileLg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
  },
});
