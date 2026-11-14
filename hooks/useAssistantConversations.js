import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';

// Past Ask FLO chats (44-ai-assistant.md §3.3, ticket 08), newest first. The
// title is the first question, trimmed to 40 characters by the function.
// Conversations aren't account-scoped: a chat can cover every account.
// `removeLocal(id)` drops a just-deleted row at once, without waiting for the
// refetch; only the latest fetch's answer is kept, so a slow older one can't
// bring a deleted row back.
export default function useAssistantConversations() {
  const { version } = useDataRefresh();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef(0);

  const refetch = useCallback(async () => {
    const request = ++requestRef.current;
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('id, title, created_at')
      .order('created_at', { ascending: false });
    if (request !== requestRef.current) return;
    if (!error) setConversations(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  const removeLocal = useCallback((id) => {
    setConversations((rows) => rows.filter((r) => r.id !== id));
  }, []);

  return { conversations, loading, refetch, removeLocal };
}
