import { MILESTONES } from './streak';

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
// FREEZE_COST raised 500 → 3,000 (22-coin-store-and-reward-tiering.md Phase 2)
// as the streak-cheat fix that unblocks purchasable coins (Phase 3): it sits
// ABOVE two ₹99/1,200-coin packs (2,400) and the ₹199/2,700-coin pack, so no
// single affordable pack buys a freeze — a buyer must grind by logging or jump
// tiers, keeping "engagement is the cheapest path to a freeze."
export const FREEZE_COST = 3000;
export const FREEZE_CAP = 5;

// When a freeze grant (milestone/spin/trophy) would push the holder over
// FREEZE_CAP, each freeze that can't fit converts to this many coins instead
// of being silently dropped (22-coin-store-and-reward-tiering.md Phase 2).
// 500 is ~1/6 of a bought freeze — a fair consolation, not a second way to
// stockpile. Applied uniformly by clampFreezeGrant() in lib/rewardsMutations.js.
export const FREEZE_OVERFLOW_COINS = 500;

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
  // 150 added 20-milestone-spin-wheel.md Phase 2 — on the same scaling curve
  // between 100 and 200, Holographic's new home (see MILESTONE_THEME_GRANTS).
  150: { coins: 2000, freezes: 1 },
  200: { coins: 2500, freezes: 0 },
  // 300 added 22-coin-store-and-reward-tiering.md Phase 1 — a NEW milestone
  // tier (also in lib/streak.js's MILESTONES), Neon Horizon's home. On the
  // same scaling curve between 200 and 365.
  300: { coins: 3000, freezes: 1 },
  365: { coins: 4000, freezes: 2 },
  500: { coins: 6000, freezes: 0 },
  1000: { coins: 12000, freezes: 5 },
};

// Which Legendary card theme a PURE milestone day (one with NO spin wheel)
// auto-grants, read by claimMilestone (lib/rewardsMutations.js).
//
// EMPTY as of 22-coin-store-and-reward-tiering.md Phase 2 — every milestone day
// now has a spin wheel (Phase 2 added wheels to 100/150/200/300/365/500/1000,
// the six themed ones migrated their grant into SPIN_WHEELS[day].theme below).
// The single rule "wheel day → theme via claimSpin; pure milestone day → theme
// via claimMilestone" now resolves entirely on the claimSpin side, so this map
// is left intentionally empty (not deleted — the export + claimMilestone's
// lookup stay in place so re-adding a wheel-less themed day later is a one-line
// change here, and the two grant paths can never silently disagree while it's
// empty). Day 200 was always theme-less (the Onyx gap) and stays so.
export const MILESTONE_THEME_GRANTS = {};

// Milestone spin wheel (20-milestone-spin-wheel.md Phase 1, extended Phase 2)
// — replaces the old pick-1-of-3 chest. Each wheel day's `theme` (if set) is
// granted DIRECTLY by claimSpin (lib/rewardsMutations.js) — the wheel itself
// only ever spins for the coins/freezes segments below, a BONUS on top of the
// theme. Two invariants that must hold for every wheel, at every tuning:
// (1) spins are earned only by reaching the milestone, never purchasable —
// the rejected gacha loop is "pay for a chance"; (2) no segment ever has
// coins:0 AND freezes:0 — there is no blank slice. Amounts are illustrative,
// same "ratios, not gospel" rule as the rest of this file.
//
// Days 1/3/7/10 added Phase 2 — the "front-loaded first week" from
// IDEAS-gamification.md: the highest-churn window of a new user's life, now
// with a real reward (not just streak recognition) at every single day of it.
// Day 1 rides StreakCelebration's existing isNewStreak trigger, NOT a new
// MILESTONES entry (day 1 was never a streak milestone and doesn't become
// one here — see lib/trophies.js's Streak Keeper tiers, which map over
// MILESTONES and would otherwise gain a spurious "1-Day Streak" trophy).
//
// Days 100/150/200/300/365/500/1000 added 22-coin-store-and-reward-tiering.md
// Phase 2 — "introduce a wheel bonus for the rest of the days." These late
// milestones already pay huge lumps (MILESTONE_REWARDS), so the wheel is pure
// bonus and they share ONE template (LATE_WHEEL_SEGMENTS) within the author's
// caps: 500–1,500 coins, 3–5 freezes, no blank slice. Overflow freezes past
// FREEZE_CAP convert to coins (FREEZE_OVERFLOW_COINS) via clampFreezeGrant, so
// a big freeze slice is never wasted. Each themed late day carries its `theme`
// here (migrated out of the now-empty MILESTONE_THEME_GRANTS); day 200 has no
// theme (the Onyx gap), just the coin/freeze bonus.
const LATE_WHEEL_SEGMENTS = [
  { id: 'c500', label: '500 coins', coins: 500, freezes: 0 },
  { id: 'c750', label: '750 coins', coins: 750, freezes: 0 },
  { id: 'c1000', label: '1,000 coins', coins: 1000, freezes: 0 },
  { id: 'f3', label: '3 freezes', coins: 0, freezes: 3 },
  { id: 'f5', label: '5 freezes', coins: 0, freezes: 5 },
  { id: 'c1500', label: '1,500 coins', coins: 1500, freezes: 0 }, // jackpot
];

