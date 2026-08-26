import { forwardRef, useImperativeHandle, useRef, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Wallet, FileText, Flag, Receipt, Settings, LogOut, X, Crown, ChevronRight, Users } from 'lucide-react-native';
import { radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../lib/AuthContext';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import useEntitlement from '../hooks/useEntitlement';

const MenuSheetContext = createContext(null);

export function MenuSheetProvider({ children }) {
  const sheetRef = useRef(null);
  const openMenu = useCallback(() => sheetRef.current?.open(), []);

  return (
    <MenuSheetContext.Provider value={{ openMenu }}>
      {children}
      <MenuSheet ref={sheetRef} />
    </MenuSheetContext.Provider>
  );
}

export function useMenuSheet() {
  const ctx = useContext(MenuSheetContext);
  if (!ctx) throw new Error('useMenuSheet must be used within MenuSheetProvider');
  return ctx;
}

// Plans moved back in here (2026-07-14) — its old tab slot is now the "Menu"
// action button in TabBar.js, since the menu itself was only reachable via
// Home's header, hard to get to from other tabs. Same icon (Flag) it's always
// had, on whichever surface it lives.
//
// Budgets joined it here (2026-07-18), swapped with Analytics for the tab
// bar's slot — Plans and Budgets now sit consistently next to each other
// (both pushed screens with the same thumb-reachable bottom "New X" button),
// rather than one being a tab and the other buried in this sheet.
const ITEMS = [
  { key: 'plans', label: 'Plans', route: '/plans', icon: Flag },
  // Splits sits next to Plans (2026-08-26, 31-split-expenses.md) — both are
  // event-shaped: a trip is usually a plan AND a split, and splits.plan_id
  // links the two. Adding a sixth row is what bumped the snapPoints below.
  { key: 'splits', label: 'Splits', route: '/splits', icon: Users },
  { key: 'budgets', label: 'Budgets', route: '/budgets', icon: Wallet },
  { key: 'reports', label: 'Reports', route: '/report', icon: FileText },
  { key: 'bills', label: 'Bills', route: '/bills', icon: Receipt },
  // Both Trophies (2026-07-21) and Shop (2026-07-26) moved OUT of this sheet
  // into dedicated Home header buttons (beside the bell). The menu is now
  // just navigation rows + the optional Upgrade card, so it also got shorter
  // — see the isPro-conditional snapPoints below.
  { key: 'settings', label: 'Settings', route: '/settings', icon: Settings },
];

const MenuSheet = forwardRef(function MenuSheet(_props, ref) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const modalRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef);
  const router = useRouter();
  const { signOut } = useAuth();
  const { isPro } = useEntitlement();

  useImperativeHandle(ref, () => ({
    open() {
      modalRef.current?.present();
    },
  }));

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    []
  );

  function handlePress(route) {
    modalRef.current?.dismiss();
    router.push(route);
  }

  function handleLogout() {
    modalRef.current?.dismiss();
    signOut();
  }

  return (
    <BottomSheetModal
      ref={modalRef}
      onChange={handleSheetChange}
      // FIXED height — enableDynamicSizing is OFF, deliberately, after two
      // failed attempts at combining it with this sheet's pinned-top /
      // scrolling-middle / pinned-footer layout. Dynamic sizing needs the
      // scrollable region to report its own natural content height so the
      // sheet can size around it — but that region also needs `flex: 1` to
      // fill the space BETWEEN the two pinned regions, and those two
      // requirements fight each other: flex:1 makes it try to fill whatever
      // space is left instead of reporting its natural size, which collapsed
      // the whole sheet down to barely one visible row. Not worth chasing
      // further blind (no on-device access here) — reverting to the one
      // configuration already confirmed correct on-device (full content,
      // all rows visible): a plain fixed snapPoint.
      //
      // ▼▼▼ TO CHANGE THE SHEET'S HEIGHT, EDIT THESE TWO VALUES ▼▼▼
      // Two heights now, keyed on Pro. Non-Pro is taller to make room for the
      // Upgrade card pinned in the top section; Pro (no Upgrade card, and with
      // Trophies + Shop now in the Home header) is shorter so it doesn't sit
      // half-empty. Same '%' snapPoint string every other sheet in this app
      // uses (AddTransactionSheet, AddBudgetSheet, etc.). Tune either value
      // freely — no other line needs to change alongside it. (Picked without
      // an on-device measure here; adjust if either sits too tall/short.)
      // Both values bumped ~4% (2026-08-26) for the sixth row, Splits.
      snapPoints={useMemo(() => (isPro ? ['70%'] : ['82%']), [isPro])}
      // ▲▲▲ first = Pro (shorter), second = non-Pro (taller, fits Upgrade card)
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.bg, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
      handleIndicatorStyle={{ backgroundColor: colors.chevron, width: 44 }}
    >
      {/* Three-part layout, only the middle part scrolls:
          1. Top section (pinned) — header, Level card, Upgrade card. None of
             these are "menu items" to scroll past, they're status/promo
             content the user should always see immediately on open.
          2. BottomSheetScrollView (scrolls, flex: 1 — fills whatever space
             is left between the two pinned regions) — the actual navigation
             rows (Plans/Budgets/.../Settings). This is the part that grows
             over time (a future store section, etc.); scroll is what
             absorbs that growth without the sheet's own height ever needing
             to change.
          3. Footer (pinned) — divider + Log Out, always reachable.
          The sheet's total height is the snapPoints value above (see its own
          comment) — NOT content-driven (dynamic sizing proved to conflict with
          this pinned/scroll/pinned structure; see the snapPoints comment for
          what broke). There are now two fixed heights keyed on Pro: a Pro
          account gets a genuinely shorter sheet (no Upgrade card to make room
          for), rather than the same height with empty space. */}
      <View style={styles.topSection}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Menu</Text>
          <Pressable style={styles.closeButton} onPress={() => modalRef.current?.dismiss()}>
            <X size={16} color={colors.ink} strokeWidth={2.6} />
          </Pressable>
        </View>

        {!isPro && (
          <Pressable style={styles.upgradeCard} onPress={() => handlePress('/pro')}>
            <View style={styles.upgradeIconTile}>
              <Crown size={20} color={colors.brandText} strokeWidth={2.2} fill={colors.brandText} />
            </View>
            <View style={styles.upgradeTextWrap}>
              <Text style={styles.upgradeTitle}>Upgrade to Pro</Text>
              <Text style={styles.upgradeSubtitle}>Unlimited accounts, budgets & more</Text>
            </View>
            <ChevronRight size={18} color={colors.brandText} strokeWidth={2.4} />
          </Pressable>
        )}
      </View>

      <BottomSheetScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Pressable key={item.key} style={styles.row} onPress={() => handlePress(item.route)}>
              <View style={styles.rowIcon}>
                <Icon size={19} color={colors.ink} strokeWidth={2} />
              </View>
              <Text style={styles.rowLabel}>{item.label}</Text>
            </Pressable>
          );
        })}
      </BottomSheetScrollView>

      {/* Static, always-rendered, very muted — no conditional tracking (the
          earlier onLayout/onContentSizeChange/onScroll version caused
          rendering issues on-device). Simple and reliable over precise. */}
      {/* <Text style={styles.scrollHintText}>Scroll for more</Text> */}

      {/* Pinned footer — Log Out. paddingBottom includes the device's real
          bottom safe-area inset (gesture bar / 3-button nav), same formula
          AccountSwitcherSheet already uses (spacing.xxl + insets.bottom) —
          not a guessed flat value, since that inset varies a lot by device
          and nav-bar style. */}
      <View style={[styles.footer, { paddingBottom: spacing.xxl + insets.bottom }]}>
        <View style={styles.divider} />
        <Pressable style={styles.row} onPress={handleLogout}>
          <View style={styles.rowIcon}>
            <LogOut size={19} color={colors.dangerStrong} strokeWidth={2} />
          </View>
          <Text style={[styles.rowLabel, styles.logoutLabel]}>Log Out</Text>
        </Pressable>
      </View>
    </BottomSheetModal>
  );
});

