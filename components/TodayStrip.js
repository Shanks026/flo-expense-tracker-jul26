import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { format } from 'date-fns';
import { Plus, CircleCheck } from 'lucide-react-native';
import Card from './Card';
import Button from './Button';
import Koban from './koban/Koban';
import { fontFamily, spacing, type, hitTarget } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import useDayState from '../hooks/useDayState';
import { markNoSpend } from '../lib/streakMarks';
import { track } from '../lib/track';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAddTransactionSheet } from './AddTransactionSheet';

const STATE_COPY = {
  logged: { title: 'Logged today', mood: 'happy' },
  nospend: { title: 'No spend today', mood: 'content' },
  open: { title: 'Nothing logged yet today', mood: 'neutral' },
};

// Today's habit in one strip (38-home-insights-more.md), all day rather than
// only in the evening: whether today is covered, + Log, and the no-spend mark
// (34-streak-only.md) while the day is still open. A small Koban keeps it warm.
export default function TodayStrip() {
  const { colors, modeId } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { state, loading } = useDayState();
  const { notifyChanged } = useDataRefresh();
  const { openAdd } = useAddTransactionSheet();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [declaring, setDeclaring] = useState(false);

  async function declareNoSpend() {
    setDeclaring(true);
    const { error, isNew } = await markNoSpend(format(new Date(), 'yyyy-MM-dd'));
    setDeclaring(false);
    setConfirmOpen(false);
    if (error) return;
    notifyChanged();
    if (isNew) track('no_spend_marked');
  }

  const copy = STATE_COPY[loading ? 'open' : state] ?? STATE_COPY.open;
  const covered = !loading && state !== 'open';

  return (
    <>
      <Card style={styles.card}>
        <View style={styles.row}>
          <Koban size={44} mood={copy.mood} surface={modeId} accessibilityLabel="Koban" />
          <View style={styles.textWrap}>
            <View style={styles.titleRow}>
              {covered && <CircleCheck size={18} color={colors.brandStrong} strokeWidth={2.4} />}
              {/* Blank while the day's state loads, rather than briefly
                  claiming nothing is logged. */}
              <Text style={styles.title} accessibilityRole="header">
                {loading ? '' : copy.title}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable
            style={styles.logButton}
            onPress={() => openAdd()}
            accessibilityRole="button"
            accessibilityLabel="Log a transaction"
          >
            <Plus size={18} color={colors.brandText} strokeWidth={2.6} />
            <Text style={styles.logText}>Log</Text>
          </Pressable>
          {!loading && state === 'open' && (
            <Button
              title="No spend today"
              onPress={() => setConfirmOpen(true)}
              variant="outline"
              style={styles.noSpendButton}
            />
          )}
        </View>
      </Card>

      {/* A conscience nudge, not a gate: it makes the declaration a
          deliberate act instead of a reflex tap. */}
      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setConfirmOpen(false)}>
          <Pressable style={styles.dialog} onPress={() => {}}>
            <Text style={styles.dialogTitle}>No spend today</Text>
            <Text style={styles.dialogBody}>Nothing at all today, including cash?</Text>
            <View style={styles.dialogActions}>
              <Button title="Cancel" onPress={() => setConfirmOpen(false)} variant="outline" style={styles.dialogButton} />
              <Button title="Confirm" onPress={declareNoSpend} loading={declaring} style={styles.dialogButton} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    card: {
      marginBottom: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    textWrap: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    title: {
      fontFamily: fontFamily.extrabold,
      fontSize: type.bodyLg,
      color: colors.ink,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    logButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      minHeight: hitTarget,
      paddingHorizontal: spacing.xl,
      borderRadius: 14,
      backgroundColor: colors.brand,
    },
    logText: {
      fontFamily: fontFamily.extrabold,
      fontSize: type.body,
      color: colors.brandText,
    },
    noSpendButton: {
      flex: 1,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    dialog: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: spacing.xl,
    },
    dialogTitle: {
      fontFamily: fontFamily.extrabold,
      fontSize: type.bodyLg,
      color: colors.ink,
    },
    dialogBody: {
      fontFamily: fontFamily.semibold,
      fontSize: type.body,
      color: colors.muted,
      marginTop: spacing.sm,
    },
    dialogActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xl,
    },
    dialogButton: {
      flex: 1,
    },
  });
}
