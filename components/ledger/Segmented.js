import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLedger, ledgerType, ledgerSize, ledgerRadius, ledgerSpace } from '../../theme/ledger';

// Pick one of 2–4 options (redesign §2.5): a sunk track with a white thumb
// (`surface` in dark mode) behind the selected option, so the choice reads
// without colour. Controlled: `value` / `onChange(value)`. `options` is
// [{ value, label, icon?, accessibilityLabel? }]; `icon` is a lucide
// component drawn before the label. Each option is a 48 dp target and is
// announced as a radio with its selected state.
//
// `plain` is the text-only look for a toggle beside a section title
// (Insights' Spent / Received): no track and no thumb, the selected label in
// ink and the others muted, each still a 48 dp target (person, 2026-11-11).
const TRACK_PAD = 3;

export default function Segmented({ options, value, onChange, plain = false, accessibilityLabel, style }) {
  const { c, modeId } = useLedger();
  return (
    <View style={[styles.track, plain ? styles.trackPlain : { backgroundColor: c.surfaceSunk }, style]} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((opt) => {
        const selected = opt.value === value;
        const Icon = opt.icon;
        const fg = selected ? c.ink : c.muted;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => !selected && onChange(opt.value)}
            hitSlop={plain ? { top: 4, bottom: 4, left: 4, right: 4 } : { top: TRACK_PAD, bottom: TRACK_PAD }}
            accessibilityRole="radio"
            accessibilityLabel={opt.accessibilityLabel ?? opt.label}
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.option,
              plain && styles.optionPlain,
              // In dark the `surface` thumb sits close to the sunk track,
              // so a faint light edge marks it.
              selected && !plain && [
                styles.thumb,
                { backgroundColor: c.thumb, shadowColor: c.shadow },
                modeId === 'dark' && { borderWidth: 1, borderColor: c.thumbEdge },
              ],
              pressed && !selected && { opacity: 0.6 },
            ]}
          >
            {Icon ? <Icon size={14} color={fg} strokeWidth={1.75} /> : null}
            <Text style={[ledgerType.button, styles.label, plain && styles.labelPlain, { color: fg }]} numberOfLines={1}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: ledgerRadius.field,
    padding: TRACK_PAD,
    gap: 2,
  },
  option: {
    flex: 1,
    minWidth: 0,
    // With the track's padding and the hitSlop, the target is 48 dp.
    minHeight: ledgerSize.hit - TRACK_PAD * 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
    borderRadius: ledgerRadius.field,
  },
  trackPlain: {
    padding: 0,
    gap: ledgerSpace.lg,
  },
  // 40 dp tall; hitSlop brings the target to 48.
  optionPlain: {
    flex: 0,
    minHeight: 40,
    paddingHorizontal: 0,
  },
  thumb: {
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  label: {
    fontSize: 13,
    flexShrink: 1,
  },
  labelPlain: {
    fontSize: 14,
  },
});
