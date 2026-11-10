import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { CalendarClock, ReceiptText, Target } from 'lucide-react-native';
import ListRow from './ledger/ListRow';
import AmountText from './ledger/AmountText';
import Button from './ledger/Button';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius } from '../theme/ledger';
import { useAccount } from '../lib/AccountContext';
import { setProposalStatus } from '../lib/ai';
import useCategories from '../hooks/useCategories';
import { useAddTransactionSheet } from './AddTransactionSheet';
import { useAddBudgetSheet } from './AddBudgetSheet';
import { useAddBillSheet } from './AddBillSheet';

// A draft from Ask FLO (44-ai-assistant.md, phase 4), in plain words, with
// Review and Dismiss. Review opens the matching sheet pre-filled as a NEW
// entry; that sheet's own Save is the only write of the money row, and its
// onDone({ saved }) is what turns the card into "Saved ✓". Dismiss writes
// nothing but the card's own mark on the chat row.
//
// The function already checked every id; the card checks again against the
// person's current lists (the second lock, as aiQuickAdd does), so a
// category deleted since the chat leaves the sheet to pick its default.
//
// On the Quiet Ledger kit (spec 46, ticket 04): the one surface card on the
// chat, with a hairline edge. The draft is a ListRow (kind icon, what, when)
// with its amount in AmountText; Review is the primary Button, Dismiss a
// quiet one, and a saved draft says "Saved ✓" in the positive colour.
//
// `messageId` is the answer row the proposal lives on.
export default function ProposalCard({ messageId, proposal }) {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { accounts } = useAccount();
  const { categories } = useCategories();
  const { openAdd } = useAddTransactionSheet();
  const { openAddBudget } = useAddBudgetSheet();
  const { openAddBill } = useAddBillSheet();
  const [status, setStatus] = useState(proposal?.status ?? null);

  // A refetch can bring a mark made on another device, or after a reload.
  useEffect(() => {
    if (proposal?.status) setStatus(proposal.status);
  }, [proposal?.status]);

  const view = describe(proposal, { accounts, categories });
  if (!view) return null;

  async function mark(next) {
    setStatus(next);
    try {
      await setProposalStatus(messageId, proposal, next);
    } catch (e) {
      // The card keeps its mark for now; the money row (if any) is saved
      // either way. A reopened chat would offer Review again.
      console.warn('setProposalStatus failed:', e?.message);
    }
  }

  function review() {
    view.open({ openAdd, openAddBudget, openAddBill }, ({ saved }) => {
      if (saved) mark('saved');
    });
  }

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>{view.kicker}</Text>
      <ListRow
        icon={view.Icon}
        title={view.title}
        sub={view.sub}
        subLines={2}
        right={<AmountText value={view.amount} currency={view.currency} type={view.type} signed={view.type === 'income'} />}
        divider={false}
      />

      {status === 'saved' ? (
        <Animated.Text entering={FadeIn.duration(220)} style={[styles.status, { color: c.positive }]} accessibilityLiveRegion="polite">
          Saved ✓
        </Animated.Text>
      ) : status === 'dismissed' ? (
        <Animated.Text entering={FadeIn.duration(220)} style={[styles.status, { color: c.muted }]}>
          Dismissed
        </Animated.Text>
      ) : (
        <View style={styles.actions}>
          <Button title="Review" compact onPress={review} accessibilityLabel={`Review ${view.kicker.toLowerCase()}`} style={styles.review} />
          <Button title="Dismiss" variant="quiet" compact onPress={() => mark('dismissed')} />
        </View>
      )}
    </View>
  );
}

function dayLabel(ymd) {
  const d = parseISO(ymd);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEE d MMM yyyy');
}

