import { useMemo } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import ScreenHeader, { LargeTitle, useHeaderScroll } from '../components/ledger/ScreenHeader';
import PinnedFooter, { PINNED_FOOTER_HEIGHT } from '../components/ledger/PinnedFooter';
import AccountRow from '../components/AccountRow';
import { useLedger, ledgerSpace } from '../theme/ledger';
import { useAccount } from '../lib/AccountContext';
import useAllAccountSummaries from '../hooks/useAllAccountSummaries';
import useEntitlement from '../hooks/useEntitlement';
import { useAddAccountSheet } from '../components/AddAccountSheet';
import { useAddTransactionSheet } from '../components/AddTransactionSheet';
import { useProUpsellSheet } from '../components/ProUpsellSheet';
import { useToast } from '../components/Toast';
import { FREE_LIMITS } from '../lib/pro';

// Accounts on the ledger kit (spec 48, ticket 06), reached from More. One
// flat row per account (AccountRow): its colour, name, description and last
// 4, and its in-hand balance. Tap an account to make it the active one; Edit
// and, with a second account to move money to, Transfer sit in each row's ⋯
// menu. New account is pinned, behind the free-plan gate as before.
export default function Accounts() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { scrollY, onScroll } = useHeaderScroll();
  const { accounts, activeAccountId, setActiveAccount } = useAccount();
  const { summaries, loading } = useAllAccountSummaries();
  const { hasPro } = useEntitlement();
  const { openAddAccount } = useAddAccountSheet();
  const { openAdd } = useAddTransactionSheet();
  const { openProUpsell } = useProUpsellSheet();
  const { showToast } = useToast();
  const canTransfer = accounts.length >= 2;

  function handleSelect(account) {
    if (account.id === activeAccountId) return;
    setActiveAccount(account.id);
    showToast({ message: `Switched to ${account.name}`, variant: 'success' });
  }

  function handleNewAccount() {
    if (!hasPro && accounts.length >= FREE_LIMITS.accounts) {
      openProUpsell('Free includes 1 account');
      return;
    }
    openAddAccount();
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Accounts" scrollY={scrollY} />
      <Animated.ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <LargeTitle title="Accounts" scrollY={scrollY} />
        {accounts.map((account, i) => (
          <AccountRow
            key={account.id}
            account={account}
            balance={Number(summaries[account.id]?.in_hand_balance ?? 0)}
            loading={loading}
            active={account.id === activeAccountId}
            onPress={() => handleSelect(account)}
            onEdit={() => openAddAccount(account)}
            onTransfer={canTransfer ? () => openAdd({ type: 'transfer', fromAccountId: account.id }) : undefined}
            divider={i < accounts.length - 1}
          />
        ))}
      </Animated.ScrollView>

      <PinnedFooter primary={{ title: 'New account', onPress: handleNewAccount }} />
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.canvas,
    },
    flex: {
      flex: 1,
    },
    scroll: {
      paddingHorizontal: ledgerSpace.gutter,
      paddingBottom: PINNED_FOOTER_HEIGHT + ledgerSpace.section,
    },
  });
}
