import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, List, ChartColumn, Menu as MenuIcon, Plus } from 'lucide-react-native';
import { colors as staticColors, radii, fontFamily } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { useAddTransactionSheet } from './AddTransactionSheet';
import { useMenuSheet } from './MenuSheet';

const ICONS = { index: Home, transactions: List, analytics: ChartColumn };
const LABELS = { index: 'Home', transactions: 'Transactions', analytics: 'Analytics' };

// Plans' old tab slot is now a "Menu" action button (2026-07-14) — the menu
// was otherwise only reachable via Home's header, which meant walking all the
// way back to the Home tab just to reach Plans/Budgets/Reports/Settings.
// Like the ⊕ button, Menu is an action (opens a sheet), not a navigable
// route, so it isn't part of `state.routes` and is appended after it rather
// than rendered via renderItem.
//
// Budgets swapped out for Analytics here (2026-07-18) — Analytics is the
// more-frequently-used screen, so it took the tab slot; Budgets moved to a
// pushed screen reached from the Menu sheet, alongside Plans (see
// MenuSheet.js), so the two sit consistently rather than one being a tab and
// the other buried in a sheet.
export default function TabBar({ state, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { openAdd } = useAddTransactionSheet();
  const { openMenu } = useMenuSheet();

  function renderItem(route, index) {
    const isFocused = state.index === index;
    const Icon = ICONS[route.name] ?? Home;
    const color = isFocused ? colors.ink : colors.mutedLight;

    function onPress() {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    }

    return (
      <Pressable key={route.key} onPress={onPress} style={styles.item}>
        <Icon size={24} color={color} strokeWidth={isFocused ? 2.2 : 2} />
        <Text
          style={[styles.label, { color, fontFamily: isFocused ? fontFamily.extrabold : fontFamily.semibold }]}
          numberOfLines={1}
        >
          {LABELS[route.name]}
        </Text>
      </Pressable>
    );
  }

  const firstHalf = state.routes.slice(0, 2);
  const secondHalf = state.routes.slice(2);

  return (
    <View style={[styles.bar, { height: 96 + insets.bottom, paddingBottom: insets.bottom }]}>
      {firstHalf.map((route, i) => renderItem(route, i))}
      <Pressable style={styles.addButton} onPress={() => openAdd()}>
        {/* Pinned: the button itself stays the theme's accent color
            (colors.brand) regardless of theme, so the icon on top needs a
            fixed color too, not one that inverts with the active theme. */}
        <Plus size={28} color={staticColors.ink} strokeWidth={2.6} />
      </Pressable>
      {secondHalf.map((route, i) => renderItem(route, i + 2))}
      <Pressable style={styles.item} onPress={openMenu}>
        <MenuIcon size={24} color={colors.mutedLight} strokeWidth={2} />
        <Text style={[styles.label, { color: colors.mutedLight, fontFamily: fontFamily.semibold }]} numberOfLines={1}>
          Menu
        </Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 14,
      paddingHorizontal: 10,
    },
    item: {
      alignItems: 'center',
      gap: 5,
      width: 72,
    },
    label: {
      fontSize: 10,
      letterSpacing: -0.2,
    },
    addButton: {
      width: 58,
      height: 58,
      borderRadius: radii.iconTileLg,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -20,
      shadowColor: colors.brand,
      shadowOpacity: 0.5,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
  });
}
