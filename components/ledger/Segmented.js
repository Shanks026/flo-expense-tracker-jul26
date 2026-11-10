import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLedger, ledgerType, ledgerSize, ledgerRadius } from '../../theme/ledger';

// Pick one of 2–4 options (redesign §2.5): a sunk track with a white thumb
// (`surface` in dark mode) behind the selected option, so the choice reads
// without colour. Controlled: `value` / `onChange(value)`. `options` is
// [{ value, label, icon?, accessibilityLabel? }]; `icon` is a lucide
// component drawn before the label. Each option is a 48 dp target and is
// announced as a radio with its selected state.
const TRACK_PAD = 3;

export default function Segmented({ options, value, onChange, accessibilityLabel, style }) {
  const { c, modeId } = useLedger();
  return (
    <View style={[styles.track, { backgroundColor: c.surfaceSunk }, style]} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((opt) => {
        const selected = opt.value === value;
        const Icon = opt.icon;
        const fg = selected ? c.ink : c.muted;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => !selected && onChange(opt.value)}
            hitSlop={{ top: TRACK_PAD, bottom: TRACK_PAD }}
            accessibilityRole="radio"
            accessibilityLabel={opt.accessibilityLabel ?? opt.label}
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.option,
              // In dark the `surface` thumb sits close to the sunk track,
              // so a faint light edge marks it.
              selected && [
                styles.thumb,
                { backgroundColor: c.thumb, shadowColor: c.shadow },
                modeId === 'dark' && { borderWidth: 1, borderColor: c.thumbEdge },
              ],
              pressed && !selected && { opacity: 0.6 },
            ]}
          >
            {Icon ? <Icon size={14} color={fg} strokeWidth={1.75} /> : null}
            <Text style={[ledgerType.button, styles.label, { color: fg }]} numberOfLines={1}>
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
    borderRadius: ledgerRadius.input,
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
    borderRadius: ledgerRadius.input - TRACK_PAD,
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
});
