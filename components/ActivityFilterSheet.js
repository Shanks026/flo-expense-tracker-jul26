import { forwardRef, useEffect, useState } from 'react';
import { View, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CalendarDays, Layers, Wallet, ArrowLeftRight, TrendingDown, TrendingUp, Shapes, Check } from 'lucide-react-native';
import Sheet from './ledger/Sheet';
import ListRow from './ledger/ListRow';
import SectionHeader from './ledger/SectionHeader';
import AmountText from './ledger/AmountText';
import CategoryIcon from './CategoryIcon';
import useAllAccountSummaries from '../hooks/useAllAccountSummaries';
import useSheetBackHandler from '../hooks/useSheetBackHandler';
import { RANGE_PRESETS, activityRange, ymd, dateFromYmd, fullDayLabel } from '../lib/activity';
import { useLedger, ledgerSpace, ledgerRadius } from '../theme/ledger';

// One sheet for Activity's four filter chips (spec 46, ticket 10). `kind`
// picks the content: 'type' | 'category' | 'account' | 'range'. Picking a row
// applies it and closes the sheet, except Custom dates, which apply from the
// footer. The screen owns the filters; this only reports a change through
// `onChange(patch)`.
//
// Local to Activity rather than an app-wide <XSheetProvider>: nothing else
// opens it, and the filters are the screen's own state.
export const TYPE_OPTIONS = [
  { value: 'all', label: 'All types', icon: Layers },
  { value: 'expense', label: 'Expense', icon: TrendingDown },
  { value: 'income', label: 'Income', icon: TrendingUp },
  { value: 'transfer', label: 'Transfers', icon: ArrowLeftRight },
];

const TITLES = { type: 'Type', category: 'Category', account: 'Account', range: 'Date range' };

