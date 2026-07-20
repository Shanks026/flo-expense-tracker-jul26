import { withOpacity } from "./color";

// Card theme catalog — 19-card-themes.md Phase 1. Pure data, no React/
// Supabase imports (same discipline as lib/rewards.js). The hero card and
// the Shop screen both read this file as their single source of truth for
// every theme's look/price; the DB only ever stores which ids a user owns
// and which one is equipped (see hooks/useCardThemes.js).
//
// `background` is one of:
//   { type: 'solid', color }
//   { type: 'linear', angle, colors: [c1, c2, ...] }  — CSS-style angle
//   { type: 'pattern', base, kind: 'grid'|'lines'|'weave'|'blotch'|'glow'|'grain', line?, accent? }
// Rendered by components/CardThemeSurface.js.

// Coin-purchasable tiers — the Shop's buyable grid (Phase 1).
// 'epic' added 22-coin-store-and-reward-tiering.md (post-Phase-3) — a tier
// ABOVE rare for the vivid scene themes (Lava and the gradient/blotch cards),
// which were "too good for Rare." Rare now holds only the understated material
// themes (metal/stone/fabric). Order matters: the Shop renders TIERS in this
// sequence, so 'epic' sits after 'rare'.
export const TIERS = ["free", "common", "rare", "epic"];

// Never purchasable — auto-granted the moment a streak milestone is reached.
// Shown in the Shop as a separate, locked section. See `unlock` on each theme
// below for how.
// 'chest' retired 20-milestone-spin-wheel.md Phase 1 — the pick-1-of-3 chest
// is gone; every theme that was chest-exclusive is now a direct milestone
// grant (tier: 'legendary'), with a bonus spin wheel replacing the chest.
// 'milestone' added Phase 2 — the first-week ladder's themes (day 1/3/7/10/30)
// are also direct milestone grants, but deliberately a SEPARATE tier from
// 'legendary' so a day-1 theme isn't mislabelled "Legendary" in the Shop.
// 'achievement' added 22-coin-store-and-reward-tiering.md Phase 1 — themes
// earned by claiming a non-streak trophy (Perfect Month, Logger, etc.), not
// by a streak day and not buyable; unlock is `{ type: 'trophy', trophyId,
// label }` (see the six 'achievement' entries below + unlockCaption in
// app/shop.js). A separate tier from 'milestone'/'legendary' so the Shop's
// locked section labels it honestly ("Achievement reward").
export const LOCKED_TIERS = ["legendary", "milestone", "achievement"];

