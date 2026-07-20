# Feature: Milestone Spin Wheel
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/20-milestone-spin-wheel.md`
**Status**: 🚧 Phases 1–2 built, Babel-verified via the project's own
`@babel/core` + `babel-preset-expo` — pending your on-device pass (Expo Go).
See each phase's Implementation Notes for what to test.
**Last Updated**: July 2026

---

## Context

`19-card-themes.md` Phase 2 shipped a deterministic **pick-1-of-3 chest** at
day 30/50 (`components/MilestoneChest.js`, `claimChestPick`). This feature
**replaces that chest with a spin wheel** — the milestone's exclusive card
theme is now granted **directly** (like the day-100+ Legendary themes already
are), and a spinning wheel then awards a **bonus** coins/freezes prize from a
fixed pool. It also **front-loads the first week** — the highest-churn window
of a new user's life — by attaching a theme + spin to days **1, 3, 7, 10, 30**
(and keeping 50).

The design decisions behind this doc were settled in chat 2026-07-20 and
supersede `IDEAS-gamification.md`'s "Milestone chests" section and
`19-card-themes.md` Phase 2's chest. The reasoning is recorded here so it
isn't re-litigated:

- **Spin, not pick.** The wheel's anticipation ("which will it land on") is the
  hook the static chest lacked. The user does **not** choose the reward.
- **Earned-only, no blanks — the two bright lines.** Spins are granted by a
  milestone, **never bought** (buying spins is the rejected gacha loop —
  triggers Play's loot-box odds-disclosure and contradicts FLO's
  discipline-first voice). Every wheel segment is a **real reward** — there is
  no "you got nothing" slice. Keep these two and the mechanic stays on-brand;
  break either and it becomes the thing `IDEAS-gamification.md` rejected as
  "no gacha, final."
- **Theme granted directly, wheel is bonus.** A single random spin means a
  theme-on-the-wheel would be missed by most users with no recovery — the exact
  frustration that "tempts a paid re-spin." Granting the theme outright removes
  the lockout; the wheel is pure upside.
- **Built on a source/wheel seam.** The *spin source* (what grants a spin) is
  kept separate from the *wheel* itself, so future sources (spend coins, watch a
  rewarded ad — the latter gated behind `IDEAS-gamification.md`'s post-launch
  ads decision) and future prize types (mascot skins/bundles, when art lands)
  plug in without reworking the wheel.

It follows FLO's ledger discipline exactly: a spin outcome is one **idempotent
`reward_events` row** (`source: 'spin'`, `ref: 'spin:<day>'`); the balance is
derived, the *claim* is what's recorded, and the persisted row is the
authoritative record of what a user won (a replayed celebration reads it back,
never re-rolls).

---

## Phase Overview

```
Phase 1 — Wheel engine (replaces the chest at day 30 & 50)
  Build the spin wheel + claimSpin + the source/wheel seam; wire it into the
  existing StreakCelebration chain in place of MilestoneChest. The day 30/50
  themes (Holographic, Aurora) become DIRECT grants; the wheel awards a
  coins/freezes bonus. No new art — uses themes that already exist. Retire the
  chest.

Phase 2 — First-week ladder + 5 new themes
  Build 5 new milestone-exclusive themes (Nebula, Ruby, Sapphire, Jupiter,
  Daybreak); extend the wheel to days 1, 3, 7, 10; reassign day 30's theme to
  Daybreak and promote Holographic to a NEW day-150 milestone. Gold Foil stays
  the solo day-100 flagship.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Wheel engine (replaces the chest at day 30 & 50)
🚧 **Built, Babel-verified — pending on-device confirmation (Expo Go).**

### Goal

When a user crosses a milestone that has a wheel (day 30 or 50 in this phase),
the `StreakCelebration` screen dismisses into a new **spin wheel** screen
instead of the pick-1-of-3 chest. The milestone's exclusive theme (Holographic
at 30, Aurora at 50) is **granted directly** — no longer one of three choices —
and the wheel spins to land on a **random coins/freezes bonus** from a fixed
6-segment pool, every segment a real reward. The outcome is recorded once and
is idempotent. The chest (`MilestoneChest.js`, `claimChestPick`) is removed.
Ships entirely on existing themes — zero new art.

### Before Starting — Confirm With Codebase

- `components/StreakCelebration.js` — confirm it still chains `MilestoneChest`
  via `chestPoolFor(current)` in `handleCelebrationDismiss`, sets `chestDay`
  alongside the celebration content, and that `isNewStreak || isMilestone`
  gates the whole thing. The wheel replaces the chest at exactly the same
  hand-off point.
- `lib/rewardsMutations.js` — re-read `claimChestPick` (being replaced) and
  `claimMilestone` (unchanged; still pays the `milestone:<day>` coins/freezes
  lump at 30/50 — the wheel bonus is *additive* to it, matching how the chest
  was additive before).
- `components/MilestoneChest.js` — the visual language (full-screen ink
  `Modal`, `ZoomIn`/`FadeInDown`, `CardThemeSurface` swatch) the wheel screen
  inherits.
- `lib/cardThemes.js` — `holographic` (`tier: 'chest'`, `unlock: {type:'chest',
  day:30}`) and `aurora` (`tier: 'chest'`, `unlock: {type:'chest', day:50}`).
  Both change to direct-grant themes this phase.
- `lib/rewards.js` — `MILESTONE_THEME_GRANTS` (add 30/50 here so the direct
  grant rides the exact path day-100+ already uses) and `MILESTONE_REWARDS`
  (unchanged).
