import { useState, useEffect, useRef } from 'react';
import { Text, StyleSheet, AccessibilityInfo } from 'react-native';
import { colors as staticColors, fontFamily, fontSize } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { formatAmountNumber, currencySymbol } from '../lib/currency';

// `dark={true}` means "rendered on a pinned-dark surface" (inside Card's
// dark=true variant, or a permanently-dark sheet) — those branches stay on
// static colors matching that surface's own pinned darkness, not the active
// theme. The light-mode branches (the default) follow the active theme, same
// split as Button.js/Pill.js.
//
// `animate={true}` (opt-in, default off — every existing call site is
// unchanged) counts the NUMBER up on mount and rolls it on any later value
// change, reusing components/CountUp.js's rAF + easeOutCubic + snap-on-reduce-
// motion pattern. Only the numeric part animates: the sign prefix, ₹ symbol,
// and colour all stay derived from the real `value`, so a count toward a
// negative balance still reads red with a leading −. Intermediate frames are
// rounded to whole units (no flickering paise); the final frame snaps to the
// exact value so any real decimals survive.
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
  animate = false,
  animateDuration = 1100,
  // Bumping animateKey replays the count from 0 even when `value` is unchanged
  // — e.g. pull-to-refresh, which refetches without remounting this component.
  // A plain value change (no key change) rolls from the current number instead,
  // so adding a transaction doesn't fly the balance up from 0. Undefined = only
  // mount and value changes animate.
  animateKey,
  // Passthrough to the underlying <Text> so amount surfaces (the hero card
  // especially) can keep very large values — 10+ digits, e.g. ₹9,99,99,99,999 —
  // on a single line by shrinking to fit rather than wrapping mid-number or
  // clipping. All default undefined, so every existing call site keeps its
  // current wrapping behaviour untouched.
  adjustsFontSizeToFit,
  numberOfLines,
  minimumFontScale,
  style,
}) {
  const { colors } = useTheme();
  const isNegative = value < 0;

  // ANIMATE-FIRST, snap-on-reduce (same reasoning as CountUp.js): the count
  // starts immediately rather than waiting for the async reduce-motion check
  // to resolve; if it comes back true, jump straight to the final value.
  const [display, setDisplay] = useState(animate ? 0 : value);
  const displayRef = useRef(animate ? 0 : value);
  const prevKeyRef = useRef(animateKey);

  useEffect(() => {
    if (!animate) {
      displayRef.current = value;
      setDisplay(value);
      return;
    }
    // A changed animateKey means "replay from 0" (pull-to-refresh); an unchanged
    // key with a new value means "roll from where we are" (a balance update). On
    // mount the key is unchanged and displayRef is already 0, so the first count
    // starts at 0 too.
    const keyChanged = prevKeyRef.current !== animateKey;
    prevKeyRef.current = animateKey;
    if (keyChanged) {
      displayRef.current = 0;
      setDisplay(0);
    }
    const from = keyChanged ? 0 : displayRef.current;
    const to = value;
    let raf;
    let start = null;
    let cancelled = false;

    const tick = (t) => {
      if (cancelled) return;
      if (start === null) start = t;
      const progress = Math.min(1, (t - start) / animateDuration);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      if (progress < 1) {
        const cur = Math.round(from + (to - from) * eased);
        displayRef.current = cur;
        setDisplay(cur);
        raf = requestAnimationFrame(tick);
      } else {
        // Exact final value (not rounded) so real decimals survive.
        displayRef.current = to;
        setDisplay(to);
      }
    };
    raf = requestAnimationFrame(tick);

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (cancelled || !reduce) return;
        if (raf) cancelAnimationFrame(raf);
        displayRef.current = to;
        setDisplay(to);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [value, animate, animateDuration, animateKey]);

  const shownValue = animate ? display : value;

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
        // A split settlement is the same kind of thing as a transfer for
        // display purposes: money genuinely moved, but it is neither a gain
        // nor a loss to account for. Same muted tone, direction via the ±.
        // Crucially NOT income-green — the whole point of the settle types is
        // that money coming back from a split isn't earnings.
        settle_in: dark ? staticColors.mutedLight : colors.mutedDarker,
        settle_out: dark ? staticColors.mutedLight : colors.mutedDarker,
      }[type];

  let prefix = '';
  if (isNegative) prefix = '−';
  else if (signed) prefix = type === 'income' || type === 'transfer_in' || type === 'settle_in' ? '+' : '−';

  // Muting the ₹ is a de-emphasis against a healthy figure — but on a negative
  // one it fought the number it belongs to, leaving a grey ₹ glued to a red
  // amount. A negative reading should be red all the way through, so the
  // currency simply takes the amount's own colour.
  const resolvedCurrencyColor = isNegative ? color : (currencyColor ?? (dark ? staticColors.mutedDarker : colors.mutedLight));

  return (
    <Text
      style={[styles.text, { color, fontSize: size }, style]}
      adjustsFontSizeToFit={adjustsFontSizeToFit}
      numberOfLines={numberOfLines}
      minimumFontScale={minimumFontScale}
    >
      {prefix}
      <Text style={muteCurrency ? { color: resolvedCurrencyColor } : null}>{currencySymbol(currency)}</Text>
      {formatAmountNumber(shownValue, currency)}
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
