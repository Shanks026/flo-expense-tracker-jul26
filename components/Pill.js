import { View, Text, StyleSheet } from 'react-native';
import { colors as staticColors, radii, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

export default function Pill({ label, tone = 'neutral', style }) {
  const { colors } = useTheme();

  // Same split as Button.js: `brand`'s bg tracks the active theme's accent;
  // its text is pinned to static ink for reliable contrast against that
  // accent (not the active theme's `colors.ink`, which Dark theme inverts to
  // a light color). `dark` is used for a SELECTED filter/segment pill (report
  // account tabs, transaction type filter, AnalyticsSegmentTabs) — plain UI
  // chrome that should follow the active theme like the rest of a segmented
  // control, not a pinned emphasis surface: it reads `colors.ink`/
  // `colors.surface` reactively so it doesn't blend into Dark theme's own
  // near-black screen the way a pinned near-black pill would. income/danger/
  // warn are already semantic-locked (identical across every theme), so
  // reading them from the active theme is safe. neutral/completed genuinely
  // should follow the active theme — they're meant to blend into whatever
  // screen they're on.
  const TONES = {
    brand: { bg: colors.brand, text: staticColors.ink },
    dark: { bg: colors.ink, text: colors.surface },
    income: { bg: colors.incomeBg, text: colors.income },
    danger: { bg: colors.dangerBg, text: colors.danger },
    warn: { bg: colors.warnBg, text: colors.warn },
    neutral: { bg: colors.surface, text: colors.mutedDarker, border: colors.border },
    completed: { bg: colors.completedTrack, text: colors.muted },
  };
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