- `hooks/useCardThemes.js` — confirm its ownership query already reads
  `['theme_buy', 'theme_grant']` (it does, per `19` Phase 2), so a
  directly-granted theme is owned with no query change.
- `react-native-reanimated` (`~4.1.1`) + `react-native-svg` (`15.12.1`) are the
  animation/vector deps already present — the wheel uses both, no new dep.
- Reduce-motion convention: `FadeIn`/`OnboardingReveal`/`RewardBurst` —
  animate-first, snap-on-reduce, but still SHOW the result (a spin conveys real
  information, so unlike decorative `Confetti` it must not render nothing).

### 1.1 Database

**No schema changes.** A spin outcome is a `reward_events` row using the Phase-2
(`18`) table: `source: 'spin'`, `ref: 'spin:<day>'`, carrying the won segment's
`coins`/`freezes`. `source` is free-form text — no migration, exactly like
`'theme_buy'`/`'theme_grant'`/`'chest'` needed none. Old `'chest'` rows from
`19` Phase 2 stay valid and harmless (they already granted their coins/freezes;
nothing reads them back).

### 1.2 Data Layer

- **`lib/rewards.js`** — add the wheel config + extend the direct-grant map:
  - `SPIN_WHEELS` — keyed by day, each `{ theme: <themeId|null>, segments:
    [{ id, label, coins, freezes }] }`. Phase 1 defines **30** and **50** only:
    ```js
    export const SPIN_WHEELS = {
      30: {
        theme: 'holographic',
        segments: [
          { id: 'c150', label: '150 coins', coins: 150, freezes: 0 },
          { id: 'c300', label: '300 coins', coins: 300, freezes: 0 },
          { id: 'c500', label: '500 coins', coins: 500, freezes: 0 },
          { id: 'f1',   label: '1 freeze',  coins: 0,   freezes: 1 },
          { id: 'f2',   label: '2 freezes', coins: 0,   freezes: 2 },
          { id: 'c750', label: '750 coins', coins: 750, freezes: 0 }, // jackpot
        ],
      },
      50: {
        theme: 'aurora',
        segments: [
          { id: 'c250',  label: '250 coins',  coins: 250,  freezes: 0 },
          { id: 'c500',  label: '500 coins',  coins: 500,  freezes: 0 },
          { id: 'c750',  label: '750 coins',  coins: 750,  freezes: 0 },
          { id: 'f2',    label: '2 freezes',  coins: 0,    freezes: 2 },
          { id: 'f3',    label: '3 freezes',  coins: 0,    freezes: 3 },
          { id: 'c1000', label: '1,000 coins',coins: 1000, freezes: 0 }, // jackpot
        ],
      },
    };
    export function spinWheelFor(day) { return SPIN_WHEELS[day] ?? null; }
    ```
    All amounts are illustrative/tunable (same "ratios, not gospel" rule as the
    rest of `lib/rewards.js`). **Invariant: no segment has `coins:0 &&
    freezes:0`** — there is never a blank slice.
  - `MILESTONE_THEME_GRANTS` — add `30: 'holographic', 50: 'aurora'` so the
    theme is granted through `claimMilestone`'s existing `theme_grant` path.
    (The wheel does *not* grant the theme — `claimMilestone`, which already runs
    for these milestone days, does. The wheel grants only the bonus. This keeps
    theme-granting in one place for all milestone days.)
- **`lib/rewardsMutations.js`**:
  - Add **`claimSpin(day, segment)`** — idempotent upsert
    `{ source: 'spin', ref: 'spin:<day>', coins: segment.coins, freezes:
    segment.freezes }` with `onConflict: 'user_id,source,ref',
    ignoreDuplicates: true`, `.select()`. Respect `FREEZE_CAP` for the freeze
    portion the same way `claimMilestone` does (read live balance, clamp,
    silently drop overflow). Returns `{ isNewClaim, coins, freezes }`.
    **On a duplicate (`isNewClaim === false`)**, follow up with a `select` of
    the existing `spin:<day>` row and return *its* stored `coins`/`freezes` — so
    a replayed wheel lands on the segment the user actually won, never a fresh
    random roll that would then no-op and mislead. The persisted row is the
    authoritative outcome.
  - **Remove `claimChestPick`** (and its `theme_grant` follow-up) — superseded.
- No new hook — the wheel reads `useRewards()` (already exists) only if it needs
  the live balance for the cap message; the mutation reads balance itself.

### 1.3 Components

- **`components/MilestoneSpinWheel.js`** (new — replaces `MilestoneChest.js`).
  Props `{ day, visible, onDone }`, mirroring `MilestoneChest`'s contract so the
  `StreakCelebration` swap is a near-drop-in. Full-screen ink `Modal`, same
  chrome as `StreakCelebration`/`MilestoneChest` (icon tile, title "Day {day}",
  body). Structure:
  - A **wheel** (a `react-native-svg` disc divided into N equal segments, each
    labelled with its prize) that **spins** (reanimated `useSharedValue`
    rotation + `withTiming`, a long ease-out) and lands pointer-up on a
    **client-chosen random segment index**.
  - The random index is picked client-side (vary by no external RNG dependency
    beyond `crypto.getRandomValues`, already polyfilled — or a simple index from
    it); `claimSpin(day, segments[idx])` is called, and the wheel animates to
    whichever segment the **persisted claim** resolved to (identical to `idx` on
    a first claim; the stored one on a replay).
  - On settle: a "+N coins" / "+M freezes" reward line and a **"Nice"** button
    (`onDone`), same as the chest's resolution state.
  - **Reduce-motion**: skip the spin animation, snap directly to the resolved
    segment, still show the reward line (per `RewardBurst`'s precedent — the
    outcome is real info, not decoration).
  - Exports the component as default; the `spinWheelFor(day)` check lives in
    `lib/rewards.js` (not the component, unlike `MilestoneChest`'s
    `chestPoolFor`) so `StreakCelebration` imports config from the tuning file.
