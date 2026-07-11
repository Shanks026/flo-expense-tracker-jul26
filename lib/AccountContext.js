import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { useDataRefresh } from './DataRefreshContext';

const STORAGE_KEY = 'flo.activeAccountId';

const AccountContext = createContext(null);

export function AccountProvider({ children }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { version } = useDataRefresh();
  const [accounts, setAccounts] = useState([]);
  const [activeAccountId, setActiveAccountId] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.from('accounts').select('*').order('created_at', { ascending: true });
    if (!error) setAccounts(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  // The signed-in user changed (first sign-in after a pre-auth empty
  // fetch, sign-out, or switching accounts on the same device) — whatever
  // was previously resolved no longer applies. Without this, a fetch that
  // ran before a session existed (correctly empty) never gets revisited,
  // and activeAccountId can stay null indefinitely.
  useEffect(() => {
    setInitialized(false);
    setActiveAccountId(null);
  }, [userId]);

  useEffect(() => {
    if (accounts.length === 0) return;

    if (!initialized) {
      AsyncStorage.getItem(STORAGE_KEY)
        .catch(() => null)
        .then((stored) => {
          const exists = accounts.some((a) => a.id === stored);
          setActiveAccountId(exists ? stored : accounts[0].id);
          setInitialized(true);
        });
      return;
    }

    // Active account disappeared (e.g. deleted) -> fall back to the first one
    if (!accounts.some((a) => a.id === activeAccountId)) {
      setActiveAccountId(accounts[0].id);
      AsyncStorage.setItem(STORAGE_KEY, accounts[0].id).catch(() => {});
    }
  }, [accounts, initialized]);

  const setActiveAccount = useCallback((id) => {
    setActiveAccountId(id);
    AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
  }, []);

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null;
  // Once there are accounts to resolve, wait for that to finish; if there
  // are genuinely none (e.g. the signup trigger failed to seed one), don't
  // hang forever waiting for an initialization that will never happen.
  const resolving = accounts.length > 0 && !initialized;

  return (
    <AccountContext.Provider
      value={{ accounts, activeAccount, activeAccountId, setActiveAccount, loading: loading || resolving }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used within AccountProvider');
  return ctx;
}
