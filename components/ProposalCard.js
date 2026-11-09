import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { ReceiptText, Target } from 'lucide-react-native';
import Card from './Card';
import { fontFamily, spacing, radii, type } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { formatMoney } from '../lib/currency';
import { useAccount } from '../lib/AccountContext';
import { setProposalStatus } from '../lib/ai';
import useCategories from '../hooks/useCategories';
import { useAddTransactionSheet } from './AddTransactionSheet';
import { useAddBudgetSheet } from './AddBudgetSheet';

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
// `messageId` is the answer row the proposal lives on.
export default function ProposalCard({ messageId, proposal }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { accounts } = useAccount();
  const { categories } = useCategories();
  const { openAdd } = useAddTransactionSheet();
  const { openAddBudget } = useAddBudgetSheet();
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
    view.open({ openAdd, openAddBudget }, ({ saved }) => {
      if (saved) mark('saved');
    });
  }

  return (
    <Card style={styles.card}>
      <View style={styles.kickerRow}>
        <view.Icon size={16} color={colors.muted} strokeWidth={2.2} />
        <Text style={styles.kicker}>{view.kicker}</Text>
      </View>
      <Text style={styles.amount}>{view.amount}</Text>
      {view.lines.map((line) => (
        <Text key={line} style={styles.line} numberOfLines={2}>
          {line}
        </Text>
      ))}

      {status === 'saved' ? (
        <Animated.Text entering={FadeIn.duration(220)} style={styles.saved} accessibilityLiveRegion="polite">
          Saved ✓
        </Animated.Text>
      ) : status === 'dismissed' ? (
        <Animated.Text entering={FadeIn.duration(220)} style={styles.dismissed}>
          Dismissed
        </Animated.Text>
      ) : (
        <View style={styles.actions}>
          <Pressable
            onPress={review}
            style={({ pressed }) => [styles.action, styles.review, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Review ${view.kicker.toLowerCase()}`}
          >
            <Text style={styles.reviewText}>Review</Text>
          </Pressable>
          <Pressable
            onPress={() => mark('dismissed')}
            style={({ pressed }) => [styles.action, styles.dismiss, pressed && styles.dismissPressed]}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <Text style={styles.dismissText}>Dismiss</Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
}

function dayLabel(ymd) {
  const d = parseISO(ymd);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEE d MMM yyyy');
}

// proposal → { Icon, kicker, amount, lines, open(openers, onDone) }, or null
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
      amount: formatMoney(Number(p.amount), account?.currency),
      lines: [
        [category?.name ?? 'No category', accounts.length > 1 ? account?.name : null, dayLabel(p.date)]
          .filter(Boolean)
          .join(' · '),
        p.note ? `“${p.note}”` : null,
      ].filter(Boolean),
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
      amount: formatMoney(Number(p.amount), account?.currency),
      lines: [[category?.name ?? 'All spending', period, accounts.length > 1 ? account?.name : null].filter(Boolean).join(' · ')],
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
  return null;
}

function makeStyles(colors) {
  return StyleSheet.create({
    card: {
      marginTop: spacing.md,
      gap: spacing.xs,
    },
    kickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    kicker: {
      fontFamily: fontFamily.semibold,
      fontSize: type.caption,
      color: colors.muted,
    },
    amount: {
      fontFamily: fontFamily.extrabold,
      fontSize: type.title,
      color: colors.ink,
      marginTop: spacing.xs,
    },
    line: {
      fontFamily: fontFamily.semibold,
      fontSize: type.body,
      lineHeight: 20,
      color: colors.ink,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    action: {
      flex: 1,
      height: 44,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    review: {
      backgroundColor: colors.brand,
    },
    pressed: {
      opacity: 0.85,
    },
    reviewText: {
      fontFamily: fontFamily.extrabold,
      fontSize: type.body,
      color: colors.brandText,
    },
    dismiss: {
      backgroundColor: 'transparent',
    },
    dismissPressed: {
      backgroundColor: colors.chipBg,
    },
    dismissText: {
      fontFamily: fontFamily.bold,
      fontSize: type.body,
      color: colors.ink,
    },
    saved: {
      fontFamily: fontFamily.extrabold,
      fontSize: type.body,
      color: colors.ink,
      marginTop: spacing.md,
    },
    dismissed: {
      fontFamily: fontFamily.semibold,
      fontSize: type.body,
      color: colors.muted,
      marginTop: spacing.md,
    },
  });
}
