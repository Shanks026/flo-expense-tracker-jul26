import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

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

export default function SplitMemberChip({
  member,
  selected = false,
  onPress,
  onLongPress,
  showCheck = false,
  dimmed = false,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const swatch = member.color ?? colors.brand;
  const initial = memberInitial(member);

  const body = (
    <View
      style={[
        styles.chip,
        selected && { borderColor: colors.brand, backgroundColor: colors.brandBg },
        dimmed && { opacity: 0.45 },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: swatch }]}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {member.name}
      </Text>
      {/* The accent itself, not `brandText`. brandText is the contrast colour
          computed for text sitting ON a solid `brand` fill — but this check sits
          on `brandBg`, a pale tint, where the accent is what reads as "selected"
          and matches the chip's own brand-coloured border. */}
      {showCheck && selected && <Check size={13} color={colors.brand} strokeWidth={3} />}
    </View>
  );

  if (!onPress && !onLongPress) return body;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress}>
      {body}
    </Pressable>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingLeft: 4,
      paddingRight: 11,
      paddingVertical: 4,
      borderRadius: radii.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    avatar: {
      width: 24,
      height: 24,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.xs,
      // Sits on an arbitrary person colour from CATEGORY_COLORS, several of
      // which are dark (charcoal, navy, forest) — a light glyph is the only
      // one that stays readable across all fourteen.
      color: '#FFFFFF',
    },
    name: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.base,
      color: colors.ink,
      // Room for "Chris (You)" without truncating — the suffix costs ~6 chars.
      maxWidth: 140,
    },
  });
}

export const splitChipSpacing = spacing.sm;
