import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLedger, ledgerType, ledgerSize, ledgerSpace } from '../../theme/ledger';
import { ordinalDay } from '../../lib/periods';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const COLUMNS = 7;

// Pick a day of the month, 1–31 (spec 47's salary day): a 7-column grid of
// round 48 dp targets; the selected day is an ink fill with on-ink text, as a
// selected Chip is. Controlled: `value` (a day or null) / `onChange(day)`.
// Used by Settings → Summary period and onboarding's month-start question.
export default function DayOfMonthPicker({ value, onChange, accessibilityLabel = 'Day of the month' }) {
  const { c } = useLedger();
  return (
    <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {DAYS.map((day) => {
        const selected = day === value;
        return (
          <View key={day} style={styles.cell}>
            <Pressable
              onPress={() => onChange(day)}
              accessibilityRole="radio"
              accessibilityLabel={ordinalDay(day)}
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.day,
                selected && { backgroundColor: c.ink },
                pressed && !selected && { backgroundColor: c.surfaceSunk },
              ]}
            >
              <Text style={[ledgerType.rowTitle, { color: selected ? c.inkOnInk : c.ink }]}>{day}</Text>
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
    paddingVertical: ledgerSpace.xs / 2,
  },
  day: {
    width: ledgerSize.hit,
    height: ledgerSize.hit,
    borderRadius: ledgerSize.hit / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
