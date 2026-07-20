# Feature: Coin Store & Reward Re-Tiering
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/22-coin-store-and-reward-tiering.md`
**Status**: Planned
**Last Updated**: July 2026

---

## Context

The card-theme catalogue grew to 40 themes (`19-card-themes.md`), and a batch of
the best-looking ones (Prometheus, Van Gogh, Neon Horizon, Cumulus, Dusk Bloom,
Eclipse, Orchid Dusk, Borealis) are, per the author, "too good to just be
Rare." This feature does three things at once:

1. **Re-tiers those 8 premium themes** out of the coin-buyable Shop grid and
   into **streak-milestone** and **achievement/trophy** rewards — so the best
   cosmetics are *earned*, not bought, and the reward ladders (which had two
   empty theme slots) get filled.
2. **Fills out the reward ladders**: every milestone day gets a bonus spin
   wheel (not just the first six), achievements grant themes for the first
   time, and the freeze economy is re-tuned.
3. **Introduces the coin store** — a real-money coin-pack surface (INR),
   spending only, that will cover themes today and mascot skins/bundles later.
   Ships UI-first with payments stubbed (a toast, exactly like the Pro
   subscription); real crediting arrives with the payments-go-live effort.

### ⚠️ This reverses a documented decision

`IDEAS-gamification.md` explicitly **rejected purchasable coins** (listed
alongside leaderboards and gacha as a rejected mechanic). The author is
reversing that here, with a specific reason that removes the original
objection:

- **Original objection**: buying coins → buying streak freezes cheaply → the
  streak (the retention engine) becomes pay-to-win, which rots the one number
  the whole app is built to make honest.
- **Resolution (author, 2026-07-20)**: (a) freezes are already **hard-capped at
  5 held** (`FREEZE_CAP`), so they can't be stockpiled; (b) raise the freeze
  **price** from 500 → **3,000 coins**, deliberately set *above* two of the
  popular ₹99/1,200-coin packs (2,400) and above the ₹199/2,700-coin pack, so
  no single affordable pack buys even one freeze — a buyer must either grind by
  logging or jump to a bigger tier. That converts "pay to protect your streak"
  into "engagement is still the cheapest path to a freeze," which is the
  behaviour we want. Money flows to **cosmetics** (themes, future skins), not
  to streak protection.

`IDEAS-gamification.md`'s standing note should be updated to point here once
this ships (do it in the index step, not now).

---

## Phase Overview

```
Phase 1 — Reward re-tiering (data + trophy theme grants)
  Move the 8 premium themes out of the Shop into milestone/achievement
  rewards; reshuffle the first-week ladder; add a day-300 milestone; wire
  achievements to grant themes; apply coin-price overrides; fix Daybreak
  contrast. No money, no freeze/wheel changes yet.

Phase 2 — Freeze economy & full wheel coverage
  Raise the freeze price to 3,000; convert overflow-freeze grants to coins
  instead of dropping them (everywhere); give every milestone day a bonus
  spin wheel (not just the first six) and migrate all theme grants onto the
  wheel path.

Phase 3 — Coin store (UI-only, payments stubbed)
  Rename the Shop's "Freeze" tab to "General"; show coin packs + streak
  freeze there; tapping Buy shows a "payments aren't live yet" toast (same
  stub as the Pro subscription — no real billing, no server, no DB change
  yet). Also: a "Buy coins" shortcut when a theme purchase is short on coins.
