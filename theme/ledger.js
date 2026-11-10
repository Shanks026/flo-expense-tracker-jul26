import { useMemo } from 'react';
import { useTheme } from './ThemeContext';
import { ledgerPalettes } from './ledgerPalettes';

// "Quiet Ledger" design tokens (docs/redesign-plan.md §2.2–2.4). They live
// alongside theme/tokens.js and theme/themes.js, not instead of them: only
// screens built on components/ledger/ read these, so the rest of the app
// looks exactly as before until each screen is rebuilt.
//
// The palettes live in ledgerPalettes.js (plain data, checked against WCAG
// by scripts/ledger-check.mjs).
export { ledgerPalettes };
const { light: LIGHT, dark: DARK } = ledgerPalettes;

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