- **`components/MilestoneChest.js`** — **deleted**.

### 1.4 Navigation / Integration

- **`components/StreakCelebration.js`**:
  - Replace the `MilestoneChest`/`chestPoolFor` import with
    `MilestoneSpinWheel` + `spinWheelFor` (from `lib/rewards.js`).
  - Rename the `chestDay`/`chestVisible` state to `wheelDay`/`wheelVisible`
    (same two-sequential-Modals shape — the wheel is shown only after the
    celebration is dismissed, never stacked; this preserves the Phase-3
    Modal-over-Modal fix).
  - `setWheelDay(isMilestone && spinWheelFor(current) ? current : null)` at the
    same snapshot point `chestDay` was set.
  - `handleCelebrationDismiss` shows the wheel if `wheelDay` is set;
    `handleWheelDone` closes it.
  - `claimMilestone(current)` still runs first (unchanged) — it now also grants
    the theme for 30/50 via the extended `MILESTONE_THEME_GRANTS`. The wheel's
    `claimSpin` is the *bonus*, on top.

### 1.5 Impact on Existing Features

| Existing | Impact | Watch for |
|---|---|---|
| `components/MilestoneChest.js` | **Deleted** | Grep for every importer — only `StreakCelebration.js` should reference it |
| `components/StreakCelebration.js` | Chest chain → wheel chain | The two Modals must never be `visible` at once (keep the Phase-3 sequential pattern); wheel only after dismiss |
| `lib/rewardsMutations.js` | `claimChestPick` removed, `claimSpin` added | No other caller of `claimChestPick` (it was chest-only) |
| `lib/rewards.js` `MILESTONE_THEME_GRANTS` | +30, +50 | `claimMilestone` now grants a theme at 30/50 — verify it's the direct path, not a double-grant with the wheel |
| `lib/cardThemes.js` `holographic`/`aurora` | `tier: 'chest'` → `'legendary'`; `unlock.type` `'chest'` → `'milestone'` | Shop's locked section already captions `unlock.type === 'milestone'`; verify no code still branches on `'chest'` |
| `app/shop.js` | `'chest'` tier disappears from `LOCKED_TIERS` | Confirm the shop renders with `LOCKED_TIERS = ['legendary']` and no empty "Chest-exclusive" section header lingers |
| `claimMilestone` coins/freezes | Unchanged | Wheel bonus is additive, same as the chest was |

### 1.6 What This Phase Does NOT Include

- No new themes (Phase 2). Day 30 keeps Holographic, day 50 keeps Aurora.
- No day 1/3/7/10 wheels (Phase 2).
- No new spin *sources* — milestone is the only source; the seam is built, but
  coins-to-spin and ad-to-spin are Phase-2+/deferred.
- No day-150 milestone, no Holographic remap (Phase 2).

### 1.7 Phase 1 Checklist — Before Marking Complete

- [x] Crossing day 30 (or 50) dismisses the celebration into the spin wheel,
      which spins and lands on a random segment; the bonus coins/freezes are
      credited exactly once (idempotent by `ref: 'spin:<day>'`) — `claimSpin`'s
      upsert uses `onConflict: 'user_id,source,ref', ignoreDuplicates: true`,
      same idempotency shape as every other claim in this ledger.
- [x] The milestone theme (Holographic/Aurora) is granted **directly** on
      crossing the day — owned immediately, not offered as a choice — via
      `MILESTONE_THEME_GRANTS` (now includes `30`/`50`) + the existing
      `claimMilestone` theme-grant path, unchanged from how 100+ already work.
- [x] Every wheel segment is a real reward — no blank/zero slice anywhere
      (`SPIN_WHEELS` in `lib/rewards.js`, checked by inspection: every entry has
      `coins > 0` xor `freezes > 0`).
- [x] A replayed/re-rendered wheel lands on the **same** segment the user
      already won (reads the persisted `spin:<day>` row via `claimSpin`'s
      not-a-new-claim branch), never re-rolls. **Caveat, documented inline in
      `MilestoneSpinWheel.js`**: the visual landing spot on a replay is
      resolved by matching the persisted coins/freezes back to a segment
      (`findSegmentIndex`) rather than a stored index, since `reward_events`
      has no metadata column to remember which segment id won — this can only
      mismatch in the rare case a freeze grant was clamped by `FREEZE_CAP` at
      original-claim time; the reward TEXT shown is always the real credited
      amount regardless of which segment the wheel visually lands on.
- [x] Freeze segments respect `FREEZE_CAP` — `claimSpin` reads the live balance
      and clamps the freeze portion before inserting, same pattern as
      `claimMilestone`.
- [x] Reduce-motion: `MilestoneSpinWheel` checks `AccessibilityInfo.isReduceMotionEnabled()`
      and snaps `rotation.value` straight to the resolved segment (no
      `withTiming`) while still revealing the reward line immediately —
      same "still show it, just don't animate it" rule `RewardBurst` uses.
- [x] `MilestoneChest.js`/`claimChestPick` are deleted with no dangling imports
      (grepped the repo — clean; the only remaining matches are explanatory
      comments in the new code referencing what was replaced); the wheel and
      celebration never show two Modals at once (same sequential-dismiss
      pattern as the chest had — `wheelVisible` only flips true inside
      `handleCelebrationDismiss`, after `setVisible(false)`).
