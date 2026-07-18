// The palette registry — 16-app-themes.md. Restructured 2026-07-18 from 7
// flat themes into two independent axes, matching how the app is actually
// built: an ACCENT (which color) and a MODE (how bright the screen is).
// `theme/tokens.js`'s existing `colors` is Brand's light-mode palette,
// re-exported verbatim so the default (lime + light) stays pixel-identical
// to the app's original look by construction, not by re-typing ~34 hex
// values and hoping nothing drifts.
import { colors as BRAND_COLORS } from './tokens';

// Keys that carry MEANING, not mood — identical across every accent AND
// every mode, always. Nobody wants "over budget" to look different
// depending on which theme is active. Spread last into the resolved color
// object so nothing above can accidentally override these by mistake.
const SEMANTIC = {
  streak: BRAND_COLORS.streak,
  streakDeep: BRAND_COLORS.streakDeep,
  rose: BRAND_COLORS.rose,
  danger: BRAND_COLORS.danger,
  dangerStrong: BRAND_COLORS.dangerStrong,
  warn: BRAND_COLORS.warn,
  warnStrong: BRAND_COLORS.warnStrong,
};

// Everything that ISN'T the accent: the full neutral scale (bg/surface/ink/
// border/muted*/chevron/completed*), the income family, and the *Bg/*Border/
// *Track pale-tint family for danger/warn/streak. These vary by MODE, not by
// which color is selected — Ocean-light and Pink-light share every one of
// these values; only `brand`/`brandBg`/`brandBgDark` (from ACCENTS below)
// differ between them.
export const MODES = {
  light: {
    id: 'light',
    name: 'Light',
    colors: {
      ...BRAND_COLORS,
      // Permanently-emphasized surface (Card's `dark` prop, hero/summary
      // cards, "New X" chip buttons) — pinned near-black so it pops against
      // a light screen, the same role sheet chrome already plays.
      emphasisBg: '#101010',
    },
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    colors: {
      ...BRAND_COLORS, // start from light mode, override only what must invert
      bg: '#0B0B0B',
      surface: '#161616',
      ink: '#F6F7F3', // primary text — now light-on-dark
      inkCard: '#242424',
      border: '#2A2A2A',
      borderSoft: '#232323',
      inputBg: '#1F1F1F',
      inputBorder: '#2A2A2A',
      chipBg: '#232323',
      iconTileBg: '#202020',
      muted: '#8f9389',
      mutedMid: '#9fa398',
      mutedLight: '#75786f',
      mutedDarker: '#c4c7bd',
      chevron: '#54564f',
      completedBg: '#1e1e1e',
      completedBorder: '#2a2a2a',
      completedTrack: '#2e2e2e',
      // The hero/summary cards this feeds will eventually carry their own
      // custom illustrations/themes (gamification track) — until then, just
      // match the same bg every other card uses in dark mode rather than
      // inventing a separate "elevated" shade.
      emphasisBg: '#161616',
      // income/incomeAccent are brightened rather than light mode's
      // medium-dark olive (#5f8a15/#7B8B0C) — that olive was tuned for
      // contrast against a white screen and reads muddy/too-dark against a
      // near-black one. Went through two revisions: a lime-leaning pass read
      // as too close to the accent color itself; an emerald (blue-green)
      // pass after that wasn't the plain "positive/money green" the app
      // already uses everywhere else — settled on a true green, same hue
      // family as light mode's own income green, just brightened for a dark
      // background. incomeBg follows the same true-green hue.
      income: '#4ADE80',
      incomeAccent: '#22C55E',
      incomeBg: '#1C3A24',
      // Each *Bg/*Border/*Track below is a dark retint of light mode's pale
      // pastel counterpart — same hue family, tuned dark instead of pale, so
      // the paired accent color stays legible sitting on top of it instead
      // of dark-on-dark.
      dangerBg: '#2E1515',
      warnBg: '#2E2410',
      streakBg: '#2E170A',
      dangerBorder: '#4A2426',
      warnBorder: '#4A3A1E',
      dangerTrack: '#3A1E1E',
    },
  },
};

