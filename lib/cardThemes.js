import { withOpacity } from './color';

// Card theme catalog — 19-card-themes.md Phase 1. Pure data, no React/
// Supabase imports (same discipline as lib/rewards.js). The hero card and
// the Shop screen both read this file as their single source of truth for
// every theme's look/price; the DB only ever stores which ids a user owns
// and which one is equipped (see hooks/useCardThemes.js).
//
// `background` is one of:
//   { type: 'solid', color }
//   { type: 'linear', angle, colors: [c1, c2, ...] }  — CSS-style angle
//   { type: 'pattern', base, kind: 'grid'|'lines'|'weave'|'blotch'|'glow', line?, accent? }
// Rendered by components/CardThemeSurface.js.

// Coin-purchasable tiers — the Shop's buyable grid (Phase 1).
export const TIERS = ['free', 'common', 'rare'];

// Never purchasable — auto-granted (legendary: a streak milestone; chest: a
// deterministic pick-one-of-3 chest). Shown in the Shop as a separate,
// locked section (Phase 2). See `unlock` on each theme below for how.
export const LOCKED_TIERS = ['legendary', 'chest'];

export const TIER_LABELS = {
  free: 'Free',
  common: 'Common',
  rare: 'Rare',
  legendary: 'Legendary',
  chest: 'Chest-exclusive',
};

// Every theme's `mutedColor` (subtext + the muted ₹ currency symbol) is
// `textColor` at this opacity — a real alpha composite, not a separately
// hand-picked grey — per direct feedback (2026-07-20): a flat muted hex
// chosen against one assumed background doesn't necessarily read right
// against every theme's own background (solid/gradient/pattern alike),
// where a genuine translucent tint of the theme's own text color always
// does. Applied uniformly below via the map at the bottom of this file —
// no theme entry sets its own `mutedColor` directly.
const MUTED_OPACITY = 0.62;

