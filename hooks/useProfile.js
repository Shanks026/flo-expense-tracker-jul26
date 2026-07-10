import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useDataRefresh } from '../lib/DataRefreshContext';

export default function useProfile() {
  const { session } = useAuth();
  const { version, notifyChanged } = useDataRefresh();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const userId = session?.user?.id;

  const refetch = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!error) setProfile(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  async function updateProfile(fields) {
    if (!userId) return { error: new Error('Not signed in') };
    const { error } = await supabase.from('profiles').update(fields).eq('id', userId);
    if (!error) {
      if (fields.full_name !== undefined) {
        await supabase.auth.updateUser({ data: { full_name: fields.full_name } });
      }
      notifyChanged();
    }
    return { error };
  }

  return { profile, loading, updateProfile, refetch };
}