// The color itself, decoupled from mode. Each accent owns three values: the
// accent color, a pale tint for an icon tile sitting on a LIGHT surface
// (IconTile's default `brand` tone), and a dark tint for one sitting on a
// PERMANENTLY-dark surface regardless of the active mode (IconTile's
// `onDark` prop — e.g. Plans' active-plan card, which is always a `Card
// dark` block even under light mode). brandBg/brandBgDark are NOT simply
// swapped based on the active mode — a light-mode screen can still have
// dark-chrome cards, which is exactly what `onDark` is for.
export const ACCENTS = {
  lime: {
    id: 'lime',
    name: 'Lime',
    brand: BRAND_COLORS.brand, // already proven on dark chrome throughout the app's own bottom sheets
    brandBg: '#F4F9D9',
    brandBgDark: '#2B3410',
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    brand: '#4A90D9',
    brandBg: '#E2EDF9',
    brandBgDark: '#162636',
  },
  violet: {
    id: 'violet',
    name: 'Violet',
    brand: '#9B7FE0',
    brandBg: '#EFEBFA',
    brandBgDark: '#201735',
  },
  amber: {
    id: 'amber',
    name: 'Amber',
    brand: '#E0A930',
    brandBg: '#FAF1DE',
    brandBgDark: '#392D14',
  },
  teal: {
    id: 'teal',
    name: 'Teal',
    brand: '#3FBFAD',
    brandBg: '#E0F5F2',
    brandBgDark: '#1A332F',
  },
  pink: {
    id: 'pink',
    name: 'Pink',
    brand: '#E8749A',
    brandBg: '#FBE9EF',
    brandBgDark: '#381420',
  },
  // A true vermillion, not a repaint of `danger` or `streak` — both of
  // which already live in this same warm corner of the wheel and were the
  // explicit thing to stay clear of. `danger` (#E5484D) carries real blue
  // (B=77), reading pink-red; this carries almost none (B=28), reading
  // orange-red. `streak` (#FF6B2C) is much lighter/brighter (L=59%,
  // fully saturated) — this sits deeper and a touch less saturated (L=50%,
  // S=78%) on purpose, an ember rather than an open flame, so the two don't
  // collide even though they share a hue neighborhood. Named "Hot Rod"
  // (renamed from "Ember" 2026-07-18) — same color, just a punchier label.
  hotrod: {
    id: 'hotrod',
    name: 'Hot Rod',
    brand: '#E3411C',
    brandBg: '#FBE1DB',
    brandBgDark: '#3F170D',
  },
};

export const DEFAULT_ACCENT_ID = 'lime';
export const DEFAULT_MODE_ID = 'light';
export const ACCENT_LIST = Object.values(ACCENTS);
export const MODE_LIST = Object.values(MODES);

// An unknown/stale id (a value from a future app version, or manual DB edit)
// degrades to the default rather than throwing — mirrors lib/currency.js's
// currencyMeta() exactly.
export function accentMeta(id) {
  return ACCENTS[id] ?? ACCENTS[DEFAULT_ACCENT_ID];
}

export function modeMeta(id) {
  return MODES[id] ?? MODES[DEFAULT_MODE_ID];
}

// The actual resolved color set a screen reads via useTheme().colors — the
// mode supplies everything, the accent overrides just the three brand keys
// on top of it, and SEMANTIC is spread last so it can never be shadowed.
//
// `brandBg` (IconTile's default, mode-FOLLOWING brand tone — a tile sitting
// on whatever card the current mode already renders) tracks the active
// mode: light mode's own cards are light, so it uses the pale tint; dark
// mode's own cards are dark, so it needs the dark tint too, or a brand-tone
// tile would wash out on an ordinary dark-mode card exactly like the
// original Dark-theme bug this fixed. `brandBgDark` stays the dark tint
// UNCONDITIONALLY — it's for a tile on a surface that's dark regardless of
// mode (IconTile's `onDark` prop, e.g. Plans' `Card dark` block, which is
// dark under light mode too).
export function resolveColors(accentId, modeId) {
  const accent = accentMeta(accentId);
  const mode = modeMeta(modeId);
  return {
    ...mode.colors,
    ...SEMANTIC,
    brand: accent.brand,
    brandBg: modeId === 'dark' ? accent.brandBgDark : accent.brandBg,
    brandBgDark: accent.brandBgDark,
  };
}
