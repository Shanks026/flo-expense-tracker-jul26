import { View, Text, StyleSheet } from 'react-native';
import { Check, Pencil, ArrowLeftRight } from 'lucide-react-native';
import ListRow from './ledger/ListRow';
import OverflowMenu from './ledger/OverflowMenu';
import AmountText from './ledger/AmountText';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, inter } from '../theme/ledger';
import { accountSub } from '../lib/accountLast4';
import { formatMoney } from '../lib/currency';

// One account as a flat row (spec 48 §Accounts and last 4), shared by the
// Accounts screen and the account switcher: a circle washed in the account's
// colour with its initial, the name, a sub of its description and "•••• 4821",
// the in-hand balance (a skeleton while it loads, never ₹0), a check on the
// active account, then a ⋯ menu with Edit and, given `onTransfer`, Transfer.
export default function AccountRow({ account, balance, loading, active, onPress, onEdit, onTransfer, divider }) {
  const { c } = useLedger();
  const initial = (account.name?.trim()?.[0] ?? '?').toUpperCase();
  const actions = [{ key: 'edit', title: 'Edit', icon: Pencil, onPress: onEdit }];
  if (onTransfer) actions.push({ key: 'transfer', title: 'Transfer', icon: ArrowLeftRight, onPress: onTransfer });
  const spoken = loading
    ? account.name
    : `${account.name}, ${balance < 0 ? 'minus ' : ''}${formatMoney(Math.abs(balance), account.currency)} in hand`;

  return (
    <ListRow
      tone={account.color}
      renderIcon={(tint) => <Text style={[ledgerType.rowTitle, styles.initial, { color: tint }]}>{initial}</Text>}
      title={account.name}
      sub={accountSub(account) ?? undefined}
      right={loading ? <View style={[styles.skeleton, { backgroundColor: c.surfaceSunk }]} /> : <AmountText value={balance} currency={account.currency} />}
      trailing={
        <View style={styles.trailing}>
          <View style={styles.checkSlot}>{active && <Check size={18} color={c.accent} strokeWidth={2.25} />}</View>
          <OverflowMenu title={account.name} actions={actions} accessibilityLabel={`More for ${account.name}`} />
        </View>
      }
      onPress={onPress}
      accessibilityLabel={`${spoken}${active ? ', active' : ''}`}
      divider={divider}
    />
  );
}

const styles = StyleSheet.create({
  initial: {
    fontFamily: inter.semibold,
  },
  skeleton: {
    width: 64,
    height: 14,
    borderRadius: ledgerRadius.input,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ledgerSpace.xs,
    marginLeft: ledgerSpace.sm,
  },
  // Keeps every balance on one edge whether or not the row is active.
  checkSlot: {
    width: 24,
    alignItems: 'center',
  },
});