// proposal → { Icon, kicker, type?, amount, currency?, title, sub, open(openers, onDone) }, or null
// for a shape this build doesn't know (a newer function, a broken row).
function describe(p, { accounts, categories }) {
  if (!p || typeof p !== 'object' || !(Number(p.amount) > 0)) return null;
  if (p.kind === 'transaction') {
    if ((p.type !== 'expense' && p.type !== 'income') || !/^\d{4}-\d{2}-\d{2}$/.test(p.date ?? '')) return null;
    const category = categories.find((c) => c.id === p.category_id && c.type === p.type);
    const account = accounts.find((a) => a.id === p.account_id);
    return {
      Icon: ReceiptText,
      kicker: p.type === 'income' ? 'New income' : 'New expense',
      type: p.type,
      amount: Number(p.amount),
      currency: account?.currency,
      title: category?.name ?? 'No category',
      sub: [accounts.length > 1 ? account?.name : null, dayLabel(p.date), p.note ? `“${p.note}”` : null].filter(Boolean).join(' · '),
      open: ({ openAdd }, onDone) =>
        openAdd({
          type: p.type,
          amount: Number(p.amount),
          categoryId: category?.id ?? null,
          accountId: account?.id ?? null,
          date: p.date,
          note: p.note ?? '',
          source: 'assistant',
          onDone,
        }),
    };
  }
  if (p.kind === 'budget') {
    const periods = ['calendar_week', 'calendar_month', 'custom'];
    if (!periods.includes(p.period_type)) return null;
    const custom = p.period_type === 'custom';
    if (custom && !(/^\d{4}-\d{2}-\d{2}$/.test(p.start_date ?? '') && /^\d{4}-\d{2}-\d{2}$/.test(p.end_date ?? ''))) return null;
    // A category deleted since the chat would make an "All spending" budget
    // out of a category one, so the card shows nothing to review instead.
    const category = p.category_id ? categories.find((c) => c.id === p.category_id && c.type === 'expense') : null;
    if (p.category_id && !category) return null;
    const account = accounts.find((a) => a.id === p.account_id);
    const period = custom
      ? `${format(parseISO(p.start_date), 'd MMM')} – ${format(parseISO(p.end_date), 'd MMM yyyy')}`
      : p.period_type === 'calendar_week'
        ? 'Every week'
        : 'Every month';
    return {
      Icon: Target,
      kicker: 'New budget',
      amount: Number(p.amount),
      currency: account?.currency,
      title: category?.name ?? 'All spending',
      sub: [period, accounts.length > 1 ? account?.name : null].filter(Boolean).join(' · '),
      open: ({ openAddBudget }, onDone) =>
        openAddBudget({
          amount: Number(p.amount),
          category_id: category?.id ?? null,
          period_type: p.period_type,
          start_date: custom ? p.start_date : null,
          end_date: custom ? p.end_date : null,
          account_id: account?.id ?? null,
          onDone,
        }),
    };
  }
  if (p.kind === 'bill') {
    const cadences = { weekly: 'Every week', monthly: 'Every month', yearly: 'Every year' };
    if (!cadences[p.cadence] || typeof p.name !== 'string' || !p.name.trim()) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.next_due_date ?? '')) return null;
    const category = p.category_id ? categories.find((c) => c.id === p.category_id && c.type === 'expense') : null;
    return {
      Icon: CalendarClock,
      kicker: 'New bill',
      amount: Number(p.amount),
      title: p.name,
      sub: [
        // "Rent · Rent" says nothing twice: the category only when it differs.
        category && category.name.toLowerCase() !== p.name.trim().toLowerCase() ? category.name : null,
        cadences[p.cadence],
        `next due ${format(parseISO(p.next_due_date), 'EEE d MMM yyyy')}`,
      ]
        .filter(Boolean)
        .join(' · '),
      open: ({ openAddBill }, onDone) =>
        openAddBill({
          name: p.name,
          amount: Number(p.amount),
          cadence: p.cadence,
          next_due_date: p.next_due_date,
          category_id: category?.id ?? null,
          onDone,
        }),
    };
  }
  return null;
}

function makeStyles(c) {
  return StyleSheet.create({
    card: {
      marginTop: ledgerSpace.md,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
      borderRadius: ledgerRadius.card,
      paddingHorizontal: ledgerSpace.lg,
      paddingTop: ledgerSpace.md,
      paddingBottom: ledgerSpace.lg,
    },
    kicker: {
      ...ledgerType.caption,
      color: c.muted,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ledgerSpace.sm,
      marginTop: ledgerSpace.sm,
    },
    review: {
      flex: 1,
    },
    status: {
      ...ledgerType.rowTitle,
      marginTop: ledgerSpace.sm,
    },
  });
}
