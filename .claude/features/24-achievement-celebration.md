# Feature: Achievement Celebration Dialog
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/24-achievement-celebration.md`
**Status**: Planned
**Last Updated**: 2026-07-21

---

## Context

Today, earning a trophy (`21-achievement-rewards-and-milestone-road.md` Phase
2) is invisible until the user happens to open the Trophy Room and notices a
**Claim** button sitting in a tile. There's no moment-of-achievement feedback
— no different from just... noticing a stat changed. This feature adds that
moment: the instant a trophy becomes newly earned, a dialog announces it
app-wide ("New Achievement Unlocked!" + the trophy's badge + name), and the
user taps **Claim Now** to reveal the reward — same deliberate two-step
(announce → tap → reveal) as `app/shop.js`'s existing buy dialog
(`buyDialogStage`: `'confirm'` → `'bought'`), reusing its exact themed-reward
preview layout for the six trophies that grant a card theme.

The manual Claim button on the Trophy Room grid **stays** — explicitly, per
direct instruction ("its a psychological thing") — as the catch-up path for
a claim that was missed (dialog dismissed, or the app wasn't open when the
threshold was crossed). Tapping it opens the exact same dialog, starting at
the same first stage, not a shortcut around it.

This directly supersedes one line from `21`'s own Phase 2 doc ("No spin-wheel
flourish for trophy claims — a flat coins/XP/freeze grant + RewardBurst is
enough") — that was the right call for a plain list row; it isn't for the new
badge-grid Trophy Room this session already built, where trophies now look
and feel like real collectibles.

---

## Phase Overview

```
Phase 1 — The two-stage claim dialog, auto-triggered + manual fallback
  One dialog component, opened either automatically (a new trophy is
  detected as earned) or manually (the Trophy Room's existing Claim button).
  Stage 1 announces what was unlocked; tapping Claim Now performs the real
  claim and reveals the reward in the same dialog, with confetti.
```

Single phase — the auto-trigger and the manual fallback are the same dialog
by design, so building one without the other isn't a smaller version of this
feature, it's half of it.

**After the phase: stop and wait for approval.**

---

## Phase 1 — The Achievement Celebration Dialog

### Goal

The moment any trophy's underlying stat crosses its threshold — anywhere in
the app, not just on the Trophy Room screen — a centered dialog appears:
the trophy's badge, "New Achievement Unlocked!", its name, and a **Claim
Now** button. Tapping it calls the existing `claimTrophy` mutation and the
*same* dialog reveals what was won (coins/XP/freezes, or — for the six
premium trophies — the exact `CardThemeSurface` "you bought it" layout Shop
already uses) with confetti. If the user dismisses the dialog before tapping
Claim Now (or never saw it — app was closed, etc.), the trophy simply stays
earned-but-unclaimed: visiting the Trophy Room still shows its Claim button
(already built this session), which opens this identical dialog.

### Before Starting — Confirm With Codebase

- `hooks/useTrophies.js` — `trophies` (each tile: `id`, `label`, `icon`,
  `tone`, `earned`, `reward`, `claimed`), recomputed on every
  `useDataRefresh` version bump. `EMPTY_STATS`/`seenKey` pattern for the
  existing *separate* unseen-dot tracking — this feature adds its own,
  differently-scoped AsyncStorage key (see 1.2), not a reuse of `seen`.
- `lib/rewardsMutations.js` `claimTrophy(trophyId)` — idempotent upsert
  (`onConflict: 'user_id,source,ref', ignoreDuplicates: true`), returns
  `{ error, isNewClaim, coins, xp, freezes, themeId }`. This is the ONLY
  correctness guard against a double-pay; already exists, unchanged here.
- `components/RankUpCelebration.js` — the closest existing precedent: root-
  mounted, `Modal` + `Confetti` + `Animated.View` staggered entrance
  (`ZoomIn`/`FadeInDown`), `Button` component for the CTA. Copy this visual
  language, not `StreakCelebration`'s pinned-dark full-screen treatment
  (trophies are frequent enough — up to 24 — that a full-screen takeover
  every time would be fatiguing; a centered card dialog matches Shop's own
  "not a big deal, just confirm" register).
- `app/shop.js` lines ~416-465 (`buyDialogStage`) + styles ~869-940
  (`dialogOverlay`/`dialogCard`/`dialogPreviewShape`/`dialogPreviewContent`/
  `dialogBoughtBadge`/`dialogTitle`/`dialogBody`/`dialogPrimaryButton`/
  `dialogSecondaryButton`) — the exact layout to mirror for a themed reward.
  `getTheme(themeId)` from `lib/cardThemes.js` resolves the theme object.
- `app/trophies.js` (this session's rewrite) — the badge grid's Claim
  button (`t.earned && t.reward && !t.claimed`), currently calling
  `handleClaim` directly. This phase reroutes it to open the new dialog
  instead; `handleClaim`/the inline `showRewardBurst`/theme-unlock-toast
  logic is deleted, folded into the new dialog's own claim handler.
- `app/_layout.js` — the sheet-provider nest (`AddTransactionSheetProvider`
  … `AlertsSheetProvider`) vs. the bare `<Stack>`-sibling celebrations
  (`StreakCelebration`, `RankUpCelebration`). This feature needs BOTH shapes
  at once (self-triggering AND externally-openable from `app/trophies.js`)
  — see 1.3 for why it's structured as a Provider, not a bare sibling.

### 1.1 Database

**No database changes.** Reward granting already exists (`claimTrophy` →
`reward_events`). This phase adds exactly one new **local** (AsyncStorage)
key for a presentational guard — see 1.2 — deliberately not a DB column,
same reasoning `useTrophies.js`'s own `seenKey`/`StreakCelebration`'s
`storageKey` already established for "have we shown this UI moment yet"
state that isn't itself a correctness guarantee.

### 1.2 Data Layer

- **No new hooks.** The feature reads `useTrophies()` (`trophies`, already
  reactive to any mutation via `useDataRefresh`) and calls the existing
  `claimTrophy` mutation.
- **New AsyncStorage key**, `flo.trophies.announced.${userId}` (own key,
  not `useTrophies.js`'s `seenKey` — that one clears the Menu unseen-dot on
  *any* Trophy Room visit, which is a different event from "has the
  auto-popup fired for this specific trophy"; conflating them would let a
  curious visit to the Trophy Room silently suppress a real celebration
  that hasn't happened yet). Holds the set of trophy ids the auto-popup has
  already announced, ever — separate from `claimed` (a trophy can be
  announced but still unclaimed, if the user dismissed without tapping
  Claim Now).
- **Backlog guard, mirroring `RankUpCelebration`'s "first-ever check is a
  welcome, not a rank-up"**: if the `announced` key doesn't exist yet for
  this user (first time this feature has ever run for them), seed it with
  every currently-`earned && reward && !claimed` trophy id **silently** (no
  dialog, no confetti) rather than firing a burst of N stacked dialogs for
  an existing user's entire history the moment this ships. Those trophies
  remain claimable via the Trophy Room's manual Claim button exactly as
  today — only genuinely *new* earns from that point on trigger the
  automatic dialog.
- **Detection**: an effect (inside the new Provider, 1.3) watching
  `trophies` for any tile where `earned && reward && !claimed &&
  !announced.has(t.id)`, gathered into a small in-memory queue. Whenever
  no dialog is currently showing and the queue is non-empty, pop the front
  entry, mark it announced (`AsyncStorage` write, same "write before
  showing" discipline `RankUpCelebration` uses to avoid a replay race), and
  open the dialog at the `'unlocked'` stage. This naturally serializes
  multiple simultaneous new earns (rare, but possible if one transaction
  save crosses two thresholds at once) into one-at-a-time dialogs instead
  of stacked/overlapping modals.
- **Claiming**: identical to today — `claimTrophy(trophyId)` → on
  `isNewClaim`, `notifyChanged()`. The dialog's own state (not a
  `RewardBurst`/toast) becomes the sole reward-reveal UI for this path;
  `showRewardBurst`/the theme-unlock toast are removed from the trophy-claim
  path specifically (both stay wired for every other caller — daily log,
  milestones, spin wheel — untouched).

### 1.3 Components

- **`components/AchievementCelebration.js`** (new) — structured as a
  **Provider + Context**, same shape as every bottom-sheet in this app
  (`AddTransactionSheetProvider`/`useAddTransactionSheet()`), because unlike
  `RankUpCelebration`/`StreakCelebration` (purely self-triggering, no
  external caller), this dialog needs to be **both** self-triggering (the
  auto-detector, 1.2) **and** externally opened (`app/trophies.js`'s manual
  Claim button) — the sheet pattern is the existing precedent for "open
  this from anywhere via a hook", just applied to a centered `Modal`
  instead of a `BottomSheetModal`.
  - `AchievementCelebrationProvider` — mounts once in `app/_layout.js`
    (inside the same provider nest as the other sheet providers, so
    `app/trophies.js` can reach its context; NOT a bare `<Stack>` sibling
    like `RankUpCelebration`). Owns: the announced-set state, the
    detection effect (1.2), the dialog's `stage` (`'unlocked'` |
    `'claimed'`) + `current` trophy state, and renders the `Modal` itself.
  - `useAchievementCelebration()` → `{ openClaim(trophy) }` — the manual
    entry point. Always opens at `'unlocked'` (same as auto-trigger) — a
    manual open does NOT check/touch the `announced` set (that set only
    gates the *automatic* popup; manual access from the Trophy Room must
    always work regardless of whether this trophy was ever auto-announced).
  - **Dialog content, stage `'unlocked'`**: badge (same `IconTile`
    size≈88/`Icon` placeholder the Trophy Room grid already uses — tone-
    colored, since this only ever shows for an earned trophy), an eyebrow
    pill reading "ACHIEVEMENT UNLOCKED" (mirrors `RankUpCelebration`'s
    "RANK UP" eyebrow), the trophy's `label` as the title, and a primary
    **Claim Now** button. No reward shown yet, nothing granted yet.
  - **Stage `'claimed'`** (entered by tapping Claim Now → awaiting
    `claimTrophy` → success): `Confetti` fires (mounted only for this
    stage, mirroring `RankUpCelebration`'s placement). If `reward.themeId`
    is present, swap the badge for Shop's exact
    `dialogPreviewShape`/`dialogPreviewContent` `CardThemeSurface` hero
    preview (`getTheme(themeId)`) + `dialogBoughtBadge` check — otherwise
    keep the same badge tile from stage 1. Below it, a reward line joining
    every non-zero component (`+400 coins · +150 XP`, `+1 freeze · +150
    XP`, etc. — a small new formatter, not `claimAmountLabel` which only
    ever surfaces one headline amount for the grid's compact pill). A
    single dismiss button ("Nice", ghost — matches `StreakCelebration`'s
    reasoning: this is an acknowledge, not a decision).
  - If `claimTrophy` errors (network failure mid-tap): stay on
    `'unlocked'`, re-enable Claim Now, no silent failure.
- **`app/trophies.js`** — the grid's Claim button (`t.earned && t.reward &&
  !t.claimed`) now calls `openClaim(t)` from `useAchievementCelebration()`
  instead of the old inline `handleClaim`. `handleClaim`,
  `claimingId`/spinner state, and the `useRewardBurst`/`useToast` imports
  used only for that path are removed — the dialog owns all of that now.
  `claimAmountLabel` stays (still used for the button's own "Claim +400"
  label — unaffected by this phase).

### 1.4 Navigation / Integration

- **`app/_layout.js`** — add `AchievementCelebrationProvider` to the sheet-
  provider nest (alongside `AddTransactionSheetProvider` etc., inside
  `DataRefreshProvider`/`AccountProvider` but reachable by every route,
  same placement logic as every other sheet provider). It renders its own
  `Modal` internally — no separate `<Stack>`-sibling line needed the way
  `RankUpCelebration`/`StreakCelebration` are (those are bare components,
  this is a Provider that mounts its own UI).
- No new route. No new Menu entry. Purely an overlay + one call-site change
  in `app/trophies.js`.

### 1.5 Impact on Existing Features

| Existing | Impact | Watch for |
|---|---|---|
| `app/trophies.js` | Claim button now opens the new dialog instead of claiming inline | Verify the grid's Claim pill still shows/hides on the exact same `earned && reward && !claimed` condition — only *what happens on tap* changes |
| `hooks/useTrophies.js` | Unaffected — read-only consumer | `announced` state lives in the new Provider, not this hook |
| `RewardBurst`/toast (trophy path only) | No longer invoked for trophy claims | Confirm no other caller regressed — `claimMilestone`/`claimSpin`'s own `RewardBurst` calls are untouched |
| `app/shop.js` | Unaffected, just the visual pattern being mirrored | Don't refactor Shop's dialog into a shared component this phase — copy the shape, don't couple the two screens together |
| `app/_layout.js` | +1 provider in the nest | Confirm no provider-ordering issue (it needs `useAuth`/`useDataRefresh`, both already available higher in the stack) |

### 1.6 What This Phase Does NOT Include

- **No changes to `claimTrophy`/`claimMilestone`/`claimSpin` themselves** —
  the grant mechanism is untouched; this is purely a presentation layer on
  top of the existing trophy-claim path.
- **No celebration for Streak Keeper or Budget Keeper tiles** — neither has
  a `TROPHY_REWARDS` entry (streak already auto-pays via
  `StreakCelebration`; Budget Keeper isn't computable yet), so `reward` is
  always absent and this dialog never fires for them — unchanged from
  today.
- **No retroactive celebration for pre-existing backlog** — see 1.2's
  backlog guard; existing unclaimed trophies at ship time are silently
  marked announced, not celebrated.
- **No changes to Rank's celebration** (`RankUpCelebration` stays exactly
  as-is — ranks are a different mechanic, already has its own working
  celebration).
- **No illustrated trophy badge art** — same placeholder `IconTile`+`Icon`
  the grid already uses; swappable later the same way `RANK_BADGE_ART` was.

### 1.7 Phase 1 Checklist — Before Marking Complete

- [ ] Crossing a trophy threshold during a live session (e.g. logging the
      transaction that hits `logger:100`) shows the `'unlocked'` dialog
      automatically, without visiting the Trophy Room.
- [ ] Tapping **Claim Now** calls `claimTrophy` exactly once, transitions
      to `'claimed'` with `Confetti` firing, and shows the correct reward
      (themed trophies show Shop's exact card-preview layout; others show
      the joined coins/XP/freezes line).
- [ ] Dismissing at `'unlocked'` without tapping Claim Now leaves the
      trophy earned-but-unclaimed; the Trophy Room's Claim button still
      appears for it and opens the identical dialog.
- [ ] The manual Claim button path and the automatic path are visibly the
      *same* dialog/component, not two implementations.
- [ ] Two trophies becoming newly-earned at the same instant celebrate
      sequentially, never as stacked/overlapping modals.
- [ ] An existing user with pre-existing earned-unclaimed trophies at
      first run of this feature does NOT get a burst of celebration
      dialogs — those stay silently claimable via the Trophy Room only.
- [ ] A `claimTrophy` network error keeps the dialog on `'unlocked'` with
      Claim Now re-enabled, not a silent dead end.
- [ ] `RewardBurst`/theme-unlock toast no longer fire for a trophy claim
      (superseded by the dialog itself); confirmed unaffected for
      milestone/spin-wheel claims elsewhere.

**→ Stop here. Show the result and wait for approval.**

---

## Data Model Summary (Final State After All Phases)

No schema changes. New local-only state:
`AsyncStorage['flo.trophies.announced.${userId}']` — a JSON array of trophy
tile ids the auto-popup has already shown, ever. Everything else (reward
grants) continues through the existing `reward_events` table.

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| Trophy Room grid (this session's redesign) | Claim button's tap target changes, not its visibility condition | Phase 1 |
| `app/shop.js` | Read-only visual reference, unmodified | none |
| `RankUpCelebration`/`StreakCelebration` | Unmodified — separate mechanics, coexist as separate root-mounted celebrations | none |

---

## Out of Scope (All Phases)

- **Illustrated trophy badge art** — same placeholder icon tiles the grid
  uses today; a future pass once art exists (`assets/rank/BADGES.md`'s
  pattern extended to trophies).
- **Budget Keeper / Streak Keeper celebrations** — neither has a claimable
  reward defined; out of scope until `18`'s Budget Keeper computability gap
  is resolved.
- **Retroactive celebration replay** — no way to re-trigger the dialog for
  an already-announced-and-since-claimed trophy; it's a one-time moment.
