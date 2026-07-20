import { Text, StyleSheet } from 'react-native';
import { colors as staticColors, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { formatAmountNumber, currencySymbol } from '../lib/currency';

// `dark={true}` means "rendered on a pinned-dark surface" (inside Card's
// dark=true variant, or a permanently-dark sheet) — those branches stay on
// static colors matching that surface's own pinned darkness, not the active
// theme. The light-mode branches (the default) follow the active theme, same
// split as Button.js/Pill.js.
export default function AmountText({
  value,
  type = 'neutral',
  signed = false,
  size = fontSize.lg,
  dark = false,
  muteCurrency = false,
  currency = 'INR',
  // Overrides the muted currency-symbol tint for a positive amount only —
  // for AccountHeroCarousel's themed hero card (19-card-themes.md), whose
  // background/text swap per equipped theme, so the fixed
  // staticColors.mutedDarker/colors.mutedLight default clashes on several
  // themes. Every other AmountText call site omits this and keeps the
  // original computed tone.
  currencyColor,
  style,
}) {
  const { colors } = useTheme();
  const isNegative = value < 0;

  const color = isNegative
    ? dark
      ? staticColors.dangerStrong
      : colors.danger
    : {
        income: colors.income,
        expense: dark ? staticColors.surface : colors.ink,
        danger: colors.danger,
        neutral: dark ? staticColors.surface : colors.ink,
        // A transfer is neither a gain nor a loss — a muted tone keeps it clearly
        // apart from income-green and expense-ink. Direction shows via the ± sign.
        transfer_in: dark ? staticColors.mutedLight : colors.mutedDarker,
        transfer_out: dark ? staticColors.mutedLight : colors.mutedDarker,
      }[type];

  let prefix = '';
  if (isNegative) prefix = '−';
  else if (signed) prefix = type === 'income' || type === 'transfer_in' ? '+' : '−';

  // Muting the ₹ is a de-emphasis against a healthy figure — but on a negative
  // one it fought the number it belongs to, leaving a grey ₹ glued to a red
  // amount. A negative reading should be red all the way through, so the
  // currency simply takes the amount's own colour.
  const resolvedCurrencyColor = isNegative ? color : (currencyColor ?? (dark ? staticColors.mutedDarker : colors.mutedLight));

  return (
    <Text style={[styles.text, { color, fontSize: size }, style]}>
      {prefix}
      <Text style={muteCurrency ? { color: resolvedCurrencyColor } : null}>{currencySymbol(currency)}</Text>
      {formatAmountNumber(value, currency)}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: fontFamily.extrabold,
    letterSpacing: -0.4,
    // Fixed-width digits — without this, proportional numerals (Manrope's
    // default) shift the whole string's width as digits change, visible as a
    // jitter on the hero balance when swiping between accounts or on any
    // amount that updates in place.
    fontVariant: ['tabular-nums'],
  },
});
