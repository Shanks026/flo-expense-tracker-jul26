import { View, Pressable, StyleSheet } from 'react-native';
import CategoryIcon from '../CategoryIcon';
import { useLedger, ledgerSize, ledgerSpace } from '../../theme/ledger';
import { BILL_ICON_KEYS } from '../../lib/billIcons';

const COLUMNS = 6;

// Names read out for keys that aren't plain words.
const LABELS = { wifi: 'Broadband', tv: 'TV', bills: 'Receipt', gas: 'Gas cylinder' };
const labelFor = (key) => LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);

// Pick one of FLO's icons (spec 48, bill icons): a 6-column grid of round
// 48 dp targets on sunk circles; the selected one is an ink circle with an
// on-ink glyph, as DayOfMonthPicker and the Add sheet's category circles.
// Controlled: `value` (a key or null) / `onChange(key)`. `keys` defaults to
// the whole bill icon set. Used by the bill sheet; the category sheet can
// pass its own keys.
export default function IconPicker({ value, onChange, keys = BILL_ICON_KEYS, accessibilityLabel = 'Icon' }) {
  const { c } = useLedger();
  return (
    <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {keys.map((key) => {
        const selected = key === value;
        return (
          <View key={key} style={styles.cell}>
            <Pressable
              onPress={() => onChange(key)}
              accessibilityRole="radio"
              accessibilityLabel={labelFor(key)}
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.circle,
                { backgroundColor: selected ? c.ink : c.surfaceSunk },
                pressed && !selected && styles.pressed,
              ]}
            >
              <CategoryIcon icon={key} size={20} color={selected ? c.inkOnInk : c.ink} strokeWidth={1.75} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / COLUMNS}%`,
    alignItems: 'center',
    paddingVertical: ledgerSpace.xs,
  },
  circle: {
    width: ledgerSize.hit,
    height: ledgerSize.hit,
    borderRadius: ledgerSize.hit / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
