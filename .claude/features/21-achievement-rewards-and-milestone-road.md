# Feature: Achievement Rewards & Milestone Road
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/21-achievement-rewards-and-milestone-road.md`
**Status**: 🚧 Phases 1–2 built, Babel-verified — pending on-device confirmation.
**Last Updated**: July 2026

---

## Context

Two gaps raised in chat 2026-07-20, discussed and scoped together since both extend
the reward economy `18-gamification-ritual-and-ledger.md` and `20-milestone-spin-wheel.md`
built, but neither is really "about the wheel":

1. **The streak milestone reward ladder is invisible until you hit it.** Today the
   only way a user learns "day 30 gives Holographic + a spin" is the surprise
   celebration firing *at* day 30. Once someone has crossed a couple of milestones
   and knows rewards exist, surprise-only actually undercuts anticipation — there's
   no way to see the road ahead. **Explicit user decision: this needs its own visual
   surface, built as its own phase — simple UI for now, solid underlying data.**
2. **Only Streak Keeper trophies pay out.** Every other trophy group (Logger,
   Perfect Month, Planner, Categorizer, Frugal, Comeback, Fresh Start) is pure
   recognition — `18` Phase 1 explicitly left this open ("whether any other trophy
   also pays a small one-time coin bonus... was raised but explicitly left
   undecided"). **Resolved here: yes**, extending the economy beyond pure
   streak-keeping to the app's other pillars (budgets, plans, categorization
   discipline), via a manual **Claim** action in the Trophy Room.

Both phases are additive to the existing ledger — no schema change, same
`reward_events` table, same `UNIQUE (user_id, source, ref)` idempotency
discipline every prior claim in this app already relies on.

---

## Phase Overview

```
Phase 1 — Milestone Road (app/streak.js)
  A new section on the existing streak screen showing every milestone
  (3 through 1000), each with its actual reward preview, and whether it's
  earned / the current target / still locked. Pure data function + a plain
  list UI — no new screen, no visual "path" polish yet (deferred).

Phase 2 — Achievement Rewards + Claim (Trophy Room)
  Every trophy group except Streak Keeper (already auto-paid via the
  existing milestone/wheel pipeline) and Budget Keeper (not yet computable)
  gains a one-time coins/XP/freeze reward, claimed manually from the Trophy
  Room via a new Claim button. "Claimed" is fully derived — a
  reward_events row either exists or it doesn't, no new column.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Milestone Road

### Goal

`app/streak.js` gains a new section listing every streak milestone in order,
each row showing its day number, its actual reward (coins, freezes, a theme
grant, "+ bonus spin" where one exists), and one of three states: **earned**
(already crossed), **current** (the next target), or **locked** (further out).
A user can now see the whole ladder — including day 100's Gold Foil, day 50's
Aurora + spin, etc. — before reaching it, instead of only learning about it at
the celebration. Deliberately plain presentation this phase (a row list, no
path/line graphic) — the data contract is what must be solid; visual polish is
a pure component-only upgrade later with zero data-layer changes.

### Before Starting — Confirm With Codebase

- `app/streak.js` — re-read its current structure (hero card → headline →
  stats row → calendar card → footnote). The road is a new `Card` section;
  confirm where it reads best (after the stats row, before the calendar, is
  the working assumption — adjust if the calendar's own flow reads better
  with it after).
- `lib/streak.js` `MILESTONES` — the day list to render, in order.
  `hooks/useStreak.js` — confirm it exposes `current` (the count to compare
  against each day, matching how `StreakCelebration.js` already decides
  `isMilestone`).
- `lib/rewards.js` `MILESTONE_REWARDS`, `MILESTONE_THEME_GRANTS`,
  `spinWheelFor` — the three sources a road row needs to describe its reward.
  No new data need be invented; this phase only reads what `20` already built.
- `app/trophies.js`'s **Rank ladder section** (lines ~110–151) — the existing
  three-state row precedent (reached / current / upcoming-with-progress) to
  mirror stylistically, since this is the same shape applied to milestone days
  instead of rank thresholds.
