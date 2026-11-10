import { useMemo, isValidElement } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronRight, Check } from 'lucide-react-native';
import { useLedger, ledgerType, ledgerSpace, ledgerSize, ledgerRadius } from '../../theme/ledger';
import { withOpacity, darken, lighten } from '../../lib/color';
import Switch from './Switch';

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
//
// `rightSub` is a string (muted, or `rightSubColor`) or any node, such as
// Home's trend icon and percentage.
//
// The trailing slot, after `right`:
//   trailing="chevron" | "check" | any node (a compact Button, a badge);
//   switchValue + onSwitchChange — the WHOLE row becomes one switch: a tap
//     anywhere toggles, and TalkBack hears "<title>, switch, on/off".
// `danger` draws the title and icon in the danger colour (Delete account).
// `disabled` dims the row and ignores taps. `children` render under the
// title line, full width, for an in-row control such as a Segmented that
// keeps its own roles. `subLines` lets a longer sub wrap (default one line).
export default function ListRow({
  icon: Icon,
  renderIcon,
  iconColor,
  tone,
  title,
  sub,
  subLines = 1,
  right,
  rightSub,
  rightSubColor,
  trailing,
  switchValue,
  onSwitchChange,
  onPress,
  danger = false,
  disabled = false,
  divider = true,
  accessibilityLabel,
  accessibilityHint,
  children,
}) {
  const { c, modeId } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const toned = danger ? { bg: c.dangerSoft, fg: c.danger } : toneColors(tone, c, modeId);
  const tint = iconColor ?? toned.fg;
  const twoLine = !!sub || !!rightSub;
  const isSwitch = typeof switchValue === 'boolean';
  const handlePress = isSwitch ? () => onSwitchChange?.(!switchValue) : onPress;

  let trailingNode = null;
  if (isSwitch) trailingNode = <Switch value={switchValue} />;
  else if (trailing === 'chevron') trailingNode = <ChevronRight size={18} color={c.muted} strokeWidth={1.75} />;
  else if (trailing === 'check') trailingNode = <Check size={18} color={c.accent} strokeWidth={2.25} />;
  else if (trailing != null) trailingNode = trailing;

  const line = (
    <View style={[styles.line, { minHeight: (twoLine ? ledgerSpace.rowTall : ledgerSpace.rowShort) - ledgerSpace.sm * 2 }]}>
      {(Icon || renderIcon) && (
        <View style={[styles.iconCircle, { backgroundColor: toned.bg }]}>
          {renderIcon ? renderIcon(tint) : <Icon size={18} color={tint} strokeWidth={1.75} />}
        </View>
      )}
      <View style={styles.mid}>
        {typeof title === 'string' ? (
          <Text style={[styles.title, danger && { color: c.danger }]} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          title
        )}
        {!!sub && (
          <Text style={styles.sub} numberOfLines={subLines}>
            {sub}
          </Text>
        )}
      </View>
      {(right != null || rightSub != null) && (
        <View style={styles.right}>
          {typeof right === 'string' ? <Text style={[styles.title, styles.rightText]}>{right}</Text> : right}
          {typeof rightSub === 'string'
            ? !!rightSub && <Text style={[styles.sub, rightSubColor && { color: rightSubColor }]}>{rightSub}</Text>
            : rightSub}
        </View>
      )}
      {trailingNode}
    </View>
  );

  const body = (
    <>
      {line}
      {children ? <View style={[styles.below, (Icon || renderIcon) && styles.belowInset]}>{children}</View> : null}
    </>
  );

  const rowStyle = [styles.row, divider && styles.divider, disabled && styles.disabled];

  if (!handlePress) {
    // A row of text reads as one element. A row holding a control (an
    // in-row Segmented, a compact button in `right` or `trailing`) stays a
    // plain container so the control keeps its own focus and role.
    const holdsControl = !!children || isValidElement(trailing) || isValidElement(right);
    return (
      <View style={rowStyle} accessible={!holdsControl} accessibilityLabel={accessibilityLabel}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      style={({ pressed }) => [...rowStyle, pressed && !disabled && styles.pressed]}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole={isSwitch ? 'switch' : 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={isSwitch ? { checked: switchValue, disabled } : { disabled }}
    >
      {body}
    </Pressable>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    row: {
      paddingVertical: ledgerSpace.sm,
    },
    line: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ledgerSpace.md,
    },
    divider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.hairline,
    },
    pressed: {
      opacity: 0.6,
    },
    disabled: {
      opacity: 0.4,
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
    rightText: {
      color: c.muted,
    },
    sub: {
      ...ledgerType.caption,
      color: c.muted,
      marginTop: 2,
    },
    right: {
      alignItems: 'flex-end',
    },
    below: {
      marginTop: ledgerSpace.sm,
      paddingBottom: ledgerSpace.xs,
    },
    // Lines the control up with the title, past the icon circle.
    belowInset: {
      marginLeft: ledgerSize.iconCircle + ledgerSpace.md,
    },
  });
}
