import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius } from '../../theme/ledger';

// A vertical list of steps (redesign §2.5): a dot per step, a title and a
// muted sub, joined by a hairline; the last step has no line under it.
// `steps` is [{ key, title, sub?, tone?, onPress? }]. The first dot is ink,
// the rest are hollow, so the step the list starts from reads first (the
// oldest in an entry's history, the next due date on a bill). `tone:
// 'danger'` draws the title and dot in danger (an overdue bill); `onPress`
// makes the step a button with a chevron (a payment opening its entry).
const DOT = 10;

export default function Timeline({ steps, style }) {
  const { c } = useLedger();
  return (
    <View style={style}>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const ink = step.tone === 'danger' ? c.danger : c.ink;
        const Row = step.onPress ? Pressable : View;
        return (
          <Row
            key={step.key}
            style={styles.step}
            onPress={step.onPress}
            accessible
            accessibilityRole={step.onPress ? 'button' : undefined}
            accessibilityLabel={[step.title, step.sub].filter(Boolean).join(', ')}
          >
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  i === 0 ? { backgroundColor: ink, borderColor: ink } : { backgroundColor: c.canvas, borderColor: ink },
                ]}
              />
              {!last && <View style={[styles.line, { backgroundColor: c.hairline }]} />}
            </View>
            <View style={[styles.body, !last && styles.bodyGap]}>
              <Text style={[ledgerType.rowTitle, { color: ink }]}>{step.title}</Text>
              {!!step.sub && <Text style={[ledgerType.caption, styles.sub, { color: c.muted }]}>{step.sub}</Text>}
            </View>
            {step.onPress && <ChevronRight size={18} color={c.muted} strokeWidth={1.75} style={styles.chevron} />}
          </Row>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  step: {
    flexDirection: 'row',
    gap: ledgerSpace.md,
  },
  // The dot sits on the title's first line (row title line height 20).
  rail: {
    width: DOT,
    alignItems: 'center',
    paddingTop: (20 - DOT) / 2,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: ledgerRadius.full,
    borderWidth: 1.5,
  },
  line: {
    flex: 1,
    width: StyleSheet.hairlineWidth * 2,
    marginTop: ledgerSpace.xs,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  bodyGap: {
    paddingBottom: ledgerSpace.lg,
  },
  sub: {
    marginTop: 2,
  },
  chevron: {
    marginTop: 1,
  },
});
