import { useMemo } from 'react';
import { Text, StyleSheet } from 'react-native';
import Card from './Card';
import Koban from './koban/Koban';
import { fontFamily, spacing, type } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

// A page's "nothing here yet" (the person's call, 2026-10-27): Koban in a pose
// that fits the page, a short title, and one line on what to do. For whole
// lists and sections only; a small note inside a card stays plain text. Koban
// never sits on a money figure (37-design-system-and-koban.md).
export default function EmptyState({ pose = 'idle', mood, title, body, style }) {
  const { colors, modeId } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Card style={[styles.card, style]}>
      <Koban size={96} pose={pose} mood={mood} surface={modeId} style={styles.koban} />
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
    koban: {
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
