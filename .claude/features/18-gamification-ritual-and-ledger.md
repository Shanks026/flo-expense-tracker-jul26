# Feature: Gamification — The Ritual & Reward Ledger
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/18-gamification-ritual-and-ledger.md`
**Status**: ✅ Phases 1–3 complete, built and iterated on real on-device
feedback. ✅ Phase 4 buy-freeze confirmed on-device (test account:
`chrisaustin11109@gmail.com`, manually granted 10,000 coins via a
`test_grant` reward_events row for testing); the return-prompt/frozen-tile
half is code-complete but not yet on-device confirmed — it needs a genuine
missed day to trigger, which takes real elapsed time rather than something
scriptable. 🚧 Phase 5 built, Babel-verified, pending on-device confirmation —
both a real milestone hit and a rank-up need real (or manually-credited) XP
to exercise end to end
**Last Updated**: July 2026

---

## Context

FLO's whole retention engine today is the streak, and everything gamified so
far rewards *logging harder* — which only makes a chore a better chore. This
feature graduates the finalized design in `IDEAS-gamification.md` (Waves 0–2)
into a build: it adds the **ritual** (a daily "close the day" acknowledgement,
incl. the no-spend path), the **economy** (an append-only `reward_events`
ledger yielding coins, XP and freeze inventory), the **permanent-progress**
layer (Money Level + Rank, so a broken streak never zeroes a user), the
**streak freeze** (the anchor consumable), and the **trophy room** (the free
recognition layer).

It follows FLO's core principle exactly: the ledger is an **append-only event
log** (mirroring `transactions → v_global_summary`), and every balance —
coins, XP, freezes — is a **computed sum**, never a stored running total.
Idempotency is enforced by a unique `(user_id, source, ref)` key: the *claim*
is recorded, the *balance* is derived.

**Scope discipline** — the whole gamification layer is **user-scoped** (global
across a person's money accounts, exactly like the streak already is). The only
money-account-scoped surface in the full design — which owned card theme each
account's hero card wears — belongs to the **cosmetics wave (a future doc)**
and is deliberately out of scope here.

**The finalized numbers are illustrative** ("ratios, not gospel"). Every one
lives as a constant in `lib/rewards.js` so tuning is a one-file change. What's
*fixed* are the four invariants (see Phase 3).

---

## Phase Overview

```
Phase 1 — Trophy Room
  A new screen of earned/locked trophies, fully derived from existing
  streak/budget/plan/transaction data. No economy, no new tables, no art.

Phase 2 — Reward Ledger + Coins + XP + Money Level
  The append-only reward_events ledger + balances view + lib/rewards.js.
  A logged day auto-earns coins & XP; Home's coin chip and a new Money Level
  line go live.

Phase 3 — Close the Day
  The daily ritual: an acknowledgement on Home, the "No-spend day"
  declaration (XP, zero coins), and a covered-dates-aware computeStreak so a
  declared no-spend day holds the streak.

Phase 4 — Streak Freeze
  Buy with coins + earn from milestones; the "you missed a day — use a freeze
  or start over?" return prompt; a distinct ice tile in the calendar; the
  hold cap.

Phase 5 — Milestone Grants + Rank / Title
  Attach idempotent coin/freeze rewards to the existing streak milestones,
  and surface the Rank ladder (Saver → Money Master) + badge over Money Level.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Trophy Room

### Goal
The user gets a new **Trophy Room** screen (opened from the Menu sheet) showing
a wall of achievements — earned ones in colour, unearned ones as greyed
silhouettes with a hint. Everything is derived live from data the app already
has (streak, transactions, budgets, plans); nothing is stored except a
lightweight "seen" flag for the new-trophy dot. This is the highest
value-per-effort item in the whole feature and ships with **zero new tables,
zero economy, zero art** (Lucide icons only) — a real visible surface before
any of the ledger machinery exists.

### Before Starting — Confirm With Codebase
- `hooks/useStreak.js` — confirm it returns `{ current, longest, history }` and
  is global (not account-scoped). Trophies read `longest`/`current`.
- `lib/streak.js` `MILESTONES` (`[3, 7, 10, 30, 50, 100]`) — the streak-trophy
  tiers must ride this same list, not a re-typed copy.
- `hooks/useTransactions.js` / `v_global_summary` — confirm how to get a
  **lifetime transaction count** and the **first transaction date** (may need a
  small count query; don't pull every row just to count).
- `hooks/useBudgets.js` / `v_budgets_with_spent` — what's available to derive
  "kept a budget for its full period" (needs `period_end` in the past +
  `spent <= amount`).
- `hooks/usePlans.js` / `v_plans_with_totals` — completed-plan count.
- `components/MenuSheet.js` — the row pattern to add a "Trophies" entry.
- The user-scoped AsyncStorage rule (`00-index.md`): any user-state key must
  include `userId` (`flo.trophies.seen.${userId}`).

### 1.1 Database
**No database changes in this phase.** Everything is derived from existing
tables/views. The only persistence is AsyncStorage for the "seen" set.

### 1.2 Data Layer
- **`lib/trophies.js`** (new, pure — testable like `lib/streak.js`, no React/
  Supabase imports). Exports:
  - `TROPHIES` — the ordered catalogue. Each entry:
    `{ id, group, name, hint, icon (Lucide key), tiers? }`. Groups: `streak`
    (mirrors `MILESTONES`), `logger` (100/500/1k/5k lifetime txns),
    `perfect_month`, `budget_keeper` (1/3/6/12 kept periods), `frugal`
    (5/25/100 declared no-spend days — **tier data available from Phase 3
    onward; shows as 0/locked until then**), `planner` (1/5/10 completed),
    `categorizer`, `comeback`, `fresh_start`.
  - `evaluateTrophies(stats)` — pure function taking a plain `stats` object
    (`{ currentStreak, longestStreak, txnCount, firstTxnDate,
    keptBudgetPeriods, completedPlans, noSpendDays, ... }`) and returning each
    trophy's `{ earned, progress, tier }`. **Rewards behaviour, never amounts**
    — no rupee thresholds anywhere.
- **`hooks/useTrophies.js`** (new) — gathers the `stats` inputs (reusing
  existing hooks/lightweight count queries; subscribes to `useDataRefresh`
  `version`), runs `evaluateTrophies`, and layers the AsyncStorage "seen" set
  to compute an `unseenCount` (drives a dot on the Menu row). Returns
  `{ trophies, earnedCount, totalCount, unseenCount, markAllSeen, loading }`.

### 1.3 Components
- **`app/trophies.js`** (new route, pushed screen — like `app/analytics.js`).
  Header (back + "Trophies") + a summary line ("14 of 32 earned") + a grid of
  trophy cards. Earned = full colour tile (brand/streak tones per group);
  unearned = greyscale silhouette + hint text + progress (`3 / 7`). Uses
  `IconTile` + `CategoryIcon`-style Lucide rendering, `theme/tokens.js` only.
  On mount, calls `markAllSeen()`.
- No sheet, no new shared component beyond the screen.

### 1.4 Navigation / Integration
- **`components/MenuSheet.js`** — add a **"Trophies"** row (Lucide `Trophy`),
  navigating `router.push('/trophies')`, with a small unseen-count dot when
  `useTrophies().unseenCount > 0`, styled like the existing bell dot.

### 1.5 Impact on Existing Features
| Existing | Impact | Watch for |
|---|---|---|
| `MenuSheet.js` | One new row | Keep row order/spacing consistent with Analytics/Settings rows |
| `useDataRefresh` | New consumer only | None |
| `lib/streak.js` `MILESTONES` | Read-only reuse | Don't duplicate the list into `trophies.js` — import it |

### 1.6 What This Phase Does NOT Include
- No coins/XP/freeze rewards for earning a trophy (no ledger yet — Phase 2+).
  Trophies here are **pure recognition**, exactly as designed.
- No `frugal` tier progress until Phase 3 introduces no-spend days (renders
  locked at 0 until then — acceptable, the tile still exists).
- No trophy detail screen, no share, no animation beyond the app's existing
  `FadeIn`.

### 1.7 Phase 1 Checklist — Before Marking Complete
- [x] `app/trophies.js` renders earned (colour) vs unearned (greyscale + hint).
- [x] Streak trophies are derived from `MILESTONES` (imported, not copied).
- [x] `Fresh Start` is earned by anyone with ≥1 transaction (room never empty).
- [x] Lifetime txn count uses a count query, not a full-row fetch.
- [x] Menu row shows an unseen dot that clears after visiting the screen.
- [x] "Seen" AsyncStorage key is user-scoped (`flo.trophies.seen.${userId}`).
- [x] `lib/trophies.js` is pure — no React/Supabase imports. **Deviation**: no
      unit tests were added — this repo has no test framework at all (no
      `jest`/`vitest`/`__tests__`, confirmed by checking `package.json` and the
      repo tree). Verified instead the way this repo verifies everywhere else:
      transformed cleanly through the project's own Babel config, and the
      manual on-device test cases below.
- [x] No new tables/views; no rupee-amount thresholds anywhere.

**Code-complete, Babel-verified; pending your on-device pass — see
Implementation Notes and Test Cases below.**

**→ Stop here. Show the result and wait for approval.**

### Phase 1 — Implementation Notes

Built: `lib/trophies.js` (pure catalogue + `evaluateTrophies`/`hasPerfectMonth`/
`isCategorizerStreak`), `hooks/useTrophies.js`, `app/trophies.js`, and a new
"Trophies" row (+ unseen dot) in `components/MenuSheet.js`. No schema changes.

**Real blocker found while building — `budget_keeper` is not computable from
the current schema, not just deferred.** The plan called for "kept a budget
1/3/6/12 consecutive periods," but `v_budgets_with_spent` only ever exposes
the **current** period's `spent`/`amount` — a `calendar_week`/`calendar_month`
budget recurs forever and there is no stored record of whether *last* week's
or *last* month's period was kept. Only `custom` budgets have a real end (and
even then, only ever one period, never "consecutive"). Building this honestly
would need a new table logging each period's outcome when it closes — real
scope, and a schema change this phase explicitly said it wouldn't need.
**Decision needed before this can unlock**; in the meantime the tile is
present but permanently locked with "Coming soon" (`lib/trophies.js`'s
`keptBudgetPeriods: null` sentinel, handled explicitly by `evaluateTrophies` —
not silently faked as 0/never-earned, which would look identical to "not
started" rather than "not built yet"). Options for later: (a) add a small
`budget_period_outcomes` table populated when a period rolls over, (b)
descope to a single non-consecutive "kept an ended custom budget" trophy
(weak — most budgets are calendar-recurring), (c) drop the group. Flagging
here rather than picking silently.

**`comeback`'s definition is a proxy, not literal history.** "Rebuilt to 30
after a break" is read as *"has ever had a break, and has since reached a
30-day streak"* (`streak.breaks > 0 && streak.longest >= 30`) — `useStreak`
doesn't expose *when* each break happened relative to *when* 30 was reached,
so this can't literally confirm the rebuild happened chronologically after the
break. In practice these are nearly always the same thing (a longest streak of
30+ that coexists with any break in the 90-day window), so it's an acceptable
v1 reading — noted in case it ever matters.

**`perfect_month`/`categorizer` reach back 400 days**, further than the
streak's own 90-day `WINDOW_DAYS` — a deliberate, separate window (see
`HISTORY_WINDOW_DAYS` in `useTrophies.js`) since a "completed calendar month"
achievement needs more lookback than the streak's rolling display ever did;
kept independent rather than widening the streak's own window for an unrelated
reason.

