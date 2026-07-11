import { ScrollView, Pressable, StyleSheet } from 'react-native';
import Pill from './Pill';
import { spacing } from '../theme/tokens';

const SEGMENTS = [
  { key: 'overview', label: 'Overview' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'categories', label: 'Categories' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'plans', label: 'Plans' },
];

export default function AnalyticsSegmentTabs({ active, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {SEGMENTS.map((s) => (
        <Pressable key={s.key} onPress={() => onChange(s.key)}>
          <Pill label={s.label} tone={active === s.key ? 'dark' : 'neutral'} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
});
