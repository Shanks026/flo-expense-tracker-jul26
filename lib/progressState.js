// ProgressBar's rule (spec 46, redesign §2.5): how full the bar is and which
// colour it takes, from a used/limit ratio (0.85 = 85 %). Pure, with no React
// Native imports, so scripts/ledger-check.mjs checks it under node.
//
// - `accent` up to and including 80 %;
// - `warn` past 80 %, up to and including 100 % (spent exactly the limit is
//   "almost out", not over);
// - `danger` past 100 %.
// `fill` is the width as 0..1: an overspent bar is simply full, in danger.
// `pct` is the whole ratio as a rounded percentage (120 when 20 % over), for
// TalkBack and labels.
const WARN_PAST = 0.8;
const DANGER_PAST = 1;

export function progressState(ratio) {
  const r = Number(ratio);
  if (!Number.isFinite(r) || r <= 0) return { tone: 'accent', fill: 0, pct: 0 };
  const tone = r > DANGER_PAST ? 'danger' : r > WARN_PAST ? 'warn' : 'accent';
  return { tone, fill: Math.min(r, 1), pct: Math.round(r * 100) };
}
