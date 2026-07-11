import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useDataRefresh } from '../lib/DataRefreshContext';

// Signed URLs for the private avatars bucket expire; 24h comfortably covers
// any single app session, and the hook re-signs whenever the profile refetches.
const AVATAR_URL_TTL_SECONDS = 60 * 60 * 24;

export default function useProfile() {
  const { session } = useAuth();
  const { version, notifyChanged } = useDataRefresh();
  const [profile, setProfile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  const userId = session?.user?.id;

  const refetch = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!error) setProfile(data);

    // profile.avatar_url holds the storage object PATH (the bucket is private);
    // turn it into a short-lived signed URL for rendering.
    const path = data?.avatar_url ?? null;
    if (path) {
      const { data: signed } = await supabase.storage.from('avatars').createSignedUrl(path, AVATAR_URL_TTL_SECONDS);
      setAvatarUrl(signed?.signedUrl ?? null);
    } else {
      setAvatarUrl(null);
    }
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

  return { profile, avatarUrl, loading, updateProfile, refetch };
}