- `lib/cardThemes.js` `getTheme(id)` — for rendering a theme grant's name in a
  road row.

### 1.1 Database

**No schema changes.** Purely a read-only presentation over data `18`/`20`
already persist.

### 1.2 Data Layer

- **`lib/rewards.js`** — add one pure function, no new state:
  ```js
  // Pure, no React/Supabase — same discipline as everything else in this
  // file. Returns every streak MILESTONES day in order, each annotated with
  // its actual reward and where it sits relative to `currentStreak`. `day`
  // is compared the same way StreakCelebration.js's own `isMilestone` does
  // (against `current`, the streak's internal count).
  export function milestoneRoad(currentStreak) {
    const nextDay = MILESTONES.find((d) => currentStreak < d) ?? null;
    return MILESTONES.map((day) => {
      const reward = MILESTONE_REWARDS[day] ?? { coins: 0, freezes: 0 };
      return {
        day,
        state: currentStreak >= day ? 'earned' : day === nextDay ? 'current' : 'locked',
        coins: reward.coins,
        freezes: reward.freezes,
        themeId: MILESTONE_THEME_GRANTS[day] ?? null,
        hasWheel: !!spinWheelFor(day),
      };
    });
  }
  ```
  Needs `MILESTONES` imported from `./streak` (one-directional — `streak.js`
  does not import `rewards.js`, no cycle introduced).
- No new hook. `app/streak.js` already calls `useStreak()`; it computes
  `milestoneRoad(current)` inline (a cheap pure map over ≤11 items, no need for
  `useMemo` gymnastics beyond what the screen already does for `typeByDate`).

### 1.3 Components

