# Feature: Card Themes
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/19-card-themes.md`
**Status**: Planned
**Last Updated**: July 2026

---

## Context

The Home hero card (`AccountHeroCarousel.js`'s dark "In Hand" card) already
reads as a bank card, and `IDEAS-gamification.md`'s "Hero card themes"
section (and the published Gamification Plan artifact) designed a shop
around that metaphor: themes are card *designs*, spent with the coins
`18-gamification-ritual-and-ledger.md` already built. This feature makes
that concrete — the hero card stops hardcoding its look and instead reads a
theme token object, and a new Shop screen lets a user browse, preview, buy,
and equip one.

Reviewed and approved in chat 2026-07-20 (with a swatch-catalog artifact) —
seasonal themes (Diwali/Monsoon/Frost & Pine/Holi) are cut from this doc
entirely per that conversation; nothing below references them.

---

## Phase Overview

```
Phase 1 — Theme engine, hero card, shop (coin-purchasable tiers only)
  Free/Common/Rare themes (15 total) are buildable, buyable with coins, and
  equippable; the hero card renders whichever is equipped.

Phase 2 — Legendary + Chest-exclusive (milestone/chest-granted tiers)
  The remaining 7 themes (day-100/200/365/500/1000 milestone locks + the
  2-item chest pool) auto-grant through the existing milestone/chest
  machinery instead of being coin-purchasable.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Theme engine, hero card, shop
🚧 **Built, Babel-verified, migration applied** — pending on-device confirmation (no Android device in this environment). See Implementation Notes below.

### Goal

A user can open a Shop screen, see every Free/Common/Rare card theme (15,
grouped by tier) with its coin cost and lock state, tap one to preview it
rendered as a real hero card, buy it with coins if they can afford it, and
equip it — which immediately changes what `AccountHeroCarousel` looks like
on Home. Free themes (Ink, Lime Flood) are owned by everyone from the
start; Ink reproduces today's exact default look, so a user who never opens
the shop sees no change at all.

### Before Starting — Confirm With Codebase

- Re-read `components/AccountHeroCarousel.js` — confirm it still renders
  `<Card dark>` with hardcoded `staticColors.surface`/`staticColors.mutedMid`
  text colors, and that `Card`'s `dark` prop still resolves to
  `colors.emphasisBg` (an app-theme token, unrelated to card themes — see
  `components/Card.js`). This feature must not touch the app-wide
  light/dark/brand theme system (`theme/ThemeContext.js`) — card themes are
  a separate, orthogonal skin layered only on the hero card.
- Re-read `lib/rewardsMutations.js`'s `buyFreeze` — the purchase pattern to
  mirror exactly (read `v_reward_balances`, guard client-side, insert a
  negative-coin `reward_events` row).
- Confirm `react-native-svg` (`15.12.1`) is still the only gradient-capable
  dependency installed (`package.json`) — no `expo-linear-gradient`. Gradient
  themes must render via `react-native-svg`'s `<LinearGradient>`/`<Defs>`,
  not a new dependency.
