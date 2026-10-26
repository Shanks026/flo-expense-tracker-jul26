import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Smartphone, Sun, Moon } from 'lucide-react-native';
import { spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
// Appearance: System / Light / Dark (37-design-system-and-koban.md). System
// follows the phone's setting and is the default.
const OPTIONS = [
  { id: 'system', name: 'System', Icon: Smartphone },
  { id: 'light', name: 'Light', Icon: Sun },
  { id: 'dark', name: 'Dark', Icon: Moon },
];

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
    <View style={[s.wrap, style]} accessibilityRole="radiogroup">
      {OPTIONS.map(({ id, name, Icon }) => {
        const isSelected = id === value;
        return (
          <Pressable
            key={id}
            style={[s.segment, isSelected && s.segmentActive]}
            onPress={() => onChange(id)}
            accessibilityRole="radio"
            accessibilityLabel={`${name} appearance`}
            accessibilityState={{ selected: isSelected }}
          >
            <Icon size={13} color={isSelected ? colors.surface : colors.muted} strokeWidth={2.4} />
            <Text style={[s.segmentText, isSelected && s.segmentTextActive]}>{name}</Text>
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
      flex: 1,
      justifyContent: 'center',
      minHeight: 40,
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
