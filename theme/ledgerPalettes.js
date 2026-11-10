// The Quiet Ledger palettes, light and dark (docs/redesign-plan.md §2.2).
// Plain data with no imports, so scripts/ledger-check.mjs can check the
// colour pairs against WCAG under node. Read them through useLedger().
//
// Neutral black and white, with colour only where it means something: money
// in (positive), warnings (danger, warn) and one small highlight mark.

// The one accent, a muted olive (2026-11-10, replacing the blue): charts,
// progress, selection marks, the switch, the caret and soft info fills.
// Defined once so `accent`, `chart` and `highlight` can't drift apart.
// Olive is decoration and meaning only: never a button fill, and never text
// on white at body size (spec 46, design tokens). Buttons stay ink.
const ACCENT_LIGHT = '#76952B';
const ACCENT_DARK = '#B5CC6A';

const LIGHT = {
  canvas: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceSunk: '#F4F4F2',
  ink: '#121211',
  inkOnInk: '#FFFFFF',
  muted: '#6E6C66',
  hairline: '#E4E1DA',
  // Money in: a deep green for cash (2026-11-10). Darker and bluer than the
  // olive so income never reads as the accent (7.1:1 on white).
  positive: '#166534',
  danger: '#B42318',
  dangerSoft: '#FDECEA',
  warn: '#B54708',
  warnSoft: '#FFF6DB',
  // Lime is gone (2026-11-10). `highlight` is now the accent, kept as a
  // name so older call sites still work; prefer `accent` for new code.
  highlight: ACCENT_LIGHT,
  // The lit flame and logged streak days only (the orange from tokens.js).
  streak: '#FF6B2C',
  // Inactive chart bars: ink at 20 %.
  inkFaint: 'rgba(18,18,17,0.2)',
  scrim: 'rgba(0,0,0,0.45)',
  // The one chart colour (Home's week line, Insights). A static olive: a
  // colour that moved with the card or the time of day would stop meaning
  // anything.
  chart: ACCENT_LIGHT,
  // The public name (spec 46): charts, progress, selection marks. `chart`
  // and `highlight` stay as aliases for code written before the spec.
  accent: ACCENT_LIGHT,
  // The accent's soft fill (the info callout). Ink text only: muted on it is
  // 4.46:1, just under AA. Against white it's 1.18:1, so a fill that marks a
  // boundary keeps a hairline edge.
  accentSoft: '#E9F0D2',
  // Segmented's selected thumb, the switch knob on the off track (`knob`)
  // and on the olive track (`knobOn`), and the faint edge that keeps them
  // visible.
  thumb: '#FFFFFF',
  knob: '#FFFFFF',
  knobOn: '#FFFFFF',
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
  positive: '#3FB97A',
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
  accentSoft: '#2A3315',
  thumb: '#171717',
  knob: '#FFFFFF',
  // A white knob on the light olive is 1.78:1; the dark knob is 10.5:1.
  knobOn: '#121211',
  thumbEdge: 'rgba(255,255,255,0.14)',
  shadow: '#000000',
};

export const ledgerPalettes = { light: LIGHT, dark: DARK };
