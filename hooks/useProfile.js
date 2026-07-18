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

  // `silent` skips notifyChanged() — for fields like theme_accent/theme_mode
  // that no fetched data (transactions, budgets, etc.) depends on. Without
  // it, every theme toggle bumps DataRefreshContext's global version and
  // every data hook in the app refetches at the same instant as the color
  // change — visible as a flicker shortly after the toggle, not from the
  // color swap itself but from every screen's data re-loading underneath it.
  // Still patches the local `profile` cache directly (optimistic, no
  // network round trip) so it doesn't go stale — ThemeProfileSync compares
  // profile.theme_accent/theme_mode against the live context on every
  // render, and a stale cached value would make it think the DB disagrees
  // with the change just made and revert it right back.
  async function updateProfile(fields, { silent = false } = {}) {
    if (!userId) return { error: new Error('Not signed in') };
    const { error } = await supabase.from('profiles').update(fields).eq('id', userId);
    if (!error) {
      if (fields.full_name !== undefined) {
        await supabase.auth.updateUser({ data: { full_name: fields.full_name } });
      }
      if (silent) {
        setProfile((prev) => (prev ? { ...prev, ...fields } : prev));
      } else {
        notifyChanged();
      }
    }
    return { error };
  }

  return { profile, avatarUrl, loading, updateProfile, refetch };
}
