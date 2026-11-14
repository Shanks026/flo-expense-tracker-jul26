import { forwardRef, useImperativeHandle, useRef, useMemo, useCallback, createContext, useContext } from 'react';
import Sheet from './ledger/Sheet';
import AccountRow from './AccountRow';
import { useAccount } from '../lib/AccountContext';
import useAllAccountSummaries from '../hooks/useAllAccountSummaries';
import { useAddAccountSheet } from './AddAccountSheet';
import { useToast } from './Toast';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import useEntitlement from '../hooks/useEntitlement';
import { useProUpsellSheet } from './ProUpsellSheet';
import { FREE_LIMITS } from '../lib/pro';

const AccountSwitcherSheetContext = createContext(null);

export function AccountSwitcherSheetProvider({ children }) {
  const sheetRef = useRef(null);
  const openAccountSwitcher = useCallback(() => sheetRef.current?.open(), []);

  return (
    <AccountSwitcherSheetContext.Provider value={{ openAccountSwitcher }}>
      {children}
      <AccountSwitcherSheet ref={sheetRef} />
    </AccountSwitcherSheetContext.Provider>
  );
}

export function useAccountSwitcherSheet() {
  const ctx = useContext(AccountSwitcherSheetContext);
  if (!ctx) throw new Error('useAccountSwitcherSheet must be used within AccountSwitcherSheetProvider');
  return ctx;
}

// The account switcher, opened from the Home card (spec 48, ticket 06): the
// same rows as the Accounts screen (AccountRow), the active account first.
// A tap switches and closes; each row's ⋯ menu has Edit (Transfer lives on
// the Accounts screen: this provider sits outside the Add sheet's).
// New account is pinned, behind the free-plan gate.
const AccountSwitcherSheet = forwardRef(function AccountSwitcherSheet(_props, ref) {
  const modalRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(modalRef);
  const { accounts, activeAccountId, setActiveAccount } = useAccount();
  const { summaries, loading } = useAllAccountSummaries();
  const { openAddAccount } = useAddAccountSheet();
  const { showToast } = useToast();
  const { hasPro } = useEntitlement();
  const { openProUpsell } = useProUpsellSheet();

  const orderedAccounts = useMemo(() => {
    const active = accounts.find((a) => a.id === activeAccountId);
    if (!active) return accounts;
    return [active, ...accounts.filter((a) => a.id !== activeAccountId)];
  }, [accounts, activeAccountId]);

  useImperativeHandle(ref, () => ({
    open() {
      modalRef.current?.present();
    },
  }));

  function handleSelect(account) {
    const switching = account.id !== activeAccountId;
    setActiveAccount(account.id);
    modalRef.current?.dismiss();
    if (switching) showToast({ message: `Switched to ${account.name}`, variant: 'success' });
  }

  // Each opens another sheet, so this one closes first.
  function dismissThen(run) {
    modalRef.current?.dismiss();
    run();
  }

  function handleNewAccount() {
    dismissThen(() => {
      if (!hasPro && accounts.length >= FREE_LIMITS.accounts) {
        openProUpsell('Free includes 1 account');
        return;
      }
      openAddAccount();
    });
  }

  return (
    <Sheet
      ref={modalRef}
      title="Accounts"
      onChange={handleSheetChange}
      footer={{ primary: { title: 'New account', onPress: handleNewAccount } }}
    >
      {orderedAccounts.map((account, i) => (
        <AccountRow
          key={account.id}
          account={account}
          balance={Number(summaries[account.id]?.in_hand_balance ?? 0)}
          loading={loading}
          active={account.id === activeAccountId}
          onPress={() => handleSelect(account)}
          onEdit={() => dismissThen(() => openAddAccount(account))}
          divider={i < orderedAccounts.length - 1}
        />
      ))}
    </Sheet>
  );
});
