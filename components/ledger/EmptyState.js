import { View, Text, StyleSheet } from 'react-native';
import { useLedger, ledgerType, ledgerSpace } from '../../theme/ledger';
import Illustration from './Illustration';
import Button from './Button';

// "Nothing here yet" (redesign §2.5): one small object, a title, one line,
// and at most one secondary button. Flat on the canvas, no card. Replaces the
// old Koban EmptyState as each screen moves to the ledger kit.
export default function EmptyState({ illustration = 'receipt', title, body, actionTitle, onAction, style }) {
  const { c } = useLedger();

  return (
    <View style={[styles.wrap, style]}>
      <Illustration name={illustration} size="small" style={styles.object} />
      <Text style={[ledgerType.section, styles.center, { color: c.ink }]} accessibilityRole="header">
        {title}
      </Text>
      {body ? <Text style={[ledgerType.body, styles.center, styles.body, { color: c.muted }]}>{body}</Text> : null}
      {actionTitle && onAction ? (
        <Button title={actionTitle} variant="secondary" compact onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: ledgerSpace.section,
    paddingHorizontal: ledgerSpace.gutter,
  },
  object: {
    marginBottom: ledgerSpace.md,
  },
  center: {
    textAlign: 'center',
  },
  body: {
    marginTop: ledgerSpace.xs,
    maxWidth: 280,
  },
  action: {
    marginTop: ledgerSpace.lg,
  },
});
