import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, List, PieChart, Receipt, Plus } from 'lucide-react-native';
import { colors, radii, fontFamily } from '../theme/tokens';
import { useAddTransactionSheet } from './AddTransactionSheet';

const ICONS = { index: Home, transactions: List, budgets: PieChart, bills: Receipt };
const LABELS = { index: 'Home', transactions: 'Transactions', budgets: 'Budgets', bills: 'Bills' };

export default function TabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { openAdd } = useAddTransactionSheet();

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
        <Plus size={28} color={colors.ink} strokeWidth={2.6} />
      </Pressable>
      {secondHalf.map((route, i) => renderItem(route, i + 2))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: '#EDEEE9',
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
