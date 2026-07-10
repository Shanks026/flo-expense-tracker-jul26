import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, fontFamily, fontSize } from '../theme/tokens';

const TONES = {
  brand: { bg: colors.brand, text: colors.ink },
  dark: { bg: colors.ink, text: colors.surface },
  income: { bg: colors.incomeBg, text: colors.income },
  danger: { bg: colors.dangerBg, text: colors.danger },
  warn: { bg: colors.warnBg, text: colors.warn },
  neutral: { bg: colors.surface, text: colors.mutedDarker, border: colors.border },
  completed: { bg: colors.completedTrack, text: colors.muted },
};

export default function Pill({ label, tone = 'neutral', style }) {
  const t = TONES[tone] ?? TONES.neutral;

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: t.bg, borderWidth: t.border ? 1 : 0, borderColor: t.border },
        style,
      ]}
    >
      <Text style={[styles.text, { color: t.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
  },
});