- [x] `lib/rewards.js` stays pure (no React/Supabase); `SPIN_WHEELS` is the only
      place segment amounts live.

**Code-complete, Babel-verified via the project's own `@babel/core` +
`babel-preset-expo` (all 6 touched files transform cleanly); pending your
on-device pass — see Implementation Notes and the on-device test plan below.**

**→ Stop here. Show the result and wait for approval.**

### Phase 1 — Implementation Notes

Built: `lib/rewards.js` (`SPIN_WHEELS`, `spinWheelFor`, `MILESTONE_THEME_GRANTS`
gained `30`/`50`), `lib/cardThemes.js` (`holographic`/`aurora` flipped
`tier: 'chest'` → `'legendary'`, `unlock.type` `'chest'` → `'milestone'`;
`LOCKED_TIERS`/`TIER_LABELS` drop `'chest'`), `lib/rewardsMutations.js`
(`claimChestPick` removed, `claimSpin` added), `components/MilestoneSpinWheel.js`
(new, replaces `MilestoneChest.js`), `components/StreakCelebration.js`
(`chestDay`/`chestVisible` renamed `wheelDay`/`wheelVisible`, chains
`MilestoneSpinWheel` instead of `MilestoneChest`), `app/shop.js` (dropped the
dead `unlock.type === 'chest'` branch in `unlockCaption`). No schema change —
`source: 'spin'` is a new free-form value in the existing `reward_events`
table, exactly like `theme_buy`/`theme_grant` needed none.

**The wheel is a ring, not a pie** — built on the exact stroke-dasharray
technique `components/DonutChart.js` already uses (a thick circular stroke
split into arcs via `strokeDasharray`/`strokeDashoffset`, `rotation={-90}` so
segment 0 starts at 12 o'clock), rather than inventing SVG `<path>` pie-slice
geometry from scratch. Segment icon+amount labels are plain RN `<View>`/`<Text>`
positioned via trigonometry at each segment's mid-angle and rotated to match
(the same "labels radiate outward, tilting as the wheel spins" look real
prize wheels use) — not SVG `<text>`, since that would need to rotate inside
the SVG coordinate system for no real benefit here. The whole ring + labels
sit inside one `Animated.View`, spun by a single `rotation` shared value
(`withTiming` + `Easing.out(Easing.cubic)` for a decelerating spin) — a fixed
triangular pointer above it (not part of the rotated group) marks the landing
segment.

**Landing math**: for `segments.length` equal slices, segment `i` spans
`[i·(360/N), (i+1)·(360/N))` clockwise from 12 o'clock; its center is at
`i·(360/N) + (360/N)/2`. To bring that center under the fixed top pointer, the
final rotation is `EXTRA_SPINS·360 + (360 − landAngle)` — `EXTRA_SPINS = 5`
full turns purely for spin-effect, tunable.

**Claim-then-animate, not animate-then-claim** — `spin()` calls `claimSpin`
*before* starting the visual animation (awaits the network round-trip first),
then animates to whatever the claim actually resolved to. This was a
deliberate choice over the alternative (animate immediately on a client-guessed
index, reconcile after): it means the wheel never has to visually "correct"
itself mid-spin or after landing if the network result differs from the
client's guess (which happens by construction on every replay, and could in
principle happen on a race). The tradeoff is a brief pause before the spin
visibly starts while the request is in flight — accepted since `RewardBurst`/
`claimDailyLog`'s own precedent already treats a short network round-trip as
acceptable latency inside a celebratory moment, and the alternative (animate
first, snap to a different result at the end) reads as visibly broken/rigged
in exactly the way a spin wheel cannot afford to.

