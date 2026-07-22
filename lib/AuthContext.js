import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
// Not `expo-linking`'s Linking.parse — that only reads the URL's QUERY
// string. Supabase's OAuth redirect can carry its payload in the HASH
// FRAGMENT instead (implicit flow's access_token/refresh_token), which
// Linking.parse simply never saw — the exact silent-failure bug found live
// (see signInWithGoogle below). QueryParams.getQueryParams merges both.
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Confirm the current session's user still exists SERVER-SIDE, and force a
  // local logout if it doesn't. `getSession()` only reads the locally-stored
  // token — a JWT stays syntactically valid until it expires (~1h), so if the
  // account is deleted straight from the DB while the app holds a live token,
  // nothing errors on its own: RLS-filtered reads just return empty (the
  // user's rows cascade-deleted), and the stale session lingers until a token
  // refresh eventually fails. `getUser()` instead validates the token against
  // the auth server, which returns a 4xx (user_not_found) the moment the user
  // is gone — that's the reliable signal.
  //
  // Only a definitive client-side auth response (401/403) forces the logout —
  // NOT a network/5xx error, or a flaky connection would sign people out. Uses
  // scope:'local' (like deleteAccount): a server-side revoke would itself fail
  // because the session no longer exists. onAuthStateChange then fires with a
  // null session → RootNavigator redirects to sign-in, and every user-scoped
  // cache (useProfile, AccountContext, ThemeProfileSync) resets on the userId
  // change, same as a normal logout.
  const verifyUser = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) return;
    const { error } = await supabase.auth.getUser();
    if (error && (error.status === 401 || error.status === 403)) {
      await supabase.auth.signOut({ scope: 'local' });
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      // Cold start with a restored session — validate it once. A session
      // restored from storage may belong to an account deleted while the app
      // was closed.
      if (data.session) verifyUser();
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    // Re-validate whenever the app returns to the foreground — catches an
    // account deleted while the app was backgrounded, without polling.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') verifyUser();
    });

    return () => {
      subscription.subscription.unsubscribe();
      appStateSub.remove();
    };
  }, [verifyUser]);

  async function signUp(email, password, fullName) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async function deleteAccount() {
    const userId = session?.user?.id;
    // Physically remove the avatar while still authenticated (RLS lets the
    // user delete their own object). The DB trigger also clears the metadata
    // row as a safety net, but only the Storage API removes the actual file.
    if (userId) {
      await supabase.storage.from('avatars').remove([`${userId}/avatar.jpg`]);
    }
    // Deletes auth.users where id = auth.uid(), cascading all of the user's
    // data (see the delete_current_user RPC / cascade_delete_user_data migration).
    const { error } = await supabase.rpc('delete_current_user');
    if (error) throw error;
    // The account (and its token) no longer exist server-side, so a normal
    // signOut would try to revoke against a dead session. Use scope 'local' to
    // just clear the stored session — onAuthStateChange then drops us to sign-in.
    await supabase.auth.signOut({ scope: 'local' });
  }

  async function signInWithGoogle() {
    const redirectTo = AuthSession.makeRedirectUri();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    // A non-'success' result (user backed out of the browser sheet, or the OS
    // dismissed it) is a silent cancel, not a failure — sign-in.js's own
    // comment on this already documents that; nothing to throw here.
    if (result.type !== 'success' || !result.url) return;

    // getQueryParams merges the URL's query string AND hash fragment into one
    // object. This client uses the default IMPLICIT flow (lib/supabase.js —
    // PKCE was tried and reverted, see there), which returns access/refresh
    // tokens in the URL HASH FRAGMENT. The original bug was that this only
    // checked `code` via expo-linking's Linking.parse, which doesn't read the
    // hash fragment at all — so the real tokens sitting there were never seen,
    // and Google sign-in silently did nothing. Handling both shapes (hash
    // tokens AND a `code` query param) keeps this correct regardless of flow,
    // so a future flowType change wouldn't re-break it.
    const { params, errorCode } = QueryParams.getQueryParams(result.url);
    if (errorCode || params.error) {
      throw new Error(params.error_description || params.error || errorCode);
    }

    if (params.access_token && params.refresh_token) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
      if (sessionError) throw sessionError;
      return;
    }

    if (params.code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code);
      if (exchangeError) throw exchangeError;
      return;
    }

    // A genuine "success" browser result that carries neither shape is a real
    // failure, not a silent cancel — surface it instead of leaving the caller
    // stranded on the sign-in screen with no feedback (the reported bug).
    throw new Error('Google sign-in did not return a session. Please try again.');
  }

  const value = { session, loading, signUp, signIn, signOut, signInWithGoogle, deleteAccount, verifyUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
