import { View, Text, StyleSheet } from 'react-native';
import {
  CircleDollarSign,
  Snowflake,
  Star,
  Flame,
  Bell,
  TrendingUp,
  TrendingDown,
  Home,
  List,
  ChartColumn,
  Menu as MenuIcon,
  Plus,
} from 'lucide-react-native';
import CardThemeSurface from './CardThemeSurface';
import AmountText from './AmountText';
import CategoryIcon from './CategoryIcon';
import { colors as staticColors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import { formatMoney } from '../lib/currency';
import { lighten } from '../lib/color';

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
const PREVIEW_COINS = 12500;
const PREVIEW_FREEZES = 3;
const PREVIEW_LEVEL = 8;
const PREVIEW_STREAK = 497;

// Fixed/deterministic — mirrors components/IncomeExpenseChart's own visual
// grammar (bars + day labels, real BAR_MAX_HEIGHT) but a fixed dataset, not
// live data or Math.random(), so the preview never jitters between renders.
const BAR_HEIGHTS = [0.4, 0.7, 0.5, 0.9, 0.3, 0.6, 0.8];
const BAR_DAYS = ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'];
const BAR_MAX_HEIGHT = 110; // matches IncomeExpenseChart's real BAR_MAX_HEIGHT

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
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.chipEntry}>
                  <CircleDollarSign size={13} color={colors.coinGold} fill={colors.coinGold} strokeWidth={1.5} />
                  <Text style={[styles.chipText, { color: colors.ink }]}>{PREVIEW_COINS.toLocaleString('en-IN')}</Text>
                </View>
                <View style={[styles.chipDivider, { backgroundColor: colors.border }]} />
                <View style={styles.chipEntry}>
                  <Snowflake size={13} color={colors.iceBlue} fill={colors.iceBlue} strokeWidth={2.2} />
                  <Text style={[styles.chipText, { color: colors.ink }]}>{PREVIEW_FREEZES}</Text>
                </View>
              </View>
              <View style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Star size={13} color={colors.brand} fill={colors.brand} strokeWidth={1.5} />
                <Text style={[styles.chipText, { color: colors.ink }]}>LVL {PREVIEW_LEVEL}</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <View style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Flame size={14} color={colors.streak} fill={colors.streak} strokeWidth={2.2} />
                <Text style={[styles.chipText, { color: colors.streakDeep }]}>{PREVIEW_STREAK}</Text>
              </View>
              <View style={[styles.bellButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Bell size={16} color={colors.ink} strokeWidth={2} />
                <View style={[styles.bellDot, { backgroundColor: colors.rose, borderColor: colors.surface }]} />
              </View>
            </View>
          </View>

          <View style={styles.welcomeRow}>
            <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
              <Text style={[styles.avatarText, { color: staticColors.ink }]}>F</Text>
            </View>
            <View>
              <Text style={[styles.welcomeTitle, { color: colors.ink }]}>Good morning</Text>
              <Text style={[styles.welcomeSubtitle, { color: colors.muted }]}>Here's your money, at a glance.</Text>
            </View>
          </View>

          <CardThemeSurface theme={cardTheme} style={styles.heroShape}>
            <View style={styles.heroContent}>
              <Text style={[styles.heroName, { color: cardTheme.textColor }]} numberOfLines={1}>
                Personal
              </Text>
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
            <View style={styles.chartArea}>
              {BAR_HEIGHTS.map((h, i) => (
                <View key={BAR_DAYS[i]} style={styles.barColumn}>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { height: Math.max(h * BAR_MAX_HEIGHT, 4), backgroundColor: colors.brand }]} />
                  </View>
                  <Text style={[styles.barDayLabel, { color: colors.mutedMid }]}>{BAR_DAYS[i]}</Text>
                </View>
              ))}
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
            <Plus size={22} color={staticColors.ink} strokeWidth={2.6} />
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
    borderRadius: radii.cardLg,
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
  // Header chips run noticeably smaller than the real Home screen's own
  // token-accurate sizes — per direct feedback, the real proportions
  // overflowed/overlapped at this mock's DEVICE_WIDTH (four chips' real
  // combined width exceeds what a 360-wide canvas has left after its own
  // content padding). Everything else in this file stays token-accurate.
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 11,
    borderWidth: 1,
    gap: 6,
  },
  chipEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipDivider: {
    width: 1,
    height: 14,
  },
  chipText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.sm,
    letterSpacing: -0.2,
  },
  bellButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  // Shrunk from real Home's 46×46, then bumped back up a little (34 read as
  // too small) — settled at 40×40 per direct feedback.
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
  },
  welcomeTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.heading,
    letterSpacing: -0.2,
  },
  welcomeSubtitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    marginTop: 2,
  },
  heroShape: {},
  heroContent: {
    paddingVertical: 22,
    paddingHorizontal: 24,
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
  chartArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barTrack: {
    height: BAR_MAX_HEIGHT,
    width: '60%',
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
