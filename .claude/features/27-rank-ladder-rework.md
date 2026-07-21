# Feature: Rank Ladder Rework (curve, names, rewards)
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/27-rank-ladder-rework.md`
**Status**: 🚧 **Both phases built** (2026-07-22) — assertion- and Babel-verified
against live module exports (14 checks in Phase 1, 46 in Phase 2, all passing).
**No DB changes in either phase.** On-device confirmation pending: everything
needing a real rank-up, a real milestone claim, or real elapsed time is
deliberately left unticked in both checklists.
**Last Updated**: 2026-07-22

> **On-device testing, seeded account state, the SQL to drive it, and the open
> findings raised while testing all live in
> `FINDINGS-rank-ladder-rollout.md`** — including three unfixed issues
> (day-1 spin, the uncelebrated Saver rank, and a reward-text display gap) that
> span this feature, `18` and `20`. Read it before picking this back up.

---

## Context

`18-gamification-ritual-and-ledger.md` Phase 5 built Rank as the **permanent
progression layer** — the thing a broken streak can never zero. It shipped with
nine ranks, illustrated badge art for all nine, bespoke `RANK_FLAVOR` copy, and
a working `RankUpCelebration`. What it never got was a reward, and — found
while investigating that — a reachable curve.

**Finding 1 — the top third of the ladder is unreachable.** XP comes from
exactly three places: `REWARDS.dailyLog` (100), `REWARDS.noSpend` (40), and
one-time trophies (~6,030 lifetime; ~8,680 once `26` lands).
`MILESTONE_REWARDS` and `SPIN_WHEELS` grant `{ coins, freezes }` and **no XP at
all** — `claimMilestone` doesn't even write an `xp` field. So a perfect daily
logger earns ~100 XP/day ≈ 36,500/year, and that is the ceiling:

| Rank | XP | Perfect daily logging |
|---|---|---|
| Financier | 50,000 | ~1.4 years |
| Tycoon | 90,000 | ~2.5 years |
| Magnate | 150,000 | ~4.1 years |
| Money Master | 250,000 | **~6.8 years** |

For scale, the app's most extreme streak milestone (day 1000) is 2.7 years. The
last three ranks sit beyond anything FLO otherwise asks of anyone.

**Finding 2 — XP has no burst source, so rank measures attendance, not skill.**
Every other currency has bursts (day 1000 drops 12,000 coins at once). XP is
flat. Two users — one logging a single transaction a day, one running budgets,
plans and full categorisation — reach every rank on **the same day**. A rank
ladder that can't tell them apart isn't measuring mastery.

**Finding 2b — the no-spend penalty.** `noSpend` earns 40 XP against
`dailyLog`'s 100, so the frugal behaviour the app explicitly wants advances
rank **2.5× slower**. Backwards.

**Finding 3 — the names are job titles and wealth fantasies.** Bookkeeper is a
dreary desk job; Treasurer does the club accounts; Tycoon and Magnate imply
capital most FLO users don't have and aren't chasing. The app's own onboarding
is about leaks and habits, its target market is India, and its live test data
includes a ₹350 monthly budget — telling that user they're a "Magnate" is
faintly absurd. The arc also jumps between four unrelated metaphor families
(behaviour → job → character → wealth).

This feature fixes all four: **retune the curve, add XP bursts, rename the
ladder around mastery rather than wealth, and finally give ranks a reward** —
in cosmetics and capability, deliberately **not** in coins.

### The one thing this feature will NOT do

**Ranks will not pay coins.** Two reasons, both from the codebase's own rules:

1. **It's a double-pay.** `TROPHY_REWARDS`' comment excludes Streak Keeper
   because a second claim path "would double-pay the same milestone." Rank is
   *entirely derived* from XP, which is entirely derived from actions that
   already paid. A coin payout at a rank boundary is a third payment for one
   behaviour.
2. **It inflates a deliberately scarce currency.** `lib/rewards.js` invariant 4
   is "coins stay scarce against shop sinks"; `FREEZE_COST` was raised
   500→3,000 specifically so no affordable coin pack buys a freeze
   (`22-coin-store-and-reward-tiering.md`); coin packs are now real-money
   purchasable. A new faucet undercuts the store that was just built.

Ranks reward **identity and capability** instead — a card theme you wear, and a
freeze cap that grows. Recorded here so it isn't re-proposed.

---

## Phase Overview

```
Phase 1 — Curve, bursts, and names
  Milestones start granting XP; no-spend's XP penalty is narrowed; the nine
  thresholds are retuned against the new earn rate; all nine ranks are
  renamed (titles only — ids and badge art untouched) with rewritten flavor.