function makeStyles(colors) {
  return StyleSheet.create({
  // The pinned top section — header, Level card, Upgrade card. A plain View,
  // not scrollable content, so it always renders in full regardless of
  // scroll position in the middle section.
  topSection: {
    paddingHorizontal: spacing.xl,
  },
  // BottomSheetScrollView's contentContainerStyle — no flex: 1, same as
  // every other sheet's contentContainerStyle in this app (a ScrollView's
  // content container sizes to its children, it doesn't stretch to fill the
  // scroll viewport).
  scrollContent: {
    paddingHorizontal: spacing.xl,
    // Modest — the footer below (outside this ScrollView) carries the real
    // bottom safe-area padding; this just keeps the last row from touching
    // the footer's divider.
    paddingBottom: spacing.md,
  },
  // Sibling of the ScrollView, not inside it — see the Log Out JSX comment.
  // Same horizontal inset as the other two sections (it's outside their
  // contentContainerStyle/View) and the sheet's own ink background, so all
  // three read as one continuous surface. paddingBottom is set inline
  // (spacing.xxl + insets.bottom) since it depends on the device's safe area.
  footer: {
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.bg,
  },
  // Static "scroll for more" hint between the scrollable region and the
  // footer — very muted, always rendered (no conditional visibility logic).
  scrollHintText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.mutedMid,
    textAlign: 'center',
    paddingVertical: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: colors.ink,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.iconTileBg,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.brand,
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
  },
  upgradeIconTile: {
    width: 44,
    height: 44,
    borderRadius: radii.iconTileLg,
    backgroundColor: colors.brandOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeTextWrap: {
    flex: 1,
  },
  upgradeTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.lg,
    color: colors.brandText,
  },
  upgradeSubtitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.brandTextMuted,
    marginTop: 1,
  },
  rowLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.ink,
  },
  logoutLabel: {
    color: colors.dangerStrong,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSoft,
    marginVertical: spacing.sm,
  },
  });
}
