import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { format } from 'date-fns';
import { Wallet, CircleCheck } from 'lucide-react-native';
import Card from './Card';
import IconTile from './IconTile';
import Button from './Button';
import { fontFamily, fontSize, spacing, radii } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import useStreak from '../hooks/useStreak';
import useDayState from '../hooks/useDayState';
import useProfile from '../hooks/useProfile';
import { claimNoSpend } from '../lib/rewardsMutations';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useRewardBurst } from './RewardBurst';
import { todayCardCopy } from '../lib/koban';

// Local "HH:MM:SS"/"HH:MM" (Postgres `time` columns come back this shape,
// same parsing precedent as app/settings.js's timeOnTodayFromString) vs. now.
// Recomputed on render, no live-updating clock — same reasoning
// lib/greetings.js's getGreeting already relies on: Home re-renders often
// enough (focus, data refetches) that a stale time-of-day bucket never
// lingers for long.
function isPastLocalTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const threshold = new Date();
  threshold.setHours(h, m, 0, 0);
  return new Date() >= threshold;
}

// The close-the-day ritual's home on Home (18-gamification-ritual-and-ledger.md
// Phase 3) — a receipt on a logged day (coins/XP already claimed by the log
// itself, nothing to do here), or the no-spend declaration on an open one.
// Renders nothing while loading rather than a skeleton — this card is new
// chrome, not an existing surface whose absence would read as broken.
//
// Evening-only, per user feedback — it shouldn't compete with the balance
// card all day, only once it's actually time to close the day. Gated on
// profile.evening_reminder_time — the SAME threshold the server-side evening
// nudge fires at (17-server-push-notifications.md's send-push cron), so the
// card and the notification that points at it agree on what "evening" means.
export default function TodayCard() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { todayTotals, loading: streakLoading } = useStreak();
  const { state, loading: stateLoading } = useDayState();
  const { profile, loading: profileLoading } = useProfile();
  const { notifyChanged } = useDataRefresh();
  const { showRewardBurst } = useRewardBurst();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [declaring, setDeclaring] = useState(false);

  async function declareNoSpend() {
    setDeclaring(true);
    const { error, isNewClaim, xp: earnedXp } = await claimNoSpend(format(new Date(), 'yyyy-MM-dd'));
    setDeclaring(false);
    setConfirmOpen(false);
    if (error) return;
    notifyChanged();
    if (isNewClaim) showRewardBurst({ xp: earnedXp });
  }

  if (streakLoading || stateLoading || profileLoading) return null;
  if (!isPastLocalTime(profile?.evening_reminder_time ?? '21:00:00')) return null;

  const copy = todayCardCopy({ state, todayTotals });
  const closed = state !== 'open';

  return (
    <>
      <Card style={styles.card}>
        <View style={styles.row}>
          <IconTile tone={closed ? 'brand' : 'neutral'} size={44} radius={radii.iconTile}>
            {closed ? (
              <CircleCheck size={20} color={colors.brand} strokeWidth={2} />
            ) : (
              <Wallet size={20} color={colors.mutedDarker} strokeWidth={2} />
            )}
          </IconTile>
          <View style={styles.textWrap}>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.body}>{copy.body}</Text>
          </View>
        </View>

        {state === 'open' && (
          <Button title="No-spend day" onPress={() => setConfirmOpen(true)} variant="outline" style={styles.button} />
        )}
      </Card>

      {/* Custom dialog, not Alert.alert — the OS system dialog reads as
          generic chrome dropped into an otherwise fully-branded app. Same
          centered-Modal shape ReportPeriodPicker already established as this
          codebase's one alternative to Alert.alert. A conscience nudge, not a
          gate — costs nothing, no verification, just makes the declaration a
          deliberate act instead of a reflex tap. */}
      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setConfirmOpen(false)}>
          <Pressable style={styles.dialog} onPress={() => {}}>
            <Text style={styles.dialogTitle}>No-spend day</Text>
            <Text style={styles.dialogBody}>Nothing at all today, including cash?</Text>
            <View style={styles.dialogActions}>
              <Button
                title="Cancel"
                onPress={() => setConfirmOpen(false)}
                variant="outline"
                style={styles.dialogButton}
              />
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
      marginTop: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    textWrap: {
      flex: 1,
    },
    title: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.md,
      color: colors.ink,
    },
    body: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      marginTop: 1,
    },
    button: {
      height: 44,
      marginTop: spacing.md,
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
      borderRadius: radii.cardLg,
      padding: spacing.xl,
    },
    dialogTitle: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.xl,
      color: colors.ink,
    },
    dialogBody: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.md,
      color: colors.mutedMid,
      marginTop: spacing.sm,
    },
    dialogActions: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.xl,
    },
    dialogButton: {
      flex: 1,
      height: 48,
    },
  });
}
