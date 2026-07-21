# Feature: Rewards Hub Sheet
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/25-rewards-hub-sheet.md`
**Status**: Planned
**Last Updated**: 2026-07-21

---

## Context

Coins, freezes, XP/level, and rank are four related numbers, but today
they're scattered: coins+freezes live in Home's header chip (tapping it opens
`RewardsHistorySheet` — a coin ledger + a freeze-buy card), while level/rank
live in a separate card at the top of the Menu sheet. There's also no
"buy coins" entry point anywhere outside the Shop itself, and no way to see
how XP, Level, and Rank actually relate — which surfaced directly this
session: Level and Rank are two *independent* XP-derived systems (Level is a
smooth curve, Rank is a fixed 9-tier ladder), so "reach level 2" does **not**
mean "next rank" the way a user would reasonably assume.

This feature consolidates all four into the one sheet already opened from
Home's header chip (`RewardsHistorySheet`, kept as-is — "tweak it", not
replace it), and removes the now-duplicate level card from the Menu sheet.

---

## Phase Overview

```
Phase 1 — The Rewards hub
  Expand RewardsHistorySheet with a Coins section (ledger + "what coins buy"
  + a Buy button to Shop's General tab), a Freeze section (existing buy card
  + a one-line explainer), and a new XP/Level/Rank section (the progress bar
  moved from Menu + a computed rank ladder showing which level each rank
  starts at). Menu's level card is removed.