const ActivityFilterSheet = forwardRef(function ActivityFilterSheet(
  { kind, filters, accounts, activeAccountId, categories, onChange },
  ref
) {
  const { c } = useLedger();
  // Android Back closes the sheet instead of leaving the tab under it.
  const handleSheetChange = useSheetBackHandler(ref);
  const { summaries, loading: summariesLoading } = useAllAccountSummaries();
  const close = () => ref.current?.dismiss();
  const apply = (patch) => {
    onChange(patch);
    close();
  };

  // Custom dates are a draft until Apply.
  const [custom, setCustom] = useState(null);
  const [picking, setPicking] = useState(null); // 'from' | 'to'
  const resetDraft = () => {
    setCustom(filters.range.preset === 'custom' ? activityRange(filters.range) : null);
    setPicking(null);
  };
  useEffect(() => {
    if (kind === 'range') resetDraft();
  }, [kind, filters.range]);

  let body = null;
  if (kind === 'type') {
    body = TYPE_OPTIONS.map((o, i) => (
      <ListRow
        key={o.value}
        icon={o.icon}
        title={o.label}
        trailing={filters.type === o.value ? 'check' : undefined}
        onPress={() => apply({ type: o.value })}
        divider={i < TYPE_OPTIONS.length - 1}
      />
    ));
  } else if (kind === 'category') {
    // Only the side that can match: income categories never hold expenses.
    const groups = [
      filters.type !== 'income' && { title: 'Expense', items: categories.filter((cat) => cat.type === 'expense') },
      filters.type !== 'expense' && { title: 'Income', items: categories.filter((cat) => cat.type === 'income') },
    ].filter((g) => g && g.items.length);
    body = (
      <>
        <ListRow
          icon={Shapes}
          title="All categories"
          trailing={filters.categoryId == null ? 'check' : undefined}
          onPress={() => apply({ categoryId: null })}
          divider={false}
        />
        {groups.map((g) => (
          <View key={g.title}>
            <SectionHeader title={g.title} style={{ marginTop: ledgerSpace.lg }} />
            {g.items.map((cat, i) => (
              <ListRow
                key={cat.id}
                tone={cat.color}
                renderIcon={(tint) => <CategoryIcon icon={cat.icon} size={18} color={tint} strokeWidth={1.75} />}
                title={cat.name}
                trailing={filters.categoryId === cat.id ? 'check' : undefined}
                onPress={() => apply({ categoryId: cat.id })}
                divider={i < g.items.length - 1}
              />
            ))}
          </View>
        ))}
      </>
    );
  } else if (kind === 'account') {
    const selected = filters.accountId ?? activeAccountId;
    // Each account's in-hand balance (lifetime, like the account card), and
    // their sum on All accounts. Nothing while loading, never a false ₹0.
    const balanceOf = (a) => Number(summaries[a.id]?.in_hand_balance ?? 0);
    const money = (value, currency) =>
      summariesLoading ? undefined : <AmountText value={value} currency={currency} />;
    const activeCurrency = accounts.find((a) => a.id === activeAccountId)?.currency;
    // The chosen row's icon circle turns ink with a white check (the same
    // "ink = selected" as a chip), not a check after the amount, so every
    // balance lines up on the right edge. TalkBack hears "selected" in the
    // label, since the check is only drawn.
    const pick = (isSelected, Icon, name) =>
      isSelected
        ? {
            renderIcon: () => (
              <View style={{ width: '100%', height: '100%', borderRadius: ledgerRadius.full, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}>
                <Check size={18} color={c.inkOnInk} strokeWidth={2.5} />
              </View>
            ),
            accessibilityLabel: `${name}, selected`,
          }
        : { icon: Icon };
    body = (
      <>
        <ListRow
          {...pick(selected === 'all', Layers, 'All accounts')}
          title="All accounts"
          right={money(accounts.reduce((sum, a) => sum + balanceOf(a), 0), activeCurrency)}
          rightSub="In hand"
          onPress={() => apply({ accountId: 'all' })}
        />
        {accounts.map((a, i) => (
          <ListRow
            key={a.id}
            {...pick(selected === a.id, Wallet, a.name)}
            title={a.name}
            sub={a.id === activeAccountId ? 'Active account' : undefined}
            right={money(balanceOf(a), a.currency)}
            rightSub="In hand"
            // The active account is the default, stored as null so it
            // follows an account switch.
            onPress={() => apply({ accountId: a.id === activeAccountId ? null : a.id })}
            divider={i < accounts.length - 1}
          />
        ))}
      </>
    );
  } else if (kind === 'range') {
    const current = custom ? 'custom' : filters.range.preset;
    const draft = custom ?? activityRange(filters.range);
    body = (
      <>
        {RANGE_PRESETS.map((p, i) => (
          <ListRow
            key={p.preset}
            icon={CalendarDays}
            title={p.label}
            trailing={current === p.preset ? 'check' : undefined}
            onPress={() => (p.preset === 'custom' ? setCustom(draft) : apply({ range: { preset: p.preset } }))}
            divider={i < RANGE_PRESETS.length - 1}
          />
        ))}
        {custom && (
          <>
            <SectionHeader title="Custom dates" style={{ marginTop: ledgerSpace.lg }} />
            <ListRow title="From" right={fullDayLabel(custom.from)} trailing="chevron" onPress={() => setPicking('from')} />
            <ListRow title="To" right={fullDayLabel(custom.to)} trailing="chevron" onPress={() => setPicking('to')} divider={false} />
          </>
        )}
        {picking && (
          <DateTimePicker
            value={dateFromYmd(custom[picking])}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(event, date) => {
              setPicking(null);
              if (event.type === 'set' && date) setCustom((prev) => ({ ...prev, [picking]: ymd(date) }));
            }}
          />
        )}
      </>
    );
  }

  const footer =
    kind === 'range' && custom
      ? { primary: { title: 'Apply', onPress: () => apply({ range: { preset: 'custom', ...activityRange({ preset: 'custom', ...custom }) } }) } }
      : undefined;

  return (
    <Sheet ref={ref} title={TITLES[kind] ?? ''} footer={footer} onChange={handleSheetChange} onDismiss={resetDraft}>
      {body}
    </Sheet>
  );
});

export default ActivityFilterSheet;
