import { createContext, useContext, useState, useCallback } from 'react';

const DataRefreshContext = createContext(null);

export function DataRefreshProvider({ children }) {
  const [version, setVersion] = useState(0);
  const notifyChanged = useCallback(() => setVersion((v) => v + 1), []);

  return (
    <DataRefreshContext.Provider value={{ version, notifyChanged }}>
      {children}
    </DataRefreshContext.Provider>
  );
}

export function useDataRefresh() {
  const ctx = useContext(DataRefreshContext);
  if (!ctx) throw new Error('useDataRefresh must be used within DataRefreshProvider');
  return ctx;
}