```

Single phase — splitting this would leave an awkward half-state (e.g. a
Buy-coins button before Menu's now-duplicate card is removed).

**After the phase: stop and wait for approval.**

---

## Phase 1 — The Rewards Hub ✅ Complete

### Goal

Tapping Home's coins/freeze/level header chip (already wired to
`openRewardsHistory()`) opens one sheet that answers everything about the
reward economy: what you have (coins, freezes, XP/level/rank), what each
is for for, and where to get more. The Menu sheet's level card is retired —
its content lives here now.

### Before Starting — Confirm With Codebase

- `components/RewardsHistorySheet.js` — current shape: header (coin count),
  a `shopCard` (freeze buy, `buyFreeze` mutation, `FREEZE_COST`/`FREEZE_CAP`),
  then a `BottomSheetFlatList` ledger of `reward_events`. All of this stays;
  new sections are added around it.
- `components/MenuSheet.js` — the `levelCard` Pressable (rank badge via
  `RANK_BADGE_ART[rank.id]`, `{rank.title} · Level {level}`, `{xp}/
  {nextLevelAt} XP`, `ProgressBar dark`) — delete this block and its now-
  unused styles (`levelCard`, `levelIconTile`, `levelBadgeArt`,
  `levelContent`, `levelTopRow`, `levelLabel`, `levelXp`) and the
  `rankFromXp`/`RANK_BADGE_ART`/`ProgressBar`/`level`/`nextLevelAt`/
  `levelProgress` bindings that become unused. `isPro`'s Upgrade card becomes
  the sole content of `topSection`.
- `hooks/useRewards.js` — already returns everything needed:
  `{ coins, xp, freezes, level, xpIntoLevel, xpForNext, nextLevelAt,
  progress }`.
- `lib/rewards.js` — `RANKS`, `RANK_BADGE_ART`, `RANK_BADGE_ART_LOCKED`,
  `levelFromXp`, `rankFromXp`. The rank ladder's "starts at level N" column
  is `levelFromXp(rank.minXp).level` for each of the 9 `RANKS` entries —
  computed at render time, nothing stored.
- `app/shop.js` — `TABS` (`cards`/`general`), `tab` state defaults to
  `'cards'` with **no route-param support today**. Needs a small addition:
  read an initial tab from `useLocalSearchParams()` (same hook already used
  by `app/budget/[id].js`/`app/plan/[id]/index.js`/`app/report.js`), falling
  back to `'cards'` when absent.
- `lib/cardThemes.js` — `TIER_LABELS` (`common`/`rare`/`epic`/`legendary`/
  etc.) for the "what coins buy" one-liner — no need to enumerate every
  theme, just name the tier ladder.

### 1.1 Database

**No database changes.** Every value already exists via `useRewards()`/
`reward_events`/`lib/rewards.js`'s pure functions.

### 1.2 Data Layer

- **No new hooks.** `RewardsHistorySheet` already calls `useRewards()`; add
  `xp, level, nextLevelAt, progress: levelProgress` to its existing
  destructure (it currently only pulls `coins, freezes`).
- **Rank ladder data**: computed inline in the sheet, not a new hook —
  `RANKS.map(r => ({ ...r, atLevel: levelFromXp(r.minXp).level }))`, memoized
  since `RANKS` is a static import (cheap, but avoids recomputing 9 pure-
  function calls every render).
- **Shop tab deep link**: `router.push('/shop?tab=general')` from the new
  coin Buy button. `app/shop.js` reads
  `const { tab: initialTab } = useLocalSearchParams();` and seeds
  `useState(initialTab === 'general' ? 'general' : 'cards')`.

### 1.3 Components

- **`components/RewardsHistorySheet.js`** — restructured top-to-bottom
  (still one file, same Provider/Context/`forwardRef` export shape, same
  `useRewardsHistorySheet().openRewardsHistory()` call sites untouched):
  1. Header — unchanged shape, but now just "Rewards" as the title (coins
     move into their own section below) rather than the coin count.
  2. **Coins section** — the existing coin count + the existing ledger
     `BottomSheetFlatList` stay, but gain: a short line ("Coins buy card
     themes in the Shop — Common through Legendary") and a **Buy** button
     (brand-colored pill, matching the existing freeze `buyButton` style)
     that dismisses the sheet and `router.push('/shop?tab=general')`.
  3. **Freeze section** — the existing `shopCard` (buy-freeze) block, moved
     under a "Streak Freeze" sub-heading with a one-line explainer
     ("Protects your streak on a day you miss") above it. Mutation/logic
     (`buyFreeze`, `FREEZE_COST`/`FREEZE_CAP`, the `Alert.alert` confirm)
     unchanged.
  4. **XP / Level / Rank section** (new) — the exact progress-bar block
     removed from `MenuSheet` (rank badge, `{rank.title} · Level {level}`,
     `{xp}/{nextLevelAt} XP`, `ProgressBar dark`), followed by a compact
     **rank ladder**: all 9 `RANKS`, each row showing its `RANK_BADGE_ART`/
     `RANK_BADGE_ART_LOCKED` badge (small, ~32px — reached vs not, same
     color/grayscale rule as the Trophy Room), the rank title, and
     **"Level {atLevel}"** — directly visualizing that ranks span many
     levels unevenly. Current rank row highlighted (background tint, same
     idea as Trophy Room's "Current" treatment minus the removed text
     label — a subtle highlight is enough here).
  5. The ledger list stays last (existing behavior, unchanged).
- **`app/shop.js`** — one small addition: `useLocalSearchParams()` seeds the
  initial `tab` state (see 1.2). No other Shop change.
- **`components/MenuSheet.js`** — `levelCard` block and its dead code
  removed (see "Before Starting" above). `handleOpenRewards` also becomes
  unused (it existed solely for the level card's `onPress`) — removed
  along with it, unless nothing else calls it (verify before deleting).

### 1.4 Navigation / Integration

- No new route, no new Menu entry. Home's header chip (`openRewardsHistory`)
  is unchanged as the trigger — it already opens this sheet.
- New internal navigation: the sheet's coin Buy button dismisses itself and
  pushes `/shop?tab=general`.

### 1.5 Impact on Existing Features

| Existing | Impact | Watch for |
|---|---|---|
| `MenuSheet.js` | Level card removed; Upgrade-to-Pro becomes `topSection`'s only content | Verify `handleOpenRewards` has no other caller before deleting it |
| `app/shop.js` | Gains route-param-driven initial tab | Default (`'cards'`) must stay unchanged for every OTHER existing entry point into Shop (Trophy Room theme grants, etc. don't pass a tab param and shouldn't need to) |
| `RewardsHistorySheet.js` | Same component/hook, much more content | `snapPoints` (currently `'70%'`) may need revisiting once the new sections are in — check on-device, adjust if content overflows/clips |
| Home header chip | Unchanged trigger | None — same `openRewardsHistory()` call |

### 1.6 What This Phase Does NOT Include

- **No changes to how coins/freezes/XP are earned or spent** — this is
  presentation only, on top of existing mutations.
- **No full card-theme browser inside the sheet** — "what coins buy" is one
  explanatory line + a Buy button to the real Shop, not a duplicate of
  Shop's own grid.
- **No re-tuning of the Level curve or Rank thresholds** — the ladder here
  *visualizes* the existing mismatch, it doesn't fix it (that's a separate,
  explicitly deferred decision from this session's earlier discussion).
- **No coin-pack purchase changes** — Buy still lands on Shop's existing
  (stubbed) General tab; this phase only adds the deep link.

### 1.7 Phase 1 Checklist — Before Marking Complete

- [x] Tapping Home's header chip opens the sheet showing Coins, Freeze, and
      XP/Level/Rank sections, in that order, above the existing ledger.
- [x] Coins section shows the current balance, a one-line "what coins buy"
      note, and a Buy button that opens Shop directly on its General tab.
- [x] Freeze section is functionally identical to today (buy flow, cap/
      afford disabling) with an added one-line explainer.
- [x] XP/Level/Rank section shows the same progress bar/rank badge Menu
      used to, plus a 9-row rank ladder where each row's level number is
      computed via `levelFromXp`, not hardcoded.
- [x] The user's current rank is visually distinguished in the ladder.
- [x] Menu sheet no longer shows a level card; Upgrade to Pro (when not Pro)
      is the only `topSection` content.
- [x] No dead code left behind in `MenuSheet.js` (unused imports/styles/
      `handleOpenRewards` — confirmed no other caller before removing it).
- [x] `app/shop.js`'s default entry (no `tab` param) still opens on Cards,
      unchanged for every existing caller.

### Implementation Notes

- **Snap point bumped 70%→92%** (not just "may need revisiting" — it did):
  the sheet went from one short pinned header + a list to three full
  sections + a 9-row ladder above the ledger, so it needed materially more
  room to avoid clipping.
- **Restructured to `ListHeaderComponent`, not fixed-above-the-list content**
  — the old layout (header/shopCard fixed above a conditionally-rendered
  `BottomSheetFlatList`) would have either crowded the ledger down to a
  sliver or, worse, hidden the new Coins/Freeze/Rank sections entirely for a
  brand-new user with zero `reward_events` rows (the old code branched to an
  empty-state view *instead of* the list when `events.length === 0`, and the
  extra sections would have needed to live inside that same list to scroll
  correctly). Fixed by making the `BottomSheetFlatList` always render
  (`data={loading ? [] : events}`), with the new sections as
  `ListHeaderComponent` (always shows) and `ListEmptyComponent` handling the
  loading/empty states — only the short title+close row stays truly pinned.
- **Freeze card's title changed from "Streak Freeze" to "{freezes} held"** —
  the sub-heading text above it already says "Streak Freeze" now that it's a
  named section, so the card itself shows the actual count instead of
  repeating the same label twice.
- **`handleOpenRewards` confirmed single-caller** before deletion (grepped
  `components/MenuSheet.js` for `openRewardsHistory`/`useRewardsHistorySheet`
  — only the removed level card referenced either).

**→ Stop here. Show the result and wait for approval.**

---

## Data Model Summary (Final State After All Phases)

No schema changes. Purely a client-side reorganization of values already
exposed by `useRewards()` and the pure functions in `lib/rewards.js`.

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| Menu sheet | Loses its level card | Phase 1 |
| `RewardsHistorySheet` | Gains Coins/Freeze explainers + XP/Level/Rank section | Phase 1 |
| Shop | Gains an optional initial-tab route param | Phase 1 |

---

## Out of Scope (All Phases)

- **Re-tuning Level/Rank to align** — a separate product decision, not this
  feature.
- **In-sheet card theme browsing** — stays exclusive to the Shop.
- **Real coin-pack purchases** — still stubbed, unaffected by this feature.