Phase 2 — Rank rewards
  A new `rank` card-theme tier granted at three ranks, and a freeze cap that
  scales with rank instead of a flat constant.
```

**After each phase: stop and wait for approval before proceeding.**

Phase 1 is bundled deliberately rather than split three ways: the retune is
meaningless without the bursts (the thresholds are being set *against* the new
earn rate), the renames are pure data in the same file, and this project's
Android build cycle is ~1 hour — three separate builds to verify three data
edits to one file is a poor trade.

---

## Phase 1 — Curve, Bursts, and Names ✅ Complete

### Goal

Rank progression starts reflecting *what a user achieves*, not just how many
days they've had the app installed, and the whole ladder becomes reachable
inside ~3 years of committed use instead of ~7. Every rank gets a name a user
would actually want to be called. No user can be demoted by the retune.

### Before Starting — Confirm With Codebase

- `lib/rewards.js` — `REWARDS`, `MILESTONE_REWARDS`, `RANKS`, `RANK_FLAVOR`,
  `RANK_BADGE_ART`, `RANK_BADGE_ART_LOCKED`, `rankFromXp`, `levelFromXp`. Note
  the file's four stated invariants at the top; Phase 1 must not break any.
- `lib/rewardsMutations.js` `claimMilestone` (~line 168) — currently upserts
  `{ source, ref, coins, freezes }` with **no `xp` key**. Confirm that before
  assuming milestones grant zero XP; it's the crux of Finding 1.
- `components/RankUpCelebration.js` (~lines 48–87) — the rank-up detector.
  **Rank state persists in `profiles.highest_rank_seen`, a DB column, not
  AsyncStorage.** It resolves `lastSeenId` → `RANKS.findIndex(...)` and
  celebrates only when `newIndex > lastIndex`. This is what forces the
  ids-stay-stable rule in 1.2.
- `app/trophies.js` (~line 207) and `components/RewardsHistorySheet.js`
  (~line 81) — both render the full `RANKS` ladder, the latter computing
  `atLevel: levelFromXp(r.minXp).level` per rank. Both pick up new titles and
  thresholds automatically; verify no rank name is hardcoded anywhere.
- `hooks/useRewards.js` — how `xp` is summed from `v_reward_balances`.

### 1.1 Database

**No database changes.** `profiles.highest_rank_seen` already exists; XP already
sums from `reward_events.xp`, a column milestones simply never populated. Every
edit in this phase is to `lib/rewards.js` data plus one line in
`lib/rewardsMutations.js`.

### 1.2 Data Layer

**A. Milestones grant XP.**

`MILESTONE_REWARDS` entries gain an `xp` field, and `claimMilestone` writes it
(`xp: reward.xp ?? 0`, alongside the existing `coins`/`freezes`). Proposed
values, scaled so a milestone is worth roughly the streak it represents:

| Day | 3 | 7 | 10 | 30 | 50 | 100 | 150 | 200 | 300 | 365 | 500 | 1000 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| XP | 150 | 300 | 400 | 900 | 1,200 | 2,500 | 3,000 | 3,500 | 4,500 | 5,500 | 7,000 | 12,000 |

Full-ladder total: **~41,000 XP**, i.e. a committed streak-keeper roughly
doubles a bare logger's rank pace. That is the entire point of the change.

**Spin wheels deliberately stay coins/freezes-only.** They fire on the same days
as the milestones above, so adding XP there would double the burst on exactly
the days that already burst hardest — and it would mean touching every segment
of every wheel and re-checking the "no blank slice" invariant. One burst source,
one place to tune it.

**B. The no-spend penalty is narrowed.**

`REWARDS.noSpend.xp` 40 → **70**. This keeps invariant 1 intact — *"a logged day
out-earns every other state, in both coins and XP"* — since 100 > 70, while
cutting the frugality penalty from 2.5× to 1.4×. `noSpend.coins` stays **0**;
invariant 2 (never pay coins for not tracking) is untouched.

**C. The nine thresholds are retuned.**

Paced against the new earn rate. A committed user (~300 logged days/year, most
milestones, most trophies) now earns roughly 54,000 in year 1, ~39,000 in year
2, ~44,000 in year 3 (day-1000 lands there) — so the peak should sit near
135,000 for a ~3-year climb, ending just past the day-1000 streak rather than
2.5× beyond it.

| # | id (unchanged) | Old minXp | **New minXp** | New pace |
|---|---|---|---|---|
| 1 | `saver` | 0 | **0** | — |
| 2 | `bookkeeper` | 1,500 | **400** | ~4 days |
| 3 | `steward` | 5,000 | **1,500** | ~2 weeks |
| 4 | `strategist` | 12,000 | **4,000** | ~1 month |
| 5 | `treasurer` | 25,000 | **10,000** | ~2.5 months |
| 6 | `financier` | 50,000 | **22,000** | ~5 months |
| 7 | `tycoon` | 90,000 | **45,000** | ~10 months |
| 8 | `magnate` | 150,000 | **80,000** | ~1.6 years |
| 9 | `money_master` | 250,000 | **135,000** | ~2.8 years |

Rank 2 deliberately lands **inside the first week** — the highest-churn window
of a new user's life, the same reasoning that front-loaded the spin wheels to
days 1/3/7/10 in `20-milestone-spin-wheel.md` Phase 2.

**The no-demotion invariant**: every new threshold is **strictly lower** than
the old one it replaces. That is not a coincidence to preserve casually — it is
what guarantees no existing user loses a rank they already hold, and that
`RankUpCelebration`'s `newIndex <= lastIndex` guard never has to fire. **Any
future retune must keep every threshold at or below its current value**, or it
must ship with a migration strategy for demoted users. There isn't one.

**Ranks are kept at nine, not reduced.** Illustrated badge art exists for
exactly nine ids, earned *and* locked variants (18 assets, commit `9d01dbb`).
Reducing the ladder throws away finished art and leaves orphan files; the
reachability problem is entirely a threshold problem, and thresholds are free
to change.

**D. Ids never change — only titles.**

`RANKS[].id` is persisted in `profiles.highest_rank_seen` and is the key for
both `RANK_BADGE_ART` maps and their `assets/rank/<id>.png` filenames. Renaming
an id would orphan every stored value (`findIndex` → `-1`, which reads as
"lower than everything" and fires a **spurious celebration**, not a crash — a
silent wrong, the worst kind) and would require renaming 18 asset files.
**Change `title` only.** The resulting id/title drift (id `tycoon` titled
"Vanguard") is deliberate, and this table is the record of it.

### 1.3 The New Names

The criterion is the user's own: *the name itself should make you want to reach
it.* Three rules fall out of that, and out of FLO's terse, un-hyped voice
(`RANK_FLAVOR`, `lib/koban.js`):

1. **Mastery, not wealth.** A name must be earnable by someone tracking a ₹350
   budget. Tycoon and Magnate fail this outright.
2. **Identity, not occupation.** You'd say "I'm a Strategist" with some pride;
   nobody says "I'm a Bookkeeper" that way.
3. **One coherent arc** — noticing → keeping → tending → charting → planning →
   designing → leading → mastering → self-rule.

| # | id | Old title | **New title** | Alternate | The idea |
|---|---|---|---|---|---|
| 1 | `saver` | Saver | **Saver** | — | Keep. The first honest behaviour: you held something back |
| 2 | `bookkeeper` | Bookkeeper | **Keeper** | Recorder | You keep the record — and you keep to it |
| 3 | `steward` | Steward | **Steward** | Custodian | Keep. Tending something because it's worth tending |
| 4 | `strategist` | Strategist | **Navigator** | Pathfinder | You can chart a course now, not just read the map |
| 5 | `treasurer` | Treasurer | **Strategist** | Tactician | Moved up — the best word in the old set, now earned properly |
| 6 | `financier` | Financier | **Architect** | Designer | You design the system your money runs on |
| 7 | `tycoon` | Tycoon | **Vanguard** | Pathfinder | Ahead of your money instead of chasing it |
| 8 | `magnate` | Magnate | **Master** | Bastion | Plain, unambiguous, universally understood |
| 9 | `money_master` | Money Master | **Sovereign** | Freeholder | Self-rule — nothing outside decides how your money moves. (A sovereign is also a coin.) |

**`RANK_FLAVOR` is rewritten for all nine**, since six titles change and the
existing lines reference the old words ("Saver was instinct. This is
discipline"). Same voice as today: terse, no exclamation marks, no shame, each
line continuing the maturity story `assets/rank/BADGES.md` set up for the art.
The `saver` line stays included-but-never-shown (the first rank is recorded
silently, not celebrated).

**Badge art is not re-commissioned.** The illustrations are abstract
medals/emblems, not literal depictions of a bookkeeper or a tycoon — they carry
over unchanged. Worth an eyeball pass at review time regardless; if any single
badge reads as tied to its old name, that's a one-asset swap, not a blocker.

### 1.4 Navigation / Integration

None. No new route, screen, sheet, or menu entry. Every existing rank surface
(Home's header badge, the Trophy Room ladder, `RewardsHistorySheet`'s rank
section, `RankUpCelebration`) reads `RANKS`/`RANK_FLAVOR`/`rankFromXp` and picks
all of this up with no change.

### 1.5 Impact on Existing Features

| Existing | Impact | Watch for |
|---|---|---|
| `RankUpCelebration.js` | Lowered thresholds may promote an existing user immediately on first launch | It celebrates only the **final** rank reached, silently skipping intermediates — correct, but confirm it's one dialog, not a queue |
| `app/trophies.js` rank ladder | New titles + thresholds | Nine rows still, art still keyed by id — purely textual change |
| `RewardsHistorySheet.js` | Recomputes `atLevel` from new `minXp` | The "which level each rank starts at" column shifts down; that's the intended outcome, not a bug |
| Home header badge | New title for the current rank | — |
| `claimMilestone` | Now writes `xp` | Verify a re-claim still no-ops (`ignoreDuplicates`) and doesn't double-grant XP |
| Already-claimed milestones | **Do not retroactively grant XP** | A user who already claimed day 30 got 0 XP for it and stays that way — the ledger is append-only. Accepted (see 1.6) |
| `v_reward_balances` | Sums a column milestones now populate | No schema change; confirm XP totals move after a milestone claim |

### 1.6 What This Phase Does NOT Include

- **No rank rewards.** Reaching a rank still pays nothing until Phase 2.
- **No retroactive XP for milestones already claimed.** `reward_events` is
  append-only and `claimMilestone` is idempotent on `milestone:<day>`, so a
  previously-claimed day cannot be topped up without inventing a second row
  type. Accepted deliberately: the affected population is the author's own test
  accounts, and the lowered thresholds more than compensate.
- **No XP from spin wheels** — see 1.2A.
- **No change to `levelFromXp`** or the Money Level curve. Level and Rank are
  separate ladders; this phase touches only Rank's thresholds.
- **No new badge art.**
- **No reduction or addition of ranks** — nine stays nine (1.2C).

### 1.7 Phase 1 Checklist — Before Marking Complete

Curve & bursts:

- [x] `claimMilestone` writes a non-zero `xp` for a milestone day, visible as an
      XP increase in `useRewards()` and in `RewardsHistorySheet`'s ledger.
      *(Code-verified: the upsert now carries `xp: reward.xp ?? 0`. The
      user-visible half needs a real milestone on-device.)*
- [ ] Claiming the same milestone twice grants XP **once** (the existing
      `ignoreDuplicates` guard still holds now that a new field is written).
      **On-device only** — needs a real claim + replay.
- [x] `REWARDS.noSpend.xp` is 70 and `dailyLog.xp` is still strictly greater
      (invariant 1); `noSpend.coins` is still 0 (invariant 2). *Asserted.*

Thresholds & safety:

- [x] Every one of the nine new `minXp` values is **≤** the value it replaced —
      checked one by one, not assumed. *Asserted against a hardcoded table of
      the old values; all 9 strictly lower except `saver` (0 → 0).*
- [ ] An account whose XP already exceeds several new thresholds is promoted and
      sees exactly **one** celebration (the highest rank reached), not a stack.
      **On-device only.**
- [ ] `profiles.highest_rank_seen` still holds a valid id afterwards, and
      re-opening the app does not re-fire the celebration. **On-device only.**

Naming:

- [x] All nine `RANKS[].id` values are byte-identical to before. *Asserted.*
- [x] `RANK_BADGE_ART` / `RANK_BADGE_ART_LOCKED` are untouched and every badge
      still resolves. *Both maps asserted to cover all 9 ids, with the
      corresponding `assets/rank/<id>.png` and `<id>-locked.png` confirmed
      present on disk.*
- [x] `RANK_FLAVOR` has an entry for all nine ids and no line references a
      retired title. *Asserted, including no orphan keys.*
- [x] Grep confirms no rank title is hardcoded anywhere outside
      `lib/rewards.js`. *Only hits are explanatory comments in that file.*

**→ Stop here. Show the result and wait for approval.**

### Implementation Notes (built 2026-07-22)

**Files changed** — four, no new files, no DB change:

| File | Change |
|---|---|
| `lib/rewards.js` | `REWARDS.noSpend.xp` 40→70; `xp` added to all 12 `MILESTONE_REWARDS` tiers; `RANKS` retuned + 6 titles renamed; `RANK_FLAVOR` rewritten; `milestoneRoad()` now returns `xp` |
| `lib/rewardsMutations.js` | `claimMilestone`'s upsert carries `xp: reward.xp ?? 0` (one line) |
| `app/streak.js` | `roadRewardText()` includes XP — **deviation, see below** |
| `components/StreakCelebration.js` | Milestone reward block shows XP — **deviation, see below** |

**Deviation — two display surfaces were updated beyond the written scope.**
The doc scoped Phase 1 as data plus one mutation line. While building, both
surfaces that advertise a milestone's reward were found to read
`{coins, freezes}` only:
`app/streak.js`'s `roadRewardText()` (the milestone road subtitle) and
`StreakCelebration`'s "You received" block. Leaving them would have made the
app **under-report** the largest component of what a milestone now grants —
introduced by this phase, so treated as a correctness consequence of the change
rather than a nice-to-have. Both now show XP, using `RewardBurst`'s existing
convention (`Star`, `colors.brand`, filled, in coins → XP → freezes order) so
the same reward reads identically wherever it appears. `milestoneRoad()` gained
an `xp` field to feed the first of these.

**Not changed, deliberately**: the spin wheels (`SPIN_WHEELS` segments) still
grant no XP, per 1.2A.

**Verification** — a throwaway script transpiled `lib/rewards.js` through the
project's own `@babel/core` + `babel-preset-expo` and asserted against the
**live exports**, not source text (grep was tried first and gave a false
negative on `RANK_FLAVOR` coverage — a bad regex, which is exactly why the
assertions were moved onto real objects). PNG `require`s were stubbed at the
Node loader level, since Metro normally resolves those. 14 assertions, all
passing, covering: flavor coverage + no orphans + no retired-title references,
both badge-art maps, invariants 1 and 2, milestone XP positive and
monotonic-by-day, `milestoneRoad` parity with `MILESTONE_REWARDS`, the
no-demotion table, first-week reachability of rank 2, and `rankFromXp`
resolving correctly at **every** rank boundary and one XP below it. All four
edited files then Babel-parsed clean.

**Measured outcome** (the numbers the phase exists to move), at 300 logged
days/year:

| | Before | After |
|---|---|---|
| Peak rank | 250,000 XP · **8.3 yrs** | 135,000 XP · **4.5 yrs** |
| Peak with full milestone ladder | — (milestones gave 0 XP) | **3.1 yrs** |
| Rank 2 | 1,500 XP · ~15 days | 400 XP · **4 days** |

Full-ladder milestone XP total: **40,950**. The 3.1-year figure counts daily
logging plus milestones only — trophies (~6,030, rising to ~8,680 once `26`
lands) and no-spend days are on top, so a committed user lands nearer the
~2.8 years the doc estimated.

**Still unverified — everything requiring a real device or real elapsed time**:
the milestone XP actually landing in `reward_events`, replay-idempotency of a
claim now that a new column is written, and the promotion/celebration behaviour
for an account whose XP already clears several lowered thresholds. Those four
checklist items are deliberately left unticked.

---

## Phase 2 — Rank Rewards ✅ Complete

### Goal

Reaching a rank finally gives something: a card theme you wear on the Home hero
card at three of the nine ranks, and a streak-freeze cap that grows as you
climb. Neither is a coin payout, and neither can be bought.

### Before Starting — Confirm Phase 1 is Approved

Also confirm, by reading:

- `lib/cardThemes.js` — `TIERS`, `LOCKED_TIERS`
  (`['legendary','milestone','achievement']`), `TIER_LABELS`, and the shape of a
  `THEMES_RAW` entry. A `rank` tier slots into `LOCKED_TIERS` alongside the
  other three.
- `hooks/useCardThemes.js` — ownership is the union of `reward_events` rows with
  `source in ('theme_buy','theme_grant')`, keyed by the theme id in `ref`. A
  rank grant writes a `theme_grant` row and needs **no** change here.
- `app/shop.js` — how a locked tier renders (unbuyable, with its unlock
  condition shown). New rank themes must read as *earnable*, not for sale.
- `lib/rewards.js` `FREEZE_CAP` (5) and `lib/rewardsMutations.js`
  `clampFreezeGrant` / `buyFreeze` — the two places the cap is enforced.
  `clampFreezeGrant` converts overflow to `FREEZE_OVERFLOW_COINS`; `buyFreeze`
  hard-blocks at the cap.

### 2.1 Database

**No database changes.** Theme grants reuse the existing `theme_grant` source;
the freeze cap is derived from XP and stores nothing.

### 2.2 Data Layer

**A. Rank card themes.**

- New tier `'rank'` added to `LOCKED_TIERS` in `lib/cardThemes.js`, with its
  `TIER_LABELS` entry.
- **Three** new themes, not nine — one per *movement* of the ladder, so the
  reward stays an event rather than routine:

  | Rank | Theme slot | Why here |
  |---|---|---|
  | Strategist (#5) | one new theme | The midpoint — first rank that takes real months |
  | Vanguard (#7) | one new theme | ~10 months; the "serious" band begins |
  | Sovereign (#9) | one new theme | The peak. Should be the rarest surface in the app |

  Palettes are authored in the same data shape as every existing theme (no art
  files — `lib/cardThemes.js` is colour/gradient data). Designing them is part
  of this phase; they must be visually distinct from the six
  achievement-exclusive themes `22` already allocated.
- **New mutation `claimRank(rankId)`** in `lib/rewardsMutations.js`, modelled
  exactly on `claimTrophy`: idempotent upsert with
  `onConflict: 'user_id,source,ref'`, `ref: rankId`. It writes a `theme_grant`
  row for the theme (same shape `claimMilestone` already uses) and a
  `source: 'rank'` marker row carrying **`coins: 0, xp: 0`** — the marker exists
  so a rank grant is idempotent and visible in the ledger, **not** to pay
  currency. See the Context note on why ranks don't pay coins; a future session
  reading a `rank` source in `reward_events` must not read it as licence to
  attach coins to it.
- Granted from `RankUpCelebration`, which already fires at exactly the right
  moment and already writes `highest_rank_seen` before showing. A rank with no
  theme grants nothing and the dialog is unchanged.

**B. Freeze cap scales with rank.**

`FREEZE_CAP` stops being a bare constant and becomes a floor plus a rank-derived
bonus — a **new pure function `freezeCapForRank(rank)`** in `lib/rewards.js`:

| Ranks | Cap |
|---|---|
| Saver – Navigator (#1–4) | 5 (unchanged) |
| Strategist – Vanguard (#5–7) | 6 |
| Master – Sovereign (#8–9) | 7 |

Deliberately shallow: +2 at the very top, not a doubling.

**The compounding risk, stated plainly**: a higher cap protects streaks, and
streaks feed XP, which feeds rank. The loop is real. It is accepted because
(i) the cap is a *ceiling on holdings*, not a source — freezes still cost 3,000
coins or a milestone; (ii) +2 over ~3 years is small against a 5-freeze base;
(iii) rank cannot be bought, so no money shortcut exists. If freeze inflation
ever shows up in practice, this table is the one place to flatten it.

`FREEZE_CAP` stays exported as the base value so nothing that imports it breaks;
`clampFreezeGrant` and `buyFreeze` both switch to `freezeCapForRank`, which means
**both need the user's current XP**, which they don't have today. Resolve by
passing the cap in from the caller (which already reads `useRewards()`) rather
than making the mutations fetch XP themselves — a mutation that silently
round-trips for a second value is the kind of thing that gets called in a loop
later.

### 2.3 Components

- `components/RankUpCelebration.js` — when the reached rank carries a theme, the
  dialog reveals it (reusing Shop's `CardThemeSurface` preview, the same layout
  `24-achievement-celebration.md` specifies for themed trophy rewards). When it
  doesn't, the dialog is exactly as it is today. It already renders `Confetti`
  and a staggered entrance; this adds a preview block, not a new dialog.
- `app/shop.js` — rank themes appear in the Cards grid as locked, labelled with
  the rank that unlocks them ("Reach Vanguard"), never with a price.
- `components/RewardsHistorySheet.js` — the rank ladder section gains, per rank,
  its reward if any (theme swatch, freeze-cap step). This is the surface
  `25-rewards-hub-sheet.md` built precisely to answer "what do I get" — leaving
  it silent about rank rewards would be the same invisible-ladder problem `21`
  fixed for milestones.

### 2.4 Navigation / Integration

None. No new route or menu entry.

### 2.5 Impact on Existing Features

| Existing | Impact | Watch for |
|---|---|---|
| `RankUpCelebration.js` | Grants + reveals a theme on three of nine ranks | The grant must be idempotent — the dialog can re-render; `claimRank` is the guard |
| `hooks/useCardThemes.js` | Three more ownable ids | **No change needed** — it already unions `theme_buy`/`theme_grant`. Verify rather than edit |
| `app/shop.js` | +1 locked tier, +3 themes | Must not be purchasable at any price, and must not appear in the buyable Cards count |
| `clampFreezeGrant` / `buyFreeze` | Cap becomes rank-derived | Both call sites must pass the cap in; a missed one silently reverts that path to 5 |
| `FREEZE_OVERFLOW_COINS` | Overflow threshold moves for high ranks | Overflow→coins conversion still applies, just at 6 or 7 |
| `22-coin-store-and-reward-tiering.md`'s economy | +3 unbuyable themes | Shop's buyable inventory is unchanged; no coin sink is added or removed |

### 2.6 What This Phase Does NOT Include

- **No coins, XP, or freezes granted at a rank-up.** The `source: 'rank'` row is
  a zero-value idempotency marker (2.2A).
- **No theme at the other six ranks** — three, deliberately (2.2A).
- **No purchasable path to any rank theme**, at any price, ever.
- **No rank-gated app accents.** Raised in planning as a third option (it would
  tie into `23-personalize-hub.md`); cut to keep this phase to one cosmetic
  surface. Noted in Out of Scope as the natural next step if rank rewards land
  well.
- **No new badge art.**

### 2.7 Phase 2 Checklist — Before Marking Complete

- [ ] Reaching Strategist/Vanguard/Sovereign grants that rank's theme exactly
      once; re-opening the app does not write a second `theme_grant` row.
      **On-device** — code-side idempotency asserted (upsert on
      `user_id,source,ref`, `ignoreDuplicates`).
- [ ] The granted theme is immediately equippable from Shop and from
      `app/personalize.js`. **On-device.**
- [x] The three rank themes cannot be bought at any price and show their unlock
      condition instead. *Asserted: all three `cost: 0`, tier `rank` is in
      `LOCKED_TIERS` and absent from buyable `TIERS`, and `unlockCaption()`
      returns "Reach: <title>".*
- [x] A rank with no theme celebrates exactly as it does today. *`claimRank`
      returns `{ themeId: null }` for the six ungranted ranks and the reveal
      block renders nothing.*
- [x] `freezeCapForRank` returns 5/6/7 at the right bands. *Asserted exactly:
      `[5,5,5,5,6,6,6,7,7]`, monotonic, base equals `FREEZE_CAP`, top is base+2,
      accepts an id or an object, and falls back to base for
      unknown/null/undefined rather than throwing.*
- [ ] **Both** `clampFreezeGrant` and `buyFreeze` honour it — verified by
      actually holding the cap at a high rank, not by reading the code.
      **On-device.** Code-side: both now read `xp` in their existing
      `v_reward_balances` select and derive the cap; no flat `FREEZE_CAP`
      remains anywhere in the mutation layer or in either UI surface.
- [ ] Overflow past the new cap still converts to `FREEZE_OVERFLOW_COINS`.
      **On-device.**
- [x] No `reward_events` row with `source: 'rank'` carries non-zero coins or XP.
      *Asserted against the source.*
- [x] `RewardsHistorySheet`'s rank ladder shows which ranks carry a reward.

**→ Stop here. Show the result and wait for approval.**

### Implementation Notes (built 2026-07-22)

**Files changed** — six, no new files, no DB change:

| File | Change |
|---|---|
| `lib/cardThemes.js` | `'rank'` added to `LOCKED_TIERS` + `TIER_LABELS`; three new themes (Meridian, Heartwood, Sovereign) |
| `lib/rewards.js` | `RANK_THEME_GRANTS`; `freezeCapForRank()` + its bonus table |
| `lib/rewardsMutations.js` | `claimRank()`; `clampFreezeGrant`/`buyFreeze` switched to the rank-derived cap |
| `components/RankUpCelebration.js` | Grants via `claimRank` before showing; reveals the theme |
| `app/shop.js` | `unlockCaption` handles `rank`; freeze card uses the derived cap |
| `components/RewardsHistorySheet.js` | Ladder rows show each rank's reward; freeze card uses the derived cap |

**Deviation — the freeze cap is read inside the mutations, not passed in.**
2.2B specified passing the cap down from each caller, and warned that "a missed
one silently reverts that path to 5." Building it revealed a strictly better
option the doc had missed: `v_reward_balances` already exposes `coins`, `xp` and
`freezes` **together**, and both `clampFreezeGrant` and `buyFreeze` were already
querying it. Adding `xp` to those existing selects derives the rank at **zero**
extra round trips, needs no signature change anywhere, and makes the
missed-caller failure mode structurally impossible rather than merely
documented. The doc's stated concern — "a mutation that silently round-trips for
a second value" — doesn't apply, because there is no second round trip.

**Unplanned but required — two UI surfaces displayed the flat cap.**
`app/shop.js` (freeze card) and `RewardsHistorySheet` (freeze card) both read
`FREEZE_CAP` directly for their "hold up to N" copy and their at-cap disable
logic. Left alone, Shop would have advertised "hold up to 5" while `buyFreeze`
allowed 7, and the Buy button would have looked blocked at a cap the user had
already outgrown. Both now derive the cap the same way the mutation does.
`FREEZE_CAP` remains exported (it is the base value inside `freezeCapForRank`)
but is no longer read by any mutation or screen.

**Theme design.** Colour families were chosen against the existing 46-theme
catalogue rather than in isolation — blues, reds/ambers, purples and metals are
all crowded, so the three take genuinely unused ground: **Meridian**
(slate + ruled `lines` pattern — a navigator's line, for the rank arc's "you can
chart it now" beat), **Heartwood** (forest → aged gold; the dense inner core a
tree takes years to lay down, the one theme in the catalogue *about* elapsed
time), and **Sovereign** (wine → ember-gold, the only theme deliberately named
for its rank, with `chipColor` set to `#D4AF37` — the exact `badgeColor` of the
`money_master` rank, so the card and the badge share their gold).

