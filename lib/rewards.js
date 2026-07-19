// The gamification economy's tuning file — 18-gamification-ritual-and-ledger.md.
// Every earn/spend amount and the level curve live here, pure (no React/
// Supabase imports), same discipline as lib/streak.js. All numbers below are
// ILLUSTRATIVE ("ratios, not gospel" — IDEAS-gamification.md) — tune here,
// nowhere else. What's actually fixed are the four invariants:
//
//   1. A logged day out-earns every other state, in both coins and XP.
//   2. A no-spend day earns ZERO coins (XP only) — or the app pays users to
//      stop tracking, which rots the ledger the whole app is built on.
//   3. The freeze-comeback reward is one-time and below a logged day's.
//   4. Coins stay scarce against shop sinks; XP inflates freely (it's the
//      vanity/level ladder, not spendable).

// Phase 2 wires `dailyLog` today. `noSpend`/`freezeComeback` are defined now
// (single source of truth for every later phase) but not yet earned by
// anything — Phase 3 wires noSpend, Phase 4 wires freezeComeback.
export const REWARDS = {
  dailyLog: { coins: 25, xp: 100 },
  noSpend: { coins: 0, xp: 40 },
  freezeComeback: { coins: 25, xp: 50 },
};

// Freeze economy constants (Phase 4). Defined here now so the shop price and
// the coin-earn rate above can be tuned against each other from one file.
export const FREEZE_COST = 500;
export const FREEZE_CAP = 5;

// Streak-milestone lump sums (Phase 5), keyed by the same MILESTONES days as
// lib/streak.js. { coins, freezes }. freezes is 0 for tiers that don't grant one.
// 200/365/500/1000 added 19-card-themes.md Phase 2 (the ladder extension) —
// each also grants a Legendary card theme via MILESTONE_THEME_GRANTS below,
// which is most of the reward at that tier; the coin/freeze lump stays on
// the same scaling curve as 3-100 rather than trying to out-earn the theme.
export const MILESTONE_REWARDS = {
  3: { coins: 50, freezes: 0 },
  7: { coins: 100, freezes: 1 },
  10: { coins: 150, freezes: 0 },
  30: { coins: 400, freezes: 1 },
  50: { coins: 600, freezes: 0 },
  100: { coins: 1500, freezes: 3 },
  200: { coins: 2500, freezes: 0 },
  365: { coins: 4000, freezes: 2 },
  500: { coins: 6000, freezes: 0 },
  1000: { coins: 12000, freezes: 5 },
};

// Which Legendary card theme (lib/cardThemes.js) a milestone day
// auto-grants, keyed by the same MILESTONES days above. Read by
// claimMilestone (lib/rewardsMutations.js) — kept here, not in
// cardThemes.js, so the milestone→reward mapping has one home instead of
// being split across two files.
// 500 → 'velvet' (was 'aurora') — swapped with the day-50 chest pool per
// direct feedback (2026-07-20), see lib/cardThemes.js's own comment.
export const MILESTONE_THEME_GRANTS = {
  100: 'gold-foil',
  200: 'onyx',
  365: 'platinum',
  500: 'velvet',
  1000: 'diamond',
};

// Money Level — a curve over lifetime XP (Σ of every reward_events.xp row,
// which is monotonic since XP is never spent). Cumulative XP required to
// REACH level L: 150 * L^1.6, rounded. Early levels come fast (front-loaded
// dopamine for a new user); gaps widen as L grows. Tune the exponent/
// multiplier here — nothing downstream cares how this curve is shaped, only
// that levelFromXp is monotonic non-decreasing in xp.
const LEVEL_BASE = 150;
const LEVEL_EXPONENT = 1.6;

function xpForLevel(level) {
  if (level <= 1) return 0;
  return Math.round(LEVEL_BASE * Math.pow(level, LEVEL_EXPONENT));
}

// Pure. Takes lifetime XP (a non-negative number) and returns the level it
// lands in plus enough to render a progress bar toward the next one.
//
// `xpIntoLevel`/`xpForNext` are a RELATIVE delta pair (both reset toward 0 at
// the start of every level) — kept only because `progress` (the 0–1 bar
// fill) is defined in terms of them and nothing else needs to change that
// math. `nextLevelAt` is the field any DISPLAY should actually read: the
// absolute lifetime-XP threshold for the next level. XP is documented
// elsewhere in this file as monotonic — only ever earned, never spent — so a
// UI showing `xpIntoLevel` next to a Rank badge reads as if XP just reset on
// every level-up, which contradicts that. Pairing the real lifetime total
// (already available separately, e.g. useRewards().xp) with `nextLevelAt`
// gives a fraction that only ever climbs, with the cap simply getting
// further away each time it's crossed — caught on-device, see
// 18-gamification-ritual-and-ledger.md Phase 5's Implementation Notes.
export function levelFromXp(xp) {
  const safeXp = Math.max(0, Number(xp) || 0);
  let level = 1;
  // A user-scale search (levels stay in the low hundreds at most for any
  // realistic lifetime XP) — no need for a closed-form inverse.
  while (xpForLevel(level + 1) <= safeXp) {
    level += 1;
  }
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  const xpIntoLevel = safeXp - floor;
  const xpForNext = ceiling - floor;
  return {
    level,
    xpIntoLevel,
    xpForNext,
    nextLevelAt: ceiling,
    progress: xpForNext > 0 ? xpIntoLevel / xpForNext : 0,
  };
}

// Rank ladder (Phase 5) — a named band spanning many levels, arriving with a
// badge. `badgeColor` is a placeholder for real badge art (same single-`Award`
// -icon-recoloured-per-tier approach the reference mockup used) — every
// consumer (MenuSheet's levelCard, the Trophy Room's rank section,
// RankUpCelebration) reads `badgeColor` off the rank object rather than
// hardcoding a palette per tier, so swapping in real illustrated badges later
// is a one-file change here, not a hunt across components.
export const RANKS = [
  { id: 'saver', title: 'Saver', minXp: 0, badgeColor: '#9a9e94' },
  { id: 'bookkeeper', title: 'Bookkeeper', minXp: 1500, badgeColor: '#8a7a5c' },
  { id: 'steward', title: 'Steward', minXp: 5000, badgeColor: '#a8a8ac' },
  { id: 'strategist', title: 'Strategist', minXp: 12000, badgeColor: '#7B8B0C' },
  { id: 'treasurer', title: 'Treasurer', minXp: 25000, badgeColor: '#4FC3E8' },
  { id: 'financier', title: 'Financier', minXp: 50000, badgeColor: '#9B7FE0' },
  { id: 'tycoon', title: 'Tycoon', minXp: 90000, badgeColor: '#E0A930' },
  { id: 'magnate', title: 'Magnate', minXp: 150000, badgeColor: '#E8749A' },
  { id: 'money_master', title: 'Money Master', minXp: 250000, badgeColor: '#D4AF37' },
];

export function rankFromXp(xp) {
  const safeXp = Math.max(0, Number(xp) || 0);
  let current = RANKS[0];
  let next = RANKS[1] ?? null;
  for (let i = 0; i < RANKS.length; i++) {
    if (RANKS[i].minXp <= safeXp) {
      current = RANKS[i];
      next = RANKS[i + 1] ?? null;
    }
  }
  return {
    current,
    next,
    xpToNext: next ? next.minXp - safeXp : 0,
  };
}
