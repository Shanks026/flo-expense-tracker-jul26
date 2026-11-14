import { useMemo } from 'react';
import { Alert, Animated, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SquarePen, Trash2 } from 'lucide-react-native';
import { format } from 'date-fns';
import ScreenHeader, { LargeTitle, useHeaderScroll } from '../../components/ledger/ScreenHeader';
import SectionHeader from '../../components/ledger/SectionHeader';
import ListRow from '../../components/ledger/ListRow';
import OverflowMenu from '../../components/ledger/OverflowMenu';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius } from '../../theme/ledger';
import useAssistantConversations from '../../hooks/useAssistantConversations';
import { useDataRefresh } from '../../lib/DataRefreshContext';
import { deleteConversation } from '../../lib/ai';
import { dateGroupKey, dateGroupLabel } from '../../lib/dateLabels';
import { FLAGS } from '../../lib/flags';

// Past chats (44-ai-assistant.md §3.3, ticket 08; on the ledger kit since
// spec 49, ticket 07): New chat first, then every Ask FLO conversation,
// newest first, grouped by day (Today, Yesterday, Sat 7 Nov) and titled from
// its first question. A tap reopens it in the chat; Delete is in each row's
// ⋯ menu.
export default function AssistantHistory() {
  if (!FLAGS.ai) return <Redirect href="/more" />;
  return <History />;
}

function History() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll } = useHeaderScroll();
  const { conversations, loading, removeLocal } = useAssistantConversations();
  const { notifyChanged } = useDataRefresh();

  // Day groups, in the newest-first order the hook already gives.
  const groups = useMemo(() => {
    const out = [];
    for (const conv of conversations) {
      const key = dateGroupKey(conv.created_at);
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(conv);
      else out.push({ key, label: dateGroupLabel(conv.created_at), items: [conv] });
    }
    return out;
  }, [conversations]);

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
    <View style={styles.screen}>
      <ScreenHeader title="Past chats" scrollY={scrollY} />
      <Animated.ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + ledgerSpace.section }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <LargeTitle title="Past chats" scrollY={scrollY} />

        <ListRow icon={SquarePen} title="New chat" onPress={() => open(null)} divider={false} />

        {loading ? (
          [0, 1, 2].map((i) => <View key={i} style={styles.rowSkeleton} />)
        ) : conversations.length === 0 ? (
          <Text style={styles.none}>Your chats will show up here.</Text>
        ) : (
          groups.map((g) => (
            <View key={g.key} style={styles.group}>
              <SectionHeader title={g.label} />
              {g.items.map((conv, i) => (
                <ListRow
                  key={conv.id}
                  title={conv.title || 'Untitled chat'}
                  sub={format(new Date(conv.created_at), 'h:mm a')}
                  onPress={() => open(conv.id)}
                  trailing={
                    <OverflowMenu
                      title={conv.title || 'Untitled chat'}
                      accessibilityLabel={`More for ${conv.title || 'this chat'}`}
                      actions={[{ key: 'delete', title: 'Delete chat', icon: Trash2, danger: true, onPress: () => confirmDelete(conv) }]}
                    />
                  }
                  divider={i < g.items.length - 1}
                />
              ))}
            </View>
          ))
        )}
      </Animated.ScrollView>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.canvas,
    },
    flex: {
      flex: 1,
    },
    scroll: {
      paddingHorizontal: ledgerSpace.gutter,
    },
    group: {
      marginTop: ledgerSpace.lg,
    },
    none: {
      ...ledgerType.body,
      color: c.muted,
      marginTop: ledgerSpace.lg,
    },
    rowSkeleton: {
      height: 64,
      borderRadius: ledgerRadius.input,
      backgroundColor: c.surfaceSunk,
      marginTop: ledgerSpace.md,
    },
  });
}
