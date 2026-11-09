import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';

// The messages of one Ask FLO conversation (44-ai-assistant.md, phase 3),
// oldest first. Only the person's questions and the answers; tool rows and
// the tool log stay out of the list. A null id is a new chat: no messages.
export default function useAssistantConversation(conversationId) {
  const { version } = useDataRefresh();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(!!conversationId);

  const refetch = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('ai_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: true });
    if (!error) setMessages(data ?? []);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { messages, loading, refetch };
}