**Trophies use their own local icon-key map** (`ICONS` in `app/trophies.js`),
not `CategoryIcon.js` — that map is specifically the category-icon registry;
trophies are a different domain and get their own small map, matching the
"category icons only through the curated map" rule's spirit without
overloading it.

**Fixed a real infinite-render crash** ("Maximum update depth exceeded"),
found on-device testing with a live account (`chrisaustin2001@gmail.com`).
Root cause was two-part: `app/trophies.js`'s `useFocusEffect(() => markAllSeen())`
passed a brand-new inline callback every render, and react-navigation's
`useFocusEffect` re-runs its internal effect whenever that callback's identity
changes (a documented footgun); combined with `markAllSeen` constructing a
**new `Set` object every call** in `hooks/useTrophies.js` — even when the
contents were identical — React always treats a new object reference as
changed state and re-renders, closing the loop. Fixed both halves: the
`useFocusEffect` callback is now wrapped in `useCallback`, and `markAllSeen`
is now a genuine no-op (checks `earnedIds.every((id) => seen.has(id))` before
touching state at all) — defense in depth, either fix alone would have broken
the loop.

**UI iterated post-build, on user feedback** — the original 3-per-row grid
(fixed 92px tiles) felt cramped once real labels/hints rendered. Replaced with
the same list-row grammar Home's Recent Transactions/Upcoming Bills already
use (`IconTile` left, title+subtitle stacked right, optional trailing value) —
one `Card` per trophy group, one row per tier. The header summary card was
also changed from a centered "N / Total" tally to a left-text/right-stat
layout mirroring `app/streak.js`'s hero card (but mirrored: engaging copy
left, the big number right) — the left side now shows a dynamic nudge toward
the closest not-yet-earned trophy (`"3 to go for \"7-Day Streak\""`), computed
as the un-earned, non-locked trophy with the highest `progress`. Earned rows
show their descriptive hint as the subtitle (not just "Earned") with the tone-
coloured word "Earned" trailing on the right; in-progress rows show a
`current/threshold` fraction instead.

**Reward-for-earning-a-trophy decision: still open, not decided.** Discussed
with the user — the design (`IDEAS-gamification.md`) already commits to the
`Comeback` trophy granting **+1 freeze** (a deliberate exception; everything
else is pure recognition, no sink). Whether any *other* trophy also pays a
small one-time coin bonus (e.g. `Fresh Start`, as an onboarding touch) was
raised but explicitly left undecided — don't wire any trophy reward beyond
Comeback's freeze without confirming first. Phase 1 itself grants nothing at
all regardless (no ledger existed yet); this note is for Phase 4/5 wiring.

---

## Phase 2 — Reward Ledger + Coins + XP + Money Level

### Goal
The economy becomes real. A new append-only `reward_events` table records every
earn/spend as an immutable row; a view sums it into live **coins, XP and freeze**
balances. `lib/rewards.js` turns lifetime XP into a **Money Level**. Logging a
transaction now **auto-earns** the daily coins + XP (claimed once per local day,
idempotently). Home's placeholder coin chip becomes the real balance, and a new
**Money Level** line appears in the greeting's reserved subtitle slot.

### Before Starting — Confirm With Codebase
- `information_schema.columns` for `transactions` — copy the exact `user_id`
  default (`DEFAULT auth.uid()`) shape for the new table (standing rule).
- `components/AddTransactionSheet.js` `handleSave` — the single place
  income/expense inserts happen (manual, share-import prefill, auto-detect
  prefill all route through it). Confirm transfers go through `lib/transfers.js`
  **instead** (they must NOT earn — excluded from the streak, same discipline).
- `app/(tabs)/index.js` — the `PLACEHOLDER_COINS`/`PLACEHOLDER_FREEZES` chips
  and the `welcomeSubtitle` slot commented "will become dynamic gamification
  content".
- `theme/tokens.js` — `coinGold`, `iceBlue` already reserved; confirm no new
  palette needed for the level line (use `accent`/`ink`).
- The view `security_invoker = true` standing rule; run the security advisor
  after creating the view.

### 2.1 Database
Apply in the Supabase SQL editor. **This block is the durable migration
record** (no migration files in this repo).

```sql
-- === reward_events: the append-only gamification ledger ===
CREATE TABLE reward_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  source     text NOT NULL,          -- 'daily_log' | 'no_spend' | 'milestone'
                                      -- | 'freeze_buy' | 'freeze_used'
                                      -- | 'freeze_comeback' | 'chest' | ...
  ref        text NOT NULL,          -- idempotency key: '2026-07-19',
                                      -- 'milestone:30', a uuid for one-off buys
  coins      integer NOT NULL DEFAULT 0,   -- signed: +earn / -spend
  xp         integer NOT NULL DEFAULT 0,   -- only ever >= 0 (never spent)
  freezes    integer NOT NULL DEFAULT 0,   -- signed: +1 grant / -1 used
  created_at timestamptz DEFAULT now(),
  CONSTRAINT reward_events_once UNIQUE (user_id, source, ref)
);

ALTER TABLE reward_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reward_events"
  ON reward_events FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Covered-dates lookups (Phase 3/4) filter by source; balances scan all rows.
CREATE INDEX idx_reward_events_user_source ON reward_events (user_id, source);

-- === balances view: one row per user, three running totals ===
CREATE VIEW v_reward_balances AS
SELECT
  user_id,
  COALESCE(SUM(coins), 0)   AS coins,     -- spendable = SUM(coins)
  COALESCE(SUM(xp), 0)      AS xp,        -- lifetime, monotonic (never spent)
  COALESCE(SUM(freezes), 0) AS freezes    -- inventory
FROM reward_events
GROUP BY user_id;

ALTER VIEW v_reward_balances SET (security_invoker = true);
```

Verification after applying: insert a `daily_log` row for the current user
(`coins:25, xp:100`), read `v_reward_balances` back (`.maybeSingle()`), confirm
`coins=25, xp=100, freezes=0`; attempt a duplicate `(user_id,'daily_log',ref)`
insert and confirm the unique constraint rejects it; run the **security advisor**
and confirm no new `security_definer_view`.

### 2.2 Data Layer
- **`lib/rewards.js`** (new, pure — no React/Supabase). The single source for
  every tunable number and the level maths. Exports:
  - `REWARDS = { dailyLog: { coins: 25, xp: 100 }, noSpend: { coins: 0, xp: 40 },
    freezeComeback: { coins: 25, xp: 50 } }`
  - `FREEZE_COST = 500`, `FREEZE_CAP = 5` (used Phase 4)
  - `MILESTONE_REWARDS` keyed by streak day (used Phase 5)
  - `levelFromXp(xp)` → `{ level, xpIntoLevel, xpForNext, progress }`. Starting
    curve (tune later): cumulative XP for level L is
    `Math.round(150 * Math.pow(L, 1.6))`; early levels come fast, gaps widen.
  - `RANKS` + `rankFromXp(xp)` (used Phase 5).
  - Ships with unit tests (level monotonic, boundaries, `xp=0 → Lv 1`).
