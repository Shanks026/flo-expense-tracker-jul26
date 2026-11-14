import { View, Text, StyleSheet } from 'react-native';
import { useLedger, inter } from '../../theme/ledger';
import { memberInitial } from '../SplitMemberChip';
import { toneColors } from './ListRow';

// A split's people as overlapping initial circles (spec 48): up to `max`
// circles washed in each member's colour (ListRow's toneColors), then a
// "+N" circle for the rest. A ring in the background colour (`ring`, default
// the canvas) separates the overlaps. `members`: [{ id, name, shortName?,
// color? }]. `size` 24 by default; the Splits list fits three 18s in a row's
// icon circle, the split detail's band uses 32.
export default function AvatarStack({ members = [], max = 3, size = 24, ring, accessibilityLabel }) {
  const { c, modeId } = useLedger();
  const shown = members.slice(0, max);
  const rest = members.length - shown.length;
  const ringColor = ring ?? c.canvas;
  const circle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 2,
    borderColor: ringColor,
    marginLeft: -size / 3,
  };
  const text = { fontFamily: inter.semibold, fontSize: Math.round(size * 0.42), lineHeight: Math.round(size * 0.55) };
  const label = accessibilityLabel ?? `${members.length} ${members.length === 1 ? 'person' : 'people'}`;

  return (
    <View style={[styles.row, { paddingLeft: size / 3 }]} accessible accessibilityLabel={label}>
      {shown.map((m) => {
        // The wash is translucent, so a disc in the ring colour sits under it
        // to hide the circle it overlaps. No colour of their own (the person
        // themselves): the accent.
        const tint = toneColors(m.color ?? c.accent, c, modeId);
        return (
          <View key={m.id ?? m.name} style={[styles.circle, circle, { backgroundColor: ringColor }]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: tint.bg, borderRadius: size / 2 }]} />
            <Text style={[text, { color: tint.fg }]}>{memberInitial(m)}</Text>
          </View>
        );
      })}
      {rest > 0 && (
        <View style={[styles.circle, circle, { backgroundColor: c.surfaceSunk }]}>
          <Text style={[text, { color: c.ink }]}>+{rest}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
