import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Flame } from 'lucide-react-native';
import { format, isToday, parseISO } from 'date-fns';
import Card from './Card';
import useStreak from '../hooks/useStreak';
import { colors, fontFamily, fontSize, spacing, radii } from '../theme/tokens';

const CELL_SIZE = 22;

// Compact, always-visible strip on Home (05-koban-engagement.md Phase 4).
// Read-only — no tap interaction in v1 (a cell showing its date on tap is a
// reasonable v2, not required now). Pure display over useStreak()'s `history`
// field; no new query, no local state.
export default function StreakCalendar() {
  const { current, loading, history } = useStreak();

  // Nothing worth showing while the first fetch is still in flight — avoids
  // a flash of "0-day streak" before the real number resolves.
  if (loading) return null;

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconTile}>
          <Flame size={18} color={current > 0 ? colors.brand : colors.mutedLight} strokeWidth={2.2} />
        </View>
        <Text style={styles.label}>
          {current > 0 ? `${current}-day streak` : 'No streak yet'}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {history.map((day) => {
          const dayIsToday = isToday(parseISO(day.date));
          return (
            <View
              key={day.date}
              style={[
                styles.cell,
                day.logged && styles.cellLogged,
                dayIsToday && styles.cellToday,
                dayIsToday && !day.logged && styles.cellTodayEmpty,
              ]}
            />
          );
        })}
      </ScrollView>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.xxl,
    paddingVertical: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  iconTile: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: colors.iconTileBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  strip: {
    flexDirection: 'row',
    gap: 6,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 7,
    backgroundColor: colors.chipBg,
  },
  cellLogged: {
    backgroundColor: colors.brand,
  },
  cellToday: {
    borderWidth: 2,
    borderColor: colors.ink,
  },
  cellTodayEmpty: {
    backgroundColor: colors.surface,
  },
});
