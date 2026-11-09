import { Text } from 'react-native';
import { useLedger, ledgerType, tabular, inter } from '../../theme/ledger';
import { amountParts, DEFAULT_CURRENCY } from '../../lib/currency';

// One money text for the whole app (redesign §2.5):
// - sizes `display` (32, the hero), `title` (20) and `row` (14);
// - tabular figures always;
// - the sign rule and the paise rule, both from amountParts() in
//   lib/currency.js (checked by scripts/ledger-check.mjs).
const SIZES = {
  display: { ...ledgerType.display },
  title: { ...ledgerType.title },
  row: { fontFamily: inter.semibold, fontSize: 14, lineHeight: 20 },
};

export default function AmountText({
  value,
  type = 'neutral', // 'income' | 'expense' | 'neutral'
  signed = false,
  size = 'row',
  currency = DEFAULT_CURRENCY,
  color,
  style,
  ...textProps
}) {
  const { c } = useLedger();
  const { sign, tone, text } = amountParts(value, { type, signed, currency });
  const toneColor = { positive: c.positive, danger: c.danger, ink: c.ink }[tone];

  return (
    <Text style={[SIZES[size] ?? SIZES.row, tabular, { color: color ?? toneColor }, style]} {...textProps}>
      {sign}
      {text}
    </Text>
  );
}
