import { forwardRef, useImperativeHandle, useRef, useMemo, useCallback, createContext, useContext } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Check, Pencil, X, TrendingUp, TrendingDown } from 'lucide-react-native';
import Button from './Button';
import { colors, radii, spacing, fontFamily, fontSize } from '../theme/tokens';
import { useAccount } from '../lib/AccountContext';
import useAllAccountSummaries from '../hooks/useAllAccountSummaries';
import { useAddAccountSheet } from './AddAccountSheet';
import { useToast } from './Toast';

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

function formatAmount(value) {
  const rounded = Math.round(Math.abs(value));
  return `${value < 0 ? '−' : ''}₹${rounded.toLocaleString('en-IN')}`;
}

function AccountCard({ account, summary, active, onSelect, onEdit }) {
  return (
    <Pressable style={styles.card} onPress={onSelect}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardHeading}>
          <View style={[styles.colorDot, { backgroundColor: account.color }]} />
          <Text style={styles.cardName} numberOfLines={1}>
            {account.name}
          </Text>
          {active && (
            <View style={styles.activePill}>
              <Check size={10} color={colors.ink} strokeWidth={3} />
            </View>
          )}
        </View>
        <Pressable style={styles.editButton} onPress={onEdit} hitSlop={8}>
          <Pencil size={14} color={colors.mutedMid} strokeWidth={2} />
        </Pressable>
      </View>

      <Text style={styles.cardLabel}>In Hand</Text>
      <Text style={styles.cardBalance}>{formatAmount(summary?.in_hand_balance ?? 0)}</Text>

      <View style={styles.cardStatsRow}>
        <View style={styles.statLine}>
          <TrendingUp size={12} color={colors.mutedMid} strokeWidth={2.6} />
          <Text style={styles.statValue}>{formatAmount(summary?.month_income ?? 0)}</Text>
          <Text style={styles.statLabel}>Income</Text>
        </View>
        <View style={styles.statLine}>
          <TrendingDown size={12} color={colors.mutedMid} strokeWidth={2.6} />
          <Text style={styles.statValue}>{formatAmount(summary?.month_expense ?? 0)}</Text>
          <Text style={styles.statLabel}>Expenses</Text>
        </View>
      </View>
    </Pressable>
  );
}

const AccountSwitcherSheet = forwardRef(function AccountSwitcherSheet(_props, ref) {
  const modalRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { accounts, activeAccountId, setActiveAccount } = useAccount();
  const { summaries } = useAllAccountSummaries();
  const { openAddAccount } = useAddAccountSheet();
  const { showToast } = useToast();

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

  const renderBackdrop = useCallback(
    (props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    []
  );

  function handleSelect(account) {
    const switching = account.id !== activeAccountId;
    setActiveAccount(account.id);
    modalRef.current?.dismiss();
    if (switching) showToast({ message: `Switched to ${account.name}`, variant: 'success' });
  }

  function handleNewAccount() {
    modalRef.current?.dismiss();
    openAddAccount();
  }

  function handleEdit(account) {
    modalRef.current?.dismiss();
    openAddAccount(account);
  }

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={useMemo(() => ['85%'], [])}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.ink, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet }}
      handleIndicatorStyle={{ backgroundColor: '#3a3a3a', width: 44 }}
    >
      <BottomSheetScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.sheet, { paddingBottom: spacing.xxl + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Accounts</Text>
          <Pressable style={styles.closeButton} onPress={() => modalRef.current?.dismiss()}>
            <X size={16} color={colors.surface} strokeWidth={2.6} />
          </Pressable>
        </View>

        {orderedAccounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            summary={summaries[account.id]}
            active={account.id === activeAccountId}
            onSelect={() => handleSelect(account)}
            onEdit={() => handleEdit(account)}
          />
        ))}

        <Button title="New Account" variant="primary" onPress={handleNewAccount} style={{ marginTop: spacing.sm }} />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: colors.surface,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.inkCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.inkCard,
    borderRadius: radii.cardLg,
    padding: spacing.xxl,
    marginBottom: spacing.md,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 1,
    paddingRight: spacing.sm,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
  },
  cardName: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    letterSpacing: -0.1,
    lineHeight: fontSize.lg,
    color: colors.surface,
    flexShrink: 1,
  },
  activePill: {
    width: 16,
    height: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
  },
  cardBalance: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.hero,
    letterSpacing: -0.4,
    color: colors.surface,
    marginTop: 4,
  },
  cardStatsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  statLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    letterSpacing: -0.2,
    color: colors.surface,
  },
  statLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: colors.mutedMid,
  },
});
