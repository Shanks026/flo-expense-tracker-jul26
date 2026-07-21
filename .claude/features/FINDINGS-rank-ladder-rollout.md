# Findings & Test Plan — Rank Ladder Rollout
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/FINDINGS-rank-ladder-rollout.md`
**Covers**: `27-rank-ladder-rework.md` (both phases, built 2026-07-22)
**Status**: Test plan partially executed — 3 cases confirmed on live data, the
rest pending. 3 open findings raised by the user, none yet fixed.
**Last Updated**: 2026-07-22

---

## What this doc is

A working record, not a feature plan. It holds (1) the on-device test plan for
`27`'s two phases with the exact SQL to drive it, and (2) the findings raised
while testing, which are **not yet actioned** and span features `18`, `20` and
`27`. Read `27-rank-ladder-rework.md` for the design and the reasoning; this is
the "what still needs checking, and what's broken" companion.

---

## Part 1 — Test Account State

`test@gmail.com` — id `467d6d85-a4e9-49d7-b44a-ea197b6fef08`

Seeded 2026-07-22 via a single `test_grant` row (`ref: 'p27-strategist'`,
+9,900 XP / +20,000 coins / +5 freezes) on top of an existing 100 XP / 125
coins, giving:

| | Value | Why |
|---|---|---|
| XP | **10,000** | Exactly the Strategist threshold — doubles as a boundary check that `rankFromXp` resolves `minXp` inclusively |
| Coins | 20,125 | Enough to actually buy freezes (`FREEZE_COST` 3,000) |
| Freezes | 5 | Exactly the OLD flat cap — the setup for the cap test |
| `highest_rank_seen` | `treasurer` | Already advanced past `saver`; the rank-up fired |
| `equipped_card_theme` | `ink` | Meridian owned but not equipped |

**The account was already past the "first-ever check" trap** (`highest_rank_seen`
was `'saver'` before seeding), which is why the celebration fired. See Finding 2
— this is the same code path that suppresses the Saver celebration.

---

## Part 2 — Driving the tests with SQL

### The id/title mapping (this trips you up every time)

Rank **ids are permanent and differ from titles** (`27`'s THE ID RULE). SQL
takes ids; the UI shows titles.

| Title in the UI | XP needed | id for SQL | Reward |
|---|---|---|---|
| Saver | 0 | `saver` | — |
| Keeper | 400 | `bookkeeper` | — |
| Steward | 1,500 | `steward` | — |
| Navigator | 4,000 | `strategist` | — |
| **Strategist** | **10,000** | `treasurer` | ★ Meridian + cap 6 |
| Architect | 22,000 | `financier` | — |
| **Vanguard** | **45,000** | `tycoon` | ★ Heartwood |
| Master | 80,000 | `magnate` | cap 7 |
| **Sovereign** | **135,000** | `money_master` | ★ Sovereign card |

### Grant XP

```sql
insert into reward_events (user_id, source, ref, coins, xp, freezes)
values ('467d6d85-a4e9-49d7-b44a-ea197b6fef08', 'test_grant', 'p27-vanguard', 0, 35000, 0);
-- → 45,000 total = Vanguard (Heartwood)

insert into reward_events (user_id, source, ref, coins, xp, freezes)
values ('467d6d85-a4e9-49d7-b44a-ea197b6fef08', 'test_grant', 'p27-sovereign', 0, 90000, 0);
-- → 135,000 total = Sovereign
```

Change `ref` every time — `UNIQUE (user_id, source, ref)` makes a repeat a
silent no-op. **No `highest_rank_seen` reset is needed to step upward**; each
grant celebrates the next rank naturally.

### Replaying a rank-up

Deleting XP alone is **not** enough — `claimRank` is idempotent, so the theme
never re-grants:

```sql
delete from reward_events
where user_id = '467d6d85-a4e9-49d7-b44a-ea197b6fef08'
  and (source = 'test_grant'
       or (source in ('rank','theme_grant')
           and ref in ('treasurer','tycoon','money_master',
                       'meridian','heartwood','sovereign')));

update profiles set highest_rank_seen = 'saver'
where id = '467d6d85-a4e9-49d7-b44a-ea197b6fef08';
```

**Set `highest_rank_seen` to a LOWER rank id, never `null`.** `null` is the
"first-ever check is a welcome" branch — it records silently with no dialog
(and no theme grant). This is exactly Finding 2.

### Inspecting state

```sql
-- balances + rank
select coalesce(b.xp,0) xp, coalesce(b.coins,0) coins, coalesce(b.freezes,0) freezes,
       p.highest_rank_seen, p.equipped_card_theme
