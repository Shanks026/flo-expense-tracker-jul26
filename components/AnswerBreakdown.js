import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { format, parseISO } from 'date-fns';
import ListRow from './ledger/ListRow';
import CategoryIcon from './CategoryIcon';
import { useLedger, ledgerType, ledgerSpace, inter, tabular } from '../theme/ledger';

// A breakdown from one of Ask FLO's tool results (44-ai-assistant.md, "Rich
// answers"), as flat ledger rows (spec 49, ticket 07; replaced the old
// table). Everything it shows is the tool's own output: the labels,
// the ₹ strings and the total, so the model never types a number that lands
// here.

const KINDS = [
  { key: 'by_day', col: 'Day', label: (r) => format(parseISO(r.day), 'EEE d MMM') },
  { key: 'by_week', col: 'Week', label: (r) => `Week of ${format(parseISO(r.week_starting), 'd MMM')}` },
  { key: 'by_month', col: 'Month', label: (r) => format(parseISO(`${r.month}-01`), 'MMM yyyy') },
  { key: 'by_category', col: 'Category', label: (r) => r.category },
];

// tool_calls (the stored tool log) → the breakdowns worth drawing, in order:
// [{ kind, col, rows: [{ label, total, value, count }], total, count, type, period }]
export function breakdownsFrom(toolCalls) {
  if (!Array.isArray(toolCalls)) return [];
  const out = [];
  const seen = new Set(); // the same breakdown asked twice in a turn draws once
  for (const call of toolCalls) {
    const result = call?.result;
    if (!result || typeof result !== 'object') continue;
    for (const kind of KINDS) {
      const list = result[kind.key];
      if (!Array.isArray(list) || list.length < 2) continue; // one row says nothing a sentence doesn't
      try {
        const id = JSON.stringify([kind.key, result.start, result.end, result.categories_counted, result.account, list]);
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({
          kind: kind.key,
          col: kind.col,
          rows: list.map((r) => ({
            // The function's own label, which the answer quotes; this
            // version's formatting only for answers stored before it had one.
            label: typeof r.label === 'string' ? r.label : kind.label(r),
            total: String(r.total ?? ''),
            value: Number(r.value) || 0,
            count: Number(r.count) || 0,
          })),
          total: String(result.total ?? ''),
          count: result.count,
          type: result.type,
          period: String(result.period ?? ''),
        });
      } catch {
        // A row in a shape this version doesn't know: skip the table, keep the answer.
      }
    }
  }
  return out;
}

// A caption ("Spent by category"), a ListRow per line (a category's own
// tinted circle when the row is one of the person's categories, matched by
// name, since the tool's rows carry only the name), and a 600-weight total.
// `categoriesByName` comes from the chat screen, fetched once for every
// answer.
export default function AnswerBreakdown({ table, categoriesByName }) {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const verb = table.type === 'income' ? 'Received' : 'Spent';

  return (
    <View style={styles.wrap} accessibilityLabel={`${table.col} breakdown, ${table.period}`}>
      <Text style={styles.caption}>
        {verb} by {table.col.toLowerCase()}
        {table.period ? ` · ${table.period}` : ''}
      </Text>
      {table.rows.map((r, i) => {
        const cat = table.kind === 'by_category' ? categoriesByName?.get(r.label) : null;
        return (
          <ListRow
            key={`${r.label}-${i}`}
            tone={cat?.color ?? undefined}
            renderIcon={cat ? (tint) => <CategoryIcon icon={cat.icon} size={18} color={tint} strokeWidth={1.75} /> : undefined}
            title={r.label}
            sub={r.count === 1 ? '1 entry' : `${r.count} entries`}
            right={<Text style={styles.money}>{r.total}</Text>}
          />
        );
      })}
      <View style={styles.totalRow}>
        <Text style={styles.money}>Total</Text>
        <Text style={styles.money}>{table.total}</Text>
      </View>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    wrap: {
      marginTop: ledgerSpace.md,
    },
    caption: {
      ...ledgerType.caption,
      color: c.muted,
    },
    money: {
      ...ledgerType.rowTitle,
      ...tabular,
      fontFamily: inter.semibold,
      color: c.ink,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: ledgerSpace.md,
    },
  });
}
