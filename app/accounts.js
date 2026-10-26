import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Pencil, ArrowLeftRight } from 'lucide-react-native';
import Button from '../components/Button';
import { RowGroup } from '../components/Row';
import { fontFamily, spacing, type, hitTarget } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { useAccount } from '../lib/AccountContext';
import useAllAccountSummaries from '../hooks/useAllAccountSummaries';
import useEntitlement from '../hooks/useEntitlement';
import { useAddAccountSheet } from '../components/AddAccountSheet';
import { useAddTransactionSheet } from '../components/AddTransactionSheet';
import { useProUpsellSheet } from '../components/ProUpsellSheet';
import { useToast } from '../components/Toast';
import { FREE_LIMITS } from '../lib/pro';
import { formatMoney } from '../lib/currency';

// Accounts (38-home-insights-more.md), reached from More. Tap an account to
// make it the active one; each account's actions are Edit and, only with a
// second account to move money to, Transfer — the one home transfers have
// now that they've left the Add sheet.
export default function Accounts() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { accounts, activeAccountId, setActiveAccount } = useAccount();
  const { summaries } = useAllAccountSummaries();
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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.scroll, { paddingBottom: spacing.xxl + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      <RowGroup title="Your accounts" style={styles.firstGroup}>
        {accounts.map((account) => {
          const active = account.id === activeAccountId;
          const balance = summaries[account.id]?.in_hand_balance ?? 0;
          return (
            <View key={account.id} style={styles.account}>
              <Pressable
                style={styles.accountMain}
                onPress={() => handleSelect(account)}
                accessibilityRole="button"
                accessibilityLabel={`${account.name}, ${formatMoney(balance, account.currency)} in hand${active ? ', active' : ''}`}
                accessibilityState={{ selected: active }}
              >
                <View style={[styles.dot, { backgroundColor: account.color }]} />
                <View style={styles.accountText}>
                  <Text style={styles.accountName} numberOfLines={1}>
                    {account.name}
                  </Text>
                  <Text style={styles.accountBalance}>{formatMoney(balance, account.currency)} in hand</Text>
                </View>
                {active && <Check size={18} color={colors.ink} strokeWidth={2.6} />}
              </Pressable>
              <View style={styles.actions}>
                <Pressable
                  style={styles.action}
                  onPress={() => openAddAccount(account)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${account.name}`}
                >
                  <Pencil size={14} color={colors.ink} strokeWidth={2.4} />
                  <Text style={styles.actionText}>Edit</Text>
                </Pressable>
                {canTransfer && (
                  <Pressable
                    style={styles.action}
                    onPress={() => openAdd({ type: 'transfer', fromAccountId: account.id })}
                    accessibilityRole="button"
                    accessibilityLabel={`Transfer from ${account.name}`}
                  >
                    <ArrowLeftRight size={14} color={colors.ink} strokeWidth={2.4} />
                    <Text style={styles.actionText}>Transfer</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </RowGroup>

      <Button title="New account" variant="primary" onPress={handleNewAccount} style={styles.newButton} />
    </ScrollView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scroll: {
      paddingHorizontal: spacing.xl,
    },
    firstGroup: {
      marginTop: spacing.sm,
    },
    account: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    accountMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: hitTarget,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    accountText: {
      flex: 1,
    },
    accountName: {
      fontFamily: fontFamily.bold,
      fontSize: type.bodyLg,
      color: colors.ink,
    },
    accountBalance: {
      fontFamily: fontFamily.semibold,
      fontSize: type.body,
      color: colors.mutedDarker,
      marginTop: 2,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginLeft: 12 + spacing.md,
    },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minHeight: hitTarget,
      paddingHorizontal: spacing.md,
    },
    actionText: {
      fontFamily: fontFamily.bold,
      fontSize: type.body,
      color: colors.ink,
    },
    newButton: {
      marginTop: spacing.xl,
    },
  });
}
