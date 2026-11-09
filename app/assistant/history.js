import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageSquare, SquarePen, Trash2 } from 'lucide-react-native';
import { format, isThisYear } from 'date-fns';
import Row, { RowGroup } from '../../components/Row';
import EmptyState from '../../components/EmptyState';
import { spacing, hitTarget } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import useAssistantConversations from '../../hooks/useAssistantConversations';
import { useDataRefresh } from '../../lib/DataRefreshContext';
import { deleteConversation } from '../../lib/ai';
import { FLAGS } from '../../lib/flags';

// Past chats (44-ai-assistant.md §3.3, ticket 08): every Ask FLO conversation,
// newest first, titled from its first question. A tap reopens it in the chat;
// the bin deletes it with its messages.
export default function AssistantHistory() {
  if (!FLAGS.ai) return <Redirect href="/more" />;
  return <History />;
}

function History() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { conversations, loading, removeLocal } = useAssistantConversations();
  const { notifyChanged } = useDataRefresh();

  // Back to the chat screen beneath (or onto it, if Past chats was opened on
  // its own), showing this conversation. `at` makes a repeat pick of the same
  // one still land.
  function open(id) {
    router.dismissTo({ pathname: '/assistant', params: { id: id ?? '', at: String(Date.now()) } });
  }

  function confirmDelete(conversation) {
    Alert.alert('Delete chat', `Delete “${conversation.title || 'Untitled chat'}”? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteConversation(conversation.id);
            removeLocal(conversation.id);
            notifyChanged();
          } catch (e) {
            Alert.alert("Couldn't delete", e?.message ?? 'Try again.');
          }
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
      showsVerticalScrollIndicator={false}
    >
      <RowGroup>
        <Row icon={SquarePen} title="New chat" onPress={() => open(null)} chevron={false} />
      </RowGroup>

      {!loading && conversations.length === 0 ? (
        <EmptyState pose="report" title="No past chats" body="Questions you ask FLO show up here." style={styles.empty} />
      ) : (
        <RowGroup title="Past chats">
          {conversations.map((c) => (
            <Row
              key={c.id}
              icon={MessageSquare}
              title={c.title || 'Untitled chat'}
              hint={formatDay(c.created_at)}
              onPress={() => open(c.id)}
              chevron={false}
              right={
                <Pressable
                  onPress={() => confirmDelete(c)}
                  style={styles.delete}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${c.title || 'chat'}`}
                >
                  <Trash2 size={18} color={colors.muted} strokeWidth={2} />
                </Pressable>
              }
            />
          ))}
        </RowGroup>
      )}
    </ScrollView>
  );
}

function formatDay(iso) {
  const d = new Date(iso);
  return format(d, isThisYear(d) ? 'd MMM, h:mm a' : 'd MMM yyyy');
}

function makeStyles(colors) {
  return StyleSheet.create({
    flex: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scroll: {
      paddingHorizontal: spacing.xl,
    },
    empty: {
      marginTop: spacing.xl,
    },
    delete: {
      width: hitTarget,
      height: hitTarget,
      marginRight: -spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
