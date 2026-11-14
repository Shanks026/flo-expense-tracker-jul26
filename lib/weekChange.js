// Home's "Last 7 days" row: how this week's spending compares with the 7 days
// before it. Pure, with no React Native imports, so scripts/ledger-check.mjs
// checks it under node.
//
// - Returns null (show nothing) when the week before had under MIN_BEFORE of
//   spend: a percentage against almost nothing reads as nonsense ("4097%").
// - A change that rounds to under FLAT_PCT is "About the same", in grey, so
//   ordinary wobble doesn't flash red or green.
// - Up is `danger` (red), down is `positive` (green). Matches Insights.
// - `text` is the bare figure; the row draws a TrendingUp / TrendingDown
//   icon from `direction` beside it (none when flat).
export const MIN_BEFORE = 100;
export const FLAT_PCT = 5;
const CAP_PCT = 999;

export function weekChange(current, previous) {
  const now = Number(current);
  const before = Number(previous);
  if (!Number.isFinite(now) || !Number.isFinite(before) || before < MIN_BEFORE) return null;

  const pct = Math.round(((now - before) / before) * 100);
  const size = Math.abs(pct);
  if (size < FLAT_PCT) {
    return { direction: 'flat', tone: 'muted', text: 'About the same', label: 'About the same as the 7 days before' };
  }
  const up = pct > 0;
  const shown = size > CAP_PCT ? `${CAP_PCT}%+` : `${size}%`;
  return {
    direction: up ? 'up' : 'down',
    tone: up ? 'danger' : 'positive',
    text: shown,
    label: `${size}% ${up ? 'more' : 'less'} than the 7 days before`,
  };
}
