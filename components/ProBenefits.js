import { View, Text, StyleSheet } from 'react-native';
import { Layers, Target, Calendar, FileText, Scan } from 'lucide-react-native';
import { colors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { PRO_BENEFITS } from '../lib/pro';

const ICONS = { layers: Layers, target: Target, calendar: Calendar, fileText: FileText, scan: Scan };

// Shared between ProUpsellSheet (top `limit` items) and app/pro.js (all of
// them). Both host surfaces are dark (colors.ink), so this is styled dark-only.
export default function ProBenefits({ limit, style }) {
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

const styles = StyleSheet.create({
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
    backgroundColor: colors.inkCard,
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
    color: colors.surface,
  },
  body: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginTop: 2,
    lineHeight: 17,
  },
});
