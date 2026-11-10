import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Info, TriangleAlert, OctagonAlert } from 'lucide-react-native';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, inter } from '../../theme/ledger';

// A one-line note that isn't data (redesign §2.5): `info` on the sunk grey,
// `warn` on warnSoft, `danger` on dangerSoft. An icon, the line, and an
// optional action ("Open settings") under it. `icon` overrides the tone's
// default glyph.
const TONES = {
  info: { icon: Info, bg: 'surfaceSunk', fg: 'muted' },
  warn: { icon: TriangleAlert, bg: 'warnSoft', fg: 'warn' },
  danger: { icon: OctagonAlert, bg: 'dangerSoft', fg: 'danger' },
};

export default function Callout({ tone = 'info', icon, text, actionLabel, onAction, style }) {
  const { c } = useLedger();
  const t = TONES[tone] ?? TONES.info;
  const Icon = icon ?? t.icon;
  const fg = c[t.fg];
  return (
    <View style={[styles.box, { backgroundColor: c[t.bg] }, style]}>
      <Icon size={16} color={fg} strokeWidth={1.75} style={styles.icon} />
      <View style={styles.mid}>
        <Text style={[ledgerType.body, { color: c.ink }]}>{text}</Text>
        {!!actionLabel && (
          <Pressable onPress={onAction} hitSlop={12} accessibilityRole="button" style={styles.action}>
            <Text style={[styles.actionText, { color: fg }]}>{actionLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ledgerSpace.sm + 2,
    borderRadius: ledgerRadius.input,
    paddingHorizontal: ledgerSpace.md,
    paddingVertical: ledgerSpace.md,
  },
  // Sits on the first line's centre (body line height 20, icon 16).
  icon: {
    marginTop: 2,
  },
  mid: {
    flex: 1,
    minWidth: 0,
  },
  action: {
    alignSelf: 'flex-start',
    marginTop: ledgerSpace.xs,
  },
  actionText: {
    fontFamily: inter.semibold,
    fontSize: 13,
    lineHeight: 18,
  },
});
