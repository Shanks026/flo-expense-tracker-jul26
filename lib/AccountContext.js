import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { useDataRefresh } from './DataRefreshContext';

const STORAGE_KEY = 'flo.activeAccountId';

const AccountContext = createContext(null);

export function AccountProvider({ children }) {
  const { version } = useDataRefresh();
  const [accounts, setAccounts] = useState([]);
  const [activeAccountId, setActiveAccountId] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase.from('accounts').select('*').order('created_at', { ascending: true });
    if (!error) setAccounts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch, version]);

  useEffect(() => {
    if (accounts.length === 0) return;

    if (!initialized) {
      AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
        const exists = accounts.some((a) => a.id === stored);
        setActiveAccountId(exists ? stored : accounts[0].id);
        setInitialized(true);
      });
      return;
    }

    // Active account disappeared (e.g. deleted) -> fall back to the first one
    if (!accounts.some((a) => a.id === activeAccountId)) {
      setActiveAccountId(accounts[0].id);
      AsyncStorage.setItem(STORAGE_KEY, accounts[0].id);
    }
  }, [accounts, initialized]);

  const setActiveAccount = useCallback((id) => {
    setActiveAccountId(id);
    AsyncStorage.setItem(STORAGE_KEY, id);
  }, []);

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null;

  return (
    <AccountContext.Provider
      value={{ accounts, activeAccount, activeAccountId, setActiveAccount, loading: loading || !initialized }}
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
