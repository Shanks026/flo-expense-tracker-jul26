import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLedger, ledgerType, ledgerSpace, ledgerSize } from '../../theme/ledger';
import { inter as fontFamily } from '../../theme/ledger';

// A sentence-case section title in ink ("Upcoming bills"), with an optional
// right action ("See all") or a right node (the week's total). The first
// pass used an uppercase muted caption; on device it read as faint and
// shouty at once, so sections now lead with a slightly bolder ink title.
export default function SectionHeader({ title, actionLabel, onAction, right, style }) {
  const { c } = useLedger();
  return (
    <View style={[styles.row, style]}>
      <Text style={[ledgerType.section, styles.title, { color: c.ink }]} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      {right}
      {!!actionLabel && (
        <Pressable onPress={onAction} hitSlop={8} style={styles.action} accessibilityRole="button">
          <Text style={[styles.actionText, { color: c.muted }]}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
    marginBottom: ledgerSpace.xs,
  },
  // Never squeezed by the right node.
  title: {
    flexShrink: 0,
    marginRight: ledgerSpace.md,
  },
  action: {
    minHeight: ledgerSize.hit - 16,
    justifyContent: 'center',
  },
  actionText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
  },
});
