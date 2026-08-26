import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Layers, Target, Calendar, FileText, Users } from 'lucide-react-native';
import { colors as staticColors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { PRO_BENEFITS } from '../lib/pro';

const ICONS = { layers: Layers, target: Target, calendar: Calendar, fileText: FileText, users: Users };

// Shared between ProUpsellSheet (top `limit` items, now a theme-reactive
// light-following sheet) and app/pro.js (all of them, still a permanently-dark
// screen) — same `dark` convention as Card/AmountText/ProgressBar: default
// false follows the active theme, `dark` pins the old dark-chrome palette for
// pro.js's own surface.
export default function ProBenefits({ limit, dark = false, style }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  const items = limit ? PRO_BENEFITS.slice(0, limit) : PRO_BENEFITS;

  return (
    <View style={[styles.list, style]}>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        return (
          <View key={item.title} style={styles.row}>
            <View style={styles.iconTile}>
              <Icon size={18} color={colors.brand} strokeWidth={2.2} />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(colors, dark) {
  return StyleSheet.create({
    list: {
      gap: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    iconTile: {
      width: 40,
      height: 40,
      borderRadius: radii.iconTile,
      backgroundColor: dark ? staticColors.inkCard : colors.iconTileBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textWrap: {
      flex: 1,
      paddingTop: 2,
    },
    title: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.lg,
      color: dark ? staticColors.surface : colors.ink,
    },
    body: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      marginTop: 2,
      lineHeight: 17,
    },
  });
}
