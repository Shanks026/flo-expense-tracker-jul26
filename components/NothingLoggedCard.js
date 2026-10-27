import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { format } from 'date-fns';
import Card from './Card';
import Button from './Button';
import Koban from './koban/Koban';
import { useToast } from './Toast';
import { fontFamily, spacing, type } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import useDayState from '../hooks/useDayState';
import { markNoSpend } from '../lib/streakMarks';
import { track } from '../lib/track';
import { useDataRefresh } from '../lib/DataRefreshContext';

// Home's nudge while today is still open (replaces spec 38's all-day Today
// strip, on the person's call, 2026-10-27). It shows each day only until
// something is logged or the day is marked no-spend, then goes away. Logging
// is the tab bar's +, so this card's one action is the no-spend mark
// (34-streak-only.md), which has no other home. Hidden while the day's state
// loads, so it never flashes on a day that's already covered.
export default function NothingLoggedCard() {
  const { colors, modeId } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { state, loading } = useDayState();
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [declaring, setDeclaring] = useState(false);

  async function declareNoSpend() {
    setDeclaring(true);
    const { error, isNew } = await markNoSpend(format(new Date(), 'yyyy-MM-dd'));
    setDeclaring(false);
    setConfirmOpen(false);
    if (error) {
      showToast({ message: "Couldn't mark today. Try again.", variant: 'error' });
      return;
    }
    notifyChanged();
    if (isNew) track('no_spend_marked');
    showToast({ message: 'No spend today. Your streak is safe.' });
  }

  if (loading || state !== 'open') return null;

  return (
    <>
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.body}>
            <Text style={styles.title} accessibilityRole="header">
              Nothing logged yet today
            </Text>
            <Text style={styles.subtitle}>Spent nothing? Mark it and your streak keeps going.</Text>
            <Button
              title="No spend today"
              onPress={() => setConfirmOpen(true)}
              variant="outline"
              style={styles.noSpendButton}
            />
          </View>
          {/* Stands on the card's bottom edge, wondering. */}
          <Koban size={84} pose="hmm" surface={modeId} style={styles.koban} accessibilityLabel="Koban" />
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
      marginBottom: spacing.md,
      // Koban sits on the bottom edge, so the card's own bottom padding
      // goes; the text column keeps its breathing room instead.
      paddingBottom: 0,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.md,
    },
    body: {
      flex: 1,
      paddingBottom: spacing.lg,
    },
    title: {
      fontFamily: fontFamily.extrabold,
      fontSize: type.bodyLg,
      color: colors.ink,
    },
    subtitle: {
      fontFamily: fontFamily.semibold,
      fontSize: type.body,
      lineHeight: 20,
      color: colors.muted,
      marginTop: spacing.xs,
    },
    noSpendButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.xl,
      marginTop: spacing.md,
    },
    koban: {
      marginRight: -spacing.xs,
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