**Verification** — 46 assertions against live module exports plus source-level
guards, all passing. Beyond the checklist: every rank theme's `unlock.rankId`
was asserted to agree with `RANK_THEME_GRANTS` (the two are deliberately
separate — grant authority vs. display metadata — so they can drift), every
`unlock.label` to match its rank's current `title`, no orphan `rank`-tier theme
unreachable from the grants map, no id collisions across all 49 themes, and no
flat `FREEZE_CAP` remaining in the mutation layer or either UI surface. All six
touched files Babel-parse clean.

**Still unverified — needs a real device or real elapsed time**: the actual
grant landing in `reward_events` on a live rank-up, replay-idempotency across an
app restart, equipping a granted theme from Shop/Personalize, and holding the
raised cap (including overflow → `FREEZE_OVERFLOW_COINS` past 6 or 7).

---

## Data Model Summary (Final State After All Phases)

**No schema changes in either phase.** Everything lands in existing structures:

```
reward_events (existing)
  ├─ source 'milestone'  → NOW carries xp        (Phase 1)
  ├─ source 'daily_log' / 'no_spend'  → noSpend xp 40→70   (Phase 1)
  ├─ source 'rank'       → NEW, zero-value idempotency marker (Phase 2)
  └─ source 'theme_grant' → reused for rank themes (Phase 2)
         │
         ▼
  v_reward_balances.xp ──► rankFromXp() ──► RANKS[] (retuned + renamed)
                                              │
                                              ├─► card theme (3 of 9)
                                              └─► freezeCapForRank() → 5/6/7

profiles.highest_rank_seen (existing) — stores rank ID, never the title.
```