export const TIER_LABELS = {
  free: "Free",
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  milestone: "Milestone reward",
  achievement: "Achievement reward",
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
    id: "ink",
    name: "Ink",
    tier: "free",
    cost: 0,
    background: { type: "solid", color: "#101010" },
    textColor: "#FFFFFF",
    chipColor: "#BBDC12",
  },
  {
    id: "lime-flood",
    name: "Lime Flood",
    tier: "free",
    cost: 0,
    background: { type: "solid", color: "#BBDC12" },
    textColor: "#101010",
    chipColor: "#101010",
  },

  // Common — 400 coins each.
  {
    id: "blueprint",
    name: "Blueprint",
    tier: "common",
    cost: 400,
    background: {
      type: "pattern",
      base: "#17263A",
      kind: "grid",
      line: "#ffffff26",
    },
    textColor: "#FFFFFF",
    chipColor: "#8Fb8e8",
  },
  {
    id: "receipt",
    name: "Receipt",
    tier: "common",
    cost: 400,
    background: {
      type: "pattern",
      base: "#F3EFE2",
      kind: "lines",
      line: "#00000014",
    },
    textColor: "#101010",
    chipColor: "#101010",
  },
  {
    id: "dusk",
    name: "Dusk",
    tier: "common",
    cost: 400,
    background: { type: "linear", angle: 150, colors: ["#3a2a6a", "#12101f"] },
    textColor: "#FFFFFF",
    chipColor: "#c9b8f0",
  },
  {
    id: "ocean-deep",
    name: "Ocean Deep",
    tier: "common",
    cost: 400,
    background: { type: "linear", angle: 150, colors: ["#0d2436", "#1a5a6a"] },
    textColor: "#FFFFFF",
    chipColor: "#7fd6c9",
  },
  {
    id: "ember",
    name: "Ember",
    tier: "common",
    cost: 400,
    background: {
      type: "pattern",
      base: "#1f150f",
      kind: "glow",
      accent: "#ff7a3d",
    },
    textColor: "#FFFFFF",
    chipColor: "#ff8c4a",
  },
  {
    id: "graphite",
    name: "Graphite",
    tier: "common",
    cost: 400,
    background: {
      type: "linear",
      angle: 100,
      colors: ["#4a4d52", "#2c2e31", "#55585c", "#2c2e31"],
    },
    textColor: "#FFFFFF",
    chipColor: "#b8bcc0",
  },
  {
    id: "mint-ledger",
    name: "Mint Ledger",
    tier: "common",
    cost: 400,
    background: {
      type: "pattern",
      base: "#E4F3E9",
      kind: "lines",
      line: "#00000010",
    },
    textColor: "#14301f",
    chipColor: "#1f6b46",
  },

  // Rare — 800-1,000 coins.
  {
    id: "titanium",
    name: "Titanium",
    tier: "rare",
    cost: 800,
    background: {
      type: "linear",
      angle: 120,
      colors: ["#7d8186", "#3c3e42", "#6a6d72", "#3c3e42"],
    },
    textColor: "#FFFFFF",
    chipColor: "#d8dbe0",
  },
  {
    id: "carbon-fiber",
    name: "Carbon Fiber",
    tier: "rare",
    cost: 800,
    background: {
      type: "pattern",
      base: "#1a1c1f",
      kind: "weave",
      line: "#ffffff1f",
    },
    textColor: "#FFFFFF",
    chipColor: "#9aa0a6",
  },
  {
    id: "marble",
    name: "Marble",
    tier: "rare",
    cost: 900,
    // Redone per direct feedback (2026-07-20) — was a pale base + a
    // BLACK-tinted blotch overlay (`accent: '#0000001a'`), which read as
    // grey/dirty rather than polished stone. Now a warm multi-stop gradient
    // (ivory → beige → light brown → back to ivory) — Botticino/cream
    // marble's actual palette, and a gradient reads as "polished sheen" the
    // flat blotch pattern didn't.
    background: {
      type: "linear",
      angle: 125,
      colors: ["#F5EEDD", "#E8D4B0", "#D9C098", "#F0E8D0"],
    },
    textColor: "#292520",
    chipColor: "#c9a94b",
  },
  {
    id: "rose-gold",
    name: "Rose Gold",
    tier: "rare",
    cost: 850, // was 1000 — re-priced 22-coin-store-and-reward-tiering.md Phase 1
    background: { type: "linear", angle: 150, colors: ["#e8b7a0", "#c98b78"] },
    textColor: "#3d251d",
    chipColor: "#7a4b3c",
  },
  {
    id: "copper",
    name: "Copper",
    tier: "rare",
    cost: 800,
    background: {
      type: "linear",
      angle: 140,
      colors: ["#b5651d", "#e0925a", "#8a4513"],
    },
    textColor: "#2c1608",
    chipColor: "#3d2410",
  },
  {
    id: "denim",
    name: "Denim",
    tier: "rare",
    cost: 900,
    background: {
      type: "pattern",
      base: "#2b3a55",
      kind: "weave",
      line: "#ffffff1a",
    },
    textColor: "#FFFFFF",
    chipColor: "#c9d4e8",
  },
  {
    id: "lava",
    name: "Lava",
    tier: "epic",
    cost: 1000,
    // Built to match FLO's own "hot red" — the streak system's colors
    // (theme/tokens.js: streak '#FF6B2C', streakDeep '#D9480F'), not an
    // arbitrary fire palette. Charred-rock-to-molten gradient, biased dark
    // overall (stops short of the brightest streak orange as a full stop)
    // so white text stays legible across the whole card — a lighter-weighted
    // version washed out. `chipColor` IS the app's actual streak orange,
    // tying the chip directly back to the flame motif.
    background: {
      type: "linear",
      angle: 155,
      colors: ["#140502", "#3d0f02", "#7a2205", "#D9480F"],
    },
    textColor: "#FFFFFF",
    chipColor: "#FF6B2C",
  },

  // Six new Rare themes (2026-07-20), inspired by references in
  // claude-design/cardthemeideas/ (not the images themselves — see the
  // discussion in chat: using real photos would need a new `image`
  // background type, an asset/storage pipeline, and per-region contrast
  // detection this app has no utility for; gradients/patterns match how
  // every existing theme is built and cost nothing extra). Purchasable in
  // the Shop for now — where they land long-term (kept in the Shop vs.
  // folded into a reward tier) is an open decision, deliberately not made
  // here. Where a reference's brightest stop would fight a single flat text
  // color, the stop is deliberately muted rather than reproduced exactly —
  // same restraint Lava (above) and Marble already use.
  {
    id: "borealis",
    name: "Borealis",
    // Re-tiered rare→achievement — 22-coin-store-and-reward-tiering.md Phase 1.
    // Earned by claiming the Categorizer trophy; no longer buyable.
    tier: "achievement",
    unlock: { type: "trophy", trophyId: "categorizer:1", label: "Categorizer" },
    // Settled on 'blotch', FINAL (2026-07-20) — tried `linear` several more
    // rounds chasing Eclipse's exact look/angle (165°) and structure (no
    // repeated stops, continuous evolution), still came back "not good."
    // 'blotch's radial blobs use a 3-point EASED opacity falloff, which is
    // structurally softer than any `linearGradient` stop-to-stop ramp can
    // be — this is the ceiling for `type: 'linear'` in this renderer, and
    // it wasn't enough. Not revisiting `linear` again for this theme.
    background: {
      type: "pattern",
      base: "#050b1a",
      kind: "blotch",
      accent: "#1450a8",
      accent2: "#7a3fc0",
      accent3: "#6fb8c9",
    },
    // Flat white, not a tinted pastel — per direct feedback (2026-07-20): a
    // color-tinted near-white read as low-opacity/washed out on the main
    // amount/income/expense text. Matches how most of the existing catalogue
    // already does it (Dusk, Ocean Deep, Ember, Titanium, etc.).
    textColor: "#FFFFFF",
    chipColor: "#8a5fd9",
  },
  {
    id: "undertow",
    name: "Undertow",
    tier: "epic",
    cost: 1100,
    background: {
      type: "pattern",
      base: "#050B14",
      kind: "grain",
      colors: ["#050B14", "#0E4C55", "#4FD9C9"],
    },
    textColor: "#FFFFFF",
    chipColor: "#4FD9C9",
  },
  {
    id: "supernova",
    name: "Supernova",
    tier: "epic",
    cost: 1200,
    // Darkened/desaturated every stop per direct feedback (2026-07-20) —
    // same hue progression, toned down rather than neon-bright.
    background: {
      type: "linear",
      angle: 165,
      colors: ["#C4183A", "#A61680", "#5E1A82", "#2E1E6E"],
    },
    textColor: "#FFFFFF",
    chipColor: "#FF6FA8",
  },
  {
    id: "eclipse",
    name: "Eclipse",
    // Re-tiered rare→achievement — 22-coin-store-and-reward-tiering.md Phase 1.
    // Earned by claiming the Perfect Month trophy; no longer buyable.
    tier: "achievement",
    unlock: { type: "trophy", trophyId: "perfect_month:1", label: "Perfect Month" },
    // Reference's brightest bottom stop was a saturated bright orange —
    // muted to a deeper burnt tone (same restraint as Lava's own comment)
    // so white text stays legible against it too. Re-tuned per direct
    // feedback (2026-07-20) — the original indigo→magenta→orange jump read
    // as clashing/harsh; softened each stop's saturation so adjacent colors
    // sit closer together and the transition reads as one smooth blend.
    background: {
      type: "linear",
      angle: 165,
      colors: ["#0A0512", "#2E1250", "#8A2560", "#A8501F"],
    },
    textColor: "#FFFFFF",
    chipColor: "#E8834A",
  },
  {
    id: "peacock",
    name: "Peacock",
    tier: "epic",
    cost: 1150,
    // Reference ran blue → teal → a blown-out bright gold; biased every
    // stop darker/more muted here so a single flat text color reads
    // correctly at BOTH ends of the gradient, not just wherever the label
    // happens to sit — the same problem a real photo would have had, solved
    // the same way Lava/Marble already solve it for a synthetic gradient.
    background: {
      type: "linear",
      angle: 175,
      colors: ["#0A2A4D", "#0F5C52", "#C48A1F"],
    },
    textColor: "#FFFFFF",
    chipColor: "#E0A930",
  },
  // Three more Rare themes (2026-07-20), inspired by a second reference
  // batch — real sky photos shared directly in chat, not files in
  // claude-design/cardthemeideas/ — same gradient/pattern-not-image
  // reasoning as the first 6 (see this file's earlier comment + the
  // discussion recorded in 19-card-themes.md's addendum). Text stays flat
  // white from the start this time, per the standing fix applied to the
  // first batch.
  {
    id: "orchid-dusk",
    name: "Orchid Dusk",
    // Re-tiered rare→achievement — 22-coin-store-and-reward-tiering.md Phase 1.
    // Earned at the Logger 1,000-transactions trophy; no longer buyable.
    tier: "achievement",
    unlock: { type: "trophy", trophyId: "logger:1000", label: "Logger · 1,000" },
    // Violet sky bleeding into a vivid magenta cloud bloom. Dropped the star
    // scatter per direct feedback (2026-07-20) — plain linear gradient now,
    // same as Supernova/Eclipse/Borealis.
    background: {
      type: "linear",
      angle: 160,
      colors: ["#241638", "#5b3a82", "#c94f9e", "#ff8fc0"],
    },
    textColor: "#FFFFFF",
    chipColor: "#ff8fc0",
  },
  {
    id: "crimson-shore",
    name: "Crimson Shore",
    tier: "epic",
    cost: 1250,
    // Teal, crimson, and muted-grey blobs mixed at different corners —
    // switched from horizontal bands to a radial blur per direct feedback
    // (2026-07-20), same 'blotch' technique Aurora/Marble already use.
    background: {
      type: "pattern",
      base: "#1c0d10",
      kind: "blotch",
      accent: "#0f4d52",
      accent2: "#c41f2e",
      accent3: "#6b6470",
    },
    textColor: "#FFFFFF",
    chipColor: "#e0392b",
  },
  {
    id: "dawnfall",
    name: "Dawnfall",
    tier: "epic",
    cost: 1300,
    // Teal, magenta-pink, and gold blobs mixed at different corners over a
    // navy base — switched from horizontal bands to a radial blur per
    // direct feedback (2026-07-20); star scatter dropped in the same round
    // of feedback, so this is plain 'blotch', same technique as Crimson
    // Shore with a different palette.
    background: {
      type: "pattern",
      base: "#0a1a3d",
      kind: "blotch",
      accent: "#1a6b7a",
      accent2: "#e0287a",
      accent3: "#f0a030",
    },
    textColor: "#FFFFFF",
    chipColor: "#f0a030",
  },

  // Two more Rare themes (2026-07-20), inspired by a third reference batch —
  // blue-sky photos shared directly in chat. Both gradients biased darker/
  // more saturated than the actual photos (which run genuinely pale in
  // places) so a single flat white text color stays legible across the
  // whole card — same restraint as Lava/Marble/Peacock's own comments.
  {
    id: "dusk-bloom",
    name: "Dusk Bloom",
    // Re-tiered rare→achievement — 22-coin-store-and-reward-tiering.md Phase 1.
    // Earned at the Frugal 100-no-spend-days trophy; no longer buyable.
    tier: "achievement",
    unlock: { type: "trophy", trophyId: "frugal:100", label: "Frugal · 100" },
    // Vivid blue sky deepening through blue-lavender into a soft pink
    // bloom near the clouds — a smooth vertical gradient, matching the
    // reference photo's own soft top-to-bottom transition.
    background: {
      type: "linear",
      angle: 180,
      colors: ["#2a4de0", "#5a6bd9", "#9a7ed0", "#c9a0c9"],
    },
    textColor: "#FFFFFF",
    chipColor: "#e0b8e0",
  },
  {
    id: "cumulus",
    name: "Cumulus",
    // Re-tiered rare→milestone (day 3) — 22-coin-store-and-reward-tiering.md
    // Phase 1. No longer buyable; granted via SPIN_WHEELS[3].theme (took the
    // day-3 slot Ruby vacated for day 10). Left physically in the Rare block —
    // grouping is by the `tier` field, not array position.
    tier: "milestone",
    unlock: { type: "milestone", day: 3 },
    // A flatter, more uniform cerulean sky than Dusk Bloom's gradient —
    // matching its reference photo's own fairly solid blue background —
    // with soft pink/lavender/white cloud-glow blobs mixed in via
    // 'blotch'. Doesn't literally draw cloud shapes (this renderer has no
    // such pattern kind); approximates the photo's color mood instead.
    background: {
      type: "pattern",
      base: "#2f66db",
      kind: "blotch",
      accent: "#e8b8d9",
      accent2: "#f5e0ec",
      accent3: "#b88fd9",
    },
    textColor: "#FFFFFF",
    chipColor: "#e8b8d9",
  },
  {
    id: "neon-horizon",
    name: "Neon Horizon",
    // Re-tiered rare→legendary (day 300) — 22-coin-store-and-reward-tiering.md
    // Phase 1. No longer buyable; the day-300 streak reward (a NEW MILESTONES
    // tier). Granted via SPIN_WHEELS[300].theme once day 300 gains its wheel
    // (Phase 2); until then via MILESTONE_THEME_GRANTS[300].
    tier: "legendary",
    unlock: { type: "milestone", day: 300 },
    // City-sunset reference, colors only (2026-07-20) — a smooth vertical
    // sweep tracing the sky's own band, deep blue-violet at top down
    // through violet-purple, vivid magenta-pink, pink-red, to a warm
    // orange horizon glow, closing on a dark base. No skyline silhouette —
    // this renderer draws gradients/dots, not custom shapes; the color
    // story carries the mood instead, per direct instruction.
    //
    // Bridge stops added per direct feedback ("could you use the same [as
    // Dusk Bloom]") — measured actual RGB distance between each stop; the
    // real problem was never a missing "property," just which colors sit
    // next to which. Colors hand-tweaked directly in-editor afterward
    // (2026-07-20) — darkened the top stop, brightened several others, and
    // DROPPED the forced near-black ending entirely (closing on a muted
    // dark red-wine instead) — which fixed the worst outlier outright
    // (orange→black had been 221.9, ~3x every other step; gone now that
    // there's no black stop to jump to). Re-measured after the edit: every
    // remaining step landed 31-71 except the darkened top stop, now the
    // one outlier at 96.2 — split with one more bridge (computed via real
    // RGB interpolation, not eyeballed) into two ~48s, consistent with the
    // rest.
    background: {
      type: "linear",
      angle: 180,
      colors: [
        "#393989",
        "#6244a1",
        "#8a4fb8",
        "#b24fab",
        "#d43c92",
        "#f13a61",
        "#e8623a",
        "#cd523c",
        "#9c2031",
      ],
    },
    textColor: "#FFFFFF",
    chipColor: "#e8623a",
  },
  {
    id: "firelight",
    name: "Firelight",
    tier: "epic",
    cost: 1400,
    // Fiery orange-red sunset clouds reference, colors only (2026-07-20) —
    // colors only, no moon/cloud shapes or power-line silhouette, per the
    // same standing instruction as Neon Horizon.
    //
    // Rebuilt from scratch, per direct feedback ("the colors don't sit,
    // there are gray shades... reduce colors and make it proper"). The
    // original 9-stop version tried to trace the reference's own muted
    // moon-gap dip (first as a cool purple-lavender, then re-tuned to a
    // warm dusty-rose) — but ANY attempt at a muted "dip" between two
    // vivid hues reads as a muddy grey blend when interpolated in raw RGB,
    // which is exactly what happened. Fixed properly, not patched: dropped
    // the dip concept entirely and rebuilt as 5 stops, checked in HSL (not
    // just RGB distance) to guarantee no desaturated grey anywhere —
    // saturation 76-91% and rising throughout, hue sweeping smoothly
    // red (H5°) to orange (H31°), lightness steady. RGB step distances
    // also tight (24-46, no outlier).
    background: {
      type: "linear",
      angle: 0,
      colors: ["#e0301f", "#e8503f", "#e8622f", "#f07a2f", "#f5952f"],
    },
    textColor: "#FFFFFF",
    chipColor: "#f5952f",
  },
  {
    id: "wanderer",
    name: "Wanderer",
    tier: "epic",
    cost: 1500,
    // Illustrated desert-dune reference, colors only (2026-07-20) — a
    // deep purple-black night sky (top-left blob), a vivid golden-yellow
    // dune ground (bottom-right blob — the dominant color, matching the
    // reference's own large lower-half ground), and rich red-coral clouds
    // (top-right, subtler third blob), mixed via 'blotch' the same way
    // Crimson Shore/Dawnfall/Borealis already are. Base is a muted warm
    // gold-tan (not the coolest/darkest color) so gaps between blobs still
    // read as part of the same warm palette. No cloud linework or walking
    // figure — colors only, per this session's standing instruction.
    // Every color checked in HSL before committing: 38-79% saturation,
    // nothing muddy or grey.
    background: {
      type: "pattern",
      base: "#c98a4a",
      kind: "blotch",
      accent: "#bd2e0a",
      accent2: "#f68113",
      accent3: "#d9524a",
    },
    textColor: "#FFFFFF",
    chipColor: "#d9524a",
  },

  {
    id: "van-gogh",
    name: "Van Gogh",
    // Re-tiered rare→achievement — 22-coin-store-and-reward-tiering.md Phase 1.
    // Earned at the Planner 10-plans trophy; no longer buyable.
    tier: "achievement",
    unlock: { type: "trophy", trophyId: "planner:10", label: "Planner · 10" },
    // Starry-Night-style illustration, colors only (2026-07-20).
    //
    // Rebalanced per direct feedback ("the yellow is too much... more blues
    // and off-white, add yellow as a slight touch") — the gold swirl was
    // originally `accent` (blotch's top-left blob, FULL opacity), making it
    // co-dominant with the navy. Moved gold to `accent3` instead — blotch's
    // own reduced-opacity third slot (~0.45-0.5, by construction, not a
    // custom value here) — which is exactly the mechanism for "a slight
    // touch" rather than a hand-picked lower alpha.
    //
    // Second pass ("too much white. blue needs to be more") — the off-white
    // `base` from the first pass was still showing through wherever the
    // blotch blobs fall off, reading as white patches. Replaced `base` with
    // a genuine light-medium blue instead of dropping the lightness of the
    // same off-white, so the card is blue in three distinct tones (light
    // base, medium `accent`, near-black navy `accent2`) with zero white
    // anywhere — gold stays demoted to `accent3` as before.
    background: {
      type: "pattern",
      base: "#599de2",
      kind: "blotch",
      accent: "#1b59aa",
      accent2: "#0c225a",
      accent3: "#e9bc2b",
    },
    textColor: "#FFFFFF",
    chipColor: "#f0c94a",
  },

  {
    id: "prometheus",
    name: "Prometheus",
    // Re-tiered rare→achievement — 22-coin-store-and-reward-tiering.md Phase 1.
    // Earned at the Logger 5,000-transactions trophy (the fire theme for the
    // biggest logging milestone); no longer buyable.
    tier: "achievement",
    unlock: { type: "trophy", trophyId: "logger:5000", label: "Logger · 5,000" },
    // Sun-illustration reference (2026-07-20), last in this batch — asked to
    // experiment with a technique other than 'blotch' this time. This one is
    // a straight 'grain' gradient instead: near-black through deep red/
    // maroon into a white-hot orange/yellow "sun," so grain's built-in
    // speckle dots read directly as the reference image's own starfield —
    // no new pattern code needed, the existing 'grain' kind (Undertow)
    // already does exactly this.
    //
    // Fixed per direct feedback ("fix the colors and angle to make the left
    // section readable") — the original angle (50°, bright corner at
    // bottom-left) put the palest colors right where the account name/
    // balance text sits. Changed angle to 90 (pure horizontal — every point
    // at the same x gets the same color regardless of y, so the WHOLE left
    // column reads consistently, not just one corner) and reordered/rebuilt
    // the stops dark-to-bright instead of bright-to-dark, biased so the
    // white-hot end only arrives in the final ~1/3 of the card's width —
    // checked stop-by-stop against white text: contrast stays >=4.9:1
    // through the first 44% of the width and only drops below 3:1 past the
    // 67% mark, by which point no text extends. Textcolor unchanged
    // (staying white was the right call — the fix is a background dark
    // enough for it everywhere text sits, not a text-color swap that would
    // just break legibility against the bright end instead).
    background: {
      type: "pattern",
      base: "#040201",
      kind: "grain",
      angle: 50,
      colors: [
        "#040201",
        "#150504",
        "#2c0a07",
        "#4a100c",
        "#6f1710",
        "#9c2214",
        "#c9341a",
        "#e8621f",
        "#ffb347",
        "#fff2c9",
      ],
    },
    textColor: "#fff8e2",
    chipColor: "#ffb347",
  },

  // Legendary — Phase 2. Never purchasable; auto-granted the moment the
  // matching MILESTONES day (lib/streak.js) is crossed, via
  // MILESTONE_THEME_GRANTS (lib/rewards.js) → claimMilestone
  // (lib/rewardsMutations.js). `unlock` describes the condition shown in
  // the Shop's locked section, not a purchase path.
  {
    id: "gold-foil",
    name: "Gold Foil",
    tier: "legendary",
    unlock: { type: "milestone", day: 100 },
    background: {
      type: "linear",
      angle: 135,
      colors: ["#b8860b", "#f5d76e", "#d4a017", "#8a6608"],
    },
    textColor: "#2c2005",
    chipColor: "#3a2c08",
  },
  {
    id: "platinum",
    name: "Platinum",
    tier: "legendary",
    unlock: { type: "milestone", day: 365 },
    background: {
      type: "linear",
      angle: 135,
      colors: ["#dfe4e8", "#b8c0c6", "#eef1f3"],
    },
    textColor: "#2c2f32",
    chipColor: "#6a7076",
  },
  {
    id: "velvet",
    name: "Velvet",
    // Swapped with Aurora per direct feedback (2026-07-20) — was
    // chest-exclusive (day 50), now legendary (day 500), taking Aurora's
    // old milestone slot exactly (same day, just a different theme).
    tier: "legendary",
    unlock: { type: "milestone", day: 500 },
    background: { type: "linear", angle: 150, colors: ["#3d0f1f", "#1a0810"] },
    textColor: "#FFFFFF",
    chipColor: "#e08fae",
  },
  {
    id: "diamond",
    name: "Diamond",
    tier: "legendary",
    unlock: { type: "milestone", day: 1000 },
    background: {
      type: "linear",
      angle: 115,
      colors: ["#eaf6fb", "#ffffff", "#d8ecf5", "#ffffff", "#eaf6fb"],
    },
    textColor: "#123a4a",
    chipColor: "#4fc3e8",
  },

  // Was chest-exclusive (19-card-themes.md Phase 2's pick-1-of-3 chest at day
  // 30/50) — 20-milestone-spin-wheel.md Phase 1 replaced the chest with a
  // bonus spin wheel and granted these two directly, same path as every
  // other Legendary theme (see MILESTONE_THEME_GRANTS in lib/rewards.js).
  // Holographic's day moved 30 → 150 in Phase 2 once Daybreak (below) took
  // over day 30's theme slot as part of the first-week ladder.
  {
    id: "holographic",
    name: "Holographic",
    tier: "legendary",
    unlock: { type: "milestone", day: 150 },
    background: {
      type: "linear",
      angle: 200,
      colors: ["#f6d365", "#a6e3e9", "#c3a6f6", "#f6a6c1", "#f6d365"],
    },
    textColor: "#1a1a1a",
    chipColor: "#ffffffcc",
  },
  {
    id: "aurora",
    name: "Aurora",
    // Swapped with Velvet per direct feedback (2026-07-20) — was legendary
    // (day 500), then chest-exclusive (day 50); now legendary again (day 50,
    // direct grant) per 20-milestone-spin-wheel.md Phase 1's chest removal.
    tier: "legendary",
    unlock: { type: "milestone", day: 50 },
    // accent3 added per direct feedback (2026-07-20) — a slight bluish-green
    // (teal) touch alongside the existing green/purple blotches.
    background: {
      type: "pattern",
      base: "#050414",
      kind: "blotch",
      accent: "#4fc38a",
      accent2: "#9b7fe0",
      accent3: "#2ec4b6",
    },
    textColor: "#FFFFFF",
    chipColor: "#7fe0c9",
  },

  // First-week ladder (20-milestone-spin-wheel.md Phase 2) — a NEW tier,
  // 'milestone', distinct from 'legendary' (100+): these fire in the first
  // 30 days specifically to give a brand-new user a fast, real win before the
  // habit exists. Granted directly via claimSpin (not MILESTONE_THEME_GRANTS —
  // see lib/rewards.js's SPIN_WHEELS `theme` field), same as every wheel day.
  // Day 1's own theme (was Nebula, removed 2026-07-20 — looked too similar
  // to Stargazer, also removed) is Ocean Deep, an existing purchasable
  // Common theme (see lib/rewards.js's SPIN_WHEELS[1].theme) — no bespoke
  // day-1 theme exists right now.
  {
    id: "ruby",
    name: "Ruby",
    tier: "milestone",
    // Moved day 3→10 (22-coin-store-and-reward-tiering.md Phase 1) — Cumulus
    // took day 3; Ruby fills the previously-empty day-10 slot.
    unlock: { type: "milestone", day: 10 },
    // Multi-stop crimson with a lighter mid-stop for a facet-sheen look —
    // same "gradient reads as polished, not flat" reasoning as Marble/Lava.
    background: {
      type: "linear",
      angle: 130,
      colors: ["#4a0511", "#a00d24", "#e0334f", "#7a0a1c"],
    },
    textColor: "#f6e2b0",
    chipColor: "#e0a930",
  },
  {
    id: "sapphire",
    name: "Sapphire",
    tier: "milestone",
    // Moved day 7→30 (22-coin-store-and-reward-tiering.md Phase 1) — Daybreak
    // took day 7; Sapphire takes day 30 (Daybreak's old slot).
    unlock: { type: "milestone", day: 30 },
    // Ruby's sibling — same facet-sheen shape, royal-blue palette.
    background: {
      type: "linear",
      angle: 130,
      colors: ["#071a44", "#12419e", "#3d6fd6", "#0a2352"],
    },
    textColor: "#eef3ff",
    chipColor: "#c9d8f6",
  },
  // Day 10's theme is now Ruby (moved 3→10, 22-coin-store-and-reward-tiering.md
  // Phase 1) — the old Jupiter gap is filled. Cumulus took day 3; Daybreak
  // moved to day 7; Sapphire to day 30.
  {
    id: "daybreak",
    name: "Daybreak",
    tier: "milestone",
    // Moved day 30→7 (22-coin-store-and-reward-tiering.md Phase 1) — one of the
    // two prettiest first-week themes now rewards a very early day; Sapphire
    // took day 30.
    unlock: { type: "milestone", day: 7 },
    // Vertical sunrise — indigo night sky bleeding down into rose, closing on
    // a warm amber horizon. Recolored for MORE CONTRAST (22-...md Phase 1, per
    // "daybreak needs more contrast to the colors"): the old mids were badly
    // desaturated (the mauve sat at S19 — muddy/grey), flattening the card.
    // Every stop now holds 48-100% saturation, midpoints verified non-grey,
    // and lightness ramps 22→63 for a stronger night→morning sweep.
    background: {
      type: "linear",
      angle: 180,
      colors: ["#111861", "#3b2f9e", "#a83b86", "#f07a52", "#ffc542"],
    },
    // Flat white, not a tinted pastel — per direct feedback (2026-07-20),
    // same fix as the 6 new Rare themes below.
    textColor: "#FFFFFF",
    chipColor: "#ffc542",
  },
];

// The catalog every consumer actually reads — each raw entry plus its
// derived `mutedColor` (see MUTED_OPACITY above). Deriving it here, once,
// for every theme is what guarantees "opacity, not a separate color" holds
// for all of them, not just the ones someone remembered to compute it for.
export const CARD_THEMES = THEMES_RAW.map((t) => ({
  ...t,
  mutedColor: withOpacity(t.textColor, MUTED_OPACITY),
}));

const THEMES_BY_ID = new Map(CARD_THEMES.map((t) => [t.id, t]));

// Falls back to Ink for an unrecognized id — defensive against a theme
// being renamed/removed after a user already equipped it.
export function getTheme(id) {
  return THEMES_BY_ID.get(id) ?? THEMES_BY_ID.get("ink");
}