export const SPIN_WHEELS = {
  1: {
    // Was 'nebula' — removed 2026-07-20 (looked too similar to Stargazer,
    // also removed) and replaced with an existing purchasable Common theme
    // rather than leaving day 1 theme-less. Ocean Deep stays buyable in the
    // Shop too — owning it both ways (theme_buy + theme_grant rows) is
    // harmless, useCardThemes' ownedIds check already reads either source.
    theme: 'ocean-deep',
    segments: [
      { id: 'c25', label: '25 coins', coins: 25, freezes: 0 },
      { id: 'c50', label: '50 coins', coins: 50, freezes: 0 },
      { id: 'c75', label: '75 coins', coins: 75, freezes: 0 },
      { id: 'c100', label: '100 coins', coins: 100, freezes: 0 },
      { id: 'f1', label: '1 freeze', coins: 0, freezes: 1 },
      { id: 'c150', label: '150 coins', coins: 150, freezes: 0 }, // jackpot
    ],
  },
  3: {
    theme: 'cumulus', // was 'ruby' — 22-coin-store-and-reward-tiering.md Phase 1
    segments: [
      { id: 'c50', label: '50 coins', coins: 50, freezes: 0 },
      { id: 'c100', label: '100 coins', coins: 100, freezes: 0 },
      { id: 'c150', label: '150 coins', coins: 150, freezes: 0 },
      { id: 'f1', label: '1 freeze', coins: 0, freezes: 1 },
      { id: 'f2', label: '2 freezes', coins: 0, freezes: 2 },
      { id: 'c200', label: '200 coins', coins: 200, freezes: 0 }, // jackpot
    ],
  },
  7: {
    theme: 'daybreak', // was 'sapphire' — 22-coin-store-and-reward-tiering.md Phase 1
    segments: [
      { id: 'c100', label: '100 coins', coins: 100, freezes: 0 },
      { id: 'c150', label: '150 coins', coins: 150, freezes: 0 },
      { id: 'c250', label: '250 coins', coins: 250, freezes: 0 },
      { id: 'f1', label: '1 freeze', coins: 0, freezes: 1 },
      { id: 'f2', label: '2 freezes', coins: 0, freezes: 2 },
      { id: 'c300', label: '300 coins', coins: 300, freezes: 0 }, // jackpot
    ],
  },
  10: {
    // Jupiter gap filled 22-coin-store-and-reward-tiering.md Phase 1 — Ruby
    // moved here from day 3 (Cumulus took day 3).
    theme: 'ruby',
    segments: [
      { id: 'c150', label: '150 coins', coins: 150, freezes: 0 },
      { id: 'c250', label: '250 coins', coins: 250, freezes: 0 },
      { id: 'c350', label: '350 coins', coins: 350, freezes: 0 },
      { id: 'f2', label: '2 freezes', coins: 0, freezes: 2 },
      { id: 'c300', label: '300 coins', coins: 300, freezes: 0 },
      { id: 'c500', label: '500 coins', coins: 500, freezes: 0 }, // jackpot
    ],
  },
  30: {
    // Holographic (Phase 1) → Daybreak (Phase 2) → Sapphire
    // (22-coin-store-and-reward-tiering.md Phase 1). Daybreak moved to day 7;
    // Sapphire moved here from day 7.
    theme: 'sapphire',
    segments: [
      { id: 'c150', label: '150 coins', coins: 150, freezes: 0 },
      { id: 'c300', label: '300 coins', coins: 300, freezes: 0 },
      { id: 'c500', label: '500 coins', coins: 500, freezes: 0 },
      { id: 'f1', label: '1 freeze', coins: 0, freezes: 1 },
      { id: 'f2', label: '2 freezes', coins: 0, freezes: 2 },
      { id: 'c750', label: '750 coins', coins: 750, freezes: 0 }, // jackpot
    ],
  },
  50: {
    theme: 'aurora',
    segments: [
      { id: 'c250', label: '250 coins', coins: 250, freezes: 0 },
      { id: 'c500', label: '500 coins', coins: 500, freezes: 0 },
      { id: 'c750', label: '750 coins', coins: 750, freezes: 0 },
      { id: 'f2', label: '2 freezes', coins: 0, freezes: 2 },
      { id: 'f3', label: '3 freezes', coins: 0, freezes: 3 },
      { id: 'c1000', label: '1,000 coins', coins: 1000, freezes: 0 }, // jackpot
    ],
  },
  // Late milestones (22-coin-store-and-reward-tiering.md Phase 2) — all share
  // LATE_WHEEL_SEGMENTS; only the `theme` differs (200 has none).
  100: { theme: 'gold-foil', segments: LATE_WHEEL_SEGMENTS },
  150: { theme: 'holographic', segments: LATE_WHEEL_SEGMENTS },
  200: { segments: LATE_WHEEL_SEGMENTS }, // no theme (the Onyx gap)
  300: { theme: 'neon-horizon', segments: LATE_WHEEL_SEGMENTS },
  365: { theme: 'platinum', segments: LATE_WHEEL_SEGMENTS },
  500: { theme: 'velvet', segments: LATE_WHEEL_SEGMENTS },
  1000: { theme: 'diamond', segments: LATE_WHEEL_SEGMENTS },
};

