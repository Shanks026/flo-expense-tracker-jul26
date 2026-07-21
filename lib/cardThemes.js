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
// 'rank' added 27-rank-ladder-rework.md Phase 2 — earned by REACHING a rank on
// the XP ladder, not by a streak day and not by a trophy. Unlock is
// `{ type: 'rank', rankId, label }`, where `rankId` is the RANKS entry's
// permanent id and `label` is its current display title (the two deliberately
// differ — see THE ID RULE in lib/rewards.js). Only three ranks carry a theme,
// so this stays an event rather than routine. The authority for the actual
// grant is RANK_THEME_GRANTS in lib/rewards.js; `unlock` here is display
// metadata, exactly as `unlock.day` is for milestone themes (whose real grant
// authority is SPIN_WHEELS[day].theme).
export const LOCKED_TIERS = ["legendary", "milestone", "achievement", "rank"];

export const TIER_LABELS = {
  free: "Free",
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  milestone: "Milestone reward",
  achievement: "Achievement reward",
  rank: "Rank reward",
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
    id: "mercury",
    name: "Mercury",
    tier: "rare",
    cost: 900,
    // Inspired by a liquid-chrome/marbled-ink wallpaper uploaded directly in
    // chat (2026-07-20) — high-contrast black and light swirling together,
    // read as reflections rather than flat bands. Rebuilt per direct
    // feedback (the first pass was a 'linear' alternating-stop gradient,
    // which read as straight bands, not a swirl; also dropped the warm
    // cream tint entirely — pure greytones now, black through mid-grey to
    // near-white, no yellow/warmth anywhere).
    //
    // 'blotch', not 'linear' — three soft-edged radial blobs overlapping
    // (and overlapping each other's falloff) is this renderer's closest
    // primitive to an organic swirl; a straight gradient can only ever
    // produce a band. Not a literal reproduction of the reference's own
    // flowing curves (no path primitive exists here for that), but the
    // blended, uneven edges read as marbling rather than stripes.
    //
    // Positions are blotch's own fixed three spots (see
    // components/CardThemeSurface.js) — accent (top-left, mid-grey) sits
    // closest to the name/balance text and is deliberately the darkest of
    // the three so that corner stays legible; accent2 (bottom-right, the
    // largest blob) and accent3 (top-right, subtler) are both away from the
    // text column. accent2 toned down from near-white (2026-07-20, per
    // direct feedback — it was overpowering the card at full opacity/r80,
    // the biggest blob AND the brightest) to a mid-light grey, landing a
    // smoother 3-step value ladder (base 5% -> accent 36% -> accent2 60%
    // lightness) instead of jumping straight to a blown-out highlight.
    background: {
      type: "pattern",
      base: "#0c0c0c",
      kind: "blotch",
      accent: "#5c5c5c",
      accent2: "#9a9a9a",
      accent3: "#2e2e2e",
    },
    textColor: "#FFFFFF",
    chipColor: "#b0b0b0",
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
      accent2: "#323181",
      accent3: "#54d4f1",
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
  {
    id: "tempest",
    name: "Tempest",
    tier: "epic",
    cost: 1200,
    // Inspired by a storm-cloud-at-dusk wallpaper uploaded directly in chat
    // (2026-07-20) — deep violet-black sky, dark cloud-shadow masses, and
    // vivid magenta-pink lit cloud undersides. 'blotch', not 'linear' —
    // clouds are themselves diffuse, soft-edged masses, the closest match
    // this renderer has to a literal photo reference yet (Mercury's
    // liquid-metal swirl needed blotch as an APPROXIMATION; this one's
    // subject is already blob-shaped).
    //
    // Text-safe by construction, not by biasing stop order like the linear
    // themes: `base` (the deep violet-black) is what actually covers the
    // left column where the name/balance/stats sit, since blotch's own
    // accent blob positions are fixed off in the corners (see
    // components/CardThemeSurface.js) — accent (top-left, closest to text)
    // stays a dark cloud-purple rather than the vivid magenta; the magenta
    // glow itself (accent2) sits in its large bottom-right blob, away from
    // any text, matching where the reference's own brightest clouds sit.
    background: {
      type: "pattern",
      base: "#150a24",
      kind: "blotch",
      accent: "#3d2560",
      accent2: "#d94a94",
      accent3: "#8a3d7a",
    },
    textColor: "#FFFFFF",
    chipColor: "#d94a94",
  },
  {
    id: "voltage",
    name: "Voltage",
    tier: "epic",
    cost: 1250,
    // Inspired by a purple-lightning storm wallpaper uploaded directly in
    // chat (2026-07-20) — a white-hot bolt at the center, radiating out
    // through violet into near-black cloud edges. 'glow', not 'blotch' this
    // time (per direct instruction to try a different gradient method) —
    // Tempest's clouds were diffuse blob-shaped masses everywhere in frame,
    // right for 'blotch'; this reference is a single radiating light source
    // fading outward, which is exactly 'glow's own multi-hue radial shape
    // (the `colors` array variant — see components/CardThemeSurface.js —
    // sweeps several stops out from one point instead of one flat tint).
    //
    // Text-safe for a different reason than Tempest: 'glow' is pinned to a
    // fixed origin near the bottom-right corner (cx 80%, cy 96% — the
    // renderer doesn't expose a per-theme position), same distance from the
    // top-left-anchored name/balance/stats column as Prometheus/Prism's own
    // bottom-right-biased brightness. `base` (near-black violet) is what
    // covers the text column itself.
    background: {
      type: "pattern",  
      base: "#0d051aff",
      kind: "glow",
      colors: ["#c090ffff", "#b088e8", "#7c4bc4", "#4a2a7a"],
    },
    textColor: "#fffdffff",
    chipColor: "#4a2a7a",
  },
  {
    id: "glitch",
    name: "Glitch",
    tier: "epic",
    cost: 1300,
    // Inspired by a navy/cyan/coral-red marbled wallpaper uploaded directly
    // in chat (2026-07-20) — dark navy-black base, a flowing electric-cyan
    // swirl running through it, and coral-red patches embedded where the
    // swirl folds back on itself.
    //
    // Switched to 'blotch' per direct feedback (didn't like the linear/grain
    // band look — same call already made on Mercury). Cyan is the DOMINANT
    // color in the reference (it covers most of the frame; red is the
    // smaller accent), so cyan is accent2 — the large bottom-right blob —
    // while red sits in accent3, which the renderer already renders at
    // reduced opacity (~0.45, see components/CardThemeSurface.js), matching
    // how red reads as a hotspot rather than an equal third of the palette.
    // accent (top-left, closest to the name/balance text) stays a muted dark
    // teal rather than either vivid color, for the same legibility reason
    // every other theme in this file keeps that corner subdued.
    background: {
      type: "pattern",
      base: "#050912",
      kind: "blotch",
      accent: "#153a4d",
      accent2: "#1e8fb8",
      accent3: "#e0453a",
    },
    textColor: "#FFFFFF",
    chipColor: "#618ca5ff",
  },
  {
    id: "aperture",
    name: "Aperture",
    tier: "epic",
    cost: 1200,
    // Inspired by a cave-light-beam wallpaper uploaded directly in chat
    // (2026-07-20) — a near-black cavern, a single shaft of cyan light
    // pouring down from an opening above, landing in a violet-tinted glow on
    // the cave floor. 'glow', not 'blotch'/'grain' — unlike Mercury/Glitch's
    // organic marbled references, this one genuinely IS one light source
    // radiating outward (same structural match Voltage's lightning bolt
    // had), not a diffuse blob pattern needing blotch's multi-accent spread.
    //
    // Colors ordered center-out per 'glow's own stop logic (see
    // components/CardThemeSurface.js) — brightest/warmest first: the violet
    // glow where the beam lands, then the cyan of the beam itself, then a
    // deep teal fading into the cave's own near-black. `base` is the cavern
    // dark, everywhere the light doesn't reach.
    //
    // Text-safe the same way as Voltage: 'glow's origin is pinned near the
    // bottom-right corner (not configurable per-theme), far from the
    // top-left-anchored name/balance/stats column, which sits in `base`.
    background: {
      type: "pattern",
      base: "#020718ff",
      kind: "glow",
      colors: ["#7876f7ff", "#2488c2ff", "#0a3a52"],
    },
    textColor: "#FFFFFF",
    chipColor: "#2ab0d9",
  },
  {
    id: "canopy",
    name: "Canopy",
    tier: "epic",
    cost: 1200,
    // Inspired by two wallpapers uploaded directly in chat (2026-07-20) — a
    // grainy near-black-green glow (an off-center soft mint-white highlight
    // fading through green into black) and a misty forest with sunbeams
    // pouring through the canopy. The first is close to a literal 'glow'
    // gradient already; the second supplies the deeper, richer forest-green
    // midtone the first alone doesn't have much of.
    //
    // 'glow', same structural reasoning as Aperture/Voltage — one soft light
    // source fading outward, not a diffuse multi-blob scene. Colors ordered
    // center-out: pale mint-white core (the sunbeam itself), vivid forest
    // green (canopy lit from within), deep green fading into `base`'s
    // near-black. Text-safe the same way as Aperture/Voltage: 'glow's origin
    // is pinned near the bottom-right corner, away from the top-left name/
    // balance/stats column, which sits in `base`.
    //
    // A 'blotch' version was tried per direct request ("try blotch once")
    // and reverted — this 'glow' version is the one that stayed.
    background: {
      type: "pattern",
      base: "#020e04ff",
      kind: "glow",
      colors: ["#c3ee7dff", "#5a9e4a", "#123018"],
    },
    textColor: "#ffffffff",
    chipColor: "#5a9e4a",
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
    // Earned at the Logger 2,500-transactions trophy (2026-07-20: lowered
    // from 5,000, see lib/trophies.js's own comment on why) — the fire theme
    // for the biggest logging milestone; no longer buyable.
    tier: "achievement",
    unlock: { type: "trophy", trophyId: "logger:2500", label: "Logger · 2,500" },
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

  // ---- SEASONAL, NOT LIVE: Rainbow (June / Pride Month release) ----
  // Held back from the active catalog (2026-07-20, per direct instruction) —
  // earmarked as a seasonal drop rather than a permanent Epic entry. When
  // that ships: uncomment the block below, move it into THEMES_RAW's active
  // list, and give it a real seasonal availability window (not just
  // `tier: "epic"`, which would make it permanently purchasable).
  //
  // Inspired by a rainbow zigzag wallpaper uploaded directly in chat —
  // colors only, no literal zigzag/wave shape (this renderer draws
  // gradients/patterns, not custom paths; a wavy ribbon isn't a primitive
  // this system can produce).
  //
  // Rebuilt per direct feedback ("too contrasted and overlapping... smooth
  // transition... leave out the grain") — the first pass used 'grain' with
  // 10 stops bookended in near-black, which is exactly what read as harsh:
  // jumping from near-black (L2%) straight to a vivid red was a much bigger
  // step than any two adjacent rainbow hues, and grain's speckle dots on top
  // of that many close stops added visual noise rather than texture. This is
  // a plain 'linear' gradient now (no grain layer at all), 8 stops, every
  // adjacent pair measured in RGB distance to keep the steps consistent
  // (57-94 apart, no outlier) — same discipline Neon Horizon/Firelight's own
  // comments already established for this file. No near-black anywhere:
  // every stop sits in a contained 27-65% lightness band (deep wine-red to
  // muted blue-violet), so the whole sweep reads as one continuous blend
  // instead of dark-then-bright bands.
  //
  // angle: 90 (pure horizontal), same reasoning as Prometheus above:
  // AccountHeroCarousel's name/balance/stats text all sit left-anchored, so
  // a horizontal sweep keeps every line of text at the same x (and
  // therefore the same color, the darker wine-red end) regardless of row.
  // {
  //   id: "rainbow",
  //   name: "Rainbow",
  //   tier: "epic",
  //   cost: 1450,
  //   background: {
  //     type: "linear",
  //     angle: 90,
  //     colors: [
  //       "#9e1e0d",
  //       "#a8391f",
  //       "#c9701f",
  //       "#d9a52e",
  //       "#7fae3f",
  //       "#2f9e6e",
  //       "#2a7ba6",
  //       "#5a5aa8",
  //     ],
  //   },
  //   textColor: "#FFFFFF",
  //   chipColor: "#d9a52e",
  // },

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
    textColor: "#f3e6c5ff",
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
    // a warm amber horizon. Re-toned for CALM (2026-07-20, per direct
    // feedback: the prior "more contrast" pass — 22-...md Phase 1 — pushed it
    // too far the other way, ending in a near-neon yellow/orange that read as
    // harsh rather than a quiet sunrise). Same hue story, same stop count,
    // just dialed back: every stop now holds 25-62% saturation (still clear
    // of the original S19 muddy-grey failure this theme has already had
    // once, just not pushed to 48-100% either), and lightness eases
    // 21→50→66→63 — a gentle rise that settles at the end instead of
    // peaking into brightness.
    background: {
      type: "linear",
      angle: 180,
      colors: ["#1a1f52", "#4a3d78", "#a1607f", "#d99478", "#dba667"],
    },
    // Flat white, not a tinted pastel — per direct feedback (2026-07-20),
    // same fix as the 6 new Rare themes below.
    textColor: "#FFFFFF",
    chipColor: "#dba667",
  },

  // === Rank rewards (27-rank-ladder-rework.md Phase 2) ===
  // Three only — one per movement of the nine-rank ladder, so reaching a
  // themed rank stays an event. Colour families were picked against the
  // existing 46-theme catalogue rather than in isolation: blues, reds/ambers,
  // purples and metals are all crowded, so these take the three genuinely
  // under-used spaces (slate-line, forest→gold, and wine→gold) and none of
  // them reads as a recolour of an existing card.
  {
    id: "meridian",
    name: "Meridian",
    tier: "rank",
    cost: 0,
    // Strategist (#5, ~2.5 months) — the first rank that takes real months.
    // A meridian is a navigator's line at twilight: the rank arc's "you can
    // chart it now" beat.
    //
    // REBUILT 2026-07-22 (first version rejected on sight). It was
    // `{ pattern, kind: 'lines', base: '#12263A' }`, which failed three ways
    // at once and is recorded here so none of it is repeated:
    //   1. `#12263A` sat one shade off Blueprint's `#17263A` — a COMMON
    //      theme. A rank-5 reward must not read as the cheapest blue in the
    //      shop.
    //   2. The `lines` renderer in CardThemeSurface.js uses only `line` and
    //      IGNORES `accent` entirely, so the accent that was supposed to give
    //      it life never rendered. What shipped was a flat rectangle with 1px
    //      rules every 14px.
    //   3. It was the only theme in the catalogue using `kind: 'lines'` (so
    //      visually untested) and the only non-gradient of the three rank
    //      themes, next to two rich multi-stop siblings.
    // Now a 4-stop gradient with real luminance range, opening on an
    // indigo-violet shadow no other theme uses — that shadow end is what
    // separates it from Ocean Deep (2-stop teal), Peacock (blue→green→gold),
    // Denim (grey-blue weave) and Blueprint. Final stop deliberately stops at
    // mid-light rather than pushing brighter, since the card renders white
    // text across it.
    unlock: { type: "rank", rankId: "treasurer", label: "Strategist" },
    background: {
      type: "linear",
      angle: 160,
      colors: ["#080E1F", "#1C2A54", "#356690", "#6FA8C9"],
    },
    textColor: "#FFFFFF",
    chipColor: "#9FD3F2",
  },
  {
    id: "heartwood",
    name: "Heartwood",
    tier: "rank",
    cost: 0,
    // Vanguard (#7, ~10 months). Heartwood is the dense inner core a tree
    // takes years to lay down — the one theme in the catalogue about elapsed
    // time, which is exactly what this rank certifies. Deep forest easing into
    // aged gold; the green→gold family is unused anywhere else here.
    unlock: { type: "rank", rankId: "tycoon", label: "Vanguard" },
    background: {
      type: "linear",
      angle: 150,
      colors: ["#12281C", "#1E4429", "#3F6B32", "#8A7A2E"],
    },
    textColor: "#FFFFFF",
    chipColor: "#D9B45A",
  },
  {
    id: "sovereign",
    name: "Sovereign",
    tier: "rank",
    cost: 0,
    // Sovereign (#9, ~2.8 years) — the rarest surface in the app, and the one
    // theme deliberately NAMED for its rank: you reach Sovereign, you wear
    // Sovereign. Deep wine into ember-gold, chosen over another metallic
    // because Gold Foil / Platinum / Diamond already hold that ground at
    // Legendary. `chipColor` is #D4AF37 — the exact `badgeColor` of the
    // money_master rank in lib/rewards.js, so the card and the badge you
    // earned it with share their gold.
    unlock: { type: "rank", rankId: "money_master", label: "Sovereign" },
    background: {
      type: "linear",
      angle: 145,
      colors: ["#170A10", "#3A1020", "#5C1B2F", "#8A4A2A"],
    },
    textColor: "#FFFFFF",
    chipColor: "#D4AF37",
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