- **`hooks/useRewards.js`** (new) — reads `v_reward_balances` (`.maybeSingle()`,
  defaults to `{coins:0,xp:0,freezes:0}` when no row yet), runs `xp` through
  `levelFromXp`. Subscribes to `useDataRefresh` `version`. Global (no
  account filter) and keyed on `userId` directly (same rule as `useStreak` —
  no `activeAccountId` to force a post-auth refetch, so depend on `userId` or
  the pre-auth empty read is never revisited). Returns
  `{ coins, xp, freezes, level, xpIntoLevel, xpForNext, progress, loading }`.
- **`lib/rewardsMutations.js`** (new) — plain async claim helpers (not hooks),
  each an idempotent upsert with `{ onConflict: 'user_id,source,ref',
  ignoreDuplicates: true }`, then `notifyChanged()` is called by the caller:
  - `claimDailyLog(localDateStr)` → upsert `{ source:'daily_log', ref:localDate,
    coins:REWARDS.dailyLog.coins, xp:REWARDS.dailyLog.xp }`.
  - (Phase 3+ add `claimNoSpend`, Phase 4 add freeze mutations, Phase 5
    `claimMilestone`.)
- **Wiring the earn** — in `AddTransactionSheet.handleSave`, **after a
  successful income/expense insert only** (never for transfers), call
  `claimDailyLog(format(new Date(), 'yyyy-MM-dd'))` then `notifyChanged()`.
  **Why client-side with the local date, not a DB trigger**: the streak buckets
  by the device's *local* day (`streak.js`), but `created_at` is UTC — a
  02:00 IST log is the previous UTC date, so a trigger keying on
  `created_at::date` would claim the wrong day and desync the coin from the
  streak. The client knows the local date; the DB doesn't. The unique key makes
  the repeat-per-day insert a no-op, so calling it on every save is safe.

### 2.3 Components
- No new screen. Edits only:
  - **`app/(tabs)/index.js`** — replace `PLACEHOLDER_COINS` with
    `useRewards().coins` on the header coin chip (keep `PLACEHOLDER_FREEZES`
    until Phase 4). Make the coin chip pressable → opens a minimal **ledger
    history sheet** (below). Render **Money Level** in the `welcomeSubtitle`
    slot: `Level {level} · {xpIntoLevel}/{xpForNext} XP` with a thin
    `ProgressBar` (reuse `components/ProgressBar.js`) at `progress`.
  - **`components/RewardsHistorySheet.js`** (new sheet — full Provider +
    Context + `forwardRef` + **`useSheetBackHandler`** pattern, mandatory).
    A simple read-only list of recent `reward_events` (source label + signed
    coins/xp/freezes + relative date). This is the coin chip's destination;
    the real shop arrives in the cosmetics wave.

### 2.4 Navigation / Integration
- Mount `RewardsHistorySheetProvider` in `app/_layout.js` alongside the other
  sheet providers. Coin chip in Home opens it via `useRewardsHistorySheet()`.

### 2.5 Impact on Existing Features
| Existing | Impact | Watch for |
|---|---|---|
| `AddTransactionSheet.handleSave` | +1 claim call after income/expense insert | Must exclude transfers; must use **local** date; must not block/await-fail the save if the claim errors (fire-and-log) |
| `app/(tabs)/index.js` header | Real coins + new Money Level line | Chip layout already sized for a number; subtitle slot already reserved |
| `lib/transfers.js` | Must **not** call `claimDailyLog` | Transfers are excluded from earning, same as the streak |
| Trophy room (Phase 1) | Unaffected | Trophies still grant nothing yet |

### 2.6 What This Phase Does NOT Include
- No close-the-day UI and no no-spend path yet (Phase 3) — a day is earned
  purely by logging.
- No freeze buying/using (chip stays placeholder; Phase 4).
- No milestone coin/freeze grants (Phase 5).
- No shop/cosmetics (future wave). The history sheet is read-only.

### 2.7 Phase 2 Checklist — Before Marking Complete
- [x] `reward_events` + `v_reward_balances` applied; unique constraint + RLS +
      `security_invoker` verified; security advisor clean (no new finding) —
      confirmed live via Supabase MCP (`gamification_reward_events` migration).
- [x] Logging an income/expense inserts exactly one `daily_log` row per local
      day; a second log the same day does not double-claim (idempotent
      upsert on `UNIQUE (user_id, source, ref)`, only on a genuine new insert
      — never on edit).
- [x] A transfer inserts **no** reward row (the claim lives inside `handleSave`'s
      insert branch only; `handleSaveTransfer` is a wholly separate function
      that never calls it).
- [x] Home coin chip shows the real `SUM(coins)`; Money Level (compact XP
      chip in Home's header + the fuller card in Menu, after the UI iteration
      documented below) shows the right level + XP progress; both update
      after a log (`notifyChanged`). Cross-checked against live DB balances
      for 4 real accounts — level math (`levelFromXp`) confirmed correct.
- [x] `useRewards` returns sane defaults before any events exist (Lv 1, 0/0/0).
- [x] Coin chip opens the read-only history sheet (with back-handler wired).
- [x] `lib/rewards.js` is pure. **Deviation**: no unit tests — same reason as
      Phase 1, this repo has no test framework at all. Verified via Babel
      transform + manual on-device test cases below.

**Code-complete, Babel-verified, migration live-verified; pending your
on-device pass — see Implementation Notes and Test Cases below.**

**→ Stop here. Show the result and wait for approval.**

### Phase 2 — Implementation Notes

Built: migration `gamification_reward_events` (table + policy + index + view,
applied and verified live via Supabase MCP — unique constraint, RLS,
`security_invoker=true`, and a clean security-advisor run all confirmed
before writing any app code against it); `lib/rewards.js` (all constants +
`levelFromXp`/`rankFromXp`, exactly as planned); `lib/rewardsMutations.js`
(`claimDailyLog` only — Phase 3/4/5's claim functions are added when those
phases land, not stubbed early); `hooks/useRewards.js`; `components/RewardsHistorySheet.js`;
wiring in `AddTransactionSheet.js` and `app/(tabs)/index.js`.

**`claimDailyLog` is a plain client-side upsert, not an RPC — deliberately,
and the reasoning is worth recording** because this codebase has exactly one
existing precedent that went the *other* way: `lib/pushToken.js`'s
`registerPushToken` had to go through a `SECURITY DEFINER` RPC because
`push_tokens`' conflict target is the bare `token` column, and the same
physical device can produce the same Expo push token across different
accounts — so a plain upsert could try to "claim" a row already owned by a
different `user_id`, which RLS correctly (but silently) rejects. `reward_events`'
conflict target is `(user_id, source, ref)` — `user_id` is *part* of the key,
so any row a conflict could ever match already belongs to the calling user.
No cross-user RLS gap is possible here; the plain upsert is safe. Documented
inline in `rewardsMutations.js` so this isn't re-litigated as "should this be
an RPC too" later.

**Money Level did NOT replace the `welcomeSubtitle` slot as the doc originally
planned — it's additive, its own row.** `lib/greetings.js`'s 28 day/time
subtitle combinations ("A quiet look before the week ahead," etc.) are real
voice-matched copy, not a placeholder, even though the code comment that used
to sit on `welcomeSubtitle` said "will become dynamic gamification content."
Overwriting that copy felt like the wrong unilateral call to make silently, so
Money Level (`Level {n}` + a slim `ProgressBar` + `{xpIntoLevel}/{xpForNext} XP`,
pressable → opens the same history sheet as the coin chip) landed as a new row
between the welcome row and the account hero carousel instead. Flagging this
explicitly in case the original "replace it" intent was deliberate.

**`RewardsHistorySheet` follows `AlertsSheet`'s chrome, not `AddTransactionSheet`'s** —
every sheet in this app pins a dark background (`staticColors.ink`) except the
one full-form transaction sheet; a read-only feed sheet (this one) is
`AlertsSheet`'s pattern, not the form's. Matched its exact tokens (`inkCard`
tiles, `mutedMid` subtitles, the same close-button treatment) for visual
consistency rather than introducing a new light-chrome sheet variant.

**Money Level's UI moved again, post-backfill, per user feedback** — the Card
placed directly on Home (between the greeting and the account hero) read as
oddly placed: it interrupted the "greeting → your balance" flow with a
gamification metric before the actual point of Home. Settled on a
Play-Store-points shape instead: Home's header gained a third chip (`xpChip`,
next to the coin/freeze `itemStats` strip) showing just the icon (`Star`,
brand-toned) + `{xpIntoLevel}/{xpForNext} XP` — tapping it opens the Menu
sheet. The fuller card (`Award` icon, `Level {n}`, the progress bar) moved
**off Home entirely** and now sits at the top of `MenuSheet.js`, above the Pro
upsell card — Menu was chosen over Settings (the other candidate, which does
have a `profileCard` at its own top) because Menu is opened far more often and
already hosts the Trophies row; gamification depends on visibility, and
Settings is a rarely-visited configuration screen. `ProgressBar`'s `dark` prop
is used inside Menu (pinned-ink chrome), `status="healthy"` on Home's since
that one no longer exists there anymore. **No new screen for Level/Rank** —
discussed with the user: Level alone (one number, one bar) is too thin to
justify a dedicated destination the way `/streak` earns its depth (current,
longest, breaks, a calendar). Once Phase 5 lands the Rank/Title ladder (9
badges), the natural home is a new section on the existing **Trophy Room**
screen, not a fourth destination — trophies and rank are the same "progress"
bucket.

