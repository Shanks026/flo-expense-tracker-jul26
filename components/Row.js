import { Children, Fragment, isValidElement } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import Switch from './Switch';
import { fontFamily, type, radius, spacing, hitTarget } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

// Flat grouped lists (37-design-system-and-koban.md): a RowGroup is a section
// label over one plain surface, and each Row is a line in it. They replace
// "every block is a bordered card" for settings-style screens.

const ICON_SIZE = 20;
const ICON_GAP = spacing.md;

// A section: an optional uppercase label, then the rows on one surface with a
// hairline between them (inset past the icon column). Falsy children are
// skipped, so conditional rows need no divider bookkeeping.
export function RowGroup({ title, footer, children, style }) {
  const { colors } = useTheme();
  const rows = Children.toArray(children).filter((c) => isValidElement(c));
  if (rows.length === 0) return null;

  return (
    <View style={[styles.groupWrap, style]}>
      {title ? (
        <Text style={[styles.groupTitle, { color: colors.mutedMid }]} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <View style={[styles.group, { backgroundColor: colors.surface }]}>
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {i > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? <Text style={[styles.groupFooter, { color: colors.mutedMid }]}>{footer}</Text> : null}
    </View>
  );
}

// One line in a RowGroup. Pick one trailing element:
//   value        — a short current value on the right ("₹ INR", "8:00 AM");
//   onPress      — makes the row a button (chevron shown unless `chevron` is false);
//   switchValue  — makes the WHOLE row one switch: tapping anywhere toggles,
//                  and TalkBack hears "<title>, switch, on/off";
//   right        — any custom element.
// `children` render below the title line, for in-row controls (segments,
// chips) that keep their own roles.
export default function Row({
  icon: Icon,
  title,
  hint,
  value,
  onPress,
  chevron = true,
  switchValue,
  onSwitchChange,
  right,
  disabled = false,
  tone = 'default',
  accessibilityHint,
  children,
  style,
}) {
  const { colors } = useTheme();
  const isSwitch = typeof switchValue === 'boolean';
  const handlePress = isSwitch ? () => onSwitchChange?.(!switchValue) : onPress;
  const pressable = !!handlePress && !disabled;
  const titleColor = tone === 'danger' ? colors.danger : colors.ink;

  const label = [title, typeof value === 'string' ? value : null].filter(Boolean).join(', ');

  const content = (
    <>
      <View style={styles.line}>
        {Icon ? (
          <View style={styles.icon}>
            <Icon size={ICON_SIZE} color={tone === 'danger' ? colors.danger : colors.ink} strokeWidth={2} />
          </View>
        ) : null}
        <View style={styles.text}>
          <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
          {hint ? <Text style={[styles.hint, { color: colors.muted }]}>{hint}</Text> : null}
        </View>
        {value !== undefined && value !== null ? (
          typeof value === 'string' ? (
            <Text style={[styles.value, { color: colors.mutedDarker }]} numberOfLines={1}>
              {value}
            </Text>
          ) : (
            value
          )
        ) : null}
        {isSwitch ? (
          // The row itself is the accessible switch; this one is visual only.
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden pointerEvents="none">
            <Switch value={switchValue} />
          </View>
        ) : null}
        {right ?? null}
        {onPress && chevron && !isSwitch ? <ChevronRight size={18} color={colors.chevron} strokeWidth={2.4} /> : null}
      </View>
      {children ? <View style={[styles.below, Icon && styles.belowInset]}>{children}</View> : null}
    </>
  );

  const rowStyle = [styles.row, disabled && styles.disabled, style];

  if (!handlePress) {
    return (
      <View style={rowStyle} accessible={!children} accessibilityLabel={!children ? label : undefined}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={!pressable}
      accessibilityRole={isSwitch ? 'switch' : 'button'}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={isSwitch ? { checked: switchValue, disabled } : { disabled }}
      style={({ pressed }) => [...rowStyle, pressed && pressable && { backgroundColor: colors.chipBg }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  groupWrap: {
    marginTop: spacing.xl,
  },
  groupTitle: {
    fontFamily: fontFamily.bold,
    fontSize: type.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
    marginLeft: spacing.lg,
  },
  group: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  groupFooter: {
    fontFamily: fontFamily.semibold,
    fontSize: type.caption,
    lineHeight: 17,
    marginTop: spacing.sm,
    marginHorizontal: spacing.lg,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.lg + ICON_SIZE + ICON_GAP,
  },
  row: {
    minHeight: hitTarget + 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'center',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ICON_GAP,
  },
  icon: {
    width: ICON_SIZE,
    alignItems: 'center',
  },
  text: {
    flex: 1,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: type.bodyLg,
  },
  hint: {
    fontFamily: fontFamily.semibold,
    fontSize: type.body,
    lineHeight: 19,
    marginTop: 2,
  },
  value: {
    fontFamily: fontFamily.bold,
    fontSize: type.body,
    flexShrink: 1,
    maxWidth: '45%',
    textAlign: 'right',
  },
  below: {
    marginTop: spacing.md,
  },
  belowInset: {
    marginLeft: ICON_SIZE + ICON_GAP,
  },
  disabled: {
    opacity: 0.45,
  },
});
