import { ArrowLeftRight, Users } from 'lucide-react-native';
import ListRow from './ListRow';
import AmountText from './AmountText';
import CategoryIcon from '../CategoryIcon';
import { isTransfer, transferLabel } from '../../lib/transfers';
import { isSettlement, settlementLabel } from '../../lib/settlements';
import { FLAGS } from '../../lib/flags';
import { DEFAULT_CURRENCY } from '../../lib/currency';

// One entry in a list (Home's recent activity, Activity): a tinted category
// circle, the note (or the category when there's no note) as the title, the
// category as the sub, and the signed amount right. A transfer shows ⇄ and a
// settlement the people glyph, neither with a category tint.
//
// `title` overrides the transfer's "Transfer to X" (Activity passes its
// paired "Personal → Savings"). `accountName` adds the account to the sub,
// for lists that span accounts. The amount is in the entry's own account's
// currency when `accounts` knows it.
export default function TransactionRow({ tx, accounts = [], title, accountName, onPress, divider = true }) {
  const transfer = isTransfer(tx);
  const settlement = isSettlement(tx);
  const categoryName = tx.category?.name ?? (tx.type === 'income' ? 'Income' : 'Expense');
  const note = tx.note?.trim();
  // No note: the category is already the title, so it isn't repeated.
  const baseSub = transfer ? 'Transfer' : settlement ? 'Settled up' : note ? categoryName : undefined;
  const plan = FLAGS.plans && !transfer && !settlement ? tx.plan?.name : null;
  const currency = accounts.find((a) => a.id === tx.account_id)?.currency ?? DEFAULT_CURRENCY;
  const shownTitle = title ?? (transfer ? transferLabel(tx, accounts) : settlement ? settlementLabel(tx) : note || categoryName);

  return (
    <ListRow
      divider={divider}
      onPress={onPress}
      tone={transfer || settlement ? undefined : tx.category?.color}
      renderIcon={(tint) =>
        transfer ? (
          <ArrowLeftRight size={18} color={tint} strokeWidth={1.75} />
        ) : settlement ? (
          <Users size={18} color={tint} strokeWidth={1.75} />
        ) : (
          <CategoryIcon icon={tx.category?.icon} size={18} color={tint} strokeWidth={1.75} />
        )
      }
      title={shownTitle}
      sub={[baseSub, plan, accountName].filter(Boolean).join(' · ') || undefined}
      right={<AmountText value={tx.amount} type={transfer ? 'neutral' : tx.type} signed={!transfer} currency={currency} />}
    />
  );
}
