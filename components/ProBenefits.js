import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Layers, Target, Calendar, FileText, Scan } from 'lucide-react-native';
import { colors as staticColors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { PRO_BENEFITS } from '../lib/pro';

const ICONS = { layers: Layers, target: Target, calendar: Calendar, fileText: FileText, scan: Scan };

// Shared between ProUpsellSheet (top `limit` items) and app/pro.js (all of
// them). Both host surfaces are permanently dark (staticColors.ink), so most
// of this stays pinned — only the icon color follows the active theme's
// accent, same as everywhere else in these sheets.
export default function ProBenefits({ limit, style }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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

function makeStyles(colors) {
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
      backgroundColor: staticColors.inkCard,
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
      color: staticColors.surface,
    },
    body: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.sm,
      color: staticColors.mutedMid,
      marginTop: 2,
      lineHeight: 17,
    },
  });
}