- Confirm `profiles` table's current columns via `list_tables` before
  writing the migration (expect: `id, full_name, currency, avatar_url,
  created_at, onboarded_at, onboarding_answers` per `00-index.md`'s Schema
  Reference — verify it hasn't drifted).
- Re-read `components/MenuSheet.js` for the exact row pattern to copy for
  the new "Shop" entry (icon + label + `router.push`).

### 1.1 Database

One column, no new table — ownership reuses `reward_events` exactly like
`buyFreeze` reuses it for freezes (`source`/`ref` are already free-form
text; `UNIQUE(user_id, source, ref)` already exists and doubles as "can't
buy the same theme twice" with no new constraint). Equipped theme is a
single mutable value per user, not an append-only fact, so it's a
`profiles` column, matching `onboarded_at`'s shape.

```sql
ALTER TABLE profiles
  ADD COLUMN equipped_card_theme text NOT NULL DEFAULT 'ink';
```

No RLS change (profiles' existing owner-only policy already covers reads
and updates of this column). No view changes, so no `security_invoker`
step needed this phase.

**Ownership derivation** (no view needed — small row count per user):
a theme is owned if it's Free, or if a `reward_events` row exists with
`source = 'theme_buy' AND ref = '<themeId>'` for the current user.

### 1.2 Data Layer

- **`lib/cardThemes.js`** (new, pure data — same discipline as
  `lib/rewards.js`, no React/Supabase imports). Exports `CARD_THEMES`: an
  array of 15 theme objects for this phase —

  ```js
  {
    id: 'ink',
    name: 'Ink',
    tier: 'free',       // 'free' | 'common' | 'rare'
    cost: 0,
    background: { type: 'solid', color: '#101010' },
      // or { type: 'linear', angle: 150, colors: ['#3a2a6a', '#12101f'] }
      // or { type: 'pattern', base: '#17263A', kind: 'grid', line: '#ffffff14' }
    textColor: '#FFFFFF',
    mutedColor: '#9a9e94',
    chipColor: '#BBDC12',
  }
  ```

  Exact catalog (colors from the approved artifact):
  - **Free** (cost 0, owned by everyone, no purchase needed): Ink
    (`#101010`, chip `#BBDC12` — must match today's hardcoded hero card
    exactly), Lime Flood (`#BBDC12` bg, ink text, chip `#101010`).
  - **Common** (400 coins each): Blueprint (`#17263A` + faint grid pattern,
    chip `#8Fb8e8`), Receipt (`#F3EFE2` + horizontal ruled-line pattern,
    chip `#101010`, dark text), Dusk (linear 150°, `#3a2a6a→#12101f`, chip
    `#c9b8f0`), Ocean Deep (linear 150°, `#0d2436→#1a5a6a`, chip `#7fd6c9`),
    Ember (linear 160°, `#2b1c14→#1a1210` + warm radial glow, chip
    `#ff8c4a`), Graphite (linear 100°, `#4a4d52→#2c2e31→#55585c→#2c2e31`,
    chip `#b8bcc0`), Mint Ledger (`#E4F3E9` + faint ruled-line pattern, chip
    `#1f6b46`, dark text).
  - **Rare** (800–1,000 coins): Titanium (linear 120°, brushed-metal
    multi-stop `#7d8186→#3c3e42→#6a6d72→#3c3e42`, 800, chip `#d8dbe0`),
    Carbon Fiber (`#1a1c1f` + crosshatch weave pattern, 800, chip `#9aa0a6`),
    Marble (`#efeae4` + soft radial blotches, 900, chip `#c9a94b`, dark
    text), Rose Gold (linear 150°, `#e8b7a0→#c98b78`, 1000, chip `#7a4b3c`,
    dark text), Copper (linear 140°, `#b5651d→#e0925a→#8a4513`, 800, chip
    `#3d2410`, dark text), Denim (`#2b3a55` + diagonal weave texture, 900,
    chip `#c9d4e8`).

  Also exports `TIERS = ['free', 'common', 'rare']` (ordered, for the shop's
  section order) and `getTheme(id)` (falls back to the `ink` entry if `id`
  is unrecognized — defensive against a future removed/renamed theme).

- **`hooks/useCardThemes.js`** (new). Fetches, in parallel: `v_reward_balances`
  (for `coins`, already exposed — reuse, don't refetch via `useRewards` to
  avoid a second XP/level computation this screen doesn't need), and
  `reward_events` rows where `source = 'theme_buy'` (select `ref`), and
  `profiles.equipped_card_theme` for the current user. Subscribes to
  `useDataRefresh`'s `version` like every other read hook. Returns:
  ```js
  { coins, ownedIds: Set<string>, equippedId: string, loading, refetch }
  ```
  `ownedIds` always includes every `tier: 'free'` id from `CARD_THEMES`
  regardless of what the query returned — free themes are never rows in
  `reward_events`.

- **`lib/cardThemeMutations.js`** (new, plain async functions — same shape
  as `lib/rewardsMutations.js`).
  - `buyTheme(themeId)`: look up the theme via `getTheme`, read
    `v_reward_balances.coins`, guard `coins >= theme.cost` client-side
    (mirrors `buyFreeze`'s balance guard), then
    `reward_events.upsert({ source: 'theme_buy', ref: themeId, coins:
    -theme.cost }, { onConflict: 'user_id,source,ref', ignoreDuplicates:
    true })` — the `ignoreDuplicates` path is a defensive backstop only;
    the UI never calls this for an already-owned theme.
  - `equipTheme(themeId)`: `profiles.update({ equipped_card_theme: themeId
    }).eq('id', userId)`. Caller must have already confirmed ownership
    (free, or in `ownedIds`) — this function does not re-check server-side
    (matches this app's existing trust level for single-device,
    single-user mutations).

### 1.3 Components

- **`components/CardThemeSurface.js`** (new). Takes `{ theme, style,
  children }` and renders the themed background filling its bounds, with
  `children` layered on top (same children-on-top-of-background shape
  `AccountHeroCarousel` already uses inside `<Card dark>`). Solid themes
  are a plain `View` with `backgroundColor`; `linear`/`pattern` themes
  render an absolutely-positioned `react-native-svg` `<Svg>` behind the
  children (`<Defs><LinearGradient>...` for gradients; patterns are
  approximated with repeated `<Line>`/`<Rect>` elements — same
  no-Metro-SVG-loader inline-source convention as `Logo.js`/`ArrowMark.js`,
  not an imported `.svg` file). Exposes `theme.textColor`/`theme.mutedColor`
  back to the caller (doesn't render any text itself) so
  `AccountHeroCarousel` can apply them to its existing `Text` elements in
  place of the current hardcoded `staticColors.surface`/`staticColors.mutedMid`.

- **`components/AccountHeroCarousel.js`** (modified). Accepts a new
  `cardTheme` prop (the resolved theme object from `useCardThemes`). Swaps
  `<Card dark style={styles.heroCard}>` for `<CardThemeSurface theme=
  {cardTheme} style={styles.heroCard}>`, and every hardcoded
  `staticColors.surface`/`staticColors.mutedMid` reference inside the hero
  card's `Text`/icon elements switches to `cardTheme.textColor`/
  `cardTheme.mutedColor`. The account-color accent line
  (`accountColorLine`) and income/expense icons keep their current colors
  unchanged — only the card's own background/text respond to the theme.
  The "Add another account" teaser slide is explicitly NOT themed (stays
  on the existing `<Card dark>` ink look) — it's a system affordance, not
  part of the user's card.

- **`app/shop.js`** (new route, pushed screen — same top-level-file pattern
  as `app/settings.js`/`app/analytics.js`). Header shows the live coin
  balance (reuse the coin pill styling already established in
  `RewardsHistorySheet.js`). Body is a `ScrollView` with one section per
  tier (Free/Common/Rare), each a grid of theme tiles (name, mini
  `CardThemeSurface` swatch, cost or "Owned"/"Equipped" state). Tapping a
  tile opens a full-width preview — a real `CardThemeSurface` sized like
  the actual hero card, with placeholder "Flo" / a representative balance —
  plus a bottom action: "Equip" (owned), "Buy for N coins" (affordable,
  not owned), or a disabled "Need N more coins" state (not affordable).
  Buying calls `buyTheme` then immediately `equipTheme` is a separate
  explicit action, not automatic — matches how `buyFreeze` in
  `RewardsHistorySheet.js` is its own confirm step, not bundled with any
  follow-on action.

### 1.4 Navigation / Integration

- `components/MenuSheet.js` gains a "Shop" row (new icon — a shopping-bag
  or palette lucide icon, not yet used elsewhere in the menu), navigating
  to `/shop`, placed near the existing Analytics/Plans/Settings rows per
  the skill's own standing convention (new global destinations go in the
  menu sheet, not a new tab).
- `app/(tabs)/index.js` (Home) passes `cardTheme` (resolved via
  `useCardThemes` + `getTheme(equippedId)`) into `AccountHeroCarousel`.

### 1.5 Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| `AccountHeroCarousel.js` | Background/text now theme-driven instead of hardcoded | Verify the Free "Ink" theme pixel-matches today's card exactly, so existing users see zero visual change until they visit the Shop |
| `MenuSheet.js` | New "Shop" row | None beyond the row itself |
| `reward_events` | New `source: 'theme_buy'` values | None — schema is already free-form text, no migration needed for this |
| `18-gamification-ritual-and-ledger.md`'s reward economy | Unaffected — coins are spent, never newly earned, by this feature | None |

### 1.6 What This Phase Does NOT Include

- Legendary tier (Gold Foil/Onyx/Platinum/Aurora/Diamond) or Chest-exclusive
  tier (Holographic/Velvet) — Phase 2.
- Seasonal themes — cut from this doc entirely per the 2026-07-20 review.
- Per-account theming (each account keeps the same equipped theme — the
  hero card is themed per-*user*, matching how coins/XP/streak are already
  user-scoped, not account-scoped). Account-level skins using `accounts.color`
  remain a documented future idea in `IDEAS-gamification.md`, not built here.
- Cash/IAP purchase of themes (dual-track earn-or-cash per the IDEAS doc)
  — no IAP infrastructure exists in this app yet; out of scope until that
  lands.
- Animated sheen/foil effects on rare themes — ship static first, animation
  is a follow-up polish pass once the shop itself is confirmed working.

### 1.7 Phase 1 Checklist — Before Marking Complete

- [x] Migration applied: `profiles.equipped_card_theme` exists, `NOT NULL
      DEFAULT 'ink'`, confirmed via `list_tables`
- [x] `lib/cardThemes.js` exports all 15 Phase-1 themes with correct
      tier/cost/colors matching the approved artifact
- [x] `useCardThemes` returns correct `coins`/`ownedIds`/`equippedId` for
      the test account, including both free themes present by default
- [x] `CardThemeSurface` renders solid, linear-gradient, and at least one
      pattern theme correctly on-device (confirmed — also how the trend-icon
      clash was found, see Post-Phase-1 fixes below)
- [ ] Ink theme is visually indistinguishable from the pre-feature hero
      card (confirmed by direct comparison) — not explicitly re-checked
      on-device, low risk (same hex values, same component structure)
- [x] Buying a theme deducts the correct coin amount exactly once, even if
      tapped twice quickly
- [x] Equipping a theme immediately changes the Home hero card
- [ ] Buying a theme you can't afford is blocked client-side with a clear
      message, no partial state — not explicitly exercised on-device
- [x] Shop screen reachable from Menu, shows correct owned/equipped/locked
      state per tile
- [ ] App-wide light/dark/brand theme switching (`theme/ThemeContext.js`)
      is unaffected by any equipped card theme — not explicitly re-checked

**Phase 1 confirmed working on-device 2026-07-20** (buy + equip both
exercised) — two real bugs found and fixed (see Post-Phase-1 fixes below).
Proceeding to Phase 2 per direct go-ahead.

### Implementation Notes

- **Migration applied** (`add_profiles_equipped_card_theme`): `profiles`
  live schema confirmed via `list_tables` first (it had drifted well past
  `00-index.md`'s Schema Reference — gained `theme_accent`/`theme_mode`/
  `timezone`/reminder/report columns from features not yet indexed there;
  none of that affected this migration). Security advisor run after: only
  the 4 pre-existing WARNs, no new finding (no view recreated, so no
  `security_invoker` step needed).
- **`CardThemeSurface`'s `style` prop carries no padding, by design** — RN
  positions an absolutely-positioned child (the gradient/pattern SVG
  overlay) relative to its parent's *padding* edge, not its border edge, so
  padding on the same View as the overlay would leave a see-through gap in
  the padded gutter. Fixed by splitting `AccountHeroCarousel`'s old
  `heroCard` style into `heroCardShape` (border radius only, passed to
  `CardThemeSurface`) and a new `heroCardContent` inner wrapper (the actual
  padding, applied to a plain sibling `View` around the card's real
  content). The pre-existing "Add account" teaser slide keeps using the
  original `heroCard` style directly on `<Card dark>`, untouched, per the
  doc's own scope note.
- **Gradients/patterns render via `react-native-svg`'s `SvgXml`**, not
  `expo-linear-gradient` (confirmed not installed) — a small SVG-string
  builder in `CardThemeSurface.js` covers `type: 'linear'` (multi-stop,
  CSS-angle-to-SVG-coordinate conversion) and `type: 'pattern'` (5 kinds:
  `grid`/`lines`/`weave`/`blotch`/`glow`, covering all 9 non-solid/
  non-plain-gradient Phase 1 themes). Same inline-SVG-string convention as
  `Logo.js`/`ArrowMark.js`. Uses a fixed stretched viewBox rather than the
  card's real pixel size, so pattern density is an approximation of the
  artifact's CSS look, not pixel-identical — flagged in the doc as
  acceptable for Phase 1, refine on-device if a specific theme reads wrong.
- **`AmountText`'s hero-card balance recolors via its existing `style` prop
  override** (`style={[styles.heroBalance, { color: theme.textColor }]}`)
  rather than adding a new prop to `AmountText` itself — its `style` prop
  already merges last over the computed `dark`-mode color, so this needed
  no changes to that shared component. The muted ₹ currency-symbol tint
  (a nested `Text`, not reachable via the outer `style` override) was left
  as `AmountText`'s existing fixed dark-grey — a minor, already-de-emphasized
  detail, not worth a new prop for one call site.
- **Loading-state skeletons on the hero card** changed from a hardcoded
  `staticColors.inkCard` fill to a theme-agnostic `rgba(128,128,128,0.25)`
  — the old fixed dark-grey would have read as a visible dark blob on a
  light-background theme (Receipt/Mint Ledger/Marble).
- **Equip/buy call `notifyChanged()` (non-silent)**, unlike
  `useProfile.updateProfile`'s `silent` option used elsewhere for
  `theme_accent`/reminder-time writes — the hero card visibly depends on
  `equipped_card_theme`, so a full app-wide refetch on change is
  intentional here, same reasoning `buyFreeze`'s own call site already
  established for coin/freeze changes.
- **`equipTheme`/`buyTheme` are plain functions in `lib/cardThemeMutations.js`**,
  called directly from `app/shop.js` (not a bottom sheet) — the Shop is a
  full pushed screen per the doc's Phase 1 spec, following
  `app/settings.js`'s header/back-button pattern rather than any sheet
  pattern.
- **No changes needed to `18-gamification-ritual-and-ledger.md`'s reward
  economy** — `reward_events.source` is free-form text with no enum/CHECK
  constraint, so `'theme_buy'` needed no schema change, exactly as planned.

**Post-Phase-1 fixes** (found via real on-device testing, 2026-07-20 — buy
and equip both confirmed working):
- **Income/expense trend icons clashed with several card backgrounds** —
  they'd always used a fixed brand green/red (`colors.income`/
  `colors.dangerStrong`, from the app's own theme, unrelated to card
  themes), which read fine on plain Ink but had poor contrast or an ugly
  clash against similarly-hued or busy themes (Ocean Deep, Ember, Dusk...).
  Fixed with a small translucent grey scrim tile (`heroStatIconTile`,
  `rgba(128,128,128,0.32)`) behind each icon — keeps the green/red signal
  fixed (that convention shouldn't change per theme) while guaranteeing
  legibility against *any* theme, current or future, without hand-tuning a
  contrast-safe accent pair per theme.
- **The hero balance's muted ₹ symbol didn't follow the equipped theme** —
  `AmountText`'s `dark` mode hardcoded it to `staticColors.mutedDarker`
  regardless of what card theme was equipped. Added an optional
  `currencyColor` prop to `AmountText` (overrides the computed tone for a
  positive amount only; every other call site omits it and is unaffected),
  wired to `theme.mutedColor` from `AccountHeroCarousel` — reuses the same
  per-theme muted tone already curated in `lib/cardThemes.js`, no new color
  data needed.

---

## Phase 2 — Legendary + Chest-exclusive
✅ **Built, Babel-verified** — pending on-device confirmation.

### Goal

The remaining 7 themes stop being missing and start auto-granting through
mechanics that already exist: Gold Foil/Onyx/Platinum/Aurora/Diamond unlock
automatically the moment a user's streak crosses day 100/200/365/500/1000;
Holographic/Velvet become a deterministic pick-1-of-3 chest at day 30/50.
None of the 7 are ever coin-purchasable in the Shop — they show there as
locked, with their unlock condition as the caption, exactly like a trophy.

**Correction caught while starting this phase**: the original Phase 1 doc's
"Before Starting" note said the ladder extends to "200/500/1000" — that
dropped **365** (Platinum's own day, "the year", named in both
`IDEAS-gamification.md` and the artifact's Milestones table the whole time).
Fixed here: the real extension is **200/365/500/1000**.

**Chest design, resolved during this phase** (the original doc left the
exact chest contents undecided): day 30 offers {300 coins, 2 freezes,
Holographic}; day 50 offers {500 coins, 2 freezes, Velvet}; day 100 grants
Gold Foil **directly**, not through a chest — it's the flagship milestone
reward, not one of a choice. This keeps the "deterministic, same pool for
everyone, no gacha" rule from `IDEAS-gamification.md`'s Chests section
while giving Holographic/Velvet an actual acquisition path.

### 2.1 Database
No database changes — `reward_events.source` is free-form text; the new
`'theme_grant'` and `'chest'` source values need no migration, same as
`'theme_buy'` in Phase 1.

### 2.2 Data Layer
- `lib/streak.js`'s `MILESTONES` extended to
  `[3, 7, 10, 30, 50, 100, 200, 365, 500, 1000]`.
- `lib/rewards.js`'s `MILESTONE_REWARDS` gained entries for 200/365/500/1000
  (coin/freeze lumps on the same scaling curve as 3–100). New
  `MILESTONE_THEME_GRANTS` map (day → legendary theme id), read by
  `claimMilestone`.
- `lib/cardThemes.js` gained 7 entries: 5 `tier: 'legendary'` (each with
  `unlock: { type: 'milestone', day }`, no `cost`) and 2 `tier: 'chest'`
  (each with `unlock: { type: 'chest', day }`). New `LOCKED_TIERS` export
  (`['legendary', 'chest']`) alongside Phase 1's purchasable `TIERS`.
- `lib/rewardsMutations.js`'s `claimMilestone` now also upserts a
  `source: 'theme_grant', ref: <themeId>` row (a SEPARATE row from the
  existing `milestone:<day>` coins/freezes row — different `ref` shape,
  can't share one upsert) whenever `MILESTONE_THEME_GRANTS[day]` exists.
  New `claimChestPick(day, choice)` — upserts `source: 'chest',
  ref: 'chest:<day>'` for the coins/freezes, then (only if that claim was
  genuinely new) a second `theme_grant` upsert if the picked choice carries
  a theme.
- `hooks/useCardThemes.js`'s ownership query widened from
  `.eq('source', 'theme_buy')` to `.in('source', ['theme_buy', 'theme_grant'])`
  — both mean "owned".

### 2.3 Components
- **`components/MilestoneChest.js`** (new) — a full-screen ink `Modal`,
  same visual language as `StreakCelebration.js` (icon tile, title, body).
  Exports `chestPoolFor(day)` (the fixed 3-item pool, or `null`) and the
  component itself (`{ day, visible, onDone }`), which renders the 3
  options (theme options as a mini `CardThemeSurface`, coin/freeze options
  as an icon tile), claims via `claimChestPick` on tap, then shows a "Nice"
  button once resolved.
- **`components/StreakCelebration.js`** — now sequences a second Modal
  after its own: dismissing the celebration screen (`handleCelebrationDismiss`)
  checks `chestPoolFor(current)` (captured into state at the same moment the
  celebration's content is decided, so both screens describe the same
  milestone snapshot) and, if it exists, shows `MilestoneChest` next instead
  of just closing. The two Modals are siblings in a fragment, gated by
  separate `visible`/`chestVisible` booleans — never both `visible` at once.
- **`app/shop.js`** — gained a `LOCKED_TIERS` section below the buyable
  grid, using the same `renderTile` helper with a different caption
  function (`unlockCaption`, reads `theme.unlock`) instead of a price.
  Locked tiles are still tappable for a preview; the action row shows the
  unlock condition as a disabled pill instead of Buy/Need-more once
  `theme.unlock` is set (checked before falling through to the
  cost-based branches, which would otherwise divide by `undefined`).

### 2.4 Navigation / Integration
No new routes — everything lands inside the existing Shop screen and the
existing `StreakCelebration` root-mounted flow.

### 2.5 Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| `lib/streak.js` MILESTONES | Extended to 10 tiers (was 6) | None — `lib/trophies.js`'s Streak Keeper trophy tiers `.map()` over this list already, so it automatically gained 4 more trophy tiers as a side effect |
| `StreakCelebration.js` | Now conditionally chains a second Modal | Verify the two Modals never both show at once on-device |
| `app/shop.js` | New locked section, new action-row branch | Verify `selected.cost` is never read for a `theme.unlock` theme (would be `undefined`) |

### 2.6 What This Phase Does NOT Include
- Seasonal themes — cut from this doc entirely (Phase 1 decision, still stands).
- Animated sheen/foil/prismatic-edge effects (Onyx's "prismatic edge glow" is
  approximated as a static corner glow, not the artifact's animated sweep).
- Cash/IAP purchase of any theme — same Phase 1 deferral, no IAP infra yet.
- Chests beyond day 30/50 — day 100+ are direct Legendary grants, not chests,
  by design (see "Chest design, resolved during this phase" above).

### 2.7 Phase 2 Checklist — Before Marking Complete
- [x] `MILESTONES`/`MILESTONE_REWARDS` extended to 200/365/500/1000
- [x] `lib/cardThemes.js` exports all 5 Legendary + 2 Chest-exclusive themes
- [x] `claimMilestone` grants the correct theme alongside coins/freezes for
      100/200/365/500/1000, and grants nothing extra for 3/7/10/30/50
- [x] `claimChestPick` is idempotent per day (picking twice, or the
      celebration replaying, never double-grants)
- [x] Shop's locked section shows correct unlock captions, no NaN/undefined
      rendering for cost-less themes
- [ ] On-device: a real (or manually-credited) day-30/50/100 milestone shows
      the correct chest/direct-grant flow — not exercised here, no way to
      fast-forward a real streak in this environment
- [ ] On-device: MilestoneChest and StreakCelebration never visually overlap

**→ Stop here. Show the result — this closes out the feature's two planned
phases.**

### Implementation Notes

- **Freeze purchase added to the Shop as a second tab** (Cards/Freeze),
  per direct request mid-Phase-2 — not in the original doc. Reuses
  `buyFreeze`/`FREEZE_COST`/`FREEZE_CAP` from the existing Phase-4 freeze
  economy (`18-gamification-ritual-and-ledger.md`) unchanged;
  `RewardsHistorySheet`'s own freeze-buy card was left in place rather than
  removed, so freezes are purchasable from two surfaces now (low risk,
  same underlying mutation, no behavior divergence possible).
- **Day-100 deliberately bypasses the chest** — resolved a real ambiguity
  in the original artifact (which showed 🎁 at 30/50/100 but only *named*
  Gold Foil at 100, without saying whether it was chest-picked or direct).
  Treated as direct per this doc's own Phase 1 language ("Gold
  Foil/Onyx/Platinum/Aurora/Diamond unlock automatically") — kept
  consistent rather than silently contradicting Phase 1's own Goal section.
- **`MilestoneChest` and `StreakCelebration` are two separate Modals, not
  one** — RN's `Modal` renders in its own native layer; showing chest
  content *inside* the celebration's existing Modal risked the same
  "renders above/hides the other" class of bug already fixed once for
  `RewardBurst`/`StreakCelebration` (`18-gamification-ritual-and-ledger.md`
  Phase 3). Sequencing two Modals (one dismisses, state flip shows the
  next) sidesteps that entirely rather than re-solving the same z-order
  problem a second time.

**Further UI iteration, same session, per direct feedback:**
- **Buy/Equip moved from an inline row under the preview card to a
  floating bottom bar** (`floatingBar`, `position: absolute` + safe-area
  bottom inset) — reachable regardless of scroll position, instead of
  scrolling away with the preview. Freeze tab keeps its own inline button
  (a single always-visible card has no scroll-away problem to solve).
  `renderTile`'s signature changed from a trailing boolean to an options
  object (`{ showCoin, locked }`) once it grew a second flag, to keep call
  sites readable.
- **Coin glyph beside every unowned priced tile's cost** (`tileMetaRow`,
  `CircleDollarSign` at 10px) — matches the header/freeze-tab convention of
  never showing a bare coin number. Suppressed for "Free"/"Owned"/
  "Equipped"/unlock captions automatically (`showCoinIcon` checks `!owned
  && t.cost > 0`), not just when the caller opts out.
- **Locked (Legendary/Chest, not-yet-earned) tiles get a dark scrim + lock
  glyph over the swatch**, plus a small lock icon beside the unlock
  caption — makes "you can't buy this" legible at a glance instead of only
  via the caption text, which read too similar to a price at small size.
  Clears automatically once the theme is actually owned (milestone/chest
  grant already flips `ownedIds`, which `renderTile` already checks first).
- **Aurora ↔ Velvet swapped tiers** — Velvet is now Legendary (day 500,
  Aurora's old milestone slot exactly); Aurora is now the day-50
  chest-exclusive (Velvet's old slot). Pure a reassignment: `id`/`name`/
  colors untouched, only `tier`/`unlock` traded. Required three synced
  edits: `lib/cardThemes.js` (the theme objects), `lib/rewards.js`'s
  `MILESTONE_THEME_GRANTS[500]`, and `MilestoneChest.js`'s day-50 pool —
  all three keyed off the same theme ids, easy to miss one.
- **Shop gained a coin balance in the header for all tiers**, second tab
  for Freeze (`buyFreeze` reused unchanged, `RewardsHistorySheet`'s own
  card left in place — two reachable surfaces, one mutation, no divergence
  risk).

**Post-Phase-2 polish round, same session, real on-device review:**
- **`mutedColor` (every theme's subtext + the muted ₹ currency symbol) is
  now derived, not hand-picked** — `lib/color.js` gained `withOpacity(hex,
  alpha)`; `lib/cardThemes.js` computes `mutedColor: withOpacity(textColor,
  0.62)` once, for all 23 themes, instead of each theme carrying its own
  separately-chosen muted hex. A hand-picked grey wasn't guaranteed to read
  as "the same color, dimmer" — a genuine alpha composite is, against *any*
  background (solid, gradient, or pattern) behind it. Verified at runtime
  (not just Babel-parsed) that every theme's `mutedColor` is a real
  `rgba(textColor, 0.62)` string.
- **Income/expense trend icons, several iterations**: fixed colors
  (`colors.income`/`colors.dangerStrong`) clashed with several card
  backgrounds → derived from each theme's own `chipColor` via
  `lighten`/`darken` behind a neutral scrim tile → the scrim itself started
  reading as a clash/overlap, removed it → tried darkening expense harder
  (0.4 → 0.6 → 0.75) to compensate → still didn't read reliably. Landed on:
  **both icons share one `lighten(chipColor, 0.65)` tint**, no scrim, icon
  size back to 11 (a size bump tried mid-way was reverted). Income/expense
  are told apart by the arrow direction and the amount itself, not icon hue.
- **`heroStat`/`previewStat` bottom-aligned, not centered** — the value
  (`fontSize.md`) and label (`fontSize.sm`) are different sizes; `alignItems:
  'center'` left them visually offset from each other and from the icon.
  `flex-end` reads as one shared baseline.
- **`weave` pattern was a real bug, not a taste call** — Carbon Fiber and
  Denim's crosshatch was built from two PARALLEL vertical lines rotated
  together, which only ever produces two lines going the SAME diagonal
  direction, never a crossing weave. Fixed to one vertical + one horizontal
  line per tile (a plain square grid) rotated 45° together — *that's* what
  actually crosses into two directions.
- **Marble redone** — was a pale base + a BLACK-tinted blotch overlay
  (`accent: '#0000001a'`), which read grey/dirty, not polished stone.
  Replaced with a warm 4-stop linear gradient (ivory → beige → light brown
  → ivory), matching real cream/Botticino marble and reading as a sheen the
  flat pattern didn't.
- **Added Lava** (Rare, 850 coins) — built directly from FLO's own streak
  colors (`theme/tokens.js`: `streak`/`streakDeep`), not an arbitrary fire
  palette, per an explicit ask to match the app's existing "hot red." Dark
  charred-to-ember gradient, deliberately stops short of the brightest
  streak orange as a full stop so white text stays legible throughout.
  `chipColor` is literally the app's `streak` orange.
- **`blotch` pattern gained `accent3`** (optional, Aurora only so far) and
  a general rework: colors were originally too close together (Aurora's new
  third blob landed directly between the other two, muddying into an
  overlap) — repositioned all three blobs to separate corners, widened
  radii, and added a softer 3-stop opacity falloff (full → half →
  transparent, not a hard cliff) for a diffuse-blur look instead of
  sharp-edged discs. Applies to Marble too (2-blob case), not just Aurora.
- **`glow` pattern gained an optional `colors` array** (multi-stop radial,
  falls back to the original single-`accent` shape when omitted — Ember
  unaffected) — used to redo **Onyx**: was a flat white corner glow that
  "didn't sit tight"; now a prismatic sweep (white → violet → cyan → gold)
  before fading out, closer to the original "prismatic edge glow" concept
  (the actual animated sweep is still deferred, static rendering only).

**Round 2 (post-APK-build review):**
- **Real bug: Ink's trend-icon accent ignored the app's own selected
  Primary Color.** Income/expense icons derive from the equipped theme's
  `chipColor` — correct for a bought/equipped cosmetic, which should stay
  fixed regardless of app settings. But Ink is the free DEFAULT (no theme
  bought), and `lib/cardThemes.js` hardcodes its `chipColor` to lime — so
  anyone who'd picked a different Primary Color in Settings
  (`theme/ThemeContext.js`'s `ACCENTS`) still saw lime trend icons on the
  default card. Fixed: for Ink specifically, the accent source is
  `colors.brand` (the live, theme-aware selected accent) instead of
  `theme.chipColor`. `colors.brand` already resolves independent of
  light/dark app mode (`theme/themes.js`'s `resolveColors` sets it
  unconditionally), so one change fixed both modes. Every other theme keeps
  reading its own fixed `chipColor` — an equipped cosmetic shouldn't drift
  when the app accent changes.
- **`heroStat`/`previewStat` restructured** — bottom-aligning the whole row
  (icon + value + label) made the icon look like it was "sinking" below the
  text. Split into two nesting levels: the outer row (icon vs. a text
  group) stays `alignItems: 'center'`; a new inner `heroStatTextGroup`/
  `previewStatTextGroup` wraps just the value+label pair with `alignItems:
  'flex-end'`, so only those two (the mismatched-font-size pair that
  actually needed a shared baseline) bottom-align, and the icon centers
  against the group's full height. Also caught `app/shop.js`'s preview
  icons were still at size 13 from an earlier round — reverted to 11 to
  match the confirmed-good size on the real hero card.
- **Custom buy dialog replaces `Alert.alert`** (theme purchases only —
  freeze purchase still uses `Alert.alert`, no visual "item" to show for
  it) — a centered `Modal` (`dialogOverlay`/`dialogCard`, same shape as
  Settings' delete-confirm dialog) showing a real `CardThemeSurface`
  preview of the theme being bought. Two stages in one dialog, not two
  separate flows: `confirm` (theme preview + "Spend N coins?" + Buy/Cancel)
  transitions in place to `bought` (same preview + a small checkmark badge
  + "You bought [name]" + Equip/Not now) after a successful purchase —
  Equip is right there instead of requiring a second trip back into the
  grid. `buyDialogStage` (`null | 'confirm' | 'bought'`) is the only new
  state; both stages read `selected`, no separate "which theme" tracking
  needed since the dialog is always about the currently previewed theme.

---

## Data Model Summary (Final State After All Phases)

```
profiles
  └── equipped_card_theme (text, FK-less reference into lib/cardThemes.js's
      CARD_THEMES array — not a DB foreign key, same pattern as
      categories.icon referencing a client-side icon-key map)

reward_events (existing table, no schema change)
  ├── source='theme_buy',   ref=<themeId>        → Phase 1 purchases
  ├── source='theme_grant', ref=<themeId>         → Phase 2 milestone/chest theme grants
  ├── source='milestone',   ref='milestone:<day>' → Phase 2 coin/freeze lump (existing shape, 18-...md)
  └── source='chest',       ref='chest:<day>'     → Phase 2 chest coin/freeze choice
```

No new tables. `CARD_THEMES` in `lib/cardThemes.js` is the single source of
truth for every theme's identity/look/price — the DB only ever stores
*which ids* a user owns/has equipped, never any color/style data.

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| `AccountHeroCarousel.js` | Reads a theme object instead of hardcoded colors | Phase 1 |
| `MenuSheet.js` | New "Shop" entry | Phase 1 |
| `AmountText.js` | Gained an optional `currencyColor` prop (unused by every other call site) | Post-Phase-1 fix |
| `lib/rewards.js` / `lib/streak.js` | Milestone ladder extended to 200/**365**/500/1000 (corrected from the Phase 1 doc's own "200/500/1000" typo) | Phase 2 |
| `lib/rewardsMutations.js`'s `claimMilestone` | Also grants a theme on qualifying milestones (100/200/365/500/1000) | Phase 2 |
| `lib/trophies.js` | Streak Keeper trophy gained 4 more tiers automatically (maps over `MILESTONES`) | Phase 2 side effect, no code change |
| `StreakCelebration.js` | Chains into `MilestoneChest` on day 30/50 | Phase 2 |
| `18-gamification-ritual-and-ledger.md`'s Chests concept | Gets its first real UI (deterministic pick-1-of-3, day 30 and 50) | Phase 2 |
| `RewardsHistorySheet.js` | Unchanged — its own freeze-buy card still works alongside the Shop's new Freeze tab | Phase 2 (Shop tabs) |

---

## Out of Scope (All Phases)

- Seasonal themes (Diwali, Monsoon, Frost & Pine, Holi) — cut in the
  2026-07-20 review; would need their own doc if revisited later.
- Per-account card theming — documented future idea only.
- Cash/IAP theme purchases — blocked on IAP infrastructure not existing yet.
- Calendar skins, confetti styles, app icon variants, mascot skins — other
  shop categories from `IDEAS-gamification.md`, each its own future feature.
- Animated sheen/foil/aurora motion effects — static rendering only, in
  both phases.

---

## Post-Phase addendum: 6 new Rare themes (2026-07-20)

Added directly to the Shop's purchasable Rare tier — **Borealis** (900),
**Undertow** (850), **Supernova** (950), **Eclipse** (950), **Peacock**
(900, renamed from "Golden Hour" per direct feedback — no purchases existed
yet, confirmed via the live ledger, so the `id` was renamed too:
`golden-hour` → `peacock`, matching the catalogue's own convention of `id`
mirroring `name`), **Stargazer** (1000). Inspired by references dropped in
`claude-design/cardthemeideas/` (6 reference images) — built as gradients/
patterns matching the existing catalogue's shape, not the images themselves.
That was a real question worth recording the reasoning for, since it sets
precedent for any future "here's a reference image" request: using the actual
photos would need (a) a new `image` background type in `CardThemeSurface.js`
(currently only `solid`/`linear`/`pattern`), (b) an asset/storage pipeline
this app doesn't have for card themes, and (c) per-region contrast detection
to pick text color against an arbitrary photo (today every theme hand-picks
one flat `textColor`, which only works because the theme author already knows
the gradient won't have a sharp light/dark split under the actual text). None
of that exists here, and a raster image also can't rescale cleanly across the
hero card's different real sizes (Home vs. Shop preview) the way an SVG
gradient does for free. Decided to build as gradients/patterns instead — same
approach as every existing theme.

Two new `CardThemeSurface.js` pattern kinds: `'grain'` (Undertow — a diagonal
gradient with a fixed speckle of low-opacity dots approximating film grain,
since SVG can't do real photographic noise) and `'starfield'` (Stargazer — a
denser star scatter + a glow rising from the bottom edge; a deliberate
sibling to `'nebula'`, not a shared/parameterized kind, so tuning one can't
regress the other). Where a reference's brightest gradient stop would fight a
single flat text color across the whole card (Eclipse's orange, Peacock's
gold), the stop was muted rather than reproduced exactly — same restraint
`lava`/`marble` already use elsewhere in this catalogue.

**Text color fix, same day**: all 6 new themes plus **Nebula** and
**Daybreak** (`20-milestone-spin-wheel.md` Phase 2's first-week themes)
originally used a color-tinted near-white `textColor` (e.g. Borealis'
`#EAFBFF`, Nebula's `#e8ddff`) — reads as low-opacity/washed out on the
amount/income/expense text per direct feedback. Changed all 7 to flat
`#FFFFFF`, matching how most of the pre-existing catalogue already does it
(Dusk, Ocean Deep, Ember, Titanium, Aurora, etc.) — `mutedColor` (the
currency symbol/subtext) is derived automatically from `textColor` via
`withOpacity`, so it updated for free with no separate change needed.

**Deliberately undecided, per direct instruction**: whether these stay
regular coin-purchasable Shop themes, or some/all of them get reclassified as
milestone/chest/trophy-exclusive rewards instead (`21`'s trophy-reward system
is the most likely fit for at least one, if that's the direction). Shipped
into the Shop now so they're usable/visible while that's decided.

### Second batch: 3 more Rare themes, from photos shared directly in chat

**Orchid Dusk** (950), **Crimson Shore** (900), **Dawnfall** (1000) — same
day, same reasoning (gradients/patterns, not the actual photos), added to the
same Rare tier. Text flat `#FFFFFF` from the start — no separate fix needed,
unlike the first batch.

Iterated twice, same session, per direct feedback — final state only
(the intermediate builds aren't worth re-deriving from history):

- **Started as horizontal-band gradients** (Orchid Dusk linear + a star
  scatter; Crimson Shore/Dawnfall reusing `'grain'`/a new star+gradient
  hybrid). **Changed**: "instead of horizontal layering, a radial mixed blur
  at random places" — Crimson Shore and Dawnfall now both use the existing
  **`'blotch'`** kind (the same multi-radial-blob mixing Aurora/Marble
  already use), just with their own palettes. **Then**: "I don't think the
  star patterns are required for both" — the star scatter was dropped
  entirely from both. Net result: **Orchid Dusk is a plain `type: 'linear'`
  gradient** (no pattern kind needed at all without stars); **Crimson
  Shore** and **Dawnfall** are both plain `'blotch'`. The intermediate
  `'starlit'`/`'starblotch'` pattern kinds this went through were removed
  from `CardThemeSurface.js` once nothing referenced them anymore — no
  orphaned dead code left behind.
- **Supernova/Eclipse re-tuned**: Supernova's stops darkened/desaturated
  (same hue progression, less neon-bright) per "colors look too bright and
  contrasting." Eclipse's indigo→magenta→orange stops softened and moved
  closer together per "gradient should be smoother, clashing colors look a
  little harsh" — same restraint as this file's own Lava/Marble precedent,
  applied more aggressively here.

**Shop UI**: `app/shop.js`'s preview card + tabs are now pinned above the
theme grid instead of scrolling with it — same pinned-top/scroll-middle
shape `MenuSheet.js` already uses — per direct feedback that picking a theme
shouldn't require re-scrolling back up each time.

### Third round: 4 themes removed, Daybreak/Borealis re-tuned, day-1/10/200 gaps

**Removed entirely, per direct instruction** — **Stargazer** and **Nebula**
(too similar to each other), **Onyx** and **Jupiter**. Their now-unused
`CardThemeSurface.js` pattern kinds (`'nebula'`, `'starfield'`) were deleted
too, not left as dead code — same discipline as the `'starlit'`/`'starblotch'`
cleanup earlier this session.

**Consequence, flagged rather than silently patched**: three milestones lost
their theme grant and are genuinely open until new inspiration arrives:
- **Day 1** (was Nebula) → filled with the existing purchasable **Ocean
  Deep** (`SPIN_WHEELS[1].theme` in `lib/rewards.js`) rather than left empty —
  it stays buyable in the Shop too; owning it both ways is harmless.
- **Day 10** (was Jupiter) → `SPIN_WHEELS[10]` now has no `theme` key at all;
  the day still pays its full coin/freeze bonus, just no theme, until a
  replacement is chosen.
- **Day 200** (was Onyx) → removed from `MILESTONE_THEME_GRANTS`; same "still
  pays coins/freezes, no theme yet" state.

**Daybreak** re-tuned twice: first pass smoothed the transition by darkening
every stop, which lost the bright sunrise payoff entirely ("lost its bright
color... looks a bit dark now"). Fixed by keeping the dark-night top and
bright-amber bottom close to their ORIGINAL brightness and adding two
bridging mid-stops instead (5 stops total) — smooths the jump without
dimming the card.

**Borealis** replaced with a real aurora-photo reference (navy sky → rich
blue → a pale haze → magenta-purple aurora → dark treeline silhouette),
iterated four times, same session:
1. Vertical angle (180°) to match the photo's bands — read worse in-app than
   the diagonal, reverted to 45°.
2. Violet bridge stop, still `linear` — not smooth enough per feedback
   ("even more smoother like Crimson Shore").
3. Switched to **`'blotch'`** (the same radial-blob technique Crimson
   Shore/Dawnfall/Aurora use) — genuinely smoother by construction, and the
   violet bridge became an indigo-leaning purple blob (`#4a2a9e`) per
   "change the violet to purple close to indigo."
4. **Reverted to `linear`** per direct instruction ("it should be linear
   only, but this level smooth") — 6 close-spaced stops tuned to approximate
   the same smoothness, turquoise given real presence as its own visible
   band (`#1ab0c9`) rather than a fleeting transition color, per "the
   turquoise should be a little more." **The `'blotch'` version from step 3
   is kept as a commented-out fallback directly in the theme entry** — the
   user may revert to it if the linear version doesn't read as smooth
   enough on-device.
5. **"Equal color distribution"** — blue/turquoise/purple each held a
   genuine flat 3-stop plateau at equal 1/3 spacing, computed via real linear
   RGB interpolation (a small node script, not eyeballed hex), 13 stops
   total. Still flagged as structurally softer-but-not-blotch-soft (a
   `linearGradient` transition is a straight-line ramp; `'blotch'`'s radial
   blobs use a 3-point EASED falloff instead) — no amount of further linear
   tuning was going to close that gap.
6. **Switched to `'blotch'`**, per direct instruction ("switch back to
   blotch") — same accent/accent2 as the earlier blotch attempt (deep blue +
   indigo-purple), `accent3` upgraded to the more vivid turquoise (`#1ab0c9`)
   from the linear round.
7. **Re-checked the reference a second time** — "not necessary to have
   equal distribution" released the equal-thirds constraint; re-examined the
   actual photo and found the purple aurora glow is clearly the DOMINANT
   color (most of the lower two-thirds, not an equal third), the pale
   transitional haze is genuinely brief (not a bold teal band), and
   corrected `accent2` (was too dark/muted) and `accent3` (was too
   saturated) to match: `accent: '#1450a8'`, `accent2: '#7a3fc0'`,
   `accent3: '#6fb8c9'`.
8. **Back to `linear` again**, per direct instruction, specifically to match
   **Eclipse's** own look/angle (165° — Eclipse's actual value, not a literal
   45°, flagged in case that was meant literally). First pass gave purple a
   flat 3-stop plateau (repeated identical color) to convey dominance — "not
   as smooth as Eclipse" turned out to be about that flat, non-evolving
   stretch specifically, since Eclipse's own gradient never repeats a stop
   and evolves continuously. Fixed to 6 distinct, non-repeating stops with
   purple's dominance carried by color choice (a purple-leaning bridge stop)
   instead of repetition — still came back "not good."
9. **Settled on `'blotch'`, FINAL**, per direct instruction ("switch back to
   blotch") — using step 7's corrected colors. Not revisiting `linear` again
   for this theme: 'blotch's radial blobs use a 3-point EASED opacity
   falloff, structurally softer than any `linearGradient` stop-to-stop ramp
   can be, and multiple rounds of stop-tuning already established that
   ceiling isn't enough for what this theme needs.

**Net catalogue count: 33 themes** (was 37, minus the 4 removed). **Borealis
is `'blotch'`** (`accent: '#1450a8'`, `accent2: '#7a3fc0'`,
`accent3: '#6fb8c9'`), final.

### Fourth batch: 2 more Rare themes, blue-sky photos shared directly in chat

**Dusk Bloom** (950) and **Cumulus** (900) — same day, same reasoning.
Dusk Bloom is a smooth vertical `linear` (vivid blue → blue-lavender → soft
pink bloom), matching its reference's own soft top-to-bottom transition.
Cumulus is `'blotch'` over a flatter, more uniform cerulean base — its
reference photo is a fairly solid blue sky with scattered pink/lavender/white
cloud puffs, and 'blotch's soft blobs approximate the color mood; this
renderer has no pattern kind that draws actual cloud shapes, flagged rather
than pretended otherwise. Both biased darker/more saturated than their
photos (which run genuinely pale in places) so flat white text stays
legible everywhere — same restraint as Lava/Marble/Peacock.

**Net catalogue count: 35 themes.**

### Fifth: Ember Night (1000), one more sky photo shared directly in chat

A deep starry night sky, crescent moon, and a glowing fiery-orange cloud low
in the frame. Neither existing radial kind fit: `'glow'` and `'blotch'` both
anchor their glow to a corner, and this composition's bright element sits
low-and-centered instead. New **`'lowglow'`** pattern kind in
`CardThemeSurface.js` — a radial glow centered at `(50%, 78%)` (not a
corner), with an optional multi-hue `colors` sweep (same sweep mechanism
`'glow'` already has) for a hot-core-to-cooling-edge ember gradient, plus a
small star scatter in the upper portion. Unlike Dawnfall/Orchid Dusk (where
stars were dropped as unnecessary clutter), this reference's night sky +
stars is a real part of its identity, kept deliberately. No moon shape — this
renderer draws gradients/dots, not custom paths; flagged rather than faked.

**Removed the same day** — "doesn't look good," per direct feedback. The
theme entry and its `'lowglow'` pattern kind were both deleted outright
(nothing else used `'lowglow'`), not left as dead code.

### Sixth: Neon Horizon (950), a city-sunset photo, colors only

Per direct instruction ("colors only") — a smooth vertical `linear` sweep
tracing the sky's own color band (deep blue-violet → violet-purple → vivid
magenta-pink → pink-red → warm orange horizon glow → a dark base), with
**no attempt at the photo's city-skyline silhouette** — this renderer draws
gradients/dots, not custom shapes, so the color story carries the mood on
its own rather than a half-built skyline.

**Net catalogue count: 36 themes** (35, minus Ember Night, plus Neon
Horizon).

**Same day, smoothed further** — asked whether Dusk Bloom's smoothness
technique could carry over. It's not one "technique," just small RGB steps
between neighboring stops (Dusk Bloom never needed a fix because its
original palette already had that property). Measured the actual distance
between every Neon Horizon stop and found the real problem: every step sat
around 57-83 except the last (orange straight to near-black) at 221.9 —
nearly 3x any other jump. Added one bridge splitting the purple→magenta gap
and two bridging the orange→dark cliff, all computed via real RGB
interpolation (a small node script). Every step is now 42-83, consistent
with the rest of the gradient.

**Same day, colors hand-tweaked directly in-editor** — darkened the top
stop, brightened several others, and **dropped the forced near-black ending
entirely**, closing on a muted dark red-wine instead. This fixed the worst
outlier outright (there's no black stop left to jump to). Re-measured:
confirmed the user's own insight — "the smooth gradient was never about
property, it's about finding the right colors" — every remaining step
landed 31-71 except the darkened top stop, now the one outlier at 96.2.
Split with one more RGB-interpolated bridge into two ~48s. Final 9-stop
palette, every transition 31-71, no outliers.

### Seventh: Firelight (950), a fiery orange sunset with a moon-gap, colors only

Vivid orange-red clouds top and bottom, dipping through a cool muted
purple-lavender gap in the middle (where the reference's crescent moon
shows through a break in the clouds), back through pink into the most
saturated orange near the bottom. Colors only — no moon/cloud shapes, no
power-line silhouette, same standing instruction as Neon Horizon. Built the
RGB-distance discipline in from the start this time (measure and bridge
before committing, not after) — every stop-to-stop transition lands 27-74,
no outlier, matching the range Neon Horizon converged to.

**Same day**: the moon-gap stop was originally a cool muted purple-lavender
(`#a888b8`, matching the reference photo's own moon-gap color) — per direct
feedback ("drop the random blue"), replaced with a warm dusty-rose
(`#b8707a`) instead, since this theme is meant to stay purely warm/orange,
not trace the photo's cool interruption literally. Re-measured after the
swap: 13.4-55.7, even tighter than before, and the whole palette now sits in
one warm red-orange-pink family start to finish, no blue cast anywhere.

**Rebuilt again, same day** — "the colors don't sit, there are gray
shades... reduce colors and make it proper." The real bug: RGB-distance
bridging (the discipline that fixed Neon Horizon) only guarantees smooth
STEP SIZE, not smooth-looking color — interpolating in raw RGB between two
different hues routinely produces a desaturated, muddy midpoint, which is
exactly what every "dip" stop in this theme had been doing regardless of
which colors filled it. Dropped the dip concept entirely rather than
patching it again: rebuilt as 5 stops, this time checked in **HSL**, not
just RGB distance — saturation 76-91% and rising throughout, hue sweeping
smoothly red (5°) to orange (31°). No grey anywhere.
`["#e0301f", "#e8503f", "#e8622f", "#f07a2f", "#f5952f"]`.

**Net catalogue count: 37 themes.**

### Eighth: Wanderer (950), an illustrated desert-dune piece

Deep purple-black night sky, vivid red-coral clouds, and a dominant
golden-yellow dune ground, from a stylized illustration (not a photo).
Requested specifically as a `'blotch'` theme — maps naturally onto its
three-blob structure: purple-black as the top-left blob, the dominant
golden dune as the larger bottom-right blob, red-coral as the subtler
third. Base is a muted warm gold-tan (not the coolest/darkest color in the
piece) so any gap between blobs still reads as part of the same warm
palette rather than an unrelated patch. No cloud linework or the
illustration's tiny walking figure — colors only. Every blob color checked
in HSL before committing (38-79% saturation), same discipline Firelight's
rebuild established.

**Net catalogue count: 38 themes.**

### Ninth: Van Gogh (1000), a Starry-Night-style illustration

A vivid golden swirl (top-left blob, matching the painting's own sun/moon
position) against a deep-to-medium blue field — another natural `'blotch'`
fit. Base is the rich medium blue dominating most of the canvas; the larger,
dominant blob is a near-black navy from the painting's darkest passage; a
pale sky-blue highlight fills the subtler third accent. No brushstroke
texture, no silhouette/sunflower — colors only. Checked in HSL before
committing (66-85% saturation). Built while the user was live-editing
Wanderer's `accent` value in the same file — several edit attempts hit
"file modified since read" as a result; resolved by anchoring the insertion
on a stable comment elsewhere in the file rather than content actively
being changed.

**Same day, rebalanced** — "the yellow is too much... more blues and off-
white, add yellow as a slight touch." Gold had been `accent` (blotch's
top-left blob, FULL opacity), making it co-dominant with the navy. Moved
gold to `accent3` instead — blotch's own reduced-opacity third slot
(~0.45-0.5 by construction), which is exactly the "slight touch" mechanism
already built in, not a custom value. Blue now fills both full-opacity
blobs (medium blue + near-black navy), and `base` became a genuine
off-white (92% lightness, a hint of blue) instead of the medium blue it
used to be.

**Same day, second pass** — "too much white. blue needs to be more." The
off-white `base` from the previous pass was still showing through wherever
the blotch blobs fall off, reading as visible white patches rather than a
subtle hint. Replaced `base` (`#e4eaf0` → `#7ba8d4`) with a genuine
light-medium blue instead of just lowering the same off-white's lightness —
the card now reads as three distinct blue tones (light base, medium
`accent`, near-black navy `accent2`) with zero white anywhere. Gold stays
demoted to `accent3` as the one "slight touch." Verified in HSL (base
H210°/S51%/L66%, no muddy dips) before committing.

**Net catalogue count: 39 themes.**

### Tenth: Prometheus (1000), a sun/solar-flare illustration — last of this batch

Explicitly asked to experiment with a technique other than `'blotch'` this
time. The reference is a white-hot core radiating through yellow/orange/red
into a near-black starfield — mapped onto the existing `'grain'` kind
(previously only used for Undertow) instead, with grain's own built-in
speckle dots doubling as the reference image's starfield for free — no new
pattern code needed.

**Same day, fixed** — "fix the colors and angle to make the left section
readable" (the account name/balance/stat text all lives in a left-aligned
column, per `AccountHeroCarousel.js`). The original build (`angle: 50`,
bright corner at bottom-left, 7 stops bright→dark) put the palest colors
exactly where the white text sits. Rebuilt the 10 stops dark-to-bright
instead (`#040201 → #150504 → #2c0a07 → #4a100c → #6f1710 → #9c2214 →
#c9341a → #e8621f → #ffb347 → #fff2c9`), which alone puts the dark end at
the bottom-left/top-left where the text lives and pushes the white-hot
"sun" out toward the top-right/bottom-right corners instead — no angle
change needed in the end, `angle` stayed `50`. HSL-verified: hue stays a
tight 20°→46° warm-red/orange band, saturation 60-100% throughout, no grey
dip.

**Same day, final tweak** — a slight warm tint on `textColor` (`#FFFFFF` →
`#fff8e2`), a deliberate deviation from this batch's flat-white default to
tie the text into the fiery palette. Checked: `#fff8e2`'s luminance is
~97% of pure white's, so it costs essentially nothing in contrast.
Sampled actual text-anchor points (account name, balance, income/expense
stats) against the live gradient — contrast ranges 5.9:1 to 19.4:1
everywhere text sits, comfortably clear of the 4.5:1 AA threshold.

**Net catalogue count: 40 themes.**
