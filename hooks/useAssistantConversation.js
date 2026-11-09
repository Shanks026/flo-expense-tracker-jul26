import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';

// The messages of one Ask FLO conversation (44-ai-assistant.md, phase 3),
// oldest first. Only the person's questions and the answers. An answer's
// tool_calls (the tool log, results included) is loaded so its breakdown
// tables can be drawn again. A null id is a new chat: no messages.
//
// `loadedId` is the id `messages` belong to, so a screen that switches
// conversations (past chats, ticket 08) never shows one chat's rows under
// another's id. A loaded id with no messages means the conversation is gone
// (deleted from Past chats): stored conversations are never empty.
export default function useAssistantConversation(conversationId) {
  const { version } = useDataRefresh();
  const [messages, setMessages] = useState([]);
  const [loadedId, setLoadedId] = useState(conversationId ? undefined : null);

  const refetch = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setLoadedId(null);
      return;
    }
    const { data, error } = await supabase
      .from('ai_messages')
      .select('id, role, content, tool_calls, created_at')
      .eq('conversation_id', conversationId)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: true });
    if (error) return;
    setMessages(data ?? []);
    setLoadedId(conversationId);
  }, [conversationId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  const loading = loadedId !== conversationId;
  return { messages: loading ? [] : messages, loading, loadedId, refetch };
}