**`MenuSheet` height went from a fixed `'75%'` to content-driven**, raised by
the user once the Level card landed there: a Pro user never sees the upgrade
card, so the sheet had noticeably less content but the same fixed height,
leaving dead dark space at the bottom. Switched to `enableDynamicSizing` + a
`maxDynamicContentSize` ceiling — the sheet measures its actual content and
only grows to the ceiling when there's enough of it. Caught one real bug
enabling this: `styles.sheet` (the content wrapper) had `flex: 1`, which
stretches to fill whatever height it's given rather than reporting its own
natural size — with dynamic sizing that would have silently made the sheet
always snap to the ceiling regardless of actual content, defeating the whole
point. Removed it (added `paddingBottom` in its place).

**Second bug, found by the user on-device**: with *both* the Level card and
the Upgrade-to-Pro card showing (a free account — the tallest real content
case), the Log Out row was pushed below the visible sheet with no way to
reach it, at the original 75% ceiling. Total content (header + Level card +
upgrade card + 6 item rows + divider + Log Out) genuinely exceeded it on real
screens, and the content wrapper was a plain `BottomSheetView` — not
scrollable — so anything past the ceiling was simply unreachable, not just
visually cramped. Fixed two ways: switched to `BottomSheetScrollView` (the
same wrapper `AlertsSheet`/`AddTransactionSheet` already use for their own
variable-length content), so content that ever exceeds the ceiling on any
screen size scrolls instead of clipping; **and** raised the ceiling itself, first
75% → 92% (matching `AddTransactionSheet`'s own fixed snapPoint, the tallest
sheet already in the app), then — per an on-device screenshot showing a still-
visible strip of Home above the sheet's handle with both cards rendered —
92% → 97%, near full-screen.

**Abandoned `enableDynamicSizing` entirely, in favor of a fixed snap height** —
the user flagged that Menu is a *growing* destination (a future store section,
ads placement, etc.), which means content-based sizing was the wrong
long-term fit: every new section added later would mean re-tuning the ceiling
percentage again, exactly the 75%→92%→97% chase this phase just went through.
Switched to a stable `snapPoints={['92%']}` (matching `AddTransactionSheet`'s
own precedent) with `BottomSheetScrollView` doing the real work — whatever
gets added to Menu in the future just scrolls within that fixed frame, and the
sheet's own size never needs revisiting again regardless of how much content
grows. This is the more correct architecture for a menu expected to keep
accumulating sections, versus the Pro/free content-length difference the
dynamic-sizing detour was originally trying to solve.

**Real bug in that same change, caught by the user on-device**: the sheet
still opened at a measured ~70% and only reached the fixed 92% on a further
upward swipe, exactly the dynamic-sizing symptom the fixed height was
supposed to eliminate. Root cause: `enableDynamicSizing` **defaults to
`true`** in the installed `@gorhom/bottom-sheet` version (confirmed in its own
type defs) — simply omitting the prop does not disable it, and every other
sheet in this app sets `enableDynamicSizing={false}` explicitly (a grep across
`components/*.js` confirms it — this file just missed it when the dynamic-
sizing experiment was rolled back). Fixed by adding it back explicitly.

**Log Out pulled out of the scrollable area into a pinned footer**, per
explicit user request — it's a sibling `View` after `BottomSheetScrollView`,
not a row inside it, so it's always reachable at a fixed position regardless
of scroll position or how many sections Menu grows to later. The divider
moved with it into the footer, reading as a persistent separator between "the
scrollable menu" and "the pinned action," not the last scrolling item.

