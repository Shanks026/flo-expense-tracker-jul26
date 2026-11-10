import { useMemo } from 'react';
import { useTheme } from './ThemeContext';

// "Quiet Ledger" design tokens (docs/redesign-plan.md §2.2–2.4). They live
// alongside theme/tokens.js and theme/themes.js, not instead of them: only
// screens built on components/ledger/ read these, so the rest of the app
// looks exactly as before until each screen is rebuilt.
//
// Neutral black and white, with colour only where it means something: money
// in (positive), warnings (danger, warn) and one small highlight mark.

// The one accent blue (charts, progress, selection marks), defined once so
// `accent`, `chart` and `highlight` can't drift apart.
const ACCENT_LIGHT = '#3B5BDB';
const ACCENT_DARK = '#8EA6FF';

const LIGHT = {
  canvas: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceSunk: '#F4F4F2',
  ink: '#121211',
  inkOnInk: '#FFFFFF',
  muted: '#6E6C66',
  hairline: '#E4E1DA',
  positive: '#1E7A46',
  danger: '#B42318',
  dangerSoft: '#FDECEA',
  warn: '#B54708',
  warnSoft: '#FFF6DB',
  // Lime is gone (2026-11-10). `highlight` is now the accent blue, kept as a
  // name so older call sites still work; prefer `chart` for new code.
  highlight: ACCENT_LIGHT,
  // The lit flame and logged streak days only (the orange from tokens.js).
  streak: '#FF6B2C',
  // Inactive chart bars: ink at 20 %.
  inkFaint: 'rgba(18,18,17,0.2)',
  scrim: 'rgba(0,0,0,0.45)',
  // The one chart colour (Home's week line, Insights). A static calm blue:
  // lime is gone, and a colour that moved with the card or the time of day
  // would stop meaning anything.
  chart: ACCENT_LIGHT,
  // The public name (spec 46): charts, progress, selection marks. `chart`
  // and `highlight` stay as aliases for code written before the spec.
  accent: ACCENT_LIGHT,
  // Segmented's selected thumb, the switch knob (white on the accent and on
  // the off track, both modes), and the faint edge that keeps either visible.
  thumb: '#FFFFFF',
  knob: '#FFFFFF',
  thumbEdge: 'rgba(0,0,0,0.12)',
  shadow: '#000000',
};

const DARK = {
  canvas: '#0B0B0B',
  surface: '#171717',
  surfaceSunk: '#1F1F1F',
  ink: '#F3F2EE',
  inkOnInk: '#121211',
  muted: '#A3A19B',
  hairline: '#2B2B28',
  positive: '#5FD394',
  danger: '#F97066',
  dangerSoft: '#3A1715',
  warn: '#FDB022',
  warnSoft: '#3A3115',
  highlight: ACCENT_DARK,
  streak: '#FF6B2C',
  inkFaint: 'rgba(243,242,238,0.2)',
  scrim: 'rgba(0,0,0,0.6)',
  chart: ACCENT_DARK,
  accent: ACCENT_DARK,
  thumb: '#171717',
  knob: '#FFFFFF',
  thumbEdge: 'rgba(255,255,255,0.14)',
  shadow: '#000000',
};

export const ledgerPalettes = { light: LIGHT, dark: DARK };

// Inter (redesign §2.3). Weights: 400 body, 500 labels, 600 titles and
// buttons, 700 only for money heroes. `extrabold` maps to 700 so nothing
// heavier sneaks in from older call sites.
export const inter = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_700Bold',
};

// §2.3 type scale, two steps under the first pass (it still read large on a
// 411 dp phone on 2026-11-10). Rows sit at 14, the size Wise and Kit use. Amounts add `tabular` (tabular figures) so columns line up.
export const ledgerType = {
  display: { fontFamily: inter.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  title: { fontFamily: inter.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  // Home's "Good evening".
  greeting: { fontFamily: inter.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.1 },
  // Section headers ("Upcoming bills"): sentence case, a touch bolder, in ink.
  section: { fontFamily: inter.semibold, fontSize: 16, lineHeight: 22, letterSpacing: -0.1 },
  // Date groups inside a list ("Today", "Sat 7 Nov").
  group: { fontFamily: inter.medium, fontSize: 12, lineHeight: 16 },
  body: { fontFamily: inter.regular, fontSize: 14, lineHeight: 20 },
  rowTitle: { fontFamily: inter.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: inter.regular, fontSize: 12, lineHeight: 16 },
  button: { fontFamily: inter.semibold, fontSize: 14, lineHeight: 18 },
  // Labels under the Home quick-action tiles.
  quickAction: { fontFamily: inter.medium, fontSize: 12, lineHeight: 16 },
};

// Deprecated (spec 46: no uppercase captions). Kept only until the Home
// preview's last call site goes with ticket 08; don't use it in new code.
export const upper = (str) => String(str).toUpperCase();

export const tabular = { fontVariant: ['tabular-nums'] };

// §2.4: a 4-pt grid.
export const ledgerSpace = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  gutter: 20,
  // Between Home's blocks. 28 left the screen feeling gappy once the type
  // shrank (2026-11-10).
  section: 24,
  rowTall: 64,
  rowShort: 52,
};

export const ledgerRadius = {
  input: 12,
  sheet: 20,
  card: 20,
  full: 999,
};

export const ledgerSize = {
  hit: 48,
  iconCircle: 40,
  button: 52,
};

// The ledger palette for the current light/dark mode. The accent axis is
// ignored on purpose: the primary is neutral ink (§2.2, accent picker off).
export function useLedger() {
  const { modeId } = useTheme();
  const c = modeId === 'dark' ? DARK : LIGHT;
  return useMemo(() => ({ c, modeId }), [c, modeId]);
}
