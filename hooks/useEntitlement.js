import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useDataRefresh } from '../lib/DataRefreshContext';
import { useAuth } from '../lib/AuthContext';

// The client's Pro truth. A missing entitlements row reads as Free — this is
// deliberate (see 14-subscription-pro.md §Data model), not an error state.
// Real enforcement that costs money (AI) stays server-side; this only gates
// cheap create actions client-side.
export default function useEntitlement() {
  const { version } = useDataRefresh();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) {
      setIsPro(false);
      setLoading(false);
      return;
    }
    const { data } = await supabase.from('entitlements').select('is_pro').eq('user_id', userId).maybeSingle();
    setIsPro(data?.is_pro ?? false);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  return { isPro, loading };
}
