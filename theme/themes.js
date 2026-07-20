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
  coinGold: BRAND_COLORS.coinGold,
  iceBlue: BRAND_COLORS.iceBlue,
  iceBlueBg: BRAND_COLORS.iceBlueBg,
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
    // Brightened from #4A90D9 — same hue (~211°), lightness bumped ~57%→64%
    // and saturation nudged up to compensate, so it doesn't just look
    // washed-out lighter, it reads as a livelier blue.
    brand: '#65A3E2',
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

  // Expanded palette (22-coin-store-and-reward-tiering.md, post-Phase-3) —
  // colors drawn from the new card themes, spread around the wheel to fill
  // gaps in the original 7. All available to everyone from day 1 (accents are
  // never gated — see 16-app-themes.md). Tints (brandBg pale / brandBgDark
  // dark) were generated to the same targets the original 7 use, so they read
  // right on light and dark surfaces alike.
  //
  // `modes` (optional) — which screen modes an accent is legible in. Omitted =
  // both (the default; the original 7 all work either way). A pale accent
  // (Ash/Cream) can't be seen as brand-colored text/icons on a light screen,
  // so it's marked dark-only; the picker locks it in the wrong mode, and
  // resolveColors falls back to the default accent if one is ever active in an
  // unsupported mode (see accentSupportsMode below).
  crimson: { id: 'crimson', name: 'Crimson', brand: '#D42A4E', brandBg: '#F7E3E7', brandBgDark: '#39131B' },
  merlot: { id: 'merlot', name: 'Merlot', brand: '#9E2749', brandBg: '#F7E3E9', brandBgDark: '#39131E' },
  coral: { id: 'coral', name: 'Coral', brand: '#F0705A', brandBg: '#F7E6E3', brandBgDark: '#391913' },
  tangerine: { id: 'tangerine', name: 'Tangerine', brand: '#F5842E', brandBg: '#F7ECE3', brandBgDark: '#392413' },
  marigold: { id: 'marigold', name: 'Marigold', brand: '#F2B01F', brandBg: '#F7F1E3', brandBgDark: '#392D13' },
  emerald: { id: 'emerald', name: 'Emerald', brand: '#22B26C', brandBg: '#E3F7ED', brandBgDark: '#133927' },
  lagoon: { id: 'lagoon', name: 'Lagoon', brand: '#1FC2C4', brandBg: '#E3F7F7', brandBgDark: '#133939' },
  glacier: { id: 'glacier', name: 'Glacier', brand: '#35B6E0', brandBg: '#E3F2F7', brandBgDark: '#133039' },
  cobalt: { id: 'cobalt', name: 'Cobalt', brand: '#3F5FD9', brandBg: '#E3E7F7', brandBgDark: '#131B39' },
  amethyst: { id: 'amethyst', name: 'Amethyst', brand: '#8E44D4', brandBg: '#EDE3F7', brandBgDark: '#271339' },
  orchid: { id: 'orchid', name: 'Orchid', brand: '#C94F9E', brandBg: '#F7E4F0', brandBgDark: '#39132C' },
  blossom: { id: 'blossom', name: 'Blossom', brand: '#D98FC9', brandBg: '#F6E4F2', brandBgDark: '#391331' },
  rosewood: { id: 'rosewood', name: 'Rosewood', brand: '#C67C6E', brandBg: '#F5E8E5', brandBgDark: '#371B16' },
  slate: { id: 'slate', name: 'Slate', brand: '#6E7C8C', brandBg: '#EBEDEF', brandBgDark: '#22262B' },

  // Off-whites — pale by design, so they only read as an accent against a DARK
  // screen. Marked dark-only; locked in the light-mode picker.
  ash: { id: 'ash', name: 'Ash', brand: '#C4C8CE', brandBg: '#EEEFF1', brandBgDark: '#26282B', modes: ['dark'] },
  cream: { id: 'cream', name: 'Cream', brand: '#E8DCC0', brandBg: '#F5F1E8', brandBgDark: '#2C2820', modes: ['dark'] },
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

// Which modes an accent is legible in — defaults to both when `modes` is
// unspecified (every accent except the pale off-whites). Accepts an accent
// object or an id.
export function accentSupportsMode(accent, modeId) {
  const a = typeof accent === 'string' ? accentMeta(accent) : accent;
  return (a?.modes ?? ['light', 'dark']).includes(modeId);
}

// Human caption for a mode-restricted accent ("Dark mode only" / "Light mode
// only"), or null when it works in both — the picker uses this to caption a
// locked swatch.
export function accentModeLabel(accent) {
  const modes = accent?.modes;
  if (!modes || modes.length >= 2) return null;
  return modes[0] === 'dark' ? 'Dark mode only' : 'Light mode only';
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
  let accent = accentMeta(accentId);
  const mode = modeMeta(modeId);
  // Safety net (22-coin-store-and-reward-tiering.md): a mode-restricted accent
  // (Ash/Cream, dark-only) can end up ACTIVE in an unsupported mode — e.g. the
  // user picks it in dark mode, then flips to light via the appearance toggle.
  // Rather than paint unreadable pale brand-colored text/icons on a light
  // screen, fall back to the default accent for that render. Fully reversible:
  // switch back to the supported mode and the chosen accent returns (accentId
  // itself is never mutated). The picker also locks such accents in the wrong
  // mode, so this only fires for the toggle-after-picking path.
  if (!accentSupportsMode(accent, mode.id)) accent = accentMeta(DEFAULT_ACCENT_ID);
  return {
    ...mode.colors,
    ...SEMANTIC,
    brand: accent.brand,
    brandBg: modeId === 'dark' ? accent.brandBgDark : accent.brandBg,
    brandBgDark: accent.brandBgDark,
  };
}
