import { createContext, useContext, useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

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
    if (result.type !== 'success' || !result.url) return;

    const { queryParams } = Linking.parse(result.url);
    if (queryParams?.code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(queryParams.code);
      if (exchangeError) throw exchangeError;
    }
  }

  const value = { session, loading, signUp, signIn, signOut, signInWithGoogle, deleteAccount };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
