import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Sun, Moon } from 'lucide-react-native';
import { spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { MODE_LIST } from '../theme/themes';

const MODE_ICONS = { light: Sun, dark: Moon };

// Just a light/dark toggle — unlike ColorPicker, two options don't need a
// dialog. A compact inline segmented control (same shape as Settings' own
// Reports-cadence segments, or AnalyticsFilterBar's Month/Custom) sitting
// directly in the Settings row reads faster than opening a sheet to pick
// between two things. Sun/moon icons instead of (well, alongside) text —
// a light/dark toggle is one of the few controls where the icon alone is
// genuinely faster to scan than the word.
export default function AppearanceToggle({ value, onChange, style }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[s.wrap, style]}>
      {MODE_LIST.map((mode) => {
        const isSelected = mode.id === value;
        const Icon = MODE_ICONS[mode.id];
        return (
          <Pressable
            key={mode.id}
            style={[s.segment, isSelected && s.segmentActive]}
            onPress={() => onChange(mode.id)}
          >
            {Icon && <Icon size={13} color={isSelected ? colors.surface : colors.muted} strokeWidth={2.4} />}
            <Text style={[s.segmentText, isSelected && s.segmentTextActive]}>{mode.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      backgroundColor: colors.chipBg,
      borderRadius: 12,
      padding: 3,
    },
    segment: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      borderRadius: 9,
    },
    segmentActive: {
      backgroundColor: colors.ink,
    },
    segmentText: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.sm,
      color: colors.muted,
    },
    segmentTextActive: {
      fontFamily: fontFamily.extrabold,
      color: colors.surface,
    },
  });
}
