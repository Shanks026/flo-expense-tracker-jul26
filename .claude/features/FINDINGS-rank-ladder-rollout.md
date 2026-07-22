# Findings & Test Plan — Rank Ladder Rollout
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/FINDINGS-rank-ladder-rollout.md`
**Covers**: `27-rank-ladder-rework.md` (both phases, built 2026-07-22)
**Status**: Test plan partially executed — 3 cases confirmed on live data, the
rest pending. **All 3 findings fixed 2026-07-22** — on-device confirmation
still pending (no device in this environment).
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

## Part 4 — Findings (raised 2026-07-22, all fixed 2026-07-22)

### Finding 1 — Drop the day-1 spin wheel ✅ Fixed

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

**Fix applied**: the `1:` entry deleted from `SPIN_WHEELS` (`lib/rewards.js`).
`spinWheelFor(1)` now returns `undefined`; day 1 is a plain streak celebration,
same as any other non-milestone day. No replacement flat reward was added —
"drop the spin" was taken literally, matching the direct feedback quoted
above. `ocean-deep` stays in the catalogue as a plain purchasable Common theme
(its own comment in `lib/cardThemes.js` updated to match). If day 1 giving
nothing at all reads as swinging too far the other way once seen on-device,
that's a follow-up, not something guessed at here.

### Finding 2 — Saver is never celebrated, and its coins/XP float free ✅ Fixed

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

**Fix applied** (`components/RankUpCelebration.js`): Finding 1 landing first
resolved the entanglement — there's no longer a day-1 coin source to merge
into anything, so no separate design decision was needed on that front. Two
changes:

1. **The silent "first-ever check" branch is gone.** `lastSeenId` being null
   is now treated as index `-1` — "below every rank" — instead of a special
   "welcome, record and return" case. Whatever rank the user is actually at
   gets celebrated exactly once, Saver included. This also fixes a second real
   bug the silent branch caused: **live data (queried via Supabase MCP while
   fixing this) showed two existing accounts already sitting at
   `highest_rank_seen = null`** despite being weeks old — under the old code
   they would never see a celebration for any rank, ever, not just Saver. Now
   they get the one celebration for whichever rank they've actually earned.
2. **`RankUpCelebration` now defers to `RewardBurst`** (`isBursting`), the
   same ordering guard `StreakCelebration` already had and this component was
   missing — a full-screen rank-up Modal can no longer render on top of, and
   hide, a coins/XP burst animating from the same action. This is the concrete
   fix for "the coins granted and xp are just floating": the burst now always
   finishes animating in full before any rank celebration takes over.

**Deliberately not done**: Saver's celebration screen does not display a
coins/XP figure of its own. Ranks paying currency was rejected outright in
`27-rank-ladder-rework.md`'s Context ("Ranks will not pay coins," a double-pay
+ currency-scarcity violation) and that invariant wasn't reopened here — the
"floating" complaint is resolved by ordering (fix 2), not by attaching a
payout to the rank event itself. If a literal coins/XP line inside the Saver
dialog is still wanted after seeing this on-device, that's a scope decision to
raise separately.

### Finding 3 — Show the reward text in the subtitle beside the actual reward ✅ Fixed

> *"display the text reward in the subtitle beside the actual reward"*

**Needed clarification before it could be actioned** — it wasn't yet clear
which surface this refers to. Candidates considered:

- **The Rewards hub ledger** (`RewardsHistorySheet`) — rows currently show a
  `SOURCE_LABELS` label plus signed coin/XP amounts, but a `theme_grant` row
  renders no theme *name*, so a granted card appears as a bare label with no
  visible reward.
- **The milestone road** (`app/streak.js` `roadRewardText`) — already joins
  coins · XP · freezes · theme · spin as of `27` Phase 1.
- **The rank ladder** (`RewardsHistorySheet`) — gained `rewardText` in `27`
  Phase 2.

The ledger was confirmed as the right fit once the actual code was read while
fixing this: `SOURCE_LABELS` had **no entry at all** for `theme_grant`, `rank`,
`trophy`, or `spin` — every row of those four types was rendering the raw
source string (literally `"theme_grant"`, `"rank"`, etc.) with no reward
detail, not just a missing theme name. This is the ledger's own gap the doc
predicted, confirmed rather than assumed.

**Fix applied** (`components/RewardsHistorySheet.js`):

1. `SOURCE_LABELS` gained entries for all four: `theme_grant` → "Card
   unlocked", `rank` → "Rank reached", `trophy` → "Achievement claimed", `spin`
   → "Bonus spin".
2. New `rewardDetailFor(item)` resolves what was actually granted: a
   `theme_grant` row's `ref` (the theme id) → `getTheme(ref).name`; a `rank`
   row's `ref` (the rank id) → the matching `RANKS[].title`. Every other
   source returns `null` — their existing label + coin/XP amount already say
   what happened.
3. The ledger query now selects `ref` (it didn't before — the column existed
   in the table but was never read here).
4. Each row's subtitle shows the resolved detail beside the date (e.g.
   "Meridian · 22 Jul, 8:03 PM"), instead of the date alone. `theme_grant` and
   `rank` rows always carry `coins: 0` by design, so before this fix those rows
   showed literally nothing but a raw source string and a timestamp.

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

---

## Part 6 — Round 2: real on-device findings (2026-07-22)

Three more bugs, found on-device after Round 1's fixes shipped, plus one
product decision.

### Bug A — Rank ladder shows two "Level 1"s ✅ Fixed

Reported: `chrisaustin2001` (level 4, rank Steward) saw the `RewardsHistorySheet`
ladder read **Saver → Level 1, Keeper → Level 1, Steward → Level 4**. Verified
by computing `levelFromXp` against every rank's live `minXp`: Level and Rank
are genuinely independent curves (by design — see `levelFromXp`'s own comment
in `lib/rewards.js`), and the Phase 1 retune put Keeper's XP threshold (400)
under Level 2's requirement (455) — the ONLY collision on the ladder (checked
all nine ranks; every other rank's level is strictly increasing).

Two ways to fix it existed and both were rejected: raising Keeper's threshold
above 455 would **violate the no-demotion invariant** for any live user
already sitting at 400–454 XP; retuning the Level curve's constants would
change every user's displayed level app-wide, a change `27`'s own doc
explicitly put out of scope. Instead, fixed at the display layer
(`RewardsHistorySheet.js`'s `rankLadder`): a rank's "Level N" text now only
renders when it's strictly greater than the previous rank's — the same
de-dup rule already used one line above it for the freeze-cap reward text.
Keeper's row now shows no level line at all (nothing new to report — it's
still within the Level 1 band Saver already introduced); Steward still jumps
straight to "Level 4", correctly.

### Bug B — Rank celebration replays on every APK reinstall ✅ Fixed

Reported: "I'm seeing the new rank celebration screen multiple times, as I
uninstall the apk, update it with new one. I think it's because of the async
storage." **It isn't** — `RankUpCelebration` was already DB-backed
(`profiles.highest_rank_seen`), not AsyncStorage, and querying the live table
mid-investigation showed `chrisaustin2001`'s `highest_rank_seen` correctly at
`'steward'`, matching their actual rank. So the persisted VALUE was correct;
the bug was that the persist path had no way to detect a **silent failure**.

Root cause: `useProfile.js`'s `updateProfile()` did
`.update(fields).eq('id', userId)` with no `.select()`. Postgrest returns
`error: null` for an UPDATE whose WHERE clause matches zero rows (an RLS
mismatch, a stale/racing session right after a fresh sign-in after
reinstall, etc.) — there is no way to tell "succeeded" from "silently matched
nothing" without asking for the row back. Every caller that treats a clean
return as proof the write landed (`RankUpCelebration`'s
`highest_rank_seen` persist is the concrete one) had no way to notice a
no-op, so the stale DB value could survive a reinstall and replay the
celebration on the next launch.

**Fix applied**:
1. `useProfile.js`'s `updateProfile()` now chains `.select().maybeSingle()`
   and treats a null result (with no `error`) as a real error
   (`profile_update_no_match`) — a write that matched nothing is no longer
   reported as success. All existing callers only ever checked `{ error }`,
   so this is a strictly additive guarantee, not a breaking change.
2. `RankUpCelebration.js` now reads that error: if the `highest_rank_seen`
   persist fails, it does **not** proceed to `claimRank`/show the dialog, and
   resets `checkedRankRef` so a later XP tick or remount retries the write
   instead of getting stuck having "seen" a rank it never durably recorded.

### Decision — Ocean Deep moved from the day-1 spin to Saver's rank reward ✅ Done

Direct instruction: *"since we dropped the spin, we can move the ocean-deep
theme to saver as reward."* `RANK_THEME_GRANTS` gained `saver: 'ocean-deep'`
(`lib/rewards.js`); Ocean Deep itself moved in `lib/cardThemes.js` from
`tier: "common", cost: 400` (plain purchasable) to `tier: "rank", cost: 0`
with `unlock: { type: "rank", rankId: "saver", label: "Saver" }` — following
the same "never purchasable at any price" rule the other three rank themes
already have, rather than being the one exception. Functionally this is the
same guaranteed day-one grant Ocean Deep always gave (previously via the
now-removed spin wheel), just moved onto `claimRank`. It also means Saver's
celebration (Round 1, Finding 2) now has a real reward to reveal — the
`themeWrap` block in `RankUpCelebration.js` needed no code change, since it
already renders whenever `claimRank` returns a `themeId`.

**Still pending**: all of Round 2 is code-verified only (Babel-parses clean,
traced against live DB state); on-device confirmation needs a new build.