// Raw catalog — every field except the derived `mutedColor` (added by the
// CARD_THEMES map below).
const THEMES_RAW = [
  // Free — owned by everyone, no reward_events row needed. Ink must
  // pixel-match the pre-feature hardcoded hero card exactly.
  {
    id: 'ink',
    name: 'Ink',
    tier: 'free',
    cost: 0,
    background: { type: 'solid', color: '#101010' },
    textColor: '#FFFFFF',
    chipColor: '#BBDC12',
  },
  {
    id: 'lime-flood',
    name: 'Lime Flood',
    tier: 'free',
    cost: 0,
    background: { type: 'solid', color: '#BBDC12' },
    textColor: '#101010',
    chipColor: '#101010',
  },

  // Common — 400 coins each.
  {
    id: 'blueprint',
    name: 'Blueprint',
    tier: 'common',
    cost: 400,
    background: { type: 'pattern', base: '#17263A', kind: 'grid', line: '#ffffff26' },
    textColor: '#FFFFFF',
    chipColor: '#8Fb8e8',
  },
  {
    id: 'receipt',
    name: 'Receipt',
    tier: 'common',
    cost: 400,
    background: { type: 'pattern', base: '#F3EFE2', kind: 'lines', line: '#00000014' },
    textColor: '#101010',
    chipColor: '#101010',
  },
  {
    id: 'dusk',
    name: 'Dusk',
    tier: 'common',
    cost: 400,
    background: { type: 'linear', angle: 150, colors: ['#3a2a6a', '#12101f'] },
    textColor: '#FFFFFF',
    chipColor: '#c9b8f0',
  },
  {
    id: 'ocean-deep',
    name: 'Ocean Deep',
    tier: 'common',
    cost: 400,
    background: { type: 'linear', angle: 150, colors: ['#0d2436', '#1a5a6a'] },
    textColor: '#FFFFFF',
    chipColor: '#7fd6c9',
  },
  {
    id: 'ember',
    name: 'Ember',
    tier: 'common',
    cost: 400,
    background: { type: 'pattern', base: '#1f150f', kind: 'glow', accent: '#ff7a3d' },
    textColor: '#FFFFFF',
    chipColor: '#ff8c4a',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    tier: 'common',
    cost: 400,
    background: { type: 'linear', angle: 100, colors: ['#4a4d52', '#2c2e31', '#55585c', '#2c2e31'] },
    textColor: '#FFFFFF',
    chipColor: '#b8bcc0',
  },
  {
    id: 'mint-ledger',
    name: 'Mint Ledger',
    tier: 'common',
    cost: 400,
    background: { type: 'pattern', base: '#E4F3E9', kind: 'lines', line: '#00000010' },
    textColor: '#14301f',
    chipColor: '#1f6b46',
  },

  // Rare — 800-1,000 coins.
  {
    id: 'titanium',
    name: 'Titanium',
    tier: 'rare',
    cost: 800,
    background: { type: 'linear', angle: 120, colors: ['#7d8186', '#3c3e42', '#6a6d72', '#3c3e42'] },
    textColor: '#FFFFFF',
    chipColor: '#d8dbe0',
  },
  {
    id: 'carbon-fiber',
    name: 'Carbon Fiber',
    tier: 'rare',
    cost: 800,
    background: { type: 'pattern', base: '#1a1c1f', kind: 'weave', line: '#ffffff1f' },
    textColor: '#FFFFFF',
    chipColor: '#9aa0a6',
  },
  {
    id: 'marble',
    name: 'Marble',
    tier: 'rare',
    cost: 900,
    // Redone per direct feedback (2026-07-20) — was a pale base + a
    // BLACK-tinted blotch overlay (`accent: '#0000001a'`), which read as
    // grey/dirty rather than polished stone. Now a warm multi-stop gradient
    // (ivory → beige → light brown → back to ivory) — Botticino/cream
    // marble's actual palette, and a gradient reads as "polished sheen" the
    // flat blotch pattern didn't.
    background: { type: 'linear', angle: 125, colors: ['#F5EEDD', '#E8D4B0', '#D9C098', '#F0E8D0'] },
    textColor: '#292520',
    chipColor: '#c9a94b',
  },
  {
    id: 'rose-gold',
    name: 'Rose Gold',
    tier: 'rare',
    cost: 1000,
    background: { type: 'linear', angle: 150, colors: ['#e8b7a0', '#c98b78'] },
    textColor: '#3d251d',
    chipColor: '#7a4b3c',
  },
  {
    id: 'copper',
    name: 'Copper',
    tier: 'rare',
    cost: 800,
    background: { type: 'linear', angle: 140, colors: ['#b5651d', '#e0925a', '#8a4513'] },
    textColor: '#2c1608',
    chipColor: '#3d2410',
  },
  {
    id: 'denim',
    name: 'Denim',
    tier: 'rare',
    cost: 900,
    background: { type: 'pattern', base: '#2b3a55', kind: 'weave', line: '#ffffff1a' },
    textColor: '#FFFFFF',
    chipColor: '#c9d4e8',
  },
  {
    id: 'lava',
    name: 'Lava',
    tier: 'rare',
    cost: 850,
    // Built to match FLO's own "hot red" — the streak system's colors
    // (theme/tokens.js: streak '#FF6B2C', streakDeep '#D9480F'), not an
    // arbitrary fire palette. Charred-rock-to-molten gradient, biased dark
    // overall (stops short of the brightest streak orange as a full stop)
    // so white text stays legible across the whole card — a lighter-weighted
    // version washed out. `chipColor` IS the app's actual streak orange,
    // tying the chip directly back to the flame motif.
    background: { type: 'linear', angle: 155, colors: ['#140502', '#3d0f02', '#7a2205', '#D9480F'] },
    textColor: '#FFFFFF',
    chipColor: '#FF6B2C',
  },

  // Legendary — Phase 2. Never purchasable; auto-granted the moment the
  // matching MILESTONES day (lib/streak.js) is crossed, via
  // MILESTONE_THEME_GRANTS (lib/rewards.js) → claimMilestone
  // (lib/rewardsMutations.js). `unlock` describes the condition shown in
  // the Shop's locked section, not a purchase path.
  {
    id: 'gold-foil',
    name: 'Gold Foil',
    tier: 'legendary',
    unlock: { type: 'milestone', day: 100 },
    background: { type: 'linear', angle: 135, colors: ['#b8860b', '#f5d76e', '#d4a017', '#8a6608'] },
    textColor: '#2c2005',
    chipColor: '#3a2c08',
  },
  {
    id: 'onyx',
    name: 'Onyx',
    tier: 'legendary',
    unlock: { type: 'milestone', day: 200 },
    // Reworked per direct feedback (2026-07-20) — a flat white glow "didn't
    // sit tight." `colors` sweeps through a prismatic sequence (white →
    // violet → cyan → gold) before fading out, closer to the original
    // "prismatic edge glow" concept than one plain tint — the animated
    // sweep itself is still deferred (static rendering only, both phases).
    background: { type: 'pattern', base: '#0a0a0c', kind: 'glow', colors: ['#ffffff', '#c3a6f6', '#a6e3e9', '#f6d365'] },
    textColor: '#FFFFFF',
    chipColor: '#FFFFFF',
  },
  {
    id: 'platinum',
    name: 'Platinum',
    tier: 'legendary',
    unlock: { type: 'milestone', day: 365 },
    background: { type: 'linear', angle: 135, colors: ['#dfe4e8', '#b8c0c6', '#eef1f3'] },
    textColor: '#2c2f32',
    chipColor: '#6a7076',
  },
  {
    id: 'velvet',
    name: 'Velvet',
    // Swapped with Aurora per direct feedback (2026-07-20) — was
    // chest-exclusive (day 50), now legendary (day 500), taking Aurora's
    // old milestone slot exactly (same day, just a different theme).
    tier: 'legendary',
    unlock: { type: 'milestone', day: 500 },
    background: { type: 'linear', angle: 150, colors: ['#3d0f1f', '#1a0810'] },
    textColor: '#FFFFFF',
    chipColor: '#e08fae',
  },
  {
    id: 'diamond',
    name: 'Diamond',
    tier: 'legendary',
    unlock: { type: 'milestone', day: 1000 },
    background: { type: 'linear', angle: 115, colors: ['#eaf6fb', '#ffffff', '#d8ecf5', '#ffffff', '#eaf6fb'] },
    textColor: '#123a4a',
    chipColor: '#4fc3e8',
  },

  // Chest-exclusive — Phase 2. The deterministic pick-1-of-3 chest at day 30
  // (offers this or a coin/freeze bundle) and day 50 (same shape, this
  // theme instead) — see components/MilestoneChest.js. Never purchasable,
  // never milestone-auto-granted on their own.
  {
    id: 'holographic',
    name: 'Holographic',
    tier: 'chest',
    unlock: { type: 'chest', day: 30 },
    background: { type: 'linear', angle: 200, colors: ['#f6d365', '#a6e3e9', '#c3a6f6', '#f6a6c1', '#f6d365'] },
    textColor: '#1a1a1a',
    chipColor: '#ffffffcc',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    // Swapped with Velvet per direct feedback (2026-07-20) — was legendary
    // (day 500), now chest-exclusive (day 50), taking Velvet's old chest
    // slot exactly.
    tier: 'chest',
    unlock: { type: 'chest', day: 50 },
    // accent3 added per direct feedback (2026-07-20) — a slight bluish-green
    // (teal) touch alongside the existing green/purple blotches.
    background: { type: 'pattern', base: '#050414', kind: 'blotch', accent: '#4fc38a', accent2: '#9b7fe0', accent3: '#2ec4b6' },
    textColor: '#FFFFFF',
    chipColor: '#7fe0c9',
  },
];

// The catalog every consumer actually reads — each raw entry plus its
// derived `mutedColor` (see MUTED_OPACITY above). Deriving it here, once,
// for every theme is what guarantees "opacity, not a separate color" holds
// for all of them, not just the ones someone remembered to compute it for.
export const CARD_THEMES = THEMES_RAW.map((t) => ({ ...t, mutedColor: withOpacity(t.textColor, MUTED_OPACITY) }));

const THEMES_BY_ID = new Map(CARD_THEMES.map((t) => [t.id, t]));

// Falls back to Ink for an unrecognized id — defensive against a theme
// being renamed/removed after a user already equipped it.
export function getTheme(id) {
  return THEMES_BY_ID.get(id) ?? THEMES_BY_ID.get('ink');
}
