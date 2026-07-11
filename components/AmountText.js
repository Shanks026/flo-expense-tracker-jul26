import { Text, StyleSheet } from 'react-native';
import { colors, fontFamily, fontSize } from '../theme/tokens';

function formatNumber(value) {
  return Math.round(Math.abs(value)).toLocaleString('en-IN');
}

export default function AmountText({
  value,
  type = 'neutral',
  signed = false,
  size = fontSize.lg,
  dark = false,
  muteCurrency = false,
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
      }[type];

  let prefix = '';
  if (isNegative) prefix = '−';
  else if (signed) prefix = type === 'income' ? '+' : type === 'danger' ? '−' : '−';

  const currencyColor = dark ? colors.mutedDarker : colors.mutedLight;

  return (
    <Text style={[styles.text, { color, fontSize: size }, style]}>
      {prefix}
      <Text style={muteCurrency ? { color: currencyColor } : null}>₹</Text>
      {formatNumber(value)}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: fontFamily.extrabold,
    letterSpacing: -0.4,
  },
});
