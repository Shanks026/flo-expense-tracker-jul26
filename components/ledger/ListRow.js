import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLedger, ledgerType, ledgerSpace, ledgerSize, ledgerRadius } from '../../theme/ledger';
import { withOpacity, darken, lighten } from '../../lib/color';

// The icon circle's two looks:
// - `tone` (a hex, usually the category's colour): a soft wash of that
//   colour behind the icon, the icon itself in a deeper shade of the same
//   colour. It replaced the outlined circle, which read as an empty ring.
// - no tone: a neutral sunk circle with an ink icon (settings rows, prompts).
// `iconColor` still overrides the glyph (an overdue bill is danger).
export function toneColors(tone, c, modeId) {
  if (!tone || !/^#[0-9a-f]{6}$/i.test(tone)) return { bg: c.surfaceSunk, fg: c.ink };
  return modeId === 'dark'
    ? { bg: withOpacity(tone, 0.22), fg: lighten(tone, 0.35) }
    : { bg: withOpacity(tone, 0.14), fg: darken(tone, 0.3) };
}

// A flat row on the canvas (redesign §2.5): a 40 dp tinted circle icon,
// title and sub, then a right value with an optional sub under it. Hairline
// divider below unless it's the last row. `icon` is a lucide component;
// `renderIcon(color)` draws anything else inside the circle.
export default function ListRow({
  icon: Icon,
  renderIcon,
  iconColor,
  tone,
  title,
  sub,
  right,
  rightSub,
  rightSubColor,
  onPress,
  divider = true,
  accessibilityLabel,
}) {
  const { c, modeId } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const toned = toneColors(tone, c, modeId);
  const tint = iconColor ?? toned.fg;
  const twoLine = !!sub || !!rightSub;

  const body = (
    <>
      {(Icon || renderIcon) && (
        <View style={[styles.iconCircle, { backgroundColor: toned.bg }]}>
          {renderIcon ? renderIcon(tint) : <Icon size={18} color={tint} strokeWidth={1.75} />}
        </View>
      )}
      <View style={styles.mid}>
        {typeof title === 'string' ? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          title
        )}
        {!!sub && (
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        )}
      </View>
      {(right != null || rightSub != null) && (
        <View style={styles.right}>
          {typeof right === 'string' ? <Text style={styles.title}>{right}</Text> : right}
          {!!rightSub && <Text style={[styles.sub, rightSubColor && { color: rightSubColor }]}>{rightSub}</Text>}
        </View>
      )}
    </>
  );

  const rowStyle = [styles.row, { minHeight: twoLine ? ledgerSpace.rowTall : ledgerSpace.rowShort }, divider && styles.divider];

  if (!onPress) return <View style={rowStyle}>{body}</View>;
  return (
    <Pressable
      style={({ pressed }) => [rowStyle, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {body}
    </Pressable>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ledgerSpace.md,
      paddingVertical: ledgerSpace.sm,
    },
    divider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.hairline,
    },
    pressed: {
      opacity: 0.6,
    },
    iconCircle: {
      width: ledgerSize.iconCircle,
      height: ledgerSize.iconCircle,
      borderRadius: ledgerRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mid: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      ...ledgerType.rowTitle,
      color: c.ink,
    },
    sub: {
      ...ledgerType.caption,
      color: c.muted,
      marginTop: 2,
    },
    right: {
      alignItems: 'flex-end',
    },
  });
}
