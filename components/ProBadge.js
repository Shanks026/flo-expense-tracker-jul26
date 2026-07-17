import { View, Text, StyleSheet } from 'react-native';
import { Crown } from 'lucide-react-native';
import { colors, radii, fontFamily, fontSize } from '../theme/tokens';

// Caller-gated — renders unconditionally, so wrap with `{isPro && <ProBadge .../>}`.
// 'overlay': small crown badge for a corner (mirrors EditProfileSheet's cameraBadge),
//   proportioned off `size` (the host element's own size) — tuned at size=20
//   for the 46px Home avatar; pass a smaller `size` for a smaller host.
// 'pill': [👑 Pro] chip for the Settings profile card.
export default function ProBadge({ variant = 'pill', size = 20 }) {
  if (variant === 'overlay') {
    const offset = -Math.round(size * 0.2);
    return (
      <View
        style={[
          styles.overlay,
          { width: size, height: size, right: offset, bottom: offset, borderWidth: size < 18 ? 1.5 : 2 },
        ]}
      >
        <Crown size={Math.round(size * 0.45)} color={colors.ink} strokeWidth={2.6} fill={colors.ink} />
      </View>
    );
  }

  return (
    <View style={styles.pill}>
      <Crown size={12} color={colors.ink} strokeWidth={2.4} fill={colors.ink} />
      <Text style={styles.pillText}>Pro</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.brand,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xs,
    color: colors.ink,
  },
});