The single durable constraint this feature adds: **`RANKS[].id` values are
permanent.** They are persisted per-user in `profiles.highest_rank_seen`, key
both badge-art maps, and match `assets/rank/<id>.png` filenames. Titles are
free to change; ids are not.

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| `RankUpCelebration` | Fires more often (lowered thresholds); reveals themes | Phases 1 & 2 |
| Trophy Room rank ladder | New titles, thresholds, and reward markers | Phases 1 & 2 |
| `RewardsHistorySheet` | Rank section shows rewards; `atLevel` shifts | Phases 1 & 2 |
| `claimMilestone` | Writes `xp` | Phase 1 |
| Freeze economy | Cap 5 → 5/6/7 by rank | Phase 2 |
| `app/shop.js` | +1 locked tier | Phase 2 |
| `24-achievement-celebration.md` | Shares the "themed reward reveal" layout | Build whichever lands second against the other's implementation, not its doc |

---

## Out of Scope (All Phases)

- **Coins/XP/freezes as a rank-up payout** — rejected on the double-pay and
  currency-scarcity grounds in Context. Do not re-propose.
- **Rank-gated app accents** (`theme/themes.js` `ACCENTS`, surfaced via
  `23-personalize-hub.md`) — the natural next step if rank rewards land well.
  Future build.
- **Retroactive XP** for milestones claimed before Phase 1 (1.6).
- **Reducing or adding ranks** — nine is fixed by the existing badge art (1.2C).
- **Renaming rank ids** — structurally forbidden; see the Data Model Summary.
- **Reworking `levelFromXp` / the Money Level ladder** — a separate mechanic
  that happens to share the XP number. Untouched here.
- **Spin-wheel XP** (1.2A).