- **`app/streak.js`** — one new `Card` section, **"Milestone Road"**. Renders
  `milestoneRoad(current)` as a plain row list (mirroring the Rank ladder's row
  grammar in `app/trophies.js`: icon/badge left, day + reward text stacked
  middle, trailing state right):
  - `earned` → dimmed/muted "Earned" trailing text (or a checkmark), same
    visual weight as an already-passed rank.
  - `current` → highlighted row (the streak's own `streakDeep`/`streak` tone),
    trailing text shows days remaining (`current` streak vs `day`).
  - `locked` → dimmed row, no progress number (matches how far-off ranks show
    just their threshold, not a fraction, in the existing Rank section).
  - Reward text per row: coins/freezes (`"150 coins"`, `"150 coins · 1
    freeze"`), plus `"+ {theme name}"` when `themeId` is set (via
    `getTheme(themeId).name`), plus `"+ bonus spin"` when `hasWheel`. Compose
    these into one short subtitle line, not multiple stacked lines — keep the
    row grammar identical to every other row on this screen.
- No new sheet, no new screen.

### 1.4 Navigation / Integration

None beyond the new in-page section — `app/streak.js` is already reachable
from Home's streak flame.

### 1.5 Impact on Existing Features

| Existing | Impact | Watch for |
|---|---|---|
| `app/streak.js` | +1 new Card section | Existing hero/stats/calendar/footnote untouched |
| `lib/rewards.js` | +1 pure function (`milestoneRoad`) | No change to existing exports |
| `lib/streak.js` / `hooks/useStreak.js` | Read-only reuse | No change |

### 1.6 What This Phase Does NOT Include

- No visual "path"/connecting-line graphic — a plain row list only. The
  path/illustration polish is explicitly deferred to a later, presentation-only
  pass over the same `milestoneRoad()` data.
- No changes to how/when milestones are celebrated or rewarded — this is a
  read-only preview surface, not a new claim mechanism (that's Phase 2, and
  applies to trophies, not streak days — streak days keep auto-paying exactly
  as `20` built).
- No first-week (day 1/3/7/10) entries yet if `20` Phase 2 hasn't shipped —
  this phase renders whatever `MILESTONES` currently contains, automatically
  picking up any future extension with no further change here.

### 1.7 Phase 1 Checklist — Before Marking Complete

- [x] `app/streak.js` shows every `MILESTONES` day with the correct
      earned/current/locked state relative to the real streak count.
- [x] Each row's reward text matches `MILESTONE_REWARDS`/`MILESTONE_THEME_GRANTS`/
      `spinWheelFor` exactly — no hardcoded/re-typed numbers (`roadRewardText()`
      reads straight off the `milestoneRoad()` entry).
- [x] `milestoneRoad()` is pure (no React/Supabase imports in `lib/rewards.js`;
      the one new import, `MILESTONES` from `./streak`, is one-directional —
      `streak.js` doesn't import `rewards.js`, no cycle).
- [x] The section reads correctly for a brand-new user (streak 0 — day 3 is
      `current`, everything else `locked`) and for a maxed-out user (streak
      ≥1000 — every day `earned`) — verified by inspection of `milestoneRoad`'s
      logic (`nextDay = MILESTONES.find(d => currentStreak < d) ?? null`).

**Code-complete, Babel-verified via the project's own `@babel/core` +
`babel-preset-expo`; pending your on-device pass (Expo Go).**

**→ Stop here. Show the result and wait for approval.**

### Phase 1 — Implementation Notes

Built: `lib/rewards.js` (+`milestoneRoad()`), `app/streak.js` (+"Milestone
Road" section, between the stats row and the calendar card; +`Flame` import;
+row-grammar styles copied from `app/trophies.js`'s existing trophy/rank rows).
No schema change, no new hook — purely a read-only presentation layer over
data `18`/`20` already persist.

**What to check in Expo Go**: open the streak screen (Home's flame → Streak)
and confirm the new "Milestone Road" section lists every milestone day in
order, with the current/next target highlighted and showing "N to go", earned
days marked "Earned", and locked days dimmed with no progress text. Confirm
the reward line per row (coins/freezes, "+ theme name" at 30/50/100+, "+ bonus
spin" at 30/50) matches what the celebration/wheel actually pays at each day.

---

## Phase 2 — Achievement Rewards + Claim

### Goal

Every trophy group except **Streak Keeper** (already fully rewarded through
`18`/`20`'s existing celebration+wheel pipeline) and **Budget Keeper** (still
not computable — `keptBudgetPeriods: null`, unresolved schema question from
`18` Phase 1) now grants a one-time coins/XP/freeze reward. A user who has
already earned an eligible trophy sees a **Claim** button in the Trophy Room
instead of "Earned"; tapping it credits the reward (via the same `RewardBurst`
pop used everywhere else) and the row settles to "Earned" for good. **Comeback**
folds its existing (design-committed) +1 freeze into this same generic
mechanism instead of remaining a bespoke special case.

### Before Starting — Confirm Phase 1 is Approved

- `lib/trophies.js` — confirm `makeEntry()` still produces `id:
  '${group.id}:${tier.tier}'` (e.g. `logger:100`, `fresh_start:1`,
  `comeback:1`) — this exact string becomes the claim's idempotency `ref`,
  reusing the catalogue's own ids rather than inventing a parallel scheme.
  Confirm `TROPHY_GROUP_ORDER` still excludes nothing relevant and that
  `budget_keeper`'s tiles still carry the `locked: true` sentinel.
- `hooks/useTrophies.js` `fetchStats` — the existing `Promise.all` shape to
  extend with one more parallel query (claimed trophy refs).
- `app/trophies.js` — re-read the row rendering (lines ~162–186) — the exact
  `t.earned ? <Text>Earned</Text> : ...` branch this phase adds a third state
  to.
- `components/RewardBurst.js` — confirm `showRewardBurst({ coins, xp })` has
  **no freeze parameter today** (checked: it does not) — this phase must add
  one, since several trophy rewards include freezes (matching how
  `MilestoneSpinWheel`/`StreakCelebration`'s own reward pills already show
  freezes alongside coins).
- `lib/rewardsMutations.js` `claimMilestone`/`claimSpin` — the exact
  idempotent-upsert + `FREEZE_CAP`-clamping shape `claimTrophy` should mirror.

### 2.1 Database

**No schema changes.** A trophy claim is a `reward_events` row using the
existing table: `source: 'trophy'`, `ref: '<groupId>:<tier>'` (the trophy
tile's own `id`), carrying that tier's `coins`/`xp`/`freezes`. `source` is
free-form text — no migration, same as every prior new source value.

### 2.2 Data Layer

- **`lib/rewards.js`** — add `TROPHY_REWARDS`, keyed by the exact tile `id`
  strings `lib/trophies.js` already produces (no new id scheme):
  ```js
  // Keyed by the exact `id` lib/trophies.js's makeEntry() already computes
  // (`${groupId}:${tier}`) — reusing that string as the ledger's `ref` means
  // no separate mapping layer between "which trophy" and "which claim".
  // Streak Keeper and Budget Keeper are DELIBERATELY absent: Streak Keeper
  // already auto-pays via claimMilestone/the spin wheel (a second claim path
  // here would double-pay the same milestone); Budget Keeper isn't yet
  // computable at all (18-gamification-ritual-and-ledger.md Phase 1's open
  // schema question). Absence from this map is itself the exclusion — no
  // separate blocklist needed elsewhere.
  export const TROPHY_REWARDS = {
    'fresh_start:1': { coins: 50, xp: 100 },
    'perfect_month:1': { coins: 200, xp: 300 },
    'categorizer:1': { coins: 180, xp: 280 },
    'comeback:1': { coins: 0, xp: 150, freezes: 1 }, // folds in the existing design-committed freeze
    'logger:100': { coins: 75, xp: 150 },
    'logger:500': { coins: 200, xp: 350 },
    'logger:1000': { coins: 400, xp: 600 },
    'logger:5000': { coins: 1000, xp: 1200, freezes: 1 },
    'planner:1': { coins: 100, xp: 200 },
    'planner:5': { coins: 300, xp: 450 },
    'planner:10': { coins: 600, xp: 800, freezes: 1 },
    'frugal:5': { coins: 75, xp: 150 },
    'frugal:25': { coins: 250, xp: 400 },
    'frugal:100': { coins: 700, xp: 900, freezes: 1 },
  };
  ```
  All amounts illustrative/tunable — same "ratios, not gospel" rule as every
  other number in this file. Scaled deliberately modest relative to streak
  milestones (which already pay up to 12,000 coins + a Diamond theme at day
  1000) — these are secondary bonuses for the app's other pillars, not a
  competing headline reward.
- **`lib/rewardsMutations.js`** — add `claimTrophy(trophyId)`, mirroring
  `claimMilestone`'s shape exactly (live-balance read + `FREEZE_CAP` clamp for
  the freeze portion, idempotent upsert, `.select()` to report `isNewClaim`):
  ```js
  export async function claimTrophy(trophyId) {
    const reward = TROPHY_REWARDS[trophyId];
    if (!reward) return { error: null, isNewClaim: false, coins: 0, xp: 0, freezes: 0 };

    let freezesToGrant = reward.freezes ?? 0;
    if (freezesToGrant > 0) {
      const { data: balance, error: balanceError } = await supabase
        .from('v_reward_balances')
        .select('freezes')
        .maybeSingle();
      if (!balanceError) {
        const current = balance?.freezes ?? 0;
        freezesToGrant = Math.max(0, Math.min(freezesToGrant, FREEZE_CAP - current));
      }
    }

    const { data, error } = await supabase
      .from('reward_events')
      .upsert(
        { source: 'trophy', ref: trophyId, coins: reward.coins ?? 0, xp: reward.xp ?? 0, freezes: freezesToGrant },
        { onConflict: 'user_id,source,ref', ignoreDuplicates: true }
      )
      .select();

    return {
      data, error,
      isNewClaim: !error && (data?.length ?? 0) > 0,
      coins: reward.coins ?? 0, xp: reward.xp ?? 0, freezes: freezesToGrant,
    };
  }
  ```
- **`hooks/useTrophies.js`** — add one more parallel query to `fetchStats`'s
  existing `Promise.all` (claimed trophy refs: `supabase.from('reward_events')
  .select('ref').eq('source', 'trophy')`), carried on the `stats` object as
  `claimedTrophyRefs: Set<string>`. The `trophies` memo then annotates each
  tile:
  ```js
  const trophies = useMemo(
    () =>
      evaluateTrophies(stats).map((t) => {
        const reward = TROPHY_REWARDS[t.id];
        if (!reward) return t; // not claimable here (streak/budget_keeper, or any tier with no defined reward)
        return { ...t, reward, claimed: stats.claimedTrophyRefs.has(t.id) };
      }),
    [stats]
  );
  ```
  `lib/trophies.js` itself is untouched — it stays purely behavioral (its own
  cardinal rule: "every trophy rewards BEHAVIOR, never an amount"). The
  reward/claimed annotation is integration-layer work, which is exactly what
  `hooks/useTrophies.js` (not `lib/trophies.js`) already does for every other
  piece of live state (the "seen" set, e.g.).
- **`components/RewardBurst.js`** — extend `showRewardBurst({ coins, xp,
  freezes })` and `RewardBurstOverlay` to optionally render a third entry
  (`Snowflake`, `colors.iceBlue`, "+N freeze(s)") alongside the existing
  coins/xp entries, only when `freezes > 0` — same conditional-entry pattern
  the component already uses for `coins > 0`/`xp > 0`. No visual change for
  every EXISTING caller (`AddTransactionSheet`, `TodayCard`), which never pass
  `freezes` and are unaffected.

### 2.3 Components

- **`app/trophies.js`** — the row-rendering branch
  (`t.earned ? <Text>Earned</Text> : ...`) gains a third state:
  - `!t.earned` → unchanged (progress fraction, or nothing if locked).
  - `t.earned && t.reward && !t.claimed` → a small **Claim** pressable pill
    (compact, `radii.pill`, `colors.brand` background — same mini
    action-button grammar `Shop`'s tile actions already use), labelled with
    the reward amount (e.g. `Claim +75`), replacing the trailing "Earned"
    text for just this row.
  - `t.earned && (!t.reward || t.claimed)` → unchanged "Earned" text (covers
    Streak Keeper/Budget Keeper rows, which never have a `t.reward`, and any
    trophy already claimed).
  - On tap: track a `claimingId` (disable/spinner just that row's button —
    same per-row-loading-state shape `Shop`'s per-tile actions don't need
    since Shop only ever previews one tile at a time, but the *disable while
    in-flight* discipline is the same). Calls `claimTrophy(t.id)`; on
    `isNewClaim`, calls `notifyChanged()` + `showRewardBurst({ coins: t.reward.coins,
    xp: t.reward.xp, freezes: t.reward.freezes })`.
- No confirmation dialog before claiming — same reasoning as opening the spin
  wheel or any other pure-upside action in this app: there's no cost or
  choice involved, just collect it.

### 2.4 Navigation / Integration

None — the Claim button lives inline in the existing Trophy Room rows, no new
route.

### 2.5 Impact on Existing Features

| Existing | Impact | Watch for |
|---|---|---|
| `lib/trophies.js` | **None** — stays pure/behavioral | Do not import `TROPHY_REWARDS` here; keep the amount/behavior split intact |
| `hooks/useTrophies.js` | +1 query, +reward/claimed annotation | `stats`'s shape grows by one field; `EMPTY_STATS` needs `claimedTrophyRefs: new Set()` too |
| `app/trophies.js` | Row branch gains a 3rd state | Streak Keeper / Budget Keeper rows must be visually unaffected (no `t.reward`) |
| `components/RewardBurst.js` | +optional `freezes` param | Every existing caller (no `freezes` passed) renders identically to today |
| `lib/rewardsMutations.js` | +`claimTrophy` | Mirrors `claimMilestone`'s FREEZE_CAP-clamp + idempotent-upsert shape exactly |

### 2.6 What This Phase Does NOT Include

- **Streak Keeper and Budget Keeper stay excluded.** The former is already
  fully rewarded via the existing pipeline; the latter isn't yet computable —
  neither is a decision this phase revisits.
- **No retroactive backfill migration.** Unlike Phase 2's historical
  `daily_log` backfill in `18`, this needs none — a trophy that was already
  earned before this ships simply shows a Claim button the next time the
  Trophy Room is opened. This is an intended, one-time "welcome, here's what
  you already earned" moment, not a bug.
- **No spin-wheel flourish for trophy claims** — a flat coins/XP/freeze grant
  + `RewardBurst` is enough for a claim from a static list; the wheel's
  theatrics stay specific to the milestone-celebration moment `20` built.
- **Exact number tuning** — every amount lives in `lib/rewards.js`'s
  `TROPHY_REWARDS`, illustrative and adjustable without touching any other file.

### 2.7 Phase 2 Checklist — Before Marking Complete

- [x] Every eligible trophy tier (all groups except `streak`/`budget_keeper`)
      shows a **Claim** button once earned, with the correct reward amount
      (`claimAmountLabel` — coins first, then freezes, then XP as the
      guaranteed-nonzero fallback).
- [x] Tapping Claim credits coins/XP/freezes exactly once (idempotent by
      `ref: '<groupId>:<tier>'`, same `UNIQUE(user_id,source,ref)` shape as
      every other claim), shows the `RewardBurst`, and the row settles to
      "Earned" thereafter — driven by `notifyChanged()` re-triggering
      `useTrophies`' own version-subscribed refetch (no manual refetch call
      needed; caught and fixed a bug where I'd initially destructured a
      non-existent `refetch` off `useTrophies()`).
- [x] Streak Keeper and Budget Keeper rows are visually unaffected — neither
      has a `TROPHY_REWARDS` entry, so `t.reward` is `undefined` for both and
      the existing "Earned" branch is untouched.
- [x] Freeze-bearing claims (`comeback:1`, `logger:5000`, `planner:10`,
      `frugal:100`) respect `FREEZE_CAP` — `claimTrophy` reads the live
      balance and clamps before inserting, same as `claimMilestone`/`claimSpin`.
- [x] `RewardBurst`'s existing callers (`AddTransactionSheet`, `TodayCard`)
      grepped — both use object-literal calls without `freezes`, so they
      render identically to before this change.
- [x] `lib/trophies.js` is untouched — grepped for `rewards`/`TROPHY_REWARDS`,
      the only hit is the pre-existing comment stating its own cardinal rule.
- [x] A user with pre-existing history sees an immediately claimable reward
      the first time they open the updated Trophy Room — no backfill needed,
      by design (the Claim button is derived purely from `earned && !claimed`).

**Code-complete, Babel-verified via the project's own `@babel/core` +
`babel-preset-expo`; pending your on-device pass (Expo Go).**

**→ Stop here. Show the result — this closes out the feature's two planned
phases.**

### Phase 2 — Implementation Notes

Built: `lib/rewards.js` (+`TROPHY_REWARDS`), `lib/rewardsMutations.js`
(+`claimTrophy`), `components/RewardBurst.js` (+optional `freezes` param, a
third conditional entry in the overlay), `hooks/useTrophies.js` (+claimed-refs
query, `trophies` memo now annotates `reward`/`claimed` per tile),
`app/trophies.js` (+Claim button, +`claimAmountLabel` helper, +claim styles).
No schema change — `source: 'trophy'` is a new free-form value in the existing
`reward_events` table.

**Real bug caught before it shipped**: my first pass destructured `refetch`
off `useTrophies()` to call after a claim — that hook never actually exposes
one (only `trophies`/`earnedCount`/`totalCount`/`unseenCount`/`markAllSeen`/
`loading`). Would have crashed on the very first claim tap. Fixed by relying
solely on `notifyChanged()`, which already re-triggers the hook's own
version-subscribed refetch — the same pattern every other claim site in this
app already uses.

**What to check in Expo Go**: open the Trophy Room. Any trophy you've already
earned (Fresh Start is guaranteed for any account with a transaction) should
show a **Claim** button instead of "Earned." Tap it, confirm a `RewardBurst`
pops with the right coins/XP (and freeze icon, for Comeback/`logger:5000`/
`planner:10`/`frugal:100`), and confirm the row then shows "Earned" and stays
that way after leaving and reopening the screen. Confirm Streak Keeper and
Budget Keeper rows never show a Claim button.

---

## Data Model Summary (Final State After Both Phases)

```
  Phase 1 (read-only):
    MILESTONES + MILESTONE_REWARDS + MILESTONE_THEME_GRANTS + SPIN_WHEELS
        │  (all already exist — 18/20)
        ▼
    milestoneRoad(currentStreak)  [pure, lib/rewards.js]
        ▼
    app/streak.js — new "Milestone Road" section (no ledger writes)

  Phase 2 (new claims):
    Trophy earned (lib/trophies.js, pure, unchanged)
        │
        ▼
    TROPHY_REWARDS[trophyId] exists? ──no──► "Earned" (unchanged, e.g. streak/budget_keeper)
        │ yes
        ▼
    Claim tap → claimTrophy(trophyId)
        │
        ▼
    reward_events (source:'trophy', ref:'<groupId>:<tier>')  ─────►  v_reward_balances
    (append-only, same table as every other claim)                   coins / xp / freezes
```

No new table, no new view, no new column. `source: 'trophy'` is a new
free-form value in the existing `reward_events` ledger, same as `spin` was in
`20`.

### `reward_events` — new `source` value
| source | ref | coins | xp | freezes | Notes |
|---|---|---|---|---|---|
| `trophy` | `<groupId>:<tier>` (matches `lib/trophies.js`'s tile `id` exactly) | per `TROPHY_REWARDS` | per `TROPHY_REWARDS` | per `TROPHY_REWARDS`, `FREEZE_CAP`-clamped | idempotent forever, same shape as `milestone:<day>` |

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| `app/streak.js` | +Milestone Road section | Phase 1 |
| `lib/rewards.js` | +`milestoneRoad()`, +`TROPHY_REWARDS` | Both phases |
| `hooks/useTrophies.js` | +claimed-refs query, +reward/claimed annotation | Phase 2 |
| `app/trophies.js` | Row branch gains a Claim state | Phase 2 |
| `components/RewardBurst.js` | +optional `freezes` param | Phase 2 |
| `lib/rewardsMutations.js` | +`claimTrophy` | Phase 2 |
| `lib/trophies.js` | **Untouched** | Verify only — stays pure/behavioral |

---

## Out of Scope (Both Phases)

- **Streak Keeper / Budget Keeper trophy claims** — the former already fully
  rewarded via `18`/`20`'s pipeline; the latter blocked on an open schema
  question from `18` Phase 1. Neither is decided here.
- **Milestone Road visual polish** (path/line graphic, animated progress) —
  Phase 1 ships a plain row list deliberately; the pure data function is what
  must be solid, not the presentation.
- **Spin-wheel-style reveal for trophy claims** — flat grant + `RewardBurst`
  only.
- **Exact number tuning** — every amount lives in `lib/rewards.js`
  (`TROPHY_REWARDS`, `MILESTONE_REWARDS`); the fixed rule is "modest relative
  to streak milestones," not specific values.
- **Any backfill migration** — deliberately unnecessary; claims surface
  naturally the next time a screen is opened.
