import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { FileText, ChevronRight } from 'lucide-react-native';
import Card from './Card';
import { colors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import useReportDue from '../hooks/useReportDue';

const CADENCE_TITLE = { weekly: 'Your weekly report is ready', monthly: 'Your monthly report is ready' };

// The Home "report ready" card (11-reports.md Phase 1) — the reliable delivery
// channel per the doc: local scheduled notifications are best-effort and can
// be silently dropped by OEM battery killers, so this card (driven purely by
// time + seen-state, not a fired notification) is what's actually guaranteed
// to surface a due report. Renders nothing when no report is due.
export default function ReportReadyCard() {
  const router = useRouter();
  const { due } = useReportDue();

  if (!due) return null;

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/report', params: { from: due.period.from.toISOString(), to: due.period.to.toISOString() } })
      }
    >
      <Card dark style={styles.card}>
        <View style={styles.iconTile}>
          <FileText size={20} color={colors.brand} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{CADENCE_TITLE[due.cadence]}</Text>
          <Text style={styles.sub}>{due.period.label}</Text>
        </View>
        <ChevronRight size={18} color={colors.mutedMid} strokeWidth={2.4} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xxl,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.inkCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.surface,
  },
  sub: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
    marginTop: 1,
  },
});