```

**After each phase: stop and wait for approval before proceeding.**

---

## The full reward ladder (target state — confirmed 2026-07-20)

This is the agreed end state all three phases build toward. Kept here at the
top as the single reference; the phases below implement slices of it.

### Card-theme placement (40 themes)

| Bucket | Themes |
|---|---|
| **Free** (2) | Ink, Lime Flood |
| **Common** — 400 coins (7) | Blueprint, Receipt, Dusk, Ocean Deep, Ember, Graphite, Mint Ledger |
| **Rare — buyable** (14) | Titanium 800 · Carbon Fiber 800 · Copper 800 · Lava 850 · Undertow 850 · **Rose Gold 850** · Marble 900 · Denim 900 · Peacock 900 · **Dawnfall 900** · Supernova 950 · Firelight 950 · Wanderer 950 · **Crimson Shore 1000** |
| **Milestone/Legendary — streak-locked** (12) | see ladder below |
| **Achievement — trophy-locked** (6, NEW) | Eclipse, Borealis, Orchid Dusk, Prometheus, Van Gogh, Dusk Bloom |

Bold = coin-price changed this feature. Rose Gold 1000→850, Dawnfall 1000→900,
Crimson Shore 900→1000. (Neon Horizon's requested "1000" is moot — it becomes
the day-300 reward, not buyable.)

### Streak-milestone ladder

Every day pays a **lump** (`MILESTONE_REWARDS`) and, after Phase 2, a **bonus
spin** on top. Both fire — confirmed in `StreakCelebration.js` (calls
`claimMilestone` when `isMilestone`) + the wheel (`claimSpin`), which are
independent `reward_events` rows.

| Day | Lump (coins / freezes) | Theme granted | Notes |
|---|---|---|---|
| 1 | — (not a MILESTONES entry) | Ocean Deep | rides `isNewStreak`; unchanged |
| 3 | 50 / 0 | **Cumulus** *(was Ruby)* | |
| 7 | 100 / 1 | **Daybreak** *(was Sapphire; + contrast fix)* | |
| 10 | 150 / 0 | **Ruby** *(was empty — Jupiter gap)* | |
| 30 | 400 / 1 | **Sapphire** *(was Daybreak)* | |
| 50 | 600 / 0 | Aurora | unchanged |
| 100 | 1,500 / 3 | Gold Foil | unchanged |
| 150 | 2,000 / 1 | Holographic | unchanged |
| 200 | 2,500 / 0 | *(none — coins only)* | Onyx gap stays a pure-coin day |
| **300** | **3,000 / 1** *(NEW day)* | **Neon Horizon** | new MILESTONES entry |
| 365 | 4,000 / 2 | Platinum | unchanged |
| 500 | 6,000 / 0 | Velvet | unchanged |
| 1000 | 12,000 / 5 | Diamond | unchanged |

### Achievement (trophy) ladder — theme grants are NEW

Trophies already pay coins/XP/freezes (`TROPHY_REWARDS`). Six now also grant a
theme. All other trophy rows unchanged.

| Trophy (`ref`) | Coins | XP | Freeze | Theme (NEW) |
|---|---|---|---|---|
| `perfect_month:1` | 200 | 300 | — | **Eclipse** |
| `categorizer:1` | 180 | 280 | — | **Borealis** |
| `logger:1000` | 400 | 600 | — | **Orchid Dusk** |
| `logger:5000` | 1,000 | 1,200 | 1 | **Prometheus** |
| `planner:10` | 600 | 800 | 1 | **Van Gogh** |
| `frugal:100` | 700 | 900 | 1 | **Dusk Bloom** |

### Coin economy (Phase 2 + 3)

- **Freeze price**: 500 → **3,000 coins**. Cap stays 5.
- **Overflow-freeze → coins**: a freeze grant that would exceed the cap now
  pays **500 coins per dropped freeze** instead of silently vanishing —
  everywhere freezes are granted (milestone, spin, trophy).
- **Coin packs** (INR, spending-only — Phase 3):

| Pack | INR | Coins | Rate (coins/₹) |
|---|---|---|---|
| Starter | ₹49 | 500 | 10.2 |
| Popular | ₹99 | 1,200 | 12.1 |
| Value | ₹199 | 2,700 | 13.6 |
| Premium | ₹399 | 6,000 | 15.0 |
| Mega | ₹799 | 13,000 | 16.3 |
| Ultra | ₹999 | 20,000 | 20.0 |

---

## Phase 1 — Reward re-tiering ✅ Complete

### Goal

The 8 premium themes leave the buyable Shop grid and become earned rewards:
2 fill milestone theme-slots, 6 become achievement rewards. The first-week
ladder is reshuffled so the prettier themes reward the earliest days. A new
day-300 milestone is added for Neon Horizon. Achievements grant a theme for
the first time (a new `claimTrophy` capability + trophy-screen UI). Daybreak
gets more contrast; three coin prices are corrected. **No money, no freeze
change, no new wheels yet** — purely a re-mapping of what already exists, so
it's shippable on its own.

### Before Starting — Confirm With Codebase

- `lib/cardThemes.js` — current `tier`/`cost`/`unlock` shape per theme;
  `TIERS`, `LOCKED_TIERS`, `TIER_LABELS` exports; the `getTheme` fallback.
- `lib/rewards.js` — `MILESTONE_REWARDS`, `MILESTONE_THEME_GRANTS`,
  `SPIN_WHEELS`, `TROPHY_REWARDS` current values.
- `lib/streak.js` — `MILESTONES` array (adding 300 ripples into the Streak
  Keeper trophy, which maps over it — verify in `lib/trophies.js`).
- `lib/rewardsMutations.js` — `claimTrophy`'s current shape (it does NOT grant
  a theme yet; `claimMilestone`/`claimSpin` do — copy their `theme_grant`
  upsert block).
- `app/trophies.js` — how a trophy tile renders its reward + the existing
  Claim button; where to surface "+ a card theme".
- `app/shop.js` — the `LOCKED_TIERS.map(...)` locked-section render and
  `unlockCaption()` (needs a new `trophy` unlock branch).
- `lib/trophies.js` — how trophy `id`s (`${groupId}:${tier}`) are computed, to
  confirm the exact `ref` strings in the table above (`perfect_month:1`, etc.).

### 1.1 Database

**No database changes in this phase.** Themes and rewards are pure data
(`lib/*.js`); ownership is already recorded in `reward_events` via existing
`theme_grant` rows (same `ref = themeId` shape `claimMilestone`/`claimSpin`
already write). `claimTrophy` gaining a theme grant just writes one more
`theme_grant` row through the existing table + RLS.

### 1.2 Data Layer

**`lib/cardThemes.js`**
- Add a new locked tier `'achievement'`: `LOCKED_TIERS = ['legendary',
  'milestone', 'achievement']`; `TIER_LABELS.achievement = 'Achievement
  reward'`.
- **Re-tier the 8 premium themes** (remove `cost`, add `unlock`):
  - `cumulus` → `tier: 'milestone'`, `unlock: { type: 'milestone', day: 3 }`
  - `neon-horizon` → `tier: 'legendary'`, `unlock: { type: 'milestone', day: 300 }`
  - `eclipse`, `borealis`, `orchid-dusk`, `prometheus`, `van-gogh`,
    `dusk-bloom` → `tier: 'achievement'`, `unlock: { type: 'trophy', trophyId:
    '<id>', label: '<Trophy name>' }` (ids per the ladder table).
- **Reshuffle existing milestone themes' unlock days**: `ruby` day 3→**10**,
  `sapphire` day 7→**30**, `daybreak` day 30→**7**. (Cumulus takes day 3.)
- **Coin overrides**: `rose-gold` 1000→850, `dawnfall` 1000→900,
  `crimson-shore` 900→1000.
- **Daybreak contrast fix**: widen the light/dark spread of its 5 stops
  (currently `#1a1e4a → #4a3f7a → #9a6a92 → #e0a08a → #f5c07a`) so transitions
  read stronger — HSL-verify (no muddy grey), Babel-check, catalogue-check, as
  every theme edit in `19-card-themes.md` does.

**`lib/rewards.js`**
- `MILESTONE_REWARDS`: add `300: { coins: 3000, freezes: 1 }` (on the existing
  scaling curve between 200 and 365).
- `MILESTONE_THEME_GRANTS`: this phase still uses it for pure-milestone (non-
  wheel) days. Set `300: 'neon-horizon'`. (Days 3/7/10/30 keep granting via
  `SPIN_WHEELS.theme` as today — just point them at the reshuffled themes:
  `SPIN_WHEELS[3].theme = 'cumulus'`, `[7] = 'daybreak'`, `[10] = 'ruby'`,
  `[30] = 'sapphire'`.)
- `TROPHY_REWARDS`: add a `themeId` field to the six rows in the ladder table
  (e.g. `'perfect_month:1': { coins: 200, xp: 300, themeId: 'eclipse' }`).

**`lib/streak.js`**
- `MILESTONES`: insert `300` → `[3, 7, 10, 30, 50, 100, 150, 200, 300, 365,
  500, 1000]`. **Verify the Streak Keeper trophy** (`lib/trophies.js` maps over
  `MILESTONES`) gracefully gains a 300-day tier — same free-tier behaviour the
  150 addition already relied on (`streak.js`'s own comment). No spurious
  trophy, no crash.

**`lib/rewardsMutations.js`**
- `claimTrophy`: after the coins/xp/freezes upsert, add the **same
  `theme_grant` upsert block** `claimMilestone`/`claimSpin` already use, gated
  on `TROPHY_REWARDS[trophyId].themeId`. Return `themeId` in the result. (The
  freeze-overflow→coins change is Phase 2 — not here.)

### 1.3 Components

- **`app/trophies.js`** — for a trophy whose `TROPHY_REWARDS` row has a
  `themeId`, show "+ <Theme name> card" in the reward line (a small
  `CardThemeSurface` swatch is ideal, matching the Shop's tile), and on
  successful `claimTrophy`, surface the granted theme the same way the
  milestone/spin flows do (reuse the existing reward-display pattern, don't
  invent a new modal).
- **`app/shop.js`** — `unlockCaption()` gains a `trophy` branch:
  `if (theme.unlock.type === 'trophy') return \`Earn: ${theme.unlock.label}\`;`.
  The existing `LOCKED_TIERS.map(...)` render then shows the new
  `'achievement'` section automatically (it iterates `LOCKED_TIERS`).

### 1.4 Navigation / Integration

No new routes. The Shop's locked section grows an "Achievement reward" group;
the Trophy screen's existing Claim button now also grants a theme where
applicable. No menu/tab changes.

### 1.5 Impact on Existing Features

| Existing | Impact | Watch for |
|---|---|---|
| Shop grid | 8 themes leave `TIERS`, appear under `LOCKED_TIERS` | A user who *already bought* one of the 8 (a `theme_buy` row exists) keeps it — `useCardThemes` reads `theme_buy`/`theme_grant` identically. Verify the tile still reads "Owned/Equipped" for them, not "Earn: …". |
| Streak Keeper trophy | +1 tier (day 300) | No double-pay; the tier is display + claimable like any other. |
| `StreakCelebration` | Day 300 now a milestone celebration | Gated on `MILESTONES.includes(current)` already — automatic. |
| Existing `theme_grant` rows | none | Re-tiering doesn't touch ownership rows, only catalogue metadata. |

### 1.6 What This Phase Does NOT Include

- No freeze price change, no overflow→coins conversion (Phase 2).
- No new spin wheels on days 100+ (Phase 2) — day 300's theme grants via
  `MILESTONE_THEME_GRANTS` for now, like the other 100+ days.
- No money / coin packs / store UI (Phase 3).

### 1.7 Phase 1 Checklist — Before Marking Complete

- [x] The 8 premium themes no longer appear in the Shop's buyable grid; they
      appear under the correct locked section (Cumulus under milestone, Neon
      Horizon under legendary, the other 6 under "Achievement reward").
- [x] First-week ladder themes are: day 3 Cumulus, day 7 Daybreak, day 10 Ruby,
      day 30 Sapphire (verified in `SPIN_WHEELS`).
- [x] Day 300 exists in `MILESTONES` + `MILESTONE_REWARDS` (3,000/1 freeze) +
      grants Neon Horizon (`MILESTONE_THEME_GRANTS[300]`); Streak Keeper trophy
      shows a 300 tile (12 total) and earns with no error.
- [x] `claimTrophy` writes a `theme_grant` row for the six themed trophies and
      returns `themeId`; the trophy screen shows the card swatch and toasts on
      grant.
- [x] Coin overrides applied: Rose Gold 850, Dawnfall 900, Crimson Shore 1000.
- [x] Daybreak recolored, HSL-verified (48-100% saturation, no grey midpoints);
      Babel + catalogue checks pass (40 themes, no dup ids).
- [x] A user who previously bought one of the 8 still owns/equips it (ownership
      is a `theme_buy`/`theme_grant` row `useCardThemes` reads regardless of
      tier — re-tiering only touches catalogue metadata, no ownership rows).

### Implementation Notes

- **All six files edited + verified** (`lib/cardThemes.js`, `lib/rewards.js`,
  `lib/streak.js`, `lib/rewardsMutations.js`, `app/trophies.js`, `app/shop.js`).
  Babel-compiled clean; a catalogue+rewards cross-check script confirmed: 40
  themes / no dup ids; tiers free 2 · common 7 · rare 14 · achievement 6 ·
  milestone 4 · legendary 7; all 8 premium themes have no `cost` and the right
  `unlock`; all six achievement→trophy pairs consistent
  (`theme.unlock.trophyId` ↔ `TROPHY_REWARDS[id].themeId`).
- **Re-tiered themes stayed physically in place** in `THEMES_RAW` (not
  relocated between section comments) — grouping is by the `tier` field, and
  relocating 8 objects in a file the user has open was needless risk. Each
  carries a re-tier comment, same "swapped with a comment" precedent
  Aurora/Velvet set.
- **`claimTrophy` theme grant** copies `claimMilestone`/`claimSpin`'s exact
  `theme_grant` upsert (own `ref = themeId`, idempotent, unconditional) — one
  grant path, no new mechanism.
- **Theme surfaced two ways** on the trophy screen (RewardBurst is
  coins/XP/freezes-only, can't carry a theme): a mini `CardThemeSurface` swatch
  in the tile (visible before *and* after claim), plus a success toast on grant
  ("‹Name› card unlocked"). No new modal.
- **Daybreak recolor**: `#111861 → #3b2f9e → #a83b86 → #f07a52 → #ffc542` — the
  old mids were desaturated (mauve at S19, muddy); new stops hold 48-100%
  saturation with non-grey midpoints and a 22→63 lightness ramp for the
  stronger contrast requested.
- **Day 200 stays theme-less** (coins-only milestone) — the Onyx gap; Neon
  Horizon went to the new day 300 per the author, not 200.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 2 — Freeze economy & full wheel coverage ✅ Complete

### Goal

Raise the freeze price to 3,000 (the streak-cheat fix that unblocks Phase 3),
stop wasting overflow-freeze grants by converting them to coins everywhere, and
give **every** milestone day a bonus spin wheel (not just the first six) —
migrating all theme grants onto the single "wheel day → theme via claimSpin"
rule so there's one grant path, not two.

### Before Starting — Confirm Phase 1 is Approved

- Re-read `SPIN_WHEELS`, `MILESTONE_THEME_GRANTS`, `FREEZE_COST` current state.
- Re-read `claimMilestone`/`claimSpin`/`claimTrophy` freeze-clamp blocks (the
  `Math.max(0, Math.min(requested, FREEZE_CAP - current))` pattern) — the
  overflow→coins change edits all three identically.
- Confirm `StreakCelebration.js` gates the wheel purely on
  `spinWheelFor(current)` (it does) — so adding wheel days needs no celebration
  code change.

### 2.1 Database

**No database changes.** Overflow→coins just changes the `coins` value written
to an existing `reward_events` row. New wheel days write the same `spin` rows.

### 2.2 Data Layer

**`lib/rewards.js`**
- `FREEZE_COST`: `500 → 3000`.
- Add `SPIN_WHEELS` entries for `100, 150, 200, 300, 365, 500, 1000`. Per the
  author's spec: segments cap at **500–1,500 coins** and **3–5 freezes**. One
  shared late-game template is fine (these days already pay huge lumps; the
  wheel is a bonus):
  ```
  segments: [
    { id: 'c500',  label: '500 coins',   coins: 500,  freezes: 0 },
    { id: 'c750',  label: '750 coins',   coins: 750,  freezes: 0 },
    { id: 'c1000', label: '1,000 coins', coins: 1000, freezes: 0 },
    { id: 'f3',    label: '3 freezes',   coins: 0,    freezes: 3 },
    { id: 'f5',    label: '5 freezes',   coins: 0,    freezes: 5 },
    { id: 'c1500', label: '1,500 coins', coins: 1500, freezes: 0 }, // jackpot
  ]
  ```
  Each of these days also carries its `theme` on the wheel now (migrated from
  `MILESTONE_THEME_GRANTS`): 100→gold-foil, 150→holographic, 300→neon-horizon,
  365→platinum, 500→velvet, 1000→diamond. Day 200 has no theme (coins only).
- `MILESTONE_THEME_GRANTS`: becomes **empty** (every theme-granting milestone
  day now has a wheel → grants via `claimSpin`). Keep the export as `{}` with a
  comment, or remove it and the `claimMilestone` theme block — decide at build
  time; leaving it empty is the lower-risk change.

**`lib/rewardsMutations.js`** — overflow-freeze → coins, in `claimMilestone`,
`claimSpin`, `claimTrophy` (identical edit in each):
```js
const room = Math.max(0, FREEZE_CAP - current);
const freezesToGrant = Math.min(requested, room);
const overflow = requested - freezesToGrant;
const coinsToWrite = baseCoins + overflow * 500;   // 500 coins per dropped freeze
```
Write `coinsToWrite` (not `baseCoins`) to the row. `buyFreeze` is unaffected (it
hard-blocks at the cap; no overflow possible).

### 2.3 Components

- **`app/shop.js`** — the freeze card already reads `FREEZE_COST`, so "Buy for
  3000" / "3000 coins · hold up to 5" update automatically. Verify the
  affordability guard (`freezeCantAfford = coins < FREEZE_COST`) still reads
  right at 3,000. (This card moves into the "General" tab in Phase 3 — no move
  yet.)
- **`components/MilestoneSpinWheel.js`** — already renders any `SPIN_WHEELS`
  day generically; new days need no component change. Verify a 5-freeze /
  1,500-coin segment label fits the wheel geometry.

### 2.4 Impact on Existing Features

| Existing | Impact | Watch for |
|---|---|---|
| Every milestone celebration ≥100 | Now chains into a wheel after the lump | The wheel must not double-grant the theme — it's idempotent on `theme_grant` `ref`, but confirm day 300's theme isn't *also* in `MILESTONE_THEME_GRANTS` (it's moved out). |
| Freeze buyers | Price 6× higher | Intended. The Shop copy + any freeze mention in `RewardsHistorySheet`/Koban must not hardcode "500". |
| `milestoneRoad()` (streak screen) | reads `MILESTONE_REWARDS` + `spinWheelFor` | day 300 + new `hasWheel: true` on 100+ days render correctly. |

### 2.5 What This Phase Does NOT Include

- No money / coin packs / store restructure (Phase 3).
- No freeze **bundles** — see Out of Scope.

### 2.6 Phase 2 Checklist

- [x] `FREEZE_COST` is 3,000 everywhere it surfaces — verified all four call
      sites read the constant (`app/shop.js` ×3, `components/RewardsHistorySheet.js`
      ×2, `lib/rewardsMutations.js`'s `buyFreeze`); no hardcoded 500 anywhere.
- [x] Days 100/150/200/300/365/500/1000 each have a bonus wheel (shared
      `LATE_WHEEL_SEGMENTS`); every segment within the 500–1,500 coin / 3–5
      freeze caps, no blank slice. Every `MILESTONES` day now has a wheel.
- [x] All theme grants flow through `claimSpin` (`MILESTONE_THEME_GRANTS` = `{}`);
      each late wheel's `theme` is a valid catalogue id; day 200 is theme-less;
      no double-grant (the empty map means `claimMilestone` grants no theme).
- [x] A freeze grant exceeding the cap credits `FREEZE_OVERFLOW_COINS` (500) per
      dropped freeze in `claimMilestone`, `claimSpin`, and `claimTrophy` — via
      one shared `clampFreezeGrant` helper.
- [x] `milestoneRoad()` renders day 300 + `hasWheel` on the late days, and now
      resolves each day's theme from the wheel.

### Implementation Notes

- **`clampFreezeGrant` helper** (`lib/rewardsMutations.js`) — the three claim
  functions had a near-identical inline balance-read + cap-clamp; rather than
  triplicate the new overflow→coins logic, factored it into one helper
  returning `{ freezes, bonusCoins }`. Each caller adds `bonusCoins` to its base
  coins and writes/returns the sum, so the RewardBurst shows the real credited
  amount (lump + any overflow bonus). `buyFreeze` deliberately does NOT use it
  (it hard-blocks at the cap — no overflow possible).
- **One shared `LATE_WHEEL_SEGMENTS`** for all seven late days (only `theme`
  differs) rather than seven copies of the same six segments — the late
  milestones already pay huge lumps, so the wheel is uniform bonus.
- **Regression caught + fixed during verification**: `milestoneRoad()` sourced
  `themeId` from `MILESTONE_THEME_GRANTS`, which Phase 2 empties — so the streak
  screen's road would have shown NO themes. Fixed to resolve
  `spinWheelFor(day)?.theme ?? MILESTONE_THEME_GRANTS[day]`, matching how the
  grant actually happens. Bonus: this also fixes a pre-existing gap where
  wheel-day themes (Ruby, Cumulus, etc.) never appeared on the road at all.
- **`MILESTONE_THEME_GRANTS` left as `{}`** (not deleted) — the export and
  `claimMilestone`'s lookup stay, so a future wheel-less themed day is a
  one-line re-add and the two grant paths can't silently disagree while empty.
- **No component changes needed**: `MilestoneSpinWheel` already renders any
  `SPIN_WHEELS` day generically and gates its theme preview on `result?.themeId`
  (so day 200's themeless wheel just shows the coin/freeze pill);
  `StreakCelebration` already gates the wheel on `spinWheelFor(current)`, so the
  seven new wheel days light up with no edit there.
- **Verified**: both files Babel-compile; a load script confirmed FREEZE_COST
  3000 / FREEZE_OVERFLOW_COINS 500 / `MILESTONE_THEME_GRANTS` empty; all 12
  `MILESTONES` days have a wheel with valid theme + in-cap segments; day 200
  theme-less; `milestoneRoad()` shows the correct theme for every day.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 3 — Coin store (UI-only, payments stubbed) ✅ Complete

### Goal

Build the coin-store surface so cosmetics have a *visible* paid path, WITHOUT
turning on real payments yet — exactly how the Pro subscription screen already
works (`app/pro.js`: a full pricing UI whose CTA shows a "payments aren't live
yet" toast). The Shop's "Freeze" tab becomes "General", showing coin packs
(default focus) and the streak freeze together. Plus: when a theme purchase is
short on coins, a **Buy coins** button jumps straight to that section.

### Why UI-only now (author decision, 2026-07-20)

"Just like subscription — there is no paywall yet, display a toast when [you]
proceed to pay." So Phase 3 is **pure client UI**: no Play Billing, no Edge
Function, no `coin_purchase` ledger source, **no DB change**. Tapping Buy on a
pack shows the same info toast the Pro CTA shows. Real crediting (server-verified
Play Billing / RevenueCat, a `coin_purchase` source, the client-trust security
decision) is deferred to whenever payments actually go live — it rides the
monetisation master sequence in `IDEAS-subscription-and-store.md` Part 3, not
this feature. This keeps Phase 3 as light as Phases 1–2.

### Before Starting — Confirm With Codebase

- `app/pro.js` — the exact stub: `handleUpgrade()` → `showToast({ message:
  "Payments aren't live yet…", variant: 'info' })`. Match its copy/variant for
  coins so the two "not live yet" moments read consistently.
- `lib/pro.js` — the pricing-constants pattern (`PRO_PRICING`); `COIN_PACKS`
  follows the same shape.
- `app/shop.js` — the `TABS` array, the `tab === 'freeze'` branch to
  restructure, the `useToast()` already imported, and the current
  insufficient-coins state (the disabled `Need {n} more` view in the floating
  bar) to replace with the Buy-coins button.
- `hooks/useCardThemes.js`/`useRewards.js` — coin balance is a `SUM` over
  `reward_events` (`v_reward_balances`); nothing here changes it (no coins are
  actually credited this phase).

### 3.1 Database

**No database changes.** No coins are credited yet — the store is display + a
stub toast. (When payments go live later, that effort adds the `coin_purchase`
source, server verification, and resolves the client-trust security question —
none of it in this feature.)

### 3.2 Data Layer

- **`lib/coins.js`** (new) — `COIN_PACKS` constant array (id, label, INR price
  string, coin amount), same "single source of truth for pricing" discipline as
  `lib/pro.js`. Pure data, no imports. Six packs per the pricing table.
- **No mutation, no hook, no Edge Function** this phase. The Buy handler is a
  one-liner toast, mirroring `app/pro.js`'s `handleUpgrade`.

### 3.3 Components

- **`app/shop.js`** — rename the `'freeze'` tab to `'general'` (label
  "General"). Its body becomes a scroll with two sections:
  - **Coin Packs** (default focus / first section) — a grid of pack cards, each
    a lucide icon placeholder (`CircleDollarSign` sized per tier; *illustrations
    replace these later*), INR price, coin amount, and a Buy button. Buy →
    `showToast({ message: "Payments aren't live yet…", variant: 'info' })`, the
    same stub as `app/pro.js`.
  - **Streak Freeze** — the existing freeze card, moved here unchanged (now
    3,000 coins from Phase 2). This one is a *real* coin spend (not money), so
    it keeps working normally.
  - Icons are placeholders per the author — structure each card so swapping a
    lucide glyph for an `<Image>`/illustration later is a one-line change.
- **Buy-coins shortcut** (Cards tab) — replace the disabled `Need {n} more`
  view in the floating bar with a real **Buy coins** `Pressable` that runs
  `setTab('general')`, taking the user straight to the coin packs. (The theme
  they were eyeing stays selected; they can come back and buy it after topping
  up — once payments are live. For now the toast is the honest endpoint.)

### 3.4 Navigation / Integration

The Shop already exists; only its tab set changes (`Cards` · `General`), plus
the in-screen `setTab('general')` jump from the Buy-coins button. No new route.

### 3.5 Impact on Existing Features

| Existing | Impact | Watch for |
|---|---|---|
| Shop freeze card | Moves from its own tab into "General" alongside coin packs | Keep its real coin-spend flow intact — only its location changes. |
| Insufficient-coins state | `Need {n} more` becomes a Buy-coins button | Still show the shortfall somewhere (e.g. the button subtitle) so the user knows how short they are. |
| Coin balance | unchanged | No coins credited this phase — packs are display + stub. |

### 3.6 What This Phase Does NOT Include

- **Real payments** — Play Billing, RevenueCat, server verification, the
  `coin_purchase` ledger source, and the client-trust security decision are all
  deferred to the payments-go-live effort (`IDEAS-subscription-and-store.md`
  Part 3), NOT built here. Buy = toast.
- **Freeze bundles** — dropped entirely (author, 2026-07-20). Single-freeze buy
  only. See Out of Scope.
- Mascot skins / avatar bundles as coin sinks — future.
- Pro "coin stipend" interaction — compatible, not wired here.

### 3.7 Phase 3 Checklist

- [x] Shop's second tab reads "General" and shows coin packs (first) + the
      freeze card (below), in one scroll.
- [x] Coin packs match the pricing table (₹49→500 · ₹99→1,200 · ₹199→2,700 ·
      ₹399→6,000 · ₹799→13,000 · ₹999→20,000); ascending value confirmed.
- [x] Tapping Buy on any pack shows a "coin purchases aren't live yet" info
      toast (same shape as `app/pro.js`'s stub); no coins credited, no DB write.
- [x] The freeze card still works as a real coin spend (now 3,000 coins).
- [x] On the Cards tab, an unaffordable theme shows a **Buy coins** button that
      switches to the General tab, with a "Need X more" hint under the label.
- [x] Placeholder `CircleDollarSign` icons render; each pack card is structured
      so an illustration swap is a one-line change.

### Implementation Notes

- **`lib/coins.js`** — new `COIN_PACKS` (6 packs, `{ id, coins, price }`, the
  ₹99 one flagged `popular`). Pure data, same discipline as `lib/pro.js`. Its
  header spells out that Buy is stubbed and real crediting is a separate effort.
- **Stub matches the subscription exactly**: `handleBuyCoins` → `showToast({
  variant: 'info', … "aren't live yet" })`, the same pattern as
  `app/pro.js`'s `handleUpgrade`. `showToast`/`useToast` were already imported
  in `app/shop.js`.
- **General tab** replaced the old single freeze `<View>` with a `ScrollView`:
  a "Coin Packs" section (2-col grid, `popular` badge on ₹99) then a "Streak
  Freeze" section (the existing freeze card, moved in verbatim). The freeze
  card's own `marginHorizontal` was dropped — it now takes the scroll's
  `paddingHorizontal` like the Cards grid, so both tabs share one inset.
- **Buy-coins shortcut**: the Cards floating bar's dead `Need X more` label
  became a live `Buy coins` Pressable (`setTab('general')`) with the shortfall
  as a small hint line under it — action + context in one control.
- **No DB, no native, no mutation** this phase — exactly as scoped. The freeze
  purchase is the only real spend on the tab and was untouched.
- Two stale "Freeze tab" comments (floating-bar note, `scroll` padding note)
  updated to "General tab".
- **Verified**: `app/shop.js` + `lib/coins.js` Babel-compile; `COIN_PACKS`
  loads with the exact pricing table and a strictly ascending coins-per-rupee
  curve (10.2 → 20.0).

**→ Phase 3 complete. All three phases done.**

---

## Data Model Summary (Final State After All Phases)

```
reward_events (existing, entirely unchanged — no new source this feature)
  source: 'daily_log' | 'no_spend' | 'freeze_buy' | 'freeze_used'
        | 'freeze_comeback' | 'milestone' | 'spin' | 'trophy' | 'theme_grant'
  → coins summed by v_reward_balances (no schema change)

lib/cardThemes.js   catalogue: free / common / rare(buyable) / milestone
                    / legendary / achievement(NEW tier)
lib/rewards.js      MILESTONE_REWARDS(+300), SPIN_WHEELS(+7 late days),
                    TROPHY_REWARDS(+themeId ×6), FREEZE_COST 3000,
                    MILESTONE_THEME_GRANTS → {} (migrated to wheels)
lib/streak.js       MILESTONES += 300
lib/coins.js (NEW)  COIN_PACKS pricing (display only — Buy is stubbed)
```

**No database changes anywhere in this feature.** Everything is `lib/*.js` data
+ client UI. Coin packs are displayed but not purchasable yet (Buy → toast,
same as the Pro subscription); real crediting + its `coin_purchase` ledger
source arrive with the separate payments-go-live effort.

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| Shop | 8 themes move to locked tiers; second tab becomes "General" with coin packs; Buy-coins shortcut on unaffordable themes | Phases 1 & 3 |
| Trophy room | Six trophies now also grant a theme | Phase 1 (`claimTrophy` + `app/trophies.js`) |
| Streak celebration | Day-300 milestone; wheels on all milestone days | Phases 1 & 2 (mostly automatic) |
| Freeze economy | Price 500 → 3,000; overflow now pays coins | Phase 2 |
| `IDEAS-gamification.md` | "purchasable coins rejected" note is reversed (intent set now; real purchases arrive with payments-go-live) | Update in the index step, citing the freeze-cost resolution |

---

## Out of Scope (All Phases)

- **Freeze bundles (1/3/5 with a bulk discount)** — **dropped** (author,
  2026-07-20). Single-freeze buy only. (Rationale, for the record: freezes are
  capped at 5 and gifted generously by milestones/trophies so bulk-buying is
  rare; a per-freeze discount undercuts the deliberate "3,000 forces
  engagement" deterrent; and coin packs already *are* the bulk mechanic.)
- **Real payments / purchasable coins actually crediting** — Phase 3 ships the
  store UI with a stubbed Buy (toast, like the Pro subscription). Turning on
  real Play-Billing purchases, server verification, the `coin_purchase` ledger
  source, and the client-trust security decision is the separate
  payments-go-live effort (`IDEAS-subscription-and-store.md` Part 3), not this
  feature.
- **Mascot skins / avatar bundles** — future coin sinks (`IDEAS-gamification.md`);
  the economy is sized to absorb them but they aren't built here.
- **Per-theme real-money SKUs** — rejected in favour of the coin-pack rail
  (author's decision: "coins only that covers pretty much everything").
- **AdMob / watch-ad-for-coins** — a separate `IDEAS-gamification.md` idea.
- **Pro coin stipend** — compatible, not wired here.

---

## Post-Phase-3 follow-ups (2026-07-20, on-device testing feedback)

Two additions after testing the built feature. Both are `lib/*.js` data + client
UI — still **no DB changes**.

### Epic tier (card themes)

On-device, the vivid scene themes felt too good for "Rare." Added an **`epic`**
tier to `lib/cardThemes.js` `TIERS`/`TIER_LABELS` (between `rare` and the locked
tiers, so the Shop renders an Epic section automatically). Moved the 8 "Lava and
below" buyable cards `rare → epic` and re-priced them **1,000–1,500**:

| Rare (6, materials) | 800–900 | Epic (8, scenes) | price |
|---|---|---|---|
| Titanium, Carbon Fiber, Marble, Rose Gold, Copper, Denim | unchanged | Lava | 1000 |
| | | Undertow | 1100 |
| | | Peacock | 1150 |
| | | Supernova | 1200 |
| | | Crimson Shore | 1250 |
| | | Dawnfall | 1300 |
| | | Firelight | 1400 |
| | | Wanderer | 1500 |

Catalogue still 40 themes; final tier counts: free 2 · common 7 · rare 6 · epic
8 · achievement 6 · milestone 4 · legendary 7.

### Accent (primary-color) expansion + mode-locking

`theme/themes.js` `ACCENTS` grew from 7 → **23**. The 16 new ones are drawn from
the card-theme palettes, spread around the wheel to fill gaps, tints generated
to the same targets the original 7 use. Names (creative, card-theme flavoured):
Crimson, Merlot, Coral, Tangerine, Marigold, Emerald, Lagoon, Glacier, Cobalt,
Amethyst, Orchid, Blossom, Rosewood, Slate, **Ash**, **Cream**. All ungated
(accents are free — `16-app-themes.md`).

**Mode-support mechanism** (new): an accent may declare `modes: [...]` (omitted =
both, the original 7 + the 14 chromatic). The two off-whites — **Ash** (light
grey) and **Cream** (beige) — are pale by design and only legible on a dark
screen, so they're `modes: ['dark']`. Two guards:
- `accentSupportsMode(accent, modeId)` + `accentModeLabel(accent)` in
  `theme/themes.js`; `ColorPicker.js` **locks** an unsupported accent in the
  wrong mode (dimmed, non-selectable, captioned "Dark mode only" + a lock icon).
- `resolveColors` **safety net**: if a mode-restricted accent is somehow active
  in an unsupported mode (pick Cream in dark → toggle to light), it falls back
  to the default accent for that render — reversible, never mutates `accentId`.
  This is the only way a locked accent can be active in the wrong mode.

Verified: 23 accents; Ash/Cream dark-only; `resolveColors('cream','light')`
falls back to Lime while `('cream','dark')` stays Cream; other accents
unaffected. The mechanism generalises to future light-only accents (e.g. a very
dark accent) with no further code.
