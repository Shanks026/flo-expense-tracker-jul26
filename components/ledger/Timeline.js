import { View, Text, StyleSheet } from 'react-native';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius } from '../../theme/ledger';

// A vertical list of steps (redesign §2.5): a dot per step, a title and a
// muted sub, joined by a hairline; the last step has no line under it.
// `steps` is [{ key, title, sub? }]. The first (oldest) dot is ink, the
// rest are hollow, so the start of the story reads first.
const DOT = 10;

export default function Timeline({ steps, style }) {
  const { c } = useLedger();
  return (
    <View style={style}>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <View key={step.key} style={styles.step} accessible accessibilityLabel={[step.title, step.sub].filter(Boolean).join(', ')}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  i === 0 ? { backgroundColor: c.ink, borderColor: c.ink } : { backgroundColor: c.canvas, borderColor: c.ink },
                ]}
              />
              {!last && <View style={[styles.line, { backgroundColor: c.hairline }]} />}
            </View>
            <View style={[styles.body, !last && styles.bodyGap]}>
              <Text style={[ledgerType.rowTitle, { color: c.ink }]}>{step.title}</Text>
              {!!step.sub && <Text style={[ledgerType.caption, styles.sub, { color: c.muted }]}>{step.sub}</Text>}
            </View>
          </View>
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
});