from profiles p left join v_reward_balances b on b.user_id = p.id
where p.id = '467d6d85-a4e9-49d7-b44a-ea197b6fef08';

-- every grant row (T15 lives here)
select source, ref, coins, xp, freezes, created_at
from reward_events
where user_id = '467d6d85-a4e9-49d7-b44a-ea197b6fef08'
  and source in ('rank','theme_grant','milestone','spin')
order by created_at;
```

### Full cleanup

```sql
delete from reward_events where source = 'test_grant';
```

---

## Part 3 — Test Cases

### Phase 1 — curve, bursts, names

| # | Test | Expected | Status |
|---|---|---|---|
| T1 | Open the app on an existing account after the retune | **One** dialog for the *highest* new rank, not a stack — every threshold dropped, so multi-rank jumps are the norm now | ✅ Confirmed (Saver → Strategist produced one dialog) |
| T2 | Force-close, reopen | No dialog; `highest_rank_seen` holds the new id | ⬜ |
| T3 | Hit a streak milestone | Celebration shows **+N XP** beside coins/freezes; ledger has the `milestone` row with non-zero `xp` | ⬜ |
| T4 | Trigger the same milestone's celebration twice | XP unchanged after the second — the upsert still no-ops now that a new column is written | ⬜ |
| T5 | Streak screen → Milestones tab | Rows read e.g. `400 coins · 900 XP · 1 freeze · + Sapphire · + bonus spin` | ⬜ |
| T6 | Declare a no-spend day | **+70 XP, 0 coins** | ⬜ |
| T7 | Rewards hub / Trophy Room / Home header | No "Bookkeeper", "Treasurer", "Financier", "Tycoon", "Magnate", "Money Master" anywhere | ⬜ |

### Phase 2 — rank rewards

| # | Test | Expected | Status |
|---|---|---|---|
| T8 | Reach a themed rank | Theme granted exactly once; `theme_grant` row written | ✅ Confirmed (`theme_grant/meridian`, one row) |
| T9 | After T8 → Shop → Cards | Theme shows **owned**; equipping changes the Home hero card; also visible in Personalize | ⬜ |
| T10 | Shop → Cards, an *unowned* rank theme | Under **"Rank reward"**, captioned **"Reach: Vanguard"** / **"Reach: Sovereign"**, **no price, no Buy** at any balance | ⬜ |
| T11 | Rank-up into an unthemed rank (e.g. Steward) | Normal dialog, **no theme block at all** | ⬜ |
| T12 | At Strategist → Shop → General | Reads **"hold up to 6"**, not 5. At Master → **7** | ⬜ |
| T13 | At Strategist holding 5 freezes, buy one | **Succeeds** — blocked on the old flat cap. At 6 it blocks, reading "You're holding the max (6)" | ⬜ **highest-value test** |
| T14 | At the cap, claim a milestone granting freezes | Excess converts to coins at `FREEZE_OVERFLOW_COINS` (500 each), not dropped | ⬜ |
| T15 | After any rank-up, inspect `source = 'rank'` rows | Every row **`coins = 0, xp = 0`** | ✅ Confirmed (`rank/treasurer/0/0/0`) |
| T16 | Rewards hub → rank ladder | Strategist "Meridian card · 6 freeze slots"; Vanguard "Heartwood card"; Master "7 freeze slots"; Sovereign "Sovereign card". Unrewarded ranks show no reward line | ⬜ |

**Already verified without a device** (see `27`'s Implementation Notes): 14
assertions in Phase 1 and 46 in Phase 2 against live module exports, plus a
clean `npx expo export` (8.28 MB Android bundle, zero resolution errors).

---

## Part 4 — Open Findings (raised 2026-07-22, none fixed)

### Finding 1 — Drop the day-1 spin wheel

> *"drop the spin in day 1 — too much for new users"*

**Verified mechanics.** Day 1 is **not** a `MILESTONES` entry. The celebration
fires on `isNewStreak`, and the wheel is gated purely on
`spinWheelFor(current)` — deliberately **not** on `isMilestone`
(`StreakCelebration.js` ~line 143). So `SPIN_WHEELS[1]` is what puts a wheel in
front of a first-day user, awarding coins/freezes via `claimSpin(1, segment)`
plus the `ocean-deep` theme.

**The fix is one deletion**: remove the `1:` entry from `SPIN_WHEELS`
(`lib/rewards.js`). `spinWheelFor(1)` then returns undefined, `wheelDay` stays
null, and day 1 becomes a plain streak celebration.

**One consequence to decide**: `ocean-deep` loses its grant path. It is
**still buyable in the Shop** (a Common theme — see its own comment in
`lib/cardThemes.js`, which notes owning it both ways is harmless), so nothing
is orphaned and no catalogue change is strictly required. But day 1 then gives
**nothing at all**, which may swing too far the other way — worth deciding
whether day 1 keeps a small flat reward instead of a wheel.

**Scope**: `20-milestone-spin-wheel.md` Phase 2 introduced days 1/3/7/10 as the
"front-loaded first week." This partially reverses that decision for day 1 only
— record it there when actioned.

### Finding 2 — Saver is never celebrated, and its coins/XP float free

> *"the first rank title saver badge is never displayed as a celebration screen
> and the coins granted and xp are just floating. merge this to display the
> saver celebration and the coins xp in the celebration screen."*

**Verified root cause.** `RankUpCelebration.js` (~line 59):

```js
if (!lastSeenId) {
  await updateProfile({ highest_rank_seen: rank.id }, { silent: true });
  return;   // ← records Saver silently, no dialog, no claimRank
}
```

The guard exists on purpose — its comment reads *"everyone starts at Saver by
construction (minXp: 0), so this is 'welcome', not a rank-up."* Celebrating
Saver means **reversing that call**, which needs care: the same branch also
protects an *existing* user whose `highest_rank_seen` was never recorded from
getting a spurious celebration.

**The floating coins/XP is `RewardBurst`** — the overlay animation fired by
`AddTransactionSheet` (`claimDailyLog`), `TodayCard`, `app/(tabs)/index.js`'s
`takePendingLoginReward`, and `app/trophies.js`.

**A concrete asymmetry worth fixing regardless of the Saver decision**:
`StreakCelebration` already coordinates with the burst — it reads `isBursting`
and **defers** showing itself until the burst finishes, precisely so a
full-screen Modal doesn't cover the floating coins (a bug already found
on-device once; see `18` Phase 3). **`RankUpCelebration` has no such guard.**
So a rank-up and a reward burst can genuinely collide. That is a real bug
independent of the merge request.

**Open question for discussion** (the user asked to confirm): **yes — the
coins in question came from the spin.** `test@gmail.com`'s ledger shows
`theme_grant / ocean-deep` written by the **day-1 spin wheel**, and the day-1
wheel's segments pay 25–150 coins or 1 freeze. So Findings 1 and 2 are
entangled: **dropping the day-1 spin (Finding 1) removes the coin source that
Finding 2 wants merged into the Saver celebration.** Decide Finding 1 first.

### Finding 3 — Show the reward text in the subtitle beside the actual reward

> *"display the text reward in the subtitle beside the actual reward"*

**Needs clarification before it can be actioned** — it is not yet clear which
surface this refers to. Candidates:

- **The Rewards hub ledger** (`RewardsHistorySheet`) — rows currently show a
  `SOURCE_LABELS` label plus signed coin/XP amounts, but a `theme_grant` row
  renders no theme *name*, so a granted card appears as a bare label with no
  visible reward.
- **The milestone road** (`app/streak.js` `roadRewardText`) — already joins
  coins · XP · freezes · theme · spin as of `27` Phase 1.
- **The rank ladder** (`RewardsHistorySheet`) — gained `rewardText` in `27`
  Phase 2.

The ledger is the most likely fit, since it is the one surface that shows a
reward *event* without naming what was actually received. Confirm before
building.

---

## Part 5 — Also noted this session

- **`kind: 'lines'` is now dead code.** `CardThemeSurface.js` still implements
  it, but after Meridian was rebuilt as a gradient (see below) **no theme uses
  it**. It also has a latent bug: the `lines` branch reads only `line` and
  **silently ignores `accent`**, so any future theme setting an accent there
  gets nothing. Fix or delete before reaching for it again.
- **Meridian was rebuilt** (2026-07-22, rejected on first sight). The original
  `pattern/lines` version sat one shade off Blueprint's base — a *Common*
  theme — and its accent never rendered. Now a 4-stop gradient
  (`#080E1F → #1C2A54 → #356690 → #6FA8C9`). Full reasoning is in the theme's
  own comment in `lib/cardThemes.js`.
- **`profiles.highest_rank_seen`** is not recorded in `00-index.md`'s Schema
  Reference. Neither are `theme_accent`, `theme_mode`, or
  `equipped_card_theme`. The index's feature table is also **missing features
  13–21** entirely, and its Shared Infrastructure Notes stop at 2026-07-19 —
  nothing about the reward ledger, card themes, or badge art is recorded there.