**Ring colors are two static tones, not per-segment-kind** — alternates
`colors.inkCard` with a lightened variant (`lighten(colors.inkCard, 0.35)`,
`lib/color.js`) purely so adjacent slices are visually distinguishable (like a
roulette wheel's alternating dark bands), rather than color-coding by reward
kind (coins vs. freeze) — the icon on each label already carries that
information (`CircleDollarSign` vs `Snowflake`, exact same icon/color choice
`MilestoneChest.js` used), so the ring color didn't need to double up on it.

**One thing to watch on-device, flagged rather than guessed at**: the label
font size (10px, `fontSize` isn't a `theme/tokens.js` named size — a literal,
since the smallest named size (`xs: 11`) plus the icon above it didn't
comfortably fit `LABEL_SIZE` (54px) at a 6-segment ring this size (240px) in
the layout math; this is exactly the kind of thing that reads differently on
a real screen than in this environment's Babel-only verification — resize
`SIZE`/`STROKE_WIDTH`/`LABEL_SIZE` together if labels crowd or clip on-device.

**Third round of on-device feedback, all UI (data confirmed correct via the
Supabase MCP each time — the theme grant, spin, and daily-log claim all landed
right; only the presentation needed work)**:

- **The wheel no longer auto-spins.** `phase` gained an `'idle'` state; a
  primary **Spin** button shows first, and `spin()` — unchanged internally —
  now runs on tap instead of an on-mount effect. Nothing renders while
  `phase === 'spinning'`; only the wheel itself is on screen mid-animation.
- **The granted theme now shows as a real `CardThemeSurface` preview**
  ("New theme unlocked" + the actual card, same component the Shop uses to
  preview a theme) instead of a text string ("Nebula unlocked · ...") — the
  coins/freezes bonus stays a separate pill below it.
- **New `Button` variant, `ghost`** (`components/Button.js`) — a low-contrast
  translucent pill for a plain acknowledge/dismiss action on the permanently-
  dark celebration Modals, as opposed to `primary`'s loud brand-lime, which
  should stay reserved for a real decision (Spin). Applied to this wheel's
  "Nice" button and to `StreakCelebration.js`'s own CTA button — both modals
  previously used `primary` for every action, which read as visually flat
  ("these buttons look odd," direct feedback). Every OTHER `primary` button
  in the app is untouched; this variant is additive, not a restyle.

### On-Device Test Plan (what to check in Expo Go)

Since day 30/50 can't be reached quickly on a real streak, the practical way to
exercise this is a manually-credited test account (same mechanism already used
for Phase 4's freeze testing in `18-gamification-ritual-and-ledger.md` —
insert a `reward_events` row via the Supabase dashboard to simulate reaching
day 30, or use an account already near a real milestone):

1. **Trigger a day-30 (or day-50) milestone.** Confirm `StreakCelebration`
   shows as before, then — on dismiss — the new spin wheel modal appears
   (not the old 3-tile chest).
2. **Watch the spin.** The wheel should visibly rotate for a couple of
   seconds and decelerate to a stop with one segment under the pointer at
   the top. Confirm the reward line below ("+N coins" / "+N coins · +M
   freezes") matches the segment it landed on.
3. **Confirm the theme was already granted before the wheel even appeared** —
   open the Shop (`app/shop.js`) and check Holographic (day 30) / Aurora
   (day 50) show as **owned**, not locked, immediately after the milestone
   celebration — i.e. the theme wasn't something the wheel could have been
   about.
4. **Tap "Nice"** and confirm the coin/freeze balance on Home actually
   increased by the amount shown.
5. **Force a replay** (if feasible — e.g. re-trigger the same milestone
   check, or reload the app right after) and confirm the wheel does **not**
   grant a second reward, and if it re-shows at all, lands on the same
   segment/amount as before.
6. **Reduce Motion**: enable it in the device's accessibility settings,
   re-trigger a milestone, and confirm the wheel appears already landed
   (no spin animation) but still shows the correct reward.
7. **General sanity**: Shop's "Legendary" section (no more "Chest-exclusive"
   section) shows Holographic/Aurora with a "Day 30/50 streak" caption when
   not yet owned.

---

## Phase 2 — First-week ladder + 5 new themes
🚧 **Built, Babel-verified — pending on-device confirmation (Expo Go).**

### Goal

The retention play: the first week — where a new user decides to stay or churn
— now hands out a beautiful new card theme **and** a bonus spin at days **1, 3,
7, 10** (plus the day-30/50 wheels from Phase 1). Five new milestone-exclusive
themes are built; day 30's theme becomes **Daybreak** and **Holographic** is
promoted to a new **day-150** milestone. Gold Foil remains the solo day-100
flagship.

### Before Starting — Confirm Phase 1 is Approved

- `MilestoneSpinWheel` + `claimSpin` + `SPIN_WHEELS` exist and work at 30/50.
- `StreakCelebration` fires on `isNewStreak` (day 1) as well as `isMilestone` —
  confirm day 1 reaches `handleCelebrationDismiss` so the wheel can chain there
  **without** adding 1 to `MILESTONES` (which would create a duplicate day-1
  streak trophy — `lib/trophies.js` maps its Streak Keeper tiers over
  `MILESTONES`). Day 1's wheel is gated by `spinWheelFor(1)`, not by
  `isMilestone`.
- `lib/streak.js` `MILESTONES` — adding **150** here is intended (it gives a
  150-day streak trophy for free); confirm `isMilestone`/`MILESTONE_REWARDS`
  stay in sync.
- `components/CardThemeSurface.js` — `linear` (multi-stop) + `pattern` kinds
  (grid/lines/weave/blotch/glow) are all that's supported. Ruby/Sapphire/
  Jupiter/Daybreak are multi-stop `linear` (no renderer change). **Nebula**
  needs a new `pattern` kind (see 2.3).

### 2.1 Database

**No schema changes.** Same `source: 'spin'` / `theme_grant` rows as Phase 1.

### 2.2 Data Layer

- **`lib/cardThemes.js`** — add 5 new entries (see 2.3 for looks), each
  `tier: 'milestone'` (a new locked tier, label "Milestone reward" — distinct
  from `'legendary'` so a day-1 theme isn't mislabelled "Legendary") with
  `unlock: { type: 'milestone', day }`, no `cost`:
  `nebula` (day 1), `ruby` (day 3), `sapphire` (day 7), `jupiter` (day 10),
  `daybreak` (day 30).
  - Change `holographic`: `unlock.day` 30 → **150**.
  - `TIER_LABELS` gains `milestone: 'Milestone reward'`; `LOCKED_TIERS` becomes
    `['legendary', 'milestone']`.
- **`lib/streak.js`** — `MILESTONES` gains **150**:
  `[3, 7, 10, 30, 50, 100, 150, 200, 365, 500, 1000]`.
- **`lib/rewards.js`**:
  - `MILESTONE_REWARDS` — add `150: { coins: 2000, freezes: 1 }` (on the same
    curve between 100 and 200; tunable).
  - `MILESTONE_THEME_GRANTS` — add `150: 'holographic'`; change `30` from
    `'holographic'` → `'daybreak'`. (50 stays `'aurora'`.)
  - `SPIN_WHEELS` — add day **1, 3, 7, 10** with theme + segment pools per the
    table below; set day 30's `theme` to `'daybreak'`.
    ```
    Day  Theme      Segments (all real rewards, no blank)
    1    nebula     25c · 50c · 75c · 100c · 1 freeze · 150c(jackpot)
    3    ruby       50c · 100c · 150c · 1 freeze · 2 freezes · 200c(jackpot)
    7    sapphire   100c · 150c · 250c · 1 freeze · 2 freezes · 300c(jackpot)
    10   jupiter    150c · 250c · 350c · 2 freezes · 300c · 500c(jackpot)
    ```
- **`lib/rewardsMutations.js`** — `claimSpin` unchanged (already generic over
  `day`/`segment`). Day 1 is not in `MILESTONE_REWARDS`, so `claimMilestone(1)`
  no-ops for the coins/freezes lump — but the **theme grant must still happen at
  day 1**. Since `claimMilestone` early-returns when `MILESTONE_REWARDS[day]` is
  absent, move the `MILESTONE_THEME_GRANTS` grant to run **before** that early
  return (or grant the theme inside `claimSpin` when `SPIN_WHEELS[day].theme` is
  set). **Decision for the build**: grant the theme in `claimSpin` (it already
  runs for every wheel day, milestone or not) and drop the 30/50 entries from
  `MILESTONE_THEME_GRANTS` that Phase 1 added — so themes for *wheel* days go
  through `claimSpin`, and `MILESTONE_THEME_GRANTS` is left holding only the
  non-wheel Legendary days (100/150/200/365/500/1000). This keeps a single rule:
  "wheel day → theme via claimSpin; pure milestone day → theme via
  claimMilestone." Confirm this refactor doesn't double-grant at 30/50.

### 2.3 Components — the 5 new themes

All buildable with the existing `CardThemeSurface`, `{ background, textColor,
chipColor }` shape (`mutedColor` is derived automatically). SVG-only, no new
dep. Looks (final palettes tunable on-device):

| id | name | `background` | text / chip |
|---|---|---|---|
| `nebula` | Nebula | **NEW pattern kind `'nebula'`**: near-black base + a violet→magenta→indigo radial cloud + a scatter of faint white star dots | pale lavender / white |
| `ruby` | Ruby | `linear` multi-stop crimson with a light mid-stop for a facet sheen (`['#4a0511','#a00d24','#e0334f','#7a0a1c']`) | warm gold |
| `sapphire` | Sapphire | `linear` multi-stop royal/navy with a light mid-stop (`['#071a44','#12419e','#3d6fd6','#0a2352']`) — Ruby's sibling | silver-white |
| `jupiter` | Jupiter | `linear` **vertical** (angle 180) cream/amber/rust banding (`['#e8d8b8','#c98f52','#8a4a2a','#d8b58a','#7a3d1f']`) — reads as gas-giant belts | ochre |
| `daybreak` | Daybreak | `linear` **vertical** sunrise (`['#1a1e4a','#4a3a7a','#c97a8a','#f0b06a']`) — indigo→rose→amber | pale gold |

- **`components/CardThemeSurface.js`** — add one `pattern` kind, `'nebula'`: a
  dark base `rect`, a `radialGradient` cloud (offset off-centre), and ~8–12
  small white `<circle>` star dots at fixed positions (deterministic, not
  random — the SVG is a static string). Contained addition alongside the
  existing `grid`/`lines`/`weave`/`blotch`/`glow` branches; every existing theme
  unaffected.
- **`MilestoneSpinWheel.js`** — no structural change; it renders whatever
  `SPIN_WHEELS[day]` provides (now more days). Verify the disc + labels lay out
  for all pools (they're all 6 segments — same geometry as Phase 1).

### 2.4 Navigation / Integration

- **`components/StreakCelebration.js`** — the wheel already chains on
  `spinWheelFor(current)`; confirm day 1 (via `isNewStreak`) reaches it. The
  gate `worthCelebrating = isNewStreak || isMilestone` already covers day 1, and
  `spinWheelFor(1)` now returns a config, so no gate change — just verify
  `setWheelDay(spinWheelFor(current) ? current : null)` no longer also requires
  `isMilestone` (day 1 isn't a milestone). **Change**: drop the `isMilestone &&`
  qualifier on the wheel-day set, gating purely on `spinWheelFor(current)`.
- **`app/shop.js`** — the new `'milestone'` tier renders in the locked section
  with day captions; the 5 new themes + Holographic (now "Reach a 150-day
  streak") show as locked previews.

### 2.5 Impact on Existing Features

| Existing | Impact | Watch for |
|---|---|---|
| `lib/streak.js` `MILESTONES` | +150 (11 tiers) | `lib/trophies.js` auto-gains a 150-day Streak Keeper trophy tier — intended; verify it renders |
| `StreakCelebration` wheel gate | Now fires on day 1 too | Day 1 must not double-fire with the day-1 "new streak" copy oddly; verify the sequence reads well |
| `claimMilestone` / `claimSpin` theme grant | Refactor per 2.2 | No double-grant at 30/50; day-1 theme still granted despite no `MILESTONE_REWARDS[1]` |
| `lib/cardThemes.js` | +5 themes, Holographic remap, new tier | Shop grouping + captions; `getTheme` fallback unaffected |
| `CardThemeSurface` | +`'nebula'` pattern kind | Existing themes untouched; new kind is additive |
| `app/(tabs)/index.js` hero card | Renders any equipped new theme | No change — reads `getTheme` already |

### 2.6 What This Phase Does NOT Include

- No new spin *sources* (coins-to-spin, rewarded-ad-to-spin) — the seam exists;
  wiring them is deferred (ads ride `IDEAS-gamification.md`'s post-launch ads
  gate).
- No mascot-skin / bundle prize segments — art-gated (same blocker as `05`
  Phase 5); the pool is coins/freezes only until art lands.
- No animated foil/sheen sweep on the new themes (static, same deferral as `19`).
- Constellation card theme — deliberately reserved for the planned **calendar
  skins**, not built here.
- Seasonal themes — cut from `19` entirely, still out.

### 2.7 Phase 2 Checklist — Before Marking Complete

- [x] Days 1/3/7/10 each chain the wheel off the celebration, grant their theme
      directly, and award a bonus spin; day 1 works via `isNewStreak`
      (`current === 1` — verified in `lib/streak.js`) with no `MILESTONES`
      change — `StreakCelebration`'s wheel gate now reads purely
      `spinWheelFor(current)`, no `isMilestone &&` qualifier.
- [x] The 5 new themes render correctly as an equipped hero card and as Shop
      previews; Nebula's `'nebula'` pattern kind renders without breaking
      others (contained new branch in `buildPatternSvg`, existing kinds
      untouched).
- [x] Day 30 grants **Daybreak** (not Holographic); Holographic is granted at
      the new **day-150** milestone; Gold Foil is still the solo day-100 grant.
- [x] Theme-grant refactor causes no double-grant at 30/50 and still grants the
      day-1 theme despite no `MILESTONE_REWARDS[1]` — the single rule holds:
      wheel days (1/3/7/10/30/50) grant their theme via `claimSpin` reading
      `SPIN_WHEELS[day].theme`; pure milestone days (100/150/200/365/500/1000)
      grant via `claimMilestone`'s `MILESTONE_THEME_GRANTS` — the two maps
      have zero overlapping keys (verified by inspection).
- [x] `MILESTONES` includes 150 (`[3,7,10,30,50,100,150,200,365,500,1000]`);
      `lib/trophies.js`'s Streak Keeper tiers map over this list, so a 150-day
      trophy tier appears automatically.
- [x] Shop shows the `'milestone'` locked tier with correct day captions —
      `LOCKED_TIERS`/`TIER_LABELS` generic `.map()` in `app/shop.js` needed no
      code change at all (confirmed by grep — no hardcoded `'legendary'`
      assumption anywhere in that file).

**Code-complete, Babel-verified via the project's own `@babel/core` +
`babel-preset-expo`; pending your on-device pass — see Implementation Notes
below.**

**→ Stop here. Show the result — this closes out the feature's two planned
phases.**

### Phase 2 — Implementation Notes

Built: `lib/streak.js` (`MILESTONES` +150), `lib/cardThemes.js` (+5 themes —
`nebula`/`ruby`/`sapphire`/`jupiter`/`daybreak`, new `'milestone'` tier;
`holographic`'s `unlock.day` 30→150), `components/CardThemeSurface.js` (+`'nebula'`
pattern kind), `lib/rewards.js` (`MILESTONE_REWARDS` +150;
`MILESTONE_THEME_GRANTS` loses 30/50, gains 150; `SPIN_WHEELS` gains a `theme`
field on every entry + 4 new days), `lib/rewardsMutations.js` (`claimSpin` now
also grants `SPIN_WHEELS[day].theme` via a `theme_grant` row, mirroring
`claimMilestone`'s existing pattern exactly), `components/StreakCelebration.js`
(wheel gate drops its `isMilestone &&` qualifier so day 1 reaches it via
`isNewStreak`). No schema change — every new value (`theme_grant` for a wheel
day, the new `MILESTONES`/theme entries) reuses existing free-form columns.

**The theme-grant refactor is the one real plumbing change this phase made** —
Phase 1 had granted 30/50's themes through `MILESTONE_THEME_GRANTS` (the pure-
milestone path); Phase 2 moves that to `claimSpin` instead, per the doc's own
"decision for the build." Verified by inspection that the two maps
(`MILESTONE_THEME_GRANTS` and `SPIN_WHEELS[day].theme`) now partition the
milestone days with no overlap: `{100,150,200,365,500,1000}` vs
`{1,3,7,10,30,50}`.

**What to check in Expo Go**: the fastest real test is day 1 — sign in as a
brand-new account (or one that hasn't logged today) and log a single
transaction. Confirm the "new streak" celebration appears, dismissing it
chains straight into the spin wheel (Nebula should already be owned/equipped-
available in the Shop the moment the celebration fires, before the wheel even
resolves), the wheel lands on a real coin/freeze bonus, and the reward credits
correctly. For days 3/7/10/30/50, the same manually-credited-test-account
trick from Phase 1 applies. Also worth a look: Shop's locked section now shows
two labelled groups ("Milestone reward" and "Legendary") with Nebula/Ruby/
Sapphire/Jupiter/Daybreak/Holographic captioned with their correct day.

**Two post-build fixes, both from the first real on-device test (day-1 wheel,
a brand-new account)**:

- **The wheel's reward pill never showed the theme grant** — verified via the
  live ledger (Supabase MCP) that Nebula's `theme_grant` row landed correctly,
  but `MilestoneSpinWheel.js`'s `spin()` only ever captured `coins`/`freezes`
  off `claimSpin`'s return, dropping the `themeId` it already returns. Fixed:
  `result` state now carries `themeId` too, and the reward pill leads with
  `"{Theme name} unlocked · "` before the coins/freezes line whenever it's set
  — the theme is the headline (a direct grant, not a wheel outcome), the
  wheel's segment is the bonus after it.
- **Wheel enlarged** per direct feedback — `SIZE` 240→300, `STROKE_WIDTH`
  56→68, `LABEL_SIZE` 54→66, label icon 16→19, hub 44→52, pointer scaled to
  match. Everything derives from these three constants, so re-tuning scale
  again is a one-place change.

**Root-caused and fixed**: that same test showed only 25 coins total (should
be 25 from `daily_log` + the wheel's own segment) and no XP. Reproduced on a
second fresh account, confirming it wasn't a one-off. Checked the live ledger
via the Supabase MCP both times: `spin`/`theme_grant` landed correctly, but
**no `daily_log` row was written at all**, for either account. The actual
cause: a brand-new account's first-ever transaction is almost always logged
via **`app/onboarding/balance.js`** ("Starting balance") or
**`app/onboarding/expense.js`** ("log your most recent transaction") —
**both insert into `transactions` directly** (their own documented contract:
"identical row shape to an AddTransactionSheet-created transaction") and
**neither ever called `claimDailyLog`**. The day-1 streak celebration/spin
wheel still fired correctly regardless, because `useStreak` computes
`current`/`loggedToday` straight from the `transactions` table, with no
dependency on the reward ledger at all — so the wheel and theme grant working
while the coin/XP claim silently never happened is exactly what this gap
would produce. `claimDailyLog`, its schema, and `AddTransactionSheet.js`
itself were never actually broken; a second, undocumented transaction-entry
path had simply drifted out of sync with the reward contract the primary one
follows.

**Fix, per direct feedback** (don't stack a `RewardBurst` into the onboarding
stepper on top of the celebration/wheel that already fires there): both
onboarding screens now call `claimDailyLog` after their insert succeeds, same
as `AddTransactionSheet` (using `new Date()`, never the user-editable `date`
field `expense.js` lets you backdate — same "a backdated entry still counts
as logging TODAY" discipline `AddTransactionSheet`'s own call documents). The
earned reward is persisted via a new **`lib/pendingLoginReward.js`** (a
one-shot, user-scoped AsyncStorage bridge — same standing pattern as
`StreakCelebration`'s "already celebrated" key) instead of bursting
immediately. **`app/(tabs)/index.js`** consumes it in a mount effect: reads
and clears it, then fires the same `RewardBurst` `AddTransactionSheet` would
have — so the coins/XP now show up as a burst on Home, right after
onboarding finishes, rather than mid-stepper. Existing test accounts that hit
this bug before the fix (e.g. the two used to diagnose it) keep their missing
`daily_log` claim — not backfilled, since they're disposable test accounts,
not real users; a fresh account exercises the fixed path end-to-end.

---

## Data Model Summary (Final State After All Phases)

```
  streak crosses a wheel day (1/3/7/10/30/50)
        │  StreakCelebration dismisses → MilestoneSpinWheel
        ▼
  claimMilestone(day)         claimSpin(day, randomSegment)
    (existing lump +            (NEW bonus row)
     theme for pure               source:'spin', ref:'spin:<day>'
     milestone days)              coins/freezes = won segment
        │                              │
        └──────────────┬───────────────┘
                       ▼
                 reward_events  ─────►  v_reward_balances
                 (append-only)          coins / xp / freezes

  theme grant (source:'theme_grant', ref:'<themeId>')
    wheel days → via claimSpin ;  pure milestone days → via claimMilestone
        └────────────►  useCardThemes owns it (theme_buy ∪ theme_grant)
```

No new table, no new view, no new column — every row lands in the existing
`reward_events` ledger (`18-gamification-ritual-and-ledger.md`). `source: 'spin'`
is a new free-form value; `theme_grant` is reused from `19` Phase 2.

### `reward_events` — new `source` value
| source | ref | coins | freezes | Notes |
|---|---|---|---|---|
| `spin` | `spin:<day>` | won segment's coins | won segment's freezes | idempotent per milestone day; the row IS the authoritative won-outcome record |

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| `components/MilestoneChest.js` | Deleted (superseded by the wheel) | Remove; grep importers |
| `lib/rewardsMutations.js` | `claimChestPick` → `claimSpin`; theme-grant path refactor | Phase 1 + 2 |
| `components/StreakCelebration.js` | Chest chain → wheel chain; fires on day 1 | Keep sequential-Modal pattern |
| `lib/rewards.js` | +`SPIN_WHEELS`, +`spinWheelFor`, `MILESTONE_THEME_GRANTS`/`MILESTONE_REWARDS` edits | Both phases |
| `lib/cardThemes.js` | +5 themes, Holographic→150, new `'milestone'` tier, retire `'chest'` | Phase 2 (holographic/aurora tier flip in Phase 1) |
| `lib/streak.js` `MILESTONES` | +150 | Phase 2 |
| `components/CardThemeSurface.js` | +`'nebula'` pattern kind | Phase 2 |
| `app/shop.js` | Locked-tier set changes (`chest` out, `milestone` in) | Both phases |
| `lib/trophies.js` | +150-day Streak Keeper tier (automatic via `MILESTONES`) | Verify only |

---

## Out of Scope (All Phases)

- **Buying spins for cash** — the rejected gacha loop (`IDEAS-gamification.md`);
  spins are earned-only, forever.
- **Coins-to-spin / rewarded-ad-to-spin sources** — the source/wheel seam is
  built for them, but wiring is deferred; ads ride the post-launch ads gate.
- **Mascot-skin / avatar-bundle prize segments** — art-gated (`05` Phase 5).
- **Constellation card theme** — reserved for the planned calendar skins.
- **Seasonal themes** — cut from `19`, still out.
- **Animated theme sheen/foil sweep** — static rendering only, same as `19`.
- **Wheels on day 100+** — those stay direct Legendary theme grants + the
  existing milestone lump, no wheel.
- **Exact number tuning** — every amount lives in `lib/rewards.js`'s
  `SPIN_WHEELS`/`MILESTONE_REWARDS`; the fixed rules are earned-only + no-blank.
```