// Pure lookup — returns the wheel config for a milestone day, or null if that
// day has no wheel. StreakCelebration reads this (not a hardcoded day check)
// so adding/removing a wheel day is a one-file change here.
export function spinWheelFor(day) {
  return SPIN_WHEELS[day] ?? null;
}

// 21-achievement-rewards-and-milestone-road.md Phase 1 — every MILESTONES
// day annotated with its actual reward and where it sits relative to the
// user's real streak count, so app/streak.js can show the whole ladder
// instead of only surprising the user at each celebration. `day` is compared
// against `currentStreak` the same way StreakCelebration.js's own
// `isMilestone` does (the streak's internal `current` count, not `longest`).
export function milestoneRoad(currentStreak) {
  const nextDay = MILESTONES.find((d) => currentStreak < d) ?? null;
  return MILESTONES.map((day) => {
    const reward = MILESTONE_REWARDS[day] ?? { coins: 0, freezes: 0 };
    return {
      day,
      state: currentStreak >= day ? 'earned' : day === nextDay ? 'current' : 'locked',
      coins: reward.coins,
      freezes: reward.freezes,
      // Resolve the granted theme the SAME way the actual grant does — wheel
      // first, then the (now-empty) pure-milestone map (22-coin-store-and-
      // reward-tiering.md Phase 2). Before this, the road only showed themes
      // for non-wheel days and silently omitted every wheel-day theme; now
      // that all milestone days have wheels it must read the wheel, or the
      // road shows no themes at all.
      themeId: spinWheelFor(day)?.theme ?? MILESTONE_THEME_GRANTS[day] ?? null,
      hasWheel: !!spinWheelFor(day),
    };
  });
}

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

// 21-achievement-rewards-and-milestone-road.md Phase 2 — one-time rewards for
// earning a non-streak trophy, keyed by the exact tile `id` string
// lib/trophies.js's makeEntry() already computes (`${groupId}:${tier}`) —
// reusing that string as the ledger's `ref` means no separate mapping layer
// between "which trophy" and "which claim". Streak Keeper and Budget Keeper
// are DELIBERATELY absent: Streak Keeper already auto-pays via claimMilestone/
// the spin wheel (a second claim path here would double-pay the same
// milestone); Budget Keeper isn't yet computable at all (18's Phase 1 open
// schema question). Absence from this map IS the exclusion — no separate
// blocklist needed anywhere else. Amounts are illustrative/tunable, scaled
// deliberately modest relative to streak milestones (which already pay up to
// 12,000 coins + a Diamond theme at day 1000) — these are secondary bonuses
// for the app's other pillars (budgets/plans/categorization), not a
// competing headline reward.
//
// `themeId` (optional, added 22-coin-store-and-reward-tiering.md Phase 1) — a
// card theme granted alongside the coins/xp on claim (six premium themes that
// left the buyable Shop grid to become achievement-exclusive). claimTrophy
// writes the same `theme_grant` row claimMilestone/claimSpin already use;
// absence of the field = a coins/xp/freezes-only trophy, exactly as before.
export const TROPHY_REWARDS = {
  'fresh_start:1': { coins: 50, xp: 100 },
  'perfect_month:1': { coins: 200, xp: 300, themeId: 'eclipse' },
  'categorizer:1': { coins: 180, xp: 280, themeId: 'borealis' },
  // Folds in the freeze IDEAS-gamification.md committed to Comeback in
  // 18-gamification-ritual-and-ledger.md Phase 1 — never actually wired
  // until now; this IS that commitment, via the generic claim mechanism
  // instead of a bespoke one.
  'comeback:1': { coins: 0, xp: 150, freezes: 1 },
  'logger:100': { coins: 75, xp: 150 },
  'logger:500': { coins: 200, xp: 350 },
  'logger:1000': { coins: 400, xp: 600, themeId: 'orchid-dusk' },
  'logger:2500': { coins: 1000, xp: 1200, freezes: 1, themeId: 'prometheus' },
  'planner:1': { coins: 100, xp: 200 },
  'planner:5': { coins: 300, xp: 450 },
  'planner:10': { coins: 600, xp: 800, freezes: 1, themeId: 'van-gogh' },
  'frugal:5': { coins: 75, xp: 150 },
  'frugal:25': { coins: 250, xp: 400 },
  'frugal:100': { coins: 700, xp: 900, freezes: 1, themeId: 'dusk-bloom' },
};

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
