import { useMemo } from 'react';
import { Text, StyleSheet } from 'react-native';
import Card from './Card';
import Illustration from './ledger/Illustration';
import { fontFamily, spacing, type } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

// The old screens' "nothing here yet": an object, a short title, and one line
// on what to do. Koban was deleted (spec 46, 2026-11-10); callers still pass
// the pose he used to strike, so it maps to the object closest to it. Each
// screen moves to the ledger EmptyState (components/ledger/) in its own
// redesign ticket, and this file goes in the cleanup.
const POSE_OBJECTS = {
  notepad: 'receipt',
  report: 'receipt',
  magnifier: 'receipt',
  hmm: 'calendar',
  tip: 'spark',
};

export default function EmptyState({ pose = 'idle', title, body, style }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Card style={[styles.card, style]}>
      <Illustration name={POSE_OBJECTS[pose] ?? 'coins'} size="small" style={styles.object} />
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </Card>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    card: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    object: {
      marginBottom: spacing.md,
    },
    title: {
      fontFamily: fontFamily.extrabold,
      fontSize: type.bodyLg,
      color: colors.ink,
      textAlign: 'center',
    },
    body: {
      fontFamily: fontFamily.semibold,
      fontSize: type.body,
      lineHeight: 20,
      color: colors.muted,
      textAlign: 'center',
      marginTop: spacing.xs,
      maxWidth: 280,
    },
  });
}
