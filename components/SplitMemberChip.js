import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { toneColors } from './ledger/ListRow';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, inter } from '../theme/ledger';

// One person in a split: a coloured initial + their name. Used as a plain badge
// on the detail screen and as a selectable chip in the entry sheet (payer
// single-select, participants multi-select), so `selected`/`onPress` are
// optional rather than there being two near-identical components.
//
// The initial-circle stands in for an avatar deliberately — a ghost member is
// just a name and a colour, and inventing a placeholder avatar image for
// someone who isn't an app user would imply more than we know about them.
// Exported so the split detail screen's People table draws the same initial
// from the same rule — two places deriving "Y" vs a first letter independently
// is how they drift apart.
export function memberInitial(member) {
  // shortName is the undecorated name, so your own tile reads "C" rather than
  // the "Y" of a bare "You" — or "(" from "Chris (You)" if this used `name`.
  const source = member.shortName ?? member.name ?? '?';
  return String(source).trim().charAt(0).toUpperCase() || '?';
}

// Ledger look (spec 48, ticket 08): a capsule like the kit's Chip, with the
// person's initial on a wash of their colour (ListRow's toneColors). Selected
// is the Chip's own "ink = selected": an ink capsule with on-ink text.
export default function SplitMemberChip({
  member,
  selected = false,
  onPress,
  onLongPress,
  showCheck = false,
  dimmed = false,
}) {
  const { c, modeId } = useLedger();
  const tint = toneColors(member.color, c, modeId);
  const initial = memberInitial(member);
  const fg = selected ? c.inkOnInk : c.ink;
  const body = (
    <View style={[styles.chip, { backgroundColor: selected ? c.ink : c.surfaceSunk }, dimmed && styles.dimmed]}>
      <View style={[styles.avatar, { backgroundColor: c.canvas }]}>
        <View style={[StyleSheet.absoluteFill, styles.wash, { backgroundColor: tint.bg }]} />
        <Text style={[styles.avatarText, { color: tint.fg }]}>{initial}</Text>
      </View>
      <Text style={[styles.name, { color: fg }]} numberOfLines={1}>
        {member.name}
      </Text>
      {showCheck && selected && <Check size={14} color={fg} strokeWidth={2.5} />}
    </View>
  );
  if (!onPress && !onLongPress) return body;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={4}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected }}
      accessibilityLabel={member.name}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ledgerSpace.sm,
    minHeight: 40,
    paddingLeft: 6,
    paddingRight: ledgerSpace.md,
    borderRadius: ledgerRadius.full,
  },
  dimmed: {
    opacity: 0.45,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wash: {
    borderRadius: 14,
  },
  avatarText: {
    fontFamily: inter.semibold,
    fontSize: 12,
    lineHeight: 16,
  },
  name: {
    ...ledgerType.rowTitle,
    // Room for "Chris (You)" without truncating.
    maxWidth: 160,
  },
});

export const splitChipSpacing = ledgerSpace.sm;
