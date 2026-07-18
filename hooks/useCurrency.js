import { useAccount } from '../lib/AccountContext';
import { DEFAULT_CURRENCY } from '../lib/currency';

// The currency to display on account-scoped surfaces (Home, Transactions,
// Budgets, Plans, Analytics, single-account Report) — the active account's
// own currency. Falls back to INR while accounts are still loading, or if the
// active account is somehow absent, so a formatted amount never breaks.
// Surfaces that show more than one account at once (AccountSwitcherSheet, the
// Report's all-accounts scope, bills) read each row's OWN currency instead —
// see 15-currency-going-global.md Phase 2 §2.3.
export default function useCurrency() {
  const { activeAccount } = useAccount();
  return activeAccount?.currency ?? DEFAULT_CURRENCY;
}
