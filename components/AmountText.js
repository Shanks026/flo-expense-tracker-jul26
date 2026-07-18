import { Text, StyleSheet } from 'react-native';
import { colors, fontFamily, fontSize } from '../theme/tokens';
import { formatAmountNumber, currencySymbol } from '../lib/currency';

export default function AmountText({
  value,
  type = 'neutral',
  signed = false,
  size = fontSize.lg,
  dark = false,
  muteCurrency = false,
  currency = 'INR',
  style,
}) {
  const isNegative = value < 0;

  const color = isNegative
    ? dark
      ? colors.dangerStrong
      : colors.danger
    : {
        income: colors.income,
        expense: dark ? colors.surface : colors.ink,
        danger: colors.danger,
        neutral: dark ? colors.surface : colors.ink,
        // A transfer is neither a gain nor a loss — a muted tone keeps it clearly
        // apart from income-green and expense-ink. Direction shows via the ± sign.
        transfer_in: dark ? colors.mutedLight : colors.mutedDarker,
        transfer_out: dark ? colors.mutedLight : colors.mutedDarker,
      }[type];

  let prefix = '';
  if (isNegative) prefix = '−';
  else if (signed) prefix = type === 'income' || type === 'transfer_in' ? '+' : '−';

  // Muting the ₹ is a de-emphasis against a healthy figure — but on a negative
  // one it fought the number it belongs to, leaving a grey ₹ glued to a red
  // amount. A negative reading should be red all the way through, so the
  // currency simply takes the amount's own colour.
  const currencyColor = isNegative ? color : dark ? colors.mutedDarker : colors.mutedLight;

  return (
    <Text style={[styles.text, { color, fontSize: size }, style]}>
      {prefix}
      <Text style={muteCurrency ? { color: currencyColor } : null}>{currencySymbol(currency)}</Text>
      {formatAmountNumber(value, currency)}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: fontFamily.extrabold,
    letterSpacing: -0.4,
  },
});
