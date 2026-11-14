import { useEffect, useMemo, useRef } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { endOfDay, format } from 'date-fns';
import Sheet from './ledger/Sheet';
import ListRow from './ledger/ListRow';
import BillPaidButton from './BillPaidButton';
import CategoryIcon from './CategoryIcon';
import { useAuth } from '../lib/AuthContext';
import { useAccount } from '../lib/AccountContext';
import useBills from '../hooks/useBills';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import { usePayBillSheet } from './PayBillSheet';
import { dueBillsMoment, dueWording } from '../lib/billGroups';
import { billIconKey } from '../lib/billIcons';
import { amountParts } from '../lib/currency';
import { enqueue, PRIORITY } from '../lib/momentQueue';
import { useLedger, ledgerType, inter } from '../theme/ledger';

// The bills-due moment (34-streak-only.md; a sheet since spec 49, ticket 03):
// actionable, so it wins over a streak celebration in the moment queue
// (lib/momentQueue.js).
//
// Two parts. DueBillsSource (default export) is the headless sibling of
// <Stack> in app/_layout.js that enqueues the moment once a day while bills
// are due — the queue's remembered ids replace the old
// 'flo.dueBills.lastShown' key. DueBillsMoment is what components/MomentHost.js
// renders when the moment's turn comes; it reads the bills live, so a moment
// that waited still lists what's due now.
export default function DueBillsSource() {
  const { session } = useAuth();
  const { activeAccountId } = useAccount();
  const { bills, loading } = useBills();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const hasDue = dueBillsMoment(bills) !== null;

  useEffect(() => {
    if (!session || !activeAccountId || loading || !hasDue) return;
    enqueue({
      id: `bills-due:${todayStr}`,
      kind: 'bills-due',
      priority: PRIORITY.actionable,
      // Today's reminder only: tomorrow enqueues its own.
      expiresAt: endOfDay(new Date()).getTime(),
    });
  }, [session, activeAccountId, loading, hasDue, todayStr]);

  return null;
}

// A ledger Sheet: "2 bills need you", a row per bill (overdue first), and
// Mark paid / Later. Any way the sheet closes finishes the moment; a chosen
// action (pay, open the bill) runs once it has closed, so the pay sheet
// doesn't stack on this one.
export function DueBillsMoment({ onDone }) {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const sheetRef = useRef(null);
  const handleSheetChange = useSheetBackHandler(sheetRef);
  const pendingRef = useRef(null);
  const presentedRef = useRef(false);
  const { bills, loading } = useBills();
  const { openPayBill } = usePayBillSheet();

  const moment = useMemo(() => dueBillsMoment(bills), [bills]);

  useEffect(() => {
    if (loading) return;
    // Paid or deleted while the moment waited: nothing to show, and it
    // shouldn't use up the session's takeover.
    if (!moment && !presentedRef.current) {
      onDone({ skipped: true });
      return;
    }
    if (moment && !presentedRef.current) {
      presentedRef.current = true;
      sheetRef.current?.present();
    }
    // The last due bill was paid or deleted elsewhere while the sheet was up:
    // close it (finishing the moment) rather than leave it empty.
    if (!moment && presentedRef.current) sheetRef.current?.dismiss();
  }, [loading, moment]);

  function choose(action) {
    pendingRef.current = action;
    sheetRef.current?.dismiss();
  }

  function handleDismiss() {
    const run = pendingRef.current;
    pendingRef.current = null;
    onDone();
    run?.();
  }

  const list = moment?.bills ?? [];
  const single = list.length === 1;
  const footer = single
    ? {
        primary: { title: 'Mark paid', onPress: () => choose(() => openPayBill(list[0])) },
        secondary: { title: 'Later', onPress: () => sheetRef.current?.dismiss() },
      }
    : { primary: { title: 'Later', variant: 'secondary', onPress: () => sheetRef.current?.dismiss() } };

  return (
    <Sheet ref={sheetRef} title={moment?.title ?? ''} footer={footer} onChange={handleSheetChange} onDismiss={handleDismiss}>
      {list.map((bill, i) => {
        const due = dueWording(bill.next_due_date);
        const overdue = due.tone === 'danger';
        return (
          <ListRow
            key={bill.id}
            tone={overdue ? c.danger : bill.category?.color ?? undefined}
            renderIcon={(tint) => <CategoryIcon icon={billIconKey(bill)} size={18} color={tint} strokeWidth={1.75} />}
            title={bill.name}
            sub={due.text}
            subColor={overdue ? c.danger : undefined}
            right={<Text style={styles.money}>{amountParts(bill.amount, { currency: bill.currency }).text}</Text>}
            trailing={single ? undefined : <BillPaidButton billName={bill.name} onPress={() => choose(() => openPayBill(bill))} />}
            onPress={() => choose(() => router.push(`/bill/${bill.id}`))}
            divider={i < list.length - 1}
          />
        );
      })}
    </Sheet>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    money: {
      ...ledgerType.rowTitle,
      fontFamily: inter.semibold,
      fontVariant: ['tabular-nums'],
      color: c.ink,
    },
  });
}
