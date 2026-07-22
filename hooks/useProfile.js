import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useDataRefresh } from '../lib/DataRefreshContext';

// Signed URLs for the private avatars bucket expire; 24h comfortably covers
// any single app session, and the hook re-signs whenever the profile refetches.
const AVATAR_URL_TTL_SECONDS = 60 * 60 * 24;

export default function useProfile() {
  const { session, verifyUser } = useAuth();
  const { version, notifyChanged } = useDataRefresh();
  const [profile, setProfile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  const userId = session?.user?.id;

  // Reset the cached profile the instant the signed-in user changes, so a
  // consumer never reads the PREVIOUS account's row against the NEW userId.
  // Without this, `profile` holds the prior user's data until the new refetch
  // lands — and on a device where an onboarded account was just replaced by a
  // fresh signup (the common delete-and-recreate testing loop), OnboardingGate
  // reads the old row's non-null `onboarded_at`, sends the new user to Home for
  // a frame, THEN redirects to onboarding once the real (un-onboarded) profile
  // arrives: the reported "Home flashes for a second on signup". Adjusting
  // state during render (React's sanctioned "reset when an input changes"
  // pattern) clears it synchronously, before any child effect reads the stale
  // value — same class of fix AccountContext already applies to activeAccountId
  // and ThemeProfileSync to accent/mode on a user switch.
  const [trackedUserId, setTrackedUserId] = useState(userId);
  if (userId !== trackedUserId) {
    setTrackedUserId(userId);
    setProfile(null);
    setAvatarUrl(null);
    setLoading(true);
  }

  const refetch = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!error) setProfile(data);

    // A null profile for a live session is USUALLY the brief post-signup race
    // (handle_new_user hasn't inserted the row yet) — but it's also exactly
    // what a server-side-DELETED account looks like: the profiles row
    // cascade-deletes with auth.users, yet the locally-stored JWT still works
    // for reads (RLS just filters to empty). verifyUser() (a getUser() call
    // against the auth server) tells the two apart and forces a logout only if
    // the account is genuinely gone — so an externally-deleted account
    // self-ejects on the next refetch instead of lingering in a broken state.
    if (!error && data === null) {
      verifyUser?.();
    }

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
  }, [userId, verifyUser]);

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
    // `.select().maybeSingle()` added (FINDINGS-rank-ladder-rollout.md,
    // reported live: RankUpCelebration replaying after every APK reinstall) —
    // a bare `.update(fields).eq('id', userId)` with no `.select()` returns
    // `error: null` even when the WHERE clause matches ZERO rows (an RLS
    // mismatch, a stale/racing session right after a fresh sign-in, etc.) —
    // Postgrest has no way to report "matched nothing" without asking for the
    // row back. Every caller that treats a successful return as proof the
    // write landed durably (RankUpCelebration's highest_rank_seen persist is
    // the concrete case: skipping it would replay the celebration forever on
    // the next app launch, since the stale DB value never actually changed)
    // needs that guarantee, not just "no error".
    const { data, error } = await supabase.from('profiles').update(fields).eq('id', userId).select().maybeSingle();
    if (!error && !data) {
      return { error: new Error('profile_update_no_match') };
    }
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