**Converged back to `enableDynamicSizing` + a ceiling — NOT the fixed
`snapPoints={['92%']}` from the previous round.** The fixed height solved the
"content varies" problem in the wrong direction: once Log Out was a pinned
footer at the true bottom of an unconditionally-92%-tall sheet, a typical
account (whose actual content is much shorter than 92%) got a large dead gap
between "Settings" and Log Out — visible in the user's on-device screenshot.
The two earlier framings weren't actually in conflict, and abandoning dynamic
sizing entirely (the previous round's move) was an overcorrection: content
that varies *today* (Pro vs. free) needs dynamic sizing so the sheet shrinks
to fit; content that might grow *later* past any reasonable size (a future
store section, ads) needs a ceiling + scroll fallback. Both are true at once,
so both stayed: `enableDynamicSizing` (no explicit `false` this time — this
sheet is exactly the case where the library's own default is right) sizes the
sheet to its actual rendered content, and `maxDynamicContentSize` (still 92%
of screen height, `AddTransactionSheet`'s precedent — now used as a ceiling,
never a target) is what the `BottomSheetScrollView` falls back to internal
scrolling against once content genuinely exceeds it.

**Final layout is three parts, only the middle one scrolls** — the user's
explicit final spec: the Level card and Upgrade-to-Pro card are status/promo
content, not "menu items" to scroll past, so they moved (with the header) into
a plain, pinned `topSection` View above the `BottomSheetScrollView`; only the
navigation rows (Plans/Budgets/Reports/Bills/Trophies/Settings — the part
that actually grows over time, e.g. a future store section) live inside the
scrollable middle; Log Out stays the pinned footer from before. All three are
flat siblings directly inside `BottomSheetModal` (a standard supported
`gorhom` pattern) — `enableDynamicSizing` measures all three combined to size
the sheet, and only the scrollable middle falls back to internal scroll once
that combined height exceeds `maxDynamicContentSize`.

**Log Out's bottom padding now includes the device's real safe-area inset** —
raised by the user on-device (Log Out sat too close to the 3-button nav bar).
Was a flat `spacing.xl`; now `spacing.xxl + insets.bottom` via
`useSafeAreaInsets()` — the same formula `AccountSwitcherSheet` already uses
elsewhere in this app — rather than a guessed constant, since that inset
varies significantly between gesture-nav and 3-button-nav devices.

**`enableDynamicSizing` abandoned a second time, this time for good** —
combining it with the pinned-top/scroll-middle/pinned-footer layout above
collapsed the sheet down to showing barely one row on-device. Root cause:
dynamic sizing needs the scrollable middle region to report its own natural
content height so the sheet can size around it, but that same region also
needs `flex: 1` to fill the gap between the two pinned regions — those two
requirements directly conflict (`flex: 1` makes a view claim whatever space
its parent gives it rather than report its own natural size), and the
measurement collapsed rather than growing. Without on-device access to
iterate against, further chasing this blind wasn't worth it — reverted to the
one configuration already confirmed correct end-to-end on the user's device
(the screenshot that only complained about the *dead-gap* problem): a plain
fixed `snapPoints={['92%']}` + `enableDynamicSizing={false}`. The three-part
pinned/scroll/pinned structure itself is unaffected and still correct — only
the sizing *mode* reverted. Accepted tradeoff: a Pro account (no Upgrade card)
now shows a bit more empty space in the scrollable region rather than a
shorter sheet — preferring a reliably-full menu over a size-optimized one that
intermittently breaks. The exact line to change if the height ever needs
tuning again is called out inline in the component with a `▼▼▼`/`▲▲▲` marker
comment, precisely so this doesn't need re-deriving from scratch next time.
Confirmed working by the user at `'90%'` (nudged down from 92%).

**Scroll affordance simplified after causing real rendering issues** —
the first attempt tracked the ScrollView's content/viewport height and scroll
offset (`onContentSizeChange`/`onLayout`/`onScroll`) to conditionally show a
"More below" hint only when content genuinely overflowed. The user hit
rendering problems from that state-tracking on-device and asked to drop it
entirely. Replaced with the simplest possible version: `showsVerticalScrollIndicator`
stays on (free, self-hiding when content fits, zero logic), plus a single
always-rendered, very muted static `Text` ("Scroll for more") between the
scrollable region and the footer — no state, no conditionals, no listeners.
Less precise (it's shown even on a short Pro-account menu that doesn't
actually need to scroll) but reliable, which was the explicit tradeoff asked
for.

Also dropped Home's avatar `ProBadge` overlay (the small crown badge) per
user feedback — "distracting"; `ProBadge` itself is untouched and still used
on Settings/Report.

**`freeze_used`/`no_spend`/etc. rows never exist yet** — `SOURCE_LABELS` in
`RewardsHistorySheet.js` maps every source this ledger will *ever* record
(across all 5 phases), not just `daily_log`, so the sheet doesn't need
revisiting when Phase 3/4/5 start writing new sources; an unrecognised source
falls back to the raw string rather than rendering blank.

**One-time historical backfill, applied 2026-07-19** (migration
`gamification_reward_events_backfill`) — raised by the user testing on
`chrisaustin2001@gmail.com`: Phase 2 only earns going forward from when it
shipped, so pre-existing transactions (logged before `claimDailyLog` existed)
paid nothing, leaving an active streak sitting at a 0 balance. Decided **not**
to leave this as forward-only: backfilled a `daily_log` row for every LOCAL
day any user had already logged an income/expense transaction, using each
user's synced `profiles.timezone` (the same local-day discipline
`lib/streak.js` uses client-side) to bucket days server-side. Applied to
**every user with transaction history**, not just the one testing account —
previewed via a dry-run `SELECT` first since it writes real ledger data for
people beyond the reporter. `ON CONFLICT DO NOTHING` (the same unique
constraint every other claim relies on) made it safe to run without checking
for a same-day real claim first. Result: `chrisaustin2001@gmail.com` → 225
coins / 900 XP (9 backfilled days); three other accounts with history
(`chrisaustin11109`, `abishek230102`, `godricgriffindor90`) → 25 coins / 100
XP each (1 day). The 25/100 values are a **frozen snapshot** of
`REWARDS.dailyLog` at backfill time — a later tuning change to that constant
does not retroactively re-price these rows. This was a one-time migration,
not a recurring mechanism — a brand-new user with no prior history has
nothing to backfill and simply starts earning forward from their first log.

---

## Phase 3 — Close the Day

### Goal
The ritual lands. Home gains a **"Today" card**: on a logged day it's an
optional recap ("₹450 across 3 logs · Day closed ✓"); on a day with nothing
logged it offers **"No-spend day"**, which — via one tap — records a `no_spend`
event (**XP, zero coins**) and *holds the streak*. `computeStreak` becomes
covered-dates-aware so a declared no-spend day counts as an engaged day, and
the `frugal` trophy tier (stubbed in Phase 1) starts counting.

### Before Starting — Confirm Phase 2 is Approved
- `lib/streak.js` `computeStreak(rows, now)` current signature and its `days`
  Set construction + the `history` array shape.
- `hooks/useStreak.js` — where it calls `computeStreak`; it will now also fetch
  `no_spend` (and Phase 4 `freeze_used`) dates and pass them in.
- Confirm `todayTotals` (already computed in `computeStreak`) can feed the
  recap so no second aggregation is needed.

### 3.1 Database
**No schema changes.** No-spend is a `reward_events` row
(`source:'no_spend', ref:<localDate>, coins:0, xp:REWARDS.noSpend.xp`) using the
Phase 2 table. Its `ref` (the local date) doubles as the streak-cover signal.

### 3.2 Data Layer
- **`lib/streak.js`** — change signature to
  `computeStreak(rows, coveredDates, now)` where `coveredDates` is a `Set` of
  `yyyy-MM-dd` strings the day is *also* covered by (no-spend now; frozen days
  in Phase 4). Seed the `days` Set from transaction `created_at` **union**
  `coveredDates`. Extend each `history` entry to
  `{ date, logged, covered, type }` where `type ∈ 'logged'|'nospend'|null`
  (Phase 4 adds `'frozen'`) so the calendar can render the *reason* a day is
  lit, never faking one for another. **Keep it pure** — `coveredDates` is
  injected, not fetched inside. Update the 39 existing streak unit tests +
  add no-spend-coverage cases.
- **`hooks/useStreak.js`** — additionally fetch this user's `no_spend` refs
  (within the same 90-day window) and pass them as `coveredDates`. Return the
  new `history[].type` untouched otherwise.
- **`lib/rewardsMutations.js`** — add
  `claimNoSpend(localDateStr)` (idempotent upsert, `coins:0, xp:REWARDS.noSpend.xp`).
- **`hooks/useDayState.js`** (new, small) — derives today's ritual state from
  `useStreak` + a today `no_spend` check:
  `'logged' | 'nospend' | 'open'` (nothing yet) → drives the Today card. Fully
  derived; no new storage.

### 3.3 Components
- **`components/TodayCard.js`** (new plain component, rendered on Home under the
  hero). States:
  - `open` → "Nothing logged yet today." + **[No-spend day]** button (and a
    secondary hint to log). Tapping declares no-spend → `claimNoSpend(local)` +
    `notifyChanged()` → flips to `nospend`.
  - `logged` → recap from `todayTotals` ("₹450 out · 3 logs") + "Day closed ✓"
    + the coins/XP already earned (read from today's `daily_log`). No action
    required (receipt, not toll).
  - `nospend` → "No-spend day — nice. +{xp} XP" + closed check.
  A one-line Koban voice string per state (add to `lib/koban.js`, same rules).
  A confirm on the no-spend tap ("Nothing at all, including cash?") — a
  conscience nudge, not a gate (reuse `Alert.alert`).

### 3.4 Navigation / Integration
- **`app/(tabs)/index.js`** — mount `<TodayCard />` under `AccountHeroCarousel`.
- **`lib/trophies.js`** — the `frugal` tier now receives a real `noSpendDays`
  count (from a `no_spend` count query added to `useTrophies`'s stats).

### 3.5 Impact on Existing Features
| Existing | Impact | Watch for |
|---|---|---|
| `lib/streak.js` | **Signature change** (`coveredDates` arg) | Every caller of `computeStreak` must pass the new arg — grep for it (`useStreak`, its tests, `EMPTY` sentinel in `useStreak`). Its `EMPTY = computeStreak([], new Date())` becomes `computeStreak([], new Set(), new Date())` |
| `hooks/useStreak.js` | +1 fetch (no_spend refs) | Keep the single-refetch-on-userid discipline |
| `StreakCelebration` / `app/streak.js` | Reads `history[].type` | A no-spend day must render distinctly, never as a fake logged flame |
| Trophy room | `frugal` unlocks | Was stubbed at 0 in Phase 1 |

### 3.6 What This Phase Does NOT Include
- No freezes yet (a *missed* day still breaks the streak here — Phase 4 adds the
  rescue). No-spend only covers a day the user **actively declares**.
- No end-of-day push notification changes — the existing server reminder
  (`17-server-push-notifications`) already brings users back; retargeting its
  copy at the ritual is a later, separate tweak.

### 3.7 Phase 3 Checklist — Before Marking Complete
- [x] `computeStreak(rows, coveredDates, now)` is pure. **Deviation**: no unit
      tests exist to update — same reason as Phases 1–2, no test framework in
      this repo. Every call site (`hooks/useStreak.js`'s `EMPTY` sentinel +
      both `fetchStreak` return paths) updated to the new 3-arg signature;
      grepped the whole repo for other callers — none exist.
- [x] Declaring a no-spend day inserts one `no_spend` row (0 coins, XP > 0
      via `REWARDS.noSpend`), holds the streak (union'd into `computeStreak`'s
      continuity set), and is idempotent per local day (same
      `UNIQUE(user_id, source, ref)` upsert pattern as `claimDailyLog`).
- [x] The Today card shows the correct state (open/logged/nospend) and updates
      live after a log or a declaration (`useDayState` derives purely from
      `useStreak`'s own `history`, which already refetches on `notifyChanged`).
- [x] A no-spend day renders as its own calendar state, never a fake flame —
      `StreakFlame`'s `lit` boolean replaced with a `type` union
      (`'logged'|'nospend'|null`, Phase 4 adds `'frozen'`); both callers
      (`app/streak.js`'s month grid, `StreakDays`→`StreakCelebration`)
      migrated, grepped for stragglers.
- [x] Logging still auto-earns coins (Phase 2 path unbroken) — `claimDailyLog`
      wiring in `AddTransactionSheet` untouched by this phase.
- [x] `frugal` trophy tier now counts declared no-spend days — a lifetime
      `no_spend` count query added to `useTrophies.js`'s `fetchStats`
      (unwindowed, matching `txnCount`'s own lifetime-not-windowed treatment).

**Code-complete, Babel-verified across every touched file; pending your
on-device pass — see Implementation Notes below.**

**→ Stop here. Show the result and wait for approval.**

### Phase 3 — Implementation Notes

Built: `lib/streak.js` (signature + history change), `hooks/useStreak.js`
(fetches `no_spend` refs alongside transactions), `lib/rewardsMutations.js`
(`claimNoSpend`), `hooks/useDayState.js` (new, fully derived), `lib/koban.js`
(`todayCardCopy`), `components/TodayCard.js` (new, mounted on Home under
`AccountHeroCarousel`), `components/StreakDays.js` (`StreakFlame`'s `type`
union), `app/streak.js` (month grid reads `type` instead of a boolean),
`hooks/useTrophies.js` (`frugal` wiring). No schema change — `no_spend` is a
new `source` value in the existing `reward_events` table.

**One accepted edge case, not guarded against**: if a user declares no-spend
in the morning and then logs a real transaction later the same day, both
`reward_events` rows persist — they'd earn the no-spend XP *and* the full
logged-day reward for one day, a small XP bonus beyond a normal day. Not
guarded because (a) the golden invariant — no-spend never earns coins — still
holds regardless (only XP, the vanity metric, is affected), and (b) silently
reversing an already-granted reward when someone later logs something is
exactly the "punished for changing your mind" pattern this app's voice argues
against. `useDayState`/the calendar still resolve correctly either way —
`logged` always takes priority over `nospend` in `type`, so the day displays
as a real logged day once a transaction exists, never a stale "nospend" look.

**`todayCardCopy`'s "logged" body is deliberately just a count**
(`"3 logged today."`), not an amount — matches `RECAP_POOLS`' own "no numbers
on a celebration" reasoning in spirit, though this isn't a celebration screen;
kept simple rather than pulling in `formatMoney`/`useCurrency` for a receipt
that's meant to be a quiet acknowledgement, not a mini balance sheet.
`todayTotals` itself is a pre-existing, already cross-account aggregate with
no currency awareness (it summed raw amounts before this phase existed) — not
something this phase introduces or fixes, flagging only because Phase 3 is
the first real consumer of it.

**Added post-build, per user feedback: a custom no-spend confirm dialog and a
"reward burst" earn animation.** Two follow-on pieces, both still Phase 3
scope (the ritual's *feel*, not new mechanics):

- **`TodayCard`'s confirm step moved off `Alert.alert` onto a custom centered
  `Modal`** — the OS system dialog read as generic chrome dropped into an
  otherwise fully-branded app. Reused `ReportPeriodPicker`'s exact shape (the
  one other place in this codebase that already deviates from `Alert.alert`
  for the same reason): transparent fade `Modal`, dismiss-on-backdrop-press,
  an inner `Pressable` that absorbs its own taps so the card doesn't also
  trigger the backdrop dismiss.
- **`components/RewardBurst.js`** (new) — a brief centered "+N coins / +M XP"
  pop-in-then-fade celebration, Provider + imperative-trigger shape identical
  to `components/Toast.js` (`useRewardBurst().showRewardBurst({coins, xp})`),
  mounted in `app/_layout.js` alongside the other app-root providers. Built as
  its own thing rather than a `Toast` variant — a reward is a moment worth a
  beat of pop/spring pageantry, a status message isn't. Reanimated-based
  (`withSpring`/`withTiming`, matching `Confetti`'s own use of the library),
  animate-first/snap-on-reduce like `FadeIn`/`OnboardingReveal` — but unlike
  `Confetti` (purely decorative, renders nothing under reduce-motion), this
  still SHOWS the reward when reduce-motion is on, just without the pop,
  since it conveys real information (what was just earned), not decoration.
- **Wired from both earn sites**: `AddTransactionSheet.handleSave` (on the
  first log of the day) and `TodayCard.declareNoSpend` (on a no-spend
  confirm). Gating "first log of the day" required a real signal that didn't
  exist yet: `claimDailyLog`/`claimNoSpend` in `lib/rewardsMutations.js` now
  chain `.select()` and return `isNewClaim` — with `ignoreDuplicates: true`,
  PostgREST's `RETURNING` only reports rows actually inserted, so an empty
  `data` array means the `(user_id, source, ref)` key already existed and the
  call was a no-op. The burst only fires when `isNewClaim` is true, so
  logging a 2nd/3rd transaction the same day (which correctly earns nothing
  further) never re-triggers the celebration — that would cheapen it into
  background noise instead of marking the one moment it's for.

**Animation ordering bug, found on-device**: `StreakCelebration` (a
full-screen `Modal`) and `RewardBurst` (an absolutely-positioned overlay) can
both fire off the same "logged a transaction" event, and a `Modal` renders in
its own native layer above regular views regardless of JS-side z-index — if
`StreakCelebration` showed while `RewardBurst` was still animating, it
silently hid the burst instead of the two coexisting. Fixed by sequencing
them: `RewardBurstProvider` now exposes `isBursting` (`burst !== null`, true
for the overlay's whole lifecycle including its fade-out) via
`useRewardBurst()`, and `StreakCelebration`'s show-effect gates on
`!isBursting` (added to its dependency array, so it re-evaluates the instant
bursting ends) — without ever marking "already celebrated today" until it
actually decides to show. Coins/XP now always finish first; the streak
takeover follows once the user's acknowledged the burst, never overlapping it.

**`TodayCard` made evening-only + wired to the existing evening nudge, per
user feedback** ("I don't want the Today Card displayed all the time"):

- **The card now only renders past `profile.evening_reminder_time`**
  (default `21:00:00`) — a local `isPastLocalTime()` helper in
  `TodayCard.js` (same `"HH:MM:SS"` parsing precedent as
  `app/settings.js`'s `timeOnTodayFromString`), recomputed on render, no live
  clock (same reasoning `lib/greetings.js`'s `getGreeting` already relies on).
  Before that threshold each day it returns `null`, same as its existing
  loading guards.
- **Reused the existing evening nudge rather than adding a new notification**
  — `send-push`'s `sendNudges()` already fires at exactly
  `evening_reminder_time` and already skips itself if the user's logged
  today, which is precisely "you haven't closed your day yet." The card and
  the notification now agree on what "evening" means by construction, since
  both read the same profile field.
- **The evening nudge now routes to Home instead of `AddTransactionSheet` on
  tap** — `sendNudges()` added `trigger` (`'morning'|'evening'`) to the
  push's `data` payload (redeployed, `send-push` v6); client-side,
  `useNotificationSync`'s `handleResponse` (`lib/notifications.js`) now
  checks `data.trigger === 'evening'` first and routes to `/` in that case,
  falling through to the unchanged `openAdd()` behavior for the morning
  trigger and any other nudge.
- **Found and fixed a related gap while here**: the `has_logged_on_relative_day`
  Postgres RPC (which both decides whether to skip the evening nudge and
  which reminder-copy tone to use) only checked the `transactions` table — a
  user who'd already declared a no-spend day would still get pinged in the
  evening asking them to log something they'd consciously already closed.
  Migration `has_logged_on_relative_day_includes_no_spend` unions in a
  `reward_events` check (`source = 'no_spend'`), matching `lib/streak.js`'s
  own `computeStreak` union (logged OR covered counts as engaged). Verified
  via the security advisor (no new finding).

---

## Phase 4 — Streak Freeze

### Goal
The anchor consumable. Users can **buy** a freeze for 500 coins and **earn**
them from milestones (Phase 5 grants; the shop buy works now). When they open
the app after missing one or more days, a **prompt** offers "use a freeze, or
start over?" — spending 1 freeze per missed day, recording `freeze_used`
(covered dates) + a one-time `freeze_comeback` reward, and holding the streak.
Frozen days render as a distinct **ice tile** in the calendar. A hold cap (5)
keeps freezes scarce enough that the streak keeps its stakes.

### Before Starting — Confirm Phase 3 is Approved
- `computeStreak` now takes `coveredDates` and emits `history[].type` — Phase 4
  adds `'frozen'` to the union and the type.
- `hooks/useRewards` returns `freezes`; `app/(tabs)/index.js` still shows
  `PLACEHOLDER_FREEZES` — this phase wires the real count.
- `components/StreakDays.js` / `app/streak.js` `StreakFlame` — where a day tile
  renders, to add the ice variant (`iceBlue` token already exists).

### 4.1 Database
**No schema changes** — freezes are `reward_events` rows using the Phase 2
`freezes` column:
- Buy: `{ source:'freeze_buy', ref:<uuid>, coins:-FREEZE_COST, freezes:+1 }`
- Use: one row per covered date
  `{ source:'freeze_used', ref:<missedLocalDate>, freezes:-1 }`
- Comeback (one-time per return): `{ source:'freeze_comeback', ref:<returnDate>,
  coins:REWARDS.freezeComeback.coins, xp:REWARDS.freezeComeback.xp }`

`freeze_used` refs are the covered dates fed to `computeStreak`.

### 4.2 Data Layer
- **`lib/rewardsMutations.js`** — add:
  - `buyFreeze()` — guard `coins >= FREEZE_COST` **and** `freezes < FREEZE_CAP`
    (read current balance first); insert the buy row; `notifyChanged()`.
  - `useFreezeForDates(missedDates, returnDateStr)` — guard
    `freezes >= missedDates.length`; insert the `freeze_used` rows **and** the
    single `freeze_comeback` row (idempotent by `returnDate`); `notifyChanged()`.
- **`hooks/useStreak.js`** — also fetch `freeze_used` refs and merge into
  `coveredDates`; `history[].type` gets `'frozen'` for those dates.
- **`hooks/useMissedDays.js`** (new, small) — derives the list of *unresolved
  missed days* (gap days between last activity and today not yet covered) so the
  return prompt knows what it's offering to freeze and how many tokens it costs.

### 4.3 Components
- **`components/FreezePrompt.js`** (new) — the return prompt. Shown once when a
  recoverable gap exists and the user has ≥1 freeze. "You missed {n} day(s).
  Use {n} freeze(s) to keep your {current}-day streak, or start over?" →
  **[Use freeze]** (calls `useFreezeForDates`) / **[Start over]** (dismiss; the
  streak resets naturally on next log). Honest when tokens < missed days
  ("covers 1 of 2 — streak still resets"). Use `Alert.alert` or a small
  `Modal` matching `ReportPeriodPicker`'s dialog style (not a bottom sheet).
  Presented from a side-effect component at the app root (the
  `ShareIntentHandler`/`OnboardingGate` pattern) so it can fire on app-open.
- **Freeze buy** — a **[Buy freeze · 500]** action inside
  `RewardsHistorySheet` (Phase 2) or the freeze chip's tap. Confirm + guard +
  `buyFreeze()`. (Full shop is a later wave; this is the one consumable.)
- **Calendar ice tile** — extend `StreakFlame`/the calendar cell to render a
  `'frozen'` day as an ice motif (`iceBlue`), visibly different from a lit flame
  and an empty day. **The calendar must not lie** — a frozen day is neither
  "logged" nor "missed".

### 4.4 Navigation / Integration
- **`app/(tabs)/index.js`** — freeze chip now shows `useRewards().freezes`
  (replace `PLACEHOLDER_FREEZES`); make it pressable (buy/confirm).
- Mount the freeze-prompt side-effect component in `app/_layout.js`.

### 4.5 Impact on Existing Features
| Existing | Impact | Watch for |
|---|---|---|
| `computeStreak` `coveredDates` | Now also frozen dates | Union order irrelevant; `type` precedence: logged > frozen > nospend for display |
| Home freeze chip | Real count | Layout already sized |
| `app/streak.js` calendar | New ice tile state | Distinct from flame + empty; reduce-motion safe |
| App root | New on-open prompt | Only fire when a *recoverable* gap exists and tokens ≥ 1; never nag on a clean streak |

### 4.6 What This Phase Does NOT Include
- No milestone-granted freezes yet (Phase 5 — buying works now).
- No "streak repair" of an already-dead streak (that's chest-exclusive, a later
  wave — deliberately not a shop item).
- No planned "vacation/pause" mode (future, if ever).

### 4.7 Phase 4 Checklist — Before Marking Complete
- [x] Buying a freeze debits 500 coins, +1 freeze, and is blocked at the cap
      (5) and on insufficient coins — `buyFreeze()` reads the live balance
      first and guards both ends before inserting.
- [x] The return prompt appears only for a recoverable gap with ≥1 freeze; using
      it records `freeze_used` per day + one `freeze_comeback`, holds the streak.
- [x] `computeStreak` treats frozen dates as covered; the calendar shows them as
      ice (`Snowflake`, `iceBlue`/`iceBlueBg`), never a flame or an empty tile.
- [x] Freeze chip shows the real count (`useRewards().freezes`) and the whole
      `itemStats` strip opens `RewardsHistorySheet`, where buying now lives.
- [x] Hold cap enforced (`buyFreeze`); comeback reward is one-time per return
      (idempotent upsert, same `UNIQUE(user_id, source, ref)` shape as every
      other claim in this ledger).

**Code-complete, Babel-verified across every touched file; pending your
on-device pass — see Implementation Notes below.**

**→ Stop here. Show the result and wait for approval.**

### Phase 4 — Implementation Notes

Built: `lib/rewardsMutations.js` (`buyFreeze`, `useFreezeForDates`, a shared
`uuidv4()` matching `lib/transfers.js`/`lib/receipts.js`'s own),
`hooks/useMissedDays.js` (new, fully derived from `useStreak`'s
`daysSinceLastLog`/`history` — no new query), `components/FreezePrompt.js`
(new, mounted at the app root, same `DueBillsModal`-style "once per mount,
once per day via AsyncStorage" shape), `components/RewardsHistorySheet.js`
(gained the freeze shop card), `app/(tabs)/index.js` (freeze chip wired to
`useRewards().freezes`, `PLACEHOLDER_FREEZES` deleted). No schema change —
`freeze_buy`/`freeze_used`/`freeze_comeback` are new `source` values in the
existing `reward_events` table.

**`coveredDates` upgraded from a `Set<string>` to a `Map<string, 'nospend' |
'frozen'>`** — the real signature change this phase needed. Phase 3's `Set`
only had to answer "is this date covered"; Phase 4 needs "covered by *what*"
so `history[].type` can render a genuinely distinct ice tile instead of
reusing the no-spend green. `hooks/useStreak.js` builds the Map by inserting
no-spend refs first, then frozen refs — insertion order enforces the
documented `logged > frozen > nospend` display precedence for the rare date
that's somehow both (a Map's later `.set()` on an existing key overwrites).
`lib/streak.js`'s `EMPTY` sentinel and every `computeStreak` call site updated
to pass `new Map()` instead of `new Set()`; grepped the repo for stragglers —
none.

**`useMissedDays` derives the missed-day count from `daysSinceLastLog`, not by
walking `history` for uncovered days directly** — a naive backward walk over
the full 42-day window would, for any account younger than that, treat the
days before the account even existed as "missed," producing an absurd "you
missed 41 days" prompt for a brand-new user. `daysSinceLastLog` is already
bounded by real activity (`Infinity` for an account with zero covered days
ever), so gating on it first (`!Number.isFinite` → empty list) avoids the bug
by construction rather than a special case.

**Partial coverage always uses the dates closest to today, never the oldest**
— `FreezePrompt` slices `missedDates.slice(-coverCount)` when `freezes <
missedDates.length`. This isn't cosmetic: `computeStreak`'s `current` only
extends backward from today through a *contiguous* covered run, so freezing
the oldest missed days (leaving a gap right before today) would spend real
freezes for zero streak benefit. Freezing the days nearest today is the only
subset that actually helps `current`, even partially.

**Buy-freeze confirm uses `Alert.alert`, not a custom dialog** — a deliberate
difference from `TodayCard`'s no-spend confirm (which the user explicitly
asked to move off the system dialog). That request was specific to the
ritual's own "moment"; a shop purchase confirm is closer to this app's
existing default register (`Alert.alert` for confirmations/errors, per this
skill's own conventions) and didn't carry the same complaint. Revisit if the
user wants the shop's own visual language later — this wave (Phase 4) is
scoped to the freeze as a plain transactional buy, not shop chrome.

---

## Phase 5 — Milestone Grants + Rank / Title

### Goal
Close the loop. The existing streak **milestones** (`MILESTONES`) now pay out:
crossing day 3/7/10/30/50/100 grants coins (and freezes at 7/30/100),
idempotently, claimed when the celebration fires. And the XP a user has been
banking since Phase 2 gets its **identity**: a **Rank** (Saver → Money Master)
with a badge, shown over Money Level, with a rank-up moment when a threshold is
crossed.

### Before Starting — Confirm Phase 4 is Approved
- `lib/streak.js` `isMilestone` + `current`; `components/StreakCelebration.js`
  — where the milestone celebration fires (the natural claim point).
- `lib/rewards.js` `MILESTONE_REWARDS`, `RANKS`, `rankFromXp` (defined in
  Phase 2, wired here).
- Where Money Level renders (Home subtitle, Phase 2) — Rank sits alongside it.

### 5.1 Database
**No schema changes.** Milestone payouts are `reward_events`
(`source:'milestone', ref:'milestone:<day>'`, carrying that day's coins/freezes
from `MILESTONE_REWARDS`), idempotent by `ref` so a milestone pays exactly once
ever — even if the celebration is re-triggered or the streak is re-derived.

### 5.2 Data Layer
- **`lib/rewardsMutations.js`** — `claimMilestone(day)` → upsert the
  `milestone:<day>` row with `MILESTONE_REWARDS[day]` (coins + freezes),
  respecting `FREEZE_CAP` for the freeze portion; `notifyChanged()`.
- **`lib/rewards.js`** — finalize `RANKS` (`[{ id, title, minXp, badge }]` —
  Saver/Bookkeeper/Steward/Strategist/Treasurer/Financier/Tycoon/Magnate/
  Money Master) and `rankFromXp(xp)` → `{ current, next, xpToNext }`. Badges
  are Lucide-icon + tier-colour tokens (no custom art), upgradeable later.

### 5.3 Components
- **`components/StreakCelebration.js`** — on a milestone, call
  `claimMilestone(current)` (idempotent) and surface the reward in the existing
  celebration ("+400 coins · +1 freeze") — no new screen.
- **Rank display** — a small **RankBadge** next to the Money Level line on Home
  (and optionally on `app/streak.js`). A **rank-up** is detected client-side
  when `rankFromXp` crosses a threshold; reuse `Confetti`/the celebration
  convention for the moment (reduce-motion aware).
- **Rank ladder view** — a lightweight section (in the trophy room or a small
  pushed screen) showing the 9 ranks, current highlighted, next threshold. Reuse
  the trophy-room tile grammar; no new infra.

### 5.4 Navigation / Integration
- Home subtitle shows `Rank · Level {n}`; the badge taps through to the ladder.
- Milestone claim is invisible plumbing inside the existing celebration flow.

### 5.5 Impact on Existing Features
| Existing | Impact | Watch for |
|---|---|---|
| `StreakCelebration.js` | +1 idempotent claim + reward line | Must not double-pay if shown twice — `ref` guards it |
| Home subtitle | +Rank badge beside Money Level | Keep it one tidy line |
| Trophy room | Optional rank-ladder section | Reuse tile grammar |
| Freeze cap (Phase 4) | Milestone freeze grants respect it | Overflow grants are lost, not banked |

### 5.6 What This Phase Does NOT Include
- No chests (deterministic pick-1-of-3) — a later wave; `source:'chest'` is
  reserved in the ledger but unused here.
- No cosmetics/themes/shop (future wave; the money-account-scoped equipped-theme
  decision lives there).
- No leaderboard — XP is built leaderboard-*ready* (privacy-safe) but the board
  stays parked (farmable), per `IDEAS-gamification.md`.

### 5.7 Phase 5 Checklist — Before Marking Complete
- [x] Crossing each milestone pays its coins/freezes exactly once (idempotent by
      `ref: 'milestone:<day>'`, forever — not a daily key), surfaced in the
      existing celebration as a coin-toned reward pill.
- [x] Milestone freeze grants respect the hold cap — `claimMilestone` reads the
      live balance and clamps the grant to whatever room is left, dropping the
      overflow rather than queueing it.
- [x] Rank shows correctly for the user's lifetime XP (`rankFromXp`, read from
      `MenuSheet`'s levelCard and the Trophy Room's rank section); a rank-up
      fires a moment (`RankUpCelebration`, root-mounted, once per rank ever).
- [x] The rank ladder lists all 9 ranks with the current one highlighted —
      Trophy Room's new "Rank" section, reusing the trophy-row grammar exactly.
- [x] No double-pay when a celebration/streak re-renders — `claimMilestone`'s
      idempotency is enforced by the DB constraint (`ref`), not by the
      AsyncStorage "already shown today" guard, which is presentational only.

**Code-complete, Babel-verified across every touched file; pending your
on-device pass — a real milestone hit (earliest testable: day 3) is needed to
exercise the payout + celebration reward line end to end; a rank-up needs
real XP accumulation (or a manual `test_grant`-style credit, same mechanism
already used to fund `chrisaustin11109`'s freeze testing) to reach the first
1,500 XP threshold.**

**→ Stop here. Show the result and wait for approval.**

### Phase 5 — Implementation Notes

Built: `lib/rewards.js` (`RANKS` gained `badgeColor` per tier — a placeholder
palette for real illustrated badges later, not a final art direction),
`lib/rewardsMutations.js` (`claimMilestone`), `components/StreakCelebration.js`
(claims the milestone and surfaces a "+coins · +freezes" reward pill),
`components/MenuSheet.js` (levelCard now shows `{rank.title} · Level {n}`
with the Award icon tinted to the rank's badge colour), `app/trophies.js`
(new "Rank" section, reusing the trophy-row grammar exactly, per the doc's
own instruction), `components/RankUpCelebration.js` (new, root-mounted). No
schema change — `milestone` is a `source` value the ledger already had room
for.

**Rank display landed in `MenuSheet`/Trophy Room, not "Home subtitle"** — the
original 5.3/5.4 spec above predates Phase 3's UI pivot (Money Level itself
already moved off Home's subtitle into Menu's levelCard that phase, per user
feedback — see Phase 2's own Implementation Notes). Rank followed the same
already-established split rather than reintroducing a Home subtitle that no
longer exists: the compact XP chip stays in Home's header (unchanged, no rank
info added there — it was already tight), the full rank identity (title +
badge + level + progress) lives in Menu's levelCard, and the full ladder (all
9 ranks) lives in the Trophy Room, one tap from Menu via the Trophies row —
matching the doc's own "or optionally on app/streak.js" flexibility and
"reuse the trophy-room tile grammar" instruction, just resolved toward Trophy
Room specifically since it already has the exact row grammar to reuse
verbatim.

**`RankUpCelebration` is deliberately smaller than `StreakCelebration`** — a
light card on a dark overlay (Confetti + the same family `FreezePrompt`/
`DueBillsModal` already use), not a full-screen ink takeover. Rank-ups are
rare enough (first threshold 1,500 XP, ~15 logged days minimum at the
illustrative 100 XP/day rate) that they don't need daily-celebration-level
production, and a full-screen Modal here would also reopen the exact
Modal-hides-Modal risk `RewardBurst`/`StreakCelebration` already had to be
sequenced around in Phase 3 — deliberately avoided by keeping this a
lighter-weight dialog instead of another full-screen layer to coordinate.

**One-time-per-rank, not per-day** — `RankUpCelebration`'s AsyncStorage key
stores the highest rank *id* ever seen (`flo.rank.lastSeen.${userId}`), not a
date, since crossing a rank is a lifetime event, unlike
`StreakCelebration`/`FreezePrompt`'s "once today" keys. The first-ever check
for a user is treated as "welcome to Saver," not a rank-up (everyone starts
there by construction, `minXp: 0`) — silently recorded, never celebrated.

**Post-build fix, found on-device: the XP display looked like it "reset" on
every level-up.** With 6,240 lifetime XP at Level 10, the Menu levelCard read
"268/983 XP" — technically correct (progress *into* the current level, which
starts back at 0 every level), but confusing sitting right next to a Rank
badge that represents the *same* number never going down. `lib/rewards.js`'s
`levelFromXp` gained a new field, `nextLevelAt` (the absolute lifetime-XP
threshold for the next level — e.g. 6,955, not a delta) — every DISPLAY site
now pairs it with the real lifetime `xp` (`useRewards().xp`) instead of the
level-relative `xpIntoLevel`/`xpForNext` pair, so the fraction shown is
"6,240/6,955," a number that only ever climbs. `xpIntoLevel`/`xpForNext`
still exist (the progress BAR's fill math is unaffected either way — same
ratio, just not what's printed as text) but are no longer read by any
component for display text; grepped the repo to confirm. Fixed in both
consumers: `app/(tabs)/index.js`'s header chip and `MenuSheet.js`'s levelCard.

**Home's header reshuffled twice in quick succession, both per user
feedback** — first Level joined the existing coins/freezes `itemStats` chip
(to reduce header crowding from a separate pill), then moved back OUT to its
own chip seconds later once a bare "⭐ 10" proved unclear (unlike coins/
freeze/streak, whose icon alone already says what the number is) and adding
a "LVL" label to disambiguate needed more room than fit as a third entry.
Net result: `itemStats` stays coins+freezes only (back to its Phase 4 shape);
a new `levelChip` — same 44-tall bordered-pill grammar, `⭐ LVL {n}` — sits
beside it, opening Menu. One real bug caught mid-reshuffle: the first attempt
nested a `Pressable` (Level) inside another `Pressable` (the coins/freezes
tap area) to keep everything in one chip — ambiguous touch handling, not a
pattern to lean on for two genuinely different destinations. Restructured to
two sibling Pressables before it ever shipped that way.

---

## Data Model Summary (Final State After All Phases)

```
                         (existing)
  transactions ──┐
   (income/       │  logging a txn → client claims (local date)
    expense)      ▼
             reward_events  ──────────►  v_reward_balances
             (append-only ledger)         coins  = Σ coins  (spendable)
               source, ref (unique)       xp     = Σ xp     (monotonic → Level/Rank)
               coins / xp / freezes        freezes = Σ freezes (inventory)
                    │
                    │ source ∈ {no_spend, freeze_used}  → ref = covered date
                    ▼
             computeStreak(rows, coveredDates, now)   [pure]
                    │
                    ▼
             streak + history[].type (logged | nospend | frozen)

  lib/rewards.js (pure)   xp → level (curve) ; xp → rank (thresholds)
  lib/trophies.js (pure)  existing data → earned/locked trophies
```

### `reward_events` — Schema
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, `default gen_random_uuid()` |
| `user_id` | uuid | `NOT NULL DEFAULT auth.uid()` → `auth.users`, `ON DELETE CASCADE`, RLS |
| `source` | text | `NOT NULL` — `daily_log`/`no_spend`/`milestone`/`freeze_buy`/`freeze_used`/`freeze_comeback`/`chest`/… |
| `ref` | text | `NOT NULL` — idempotency key (local date, `milestone:30`, a uuid) |
| `coins` | integer | `NOT NULL DEFAULT 0`, signed (+earn/−spend) |
| `xp` | integer | `NOT NULL DEFAULT 0`, only ever ≥ 0 (never spent) |
| `freezes` | integer | `NOT NULL DEFAULT 0`, signed (+grant/−used) |
| `created_at` | timestamptz | `default now()` |
| — | — | `UNIQUE (user_id, source, ref)` — the idempotency guarantee |

No `updated_at` (append-only — rows are never edited, only inserted). Fully
consistent with FLO's no-`updated_at` convention.

### `v_reward_balances` — Computed Read
`SELECT user_id, SUM(coins) AS coins, SUM(xp) AS xp, SUM(freezes) AS freezes
FROM reward_events GROUP BY user_id`, `security_invoker = true`. Returns no row
for a user with zero events — read with `.maybeSingle()`, default to zeros.

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| `lib/streak.js` / `computeStreak` | Signature gains `coveredDates`; `history` gains `type` | Update every caller + all 39 existing tests (Phase 3) |
| `hooks/useStreak.js` | +fetch of `no_spend` + `freeze_used` refs | Keep single-refetch-on-`userId` discipline |
| `AddTransactionSheet.js` | +`claimDailyLog` after income/expense insert | Exclude transfers; use **local** date; never fail the save on a claim error |
| `lib/transfers.js` | Must NOT earn | No claim call on transfer legs |
| `app/(tabs)/index.js` | Real coin + freeze chips, Money Level + Rank, Today card | Placeholder slots already reserved |
| `components/StreakCelebration.js` | +idempotent milestone claim | `ref` guards double-pay |
| `app/streak.js` calendar | New nospend + frozen tile states | Calendar must not lie |
| `MenuSheet.js` | +Trophies row | Match existing row grammar |
| `lib/koban.js` | +close-the-day voice lines | Same terse voice rules |

---

## Out of Scope (All Phases)

- **Cosmetics / card themes / calendar skins / mascot skins / app icons** —
  the whole cosmetics wave, incl. the **shop** and the **money-account-scoped
  equipped-theme** decision. Future doc.
- **Milestone chests** (deterministic pick-1-of-3) — `source:'chest'` reserved
  in the ledger, unused here. Future wave.
- **Weekly quests** — no earn source in this build (per the finalized model).
- **Leaderboard** — XP built leaderboard-ready (privacy-safe) but parked
  (farmable), per `IDEAS-gamification.md`.
- **Streak repair** (reviving a dead streak) — chest-exclusive later, never a
  shop item. Deliberately absent.
- **Planned vacation / pause** — future, if ever.
- **IAP / dual-track cash purchases / Pro cosmetic line** — post store-launch,
  RevenueCat, per `IDEAS-subscription-and-store.md`.
- **End-of-day notification retargeting** — the existing server reminder already
  returns users; recopying it at the ritual is a later tweak, not this build.
- **Exact number tuning** — all values live in `lib/rewards.js`; the four
  invariants are fixed, the numbers are a slider (`IDEAS-gamification.md`).
