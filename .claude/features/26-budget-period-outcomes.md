# Feature: Budget Period Outcomes (& unlocking Budget Keeper)
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/26-budget-period-outcomes.md`
**Status**: Planned
**Last Updated**: 2026-07-22

---

## Context

**Budget Keeper is the last genuinely unbuilt trophy group in the app.** Its
four tiles ("Kept 1 / 3 / 6 / 12 Periods") have shipped in the Trophy Room
catalogue since `18-gamification-ritual-and-ledger.md` Phase 1, and gained
illustrated badge art in commit `9d01dbb` — but the mechanic behind them has
never existed. `hooks/useTrophies.js` hard-codes `keptBudgetPeriods: null`,
which `evaluateTrophies` reads as a `locked` sentinel, so all four tiles render
a permanent "Coming soon."

`18` recorded this as a **real blocker, not a deferral**: `v_budgets_with_spent`
only ever exposes the *current* period's `spent`/`amount`, and a
`calendar_week`/`calendar_month` budget recurs forever with no stored record of
whether last period was kept. It listed three options — (a) a table logging each
period's outcome, (b) descope to ended-custom-budgets only, (c) drop the group —
and explicitly left the decision open.

**This doc picks (a), and records why the cheaper option was rejected.** There
is in fact a fourth option `18` never considered: `computeBudgetPeriods()` in
`lib/analytics.js` already reconstructs every past period of a recurring budget
from raw transactions (it powers Analytics' budget graphs and `app/report.js`).
Budget Keeper *could* be computed today with no schema change at all.

It is rejected because **this trophy pays**. A recomputed-from-current-state
metric derives "was this period kept?" from `budget.amount` **as it is right
now**, which makes the reward trivially farmable:

> Raise a monthly budget's amount to ₹9,99,999 → every past period
> retroactively becomes "kept" → claim all four tiers → set it back.

No bug required; entirely normal app behaviour. And because `reward_events` is
append-only and `claimTrophy` is idempotent, the payout is **permanent and
un-clawable**. A recognition-only trophy can tolerate a soft metric; a paying
one cannot. So the outcome of each period must be **stamped once, when the
period closes, with the amount in force at that moment** — a historical fact,
immune to later edits.

The table also outlives the trophy: a real record of how a budget has performed
period-over-period is something Budget Detail (`app/budget/[id].js`) cannot show
today.

---

## Phase Overview

```
Phase 1 — The outcomes ledger
  A new `budget_period_outcomes` table plus a lazy, idempotent client-side
  writer that stamps any budget period which has ENDED and isn't yet
  recorded. No UI. Nothing consumes it yet.

Phase 2 — Unlock Budget Keeper
  useTrophies reads the ledger, `keptBudgetPeriods` stops being null, the
  four tiles go live, and TROPHY_REWARDS gains its budget_keeper entries so
  they actually pay.
```

**After each phase: stop and wait for approval before proceeding.**

Deliberately two phases: Phase 1 is invisible and must be allowed to
accumulate real closed periods before Phase 2's tiles can show anything
truthful. Shipping both at once would light up a trophy group with an empty
ledger behind it.

---

## Phase 1 — The Outcomes Ledger

### Goal

Every budget period that has ended gets exactly one immutable row recording
whether it was kept, the amount that was in force, and what was actually spent.
Written lazily on app open, idempotently, for every account the user owns. No
user-visible change whatsoever at the end of this phase — this is the
foundation Phase 2 reads.

### Before Starting — Confirm With Codebase

- `lib/analytics.js` `computeBudgetPeriods(budget, transactions, from, to)`
  (~line 149) — returns `{ periodStart, periodEnd, spent, limit, status }` per
  period, walks `calendar_week`/`calendar_month` forward from `from`, handles
  `custom` as a single non-recurring range, and **already filters out periods
  ending before `budget.created_at`** (`!isBefore(p.end, createdAt)`) so it
  cannot invent history from before the budget existed. Confirm that filter is
  still present — Phase 1 depends on it.
- `hooks/useBudgets.js` `budgetStatus(spent, amount)` — returns
  `'over'` / `'warn'` / `'healthy'`; over is strictly `ratio > 1`, and
  **`amount <= 0` short-circuits to `'healthy'` regardless of spend**. Read it
  to confirm that boundary, but **do not call it** from the writer — 1.2
  computes `kept` explicitly and explains why. Being at 99% of your budget is
  keeping it; a ₹0 budget is not.
- `lib/budgets.js` — `budgetPeriodDates`, `isBudgetEnded`, `previewPeriodDates`.
  Check whether any of these already answers "has this period ended" before
  writing a new predicate.
- `app/_layout.js` — the headless `<Stack>`-sibling pattern
  (`ShareIntentHandler`, `TimezoneSync`, `NotificationSync`, `PushTokenSync`).
  Phase 1's writer is the next instance of it; confirm the provider nesting
  it needs (`useAuth`, `useDataRefresh`) is available at that position.
- `lib/rewardsMutations.js` — the house style for a mutation module (plain
  async exported functions, `supabase` imported directly, caller runs
  `notifyChanged()`). Phase 1's writer follows it.
- The **`user_id DEFAULT auth.uid()` standing rule** in `00-index.md` — omitting
  it makes every insert fail with a *misleading* RLS-policy error rather than a
  NOT NULL error. Verify against an existing table's
  `information_schema.columns`, not from memory.

### 1.1 Database

One new table. No view (Phase 2 aggregates client-side — see 2.2 for why).

```sql
-- === budget_period_outcomes: an append-only record of closed budget periods ===
-- 26-budget-period-outcomes.md Phase 1.
--
-- One row per (budget, period) the moment that period has ENDED. Deliberately
-- a stamped historical fact, never recomputed: `amount` and `spent` are frozen
-- at close time so that later edits to the budget (or to past transactions)
-- cannot retroactively change whether a period was kept. That immutability is
-- the whole point — Budget Keeper pays real coins/XP, and a recomputable
-- metric would be farmable by temporarily raising a budget's amount.
Migration name for the record: **`budget_period_outcomes`**.

```sql
CREATE TABLE budget_period_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Deliberately NOT a foreign key to budgets(id): this is a historical
  -- ledger, and an ON DELETE CASCADE would let deleting a budget silently
  -- erase trophy progress that was already earned. Same reasoning (and the
  -- same shape) as reward_events' unconstrained `ref` column.
  budget_id uuid NOT NULL,
  account_id uuid NOT NULL,
  -- Stamped because a budget's period_type IS editable after creation
  -- (AddBudgetSheet loads it into state and writes it back on save). Without
  -- this column, switching a budget from calendar_week to calendar_month
  -- would make computeBudgetPeriods re-walk the SAME elapsed time on a
  -- different grid, producing a second, overlapping set of period_starts —
  -- which the UNIQUE constraint would happily accept, letting one budget's
  -- history be counted twice. Phase 2's run computation groups on
  -- (budget_id, period_type) so the two grids never merge into one run.
  period_type text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount numeric NOT NULL,   -- the limit in force when the period closed
  spent numeric NOT NULL,    -- what was actually spent in it
  kept boolean NOT NULL,     -- see 1.2 — NOT a blind budgetStatus() delegate
  created_at timestamptz NOT NULL DEFAULT now(),
  -- The idempotency guard. The writer runs on every app open and re-offers
  -- every closed period it finds; this is what makes that safe, and what
  -- makes two devices syncing simultaneously harmless.
  CONSTRAINT budget_period_outcomes_once UNIQUE (budget_id, period_start),
  -- A zero/negative limit must never reach this table. budgetStatus()
  -- short-circuits `amount <= 0` to 'healthy', so a ₹0 budget would record
  -- kept = true no matter how much was spent against it — a slow but real
  -- farm for a trophy that pays. AddBudgetSheet already rejects it client-
  -- side (handleSave, `numericAmount <= 0`); this is the half that survives
  -- a future code path that forgets to.
  CONSTRAINT budget_period_outcomes_amount_positive CHECK (amount > 0),
  CONSTRAINT budget_period_outcomes_range CHECK (period_end >= period_start)
);

ALTER TABLE budget_period_outcomes ENABLE ROW LEVEL SECURITY;

-- (select auth.uid()) per the standing rule — a bare auth.uid() re-evaluates
-- per row and trips the performance advisor's auth_rls_initplan warning.
CREATE POLICY "Users manage own budget_period_outcomes"
  ON budget_period_outcomes FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Phase 2's read is "all my outcomes, grouped by budget, in period order".
CREATE INDEX idx_budget_period_outcomes_user_budget
  ON budget_period_outcomes (user_id, budget_id, period_start);

-- Clock-skew guard. "Has this period ended?" is decided on the DEVICE, against
-- its own local today — and a device with a fast clock (or a user who sets the
-- date forward) would stamp a period that hasn't actually finished, freezing a
-- partial-spend verdict permanently. This is the server having the last word.
-- It cannot be a CHECK constraint: CHECK expressions must be IMMUTABLE, and
-- current_date is not.
CREATE FUNCTION public.guard_budget_period_closed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.period_end >= current_date THEN
    RAISE EXCEPTION 'budget period % has not ended yet (period_end %)',
      NEW.budget_id, NEW.period_end;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER budget_period_outcomes_closed_only
  BEFORE INSERT ON budget_period_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.guard_budget_period_closed();
```

**Note on the trigger vs. the settling delay (1.2)**: the trigger is a
*correctness floor* (never stamp an unfinished period), not the settling
policy. The client waits `SETTLE_DAYS` beyond that floor. If the two ever
disagree, the trigger wins and the write fails loudly — which is the desired
direction for a permanent record.

**No backfill.** Verified live via MCP on 2026-07-22: all four existing budgets
were created between 2026-07-14 and 2026-07-20, and neither `calendar_month`
budget has completed a month — **there are zero closed periods to backfill**.
A backfill migration would insert nothing. Recorded here so a future session
doesn't re-litigate it; if this feature is ever built against a database with
real history, revisit deliberately (a one-time backfill via
`computeBudgetPeriods` is safe *once*, at a known moment — the exploit needs the
recompute to be ongoing).

### 1.2 Data Layer

**New: `lib/budgetOutcomes.js`** — mutations + the close-out computation.

- **`SETTLE_DAYS = 3`** — a period is not stamped until **3 days after it
  ends**. This is not caution for its own sake: the row is immutable, and
  people log yesterday's spending today. Stamping July the instant August
  begins freezes a verdict that a Aug-2 back-dated entry (`occurred_at` is a
  user-chosen date, not `created_at`) would have changed — permanently, and
  always in the *user's favour*, since late entries can only add spend. Three
  days is the cheapest fix for the single most likely way this feature would
  quietly tell someone they kept a budget they didn't. Tunable, but never 0.
- `closedPeriodsFor(budget, transactions, today)` — pure. Returns the periods
  of one budget that ended **more than `SETTLE_DAYS` ago**, each as
  `{ periodStart, periodEnd, spent, amount, kept, periodType }`. Implemented by
  delegating to `computeBudgetPeriods(budget, transactions, from, to)` and
  dropping the still-open and still-settling trailing periods — **do not
  re-derive period boundaries here.** `computeBudgetPeriods` is already in
  lockstep with Postgres's ISO `date_trunc('week')` (`weekStartsOn: 1`), and a
  second implementation would eventually disagree with `v_budgets_with_spent`
  about the same week by a day. `from` = the budget's `created_at`;
  `to` = today.
- **`kept` is computed explicitly here, not delegated blindly**:
  `kept = amount > 0 && spent <= amount`. It deliberately does *not* just call
  `budgetStatus(spent, amount) !== 'over'`, for two reasons: that function
  short-circuits `amount <= 0` to `'healthy'` (so a ₹0 budget would record as
  kept — see the CHECK constraint in 1.1), and its `warn`/`healthy` thresholds
  exist to colour a progress bar. Retuning that bar someday must not silently
  redefine what a trophy means. The *policy* — at-or-under the limit is kept,
  including a period that ended at 99% — stays identical to today's
  `'over'` boundary (`ratio > 1`).
- `syncBudgetOutcomes()` — the writer. For the signed-in user:
  1. Fetch **all** the user's budgets — **not** filtered by `activeAccountId`
     (trophies are lifetime and user-scoped; a budget in a non-active account
     still counts). Skip any budget with `amount <= 0` before computing
     anything; the DB would reject it anyway, and a rejected row would fail the
     whole batch.
  2. Fetch the user's `expense` transactions once (exact-type filter — a
     `transfer_out` is not spending; same discipline as every other aggregation
     in this app).
  3. **Group transactions by `account_id` and pass each budget only its own
     account's rows.** `computeBudgetPeriods` has no account filter of its own,
     and `categories` are global — feeding it a multi-account array silently
     sums every account's spending in that category. This is the exact leak
     already caught once in `app/report.js` (see `00-index.md`).
  4. Write every settled period in ONE call:
     `.upsert(rows, { onConflict: 'budget_id,period_start', ignoreDuplicates: true })`
     — **`upsert`, not `insert`**. `ignoreDuplicates` is an upsert option in
     supabase-js; `insert` does not accept it and would throw a duplicate-key
     error on the second app open. `claimTrophy` in `lib/rewardsMutations.js`
     is the exact working precedent (`onConflict: 'user_id,source,ref'`).
     Omit `user_id` from the payload entirely and let the column default fill
     it (the standing rule — every insert in this codebase does this).
  5. Return `{ inserted, error }`. Call `notifyChanged()` only when
     `inserted > 0` — an app open that stamps nothing must not bump the refresh
     version and re-run every read hook in the app.
- **Concurrency is already handled.** Two devices (or a fast double-open)
  syncing at once both offer the same rows; the UNIQUE constraint plus
  `ignoreDuplicates` makes the loser a silent no-op. No locking, no
  "already syncing" flag needed.
- **Date handling**: period bounds are `date` columns. Per the standing rule,
  read them back with `parseISO`, never `new Date('2026-07-31')` (which parses
  as UTC midnight and lands on the previous local day for any negative offset).
  Send them as `format(d, 'yyyy-MM-dd')`, never a raw `Date` (which serialises
  to UTC and can shift the calendar day).

**No new hook in Phase 1** — nothing reads the table yet.

### 1.3 Components

**New: the writer's mount point in `app/_layout.js`** — a headless
`BudgetOutcomeSync` component (returns `null`), the next instance of the
established `ShareIntentHandler`/`TimezoneSync` pattern: a `<Stack>` sibling
*inside* the provider nest, because it needs `useAuth` (for the session) and
`useDataRefresh` (to notify on a real write), both of which `RootNavigator`
defines and therefore cannot itself consume.

- Runs once per app foreground, on a resolved session. Guard on
  `session?.user?.id` — an unauthenticated run would fetch an RLS-empty budget
  list and no-op, which is harmless but pointless.
- Fire-and-forget with a caught error. **A failed sync must never block app
  start or surface a user-facing error** — the periods are still there next
  open, and the unique constraint makes the retry free.
- No UI, no toast, no loading state.

**Why lazy-client rather than `pg_cron`** (which does now exist, via
`17-server-push-notifications.md`): a cron would have to iterate every user's
every budget on week/month boundaries and get each user's timezone right to
decide when a period actually closed. That is real server complexity for a
trophy, and a failure mode invisible from the client. Every comparable
"resolve on open" job in FLO (bills, reports, streaks) already works this way.
The cost of the lazy approach is bounded and documented in 1.6.

### 1.4 Navigation / Integration

No new route, no menu entry, no navigation change at all. One component added
to `app/_layout.js`'s sibling set.

### 1.5 Impact on Existing Features

| Existing | Impact | Watch for |
|---|---|---|
| `app/_layout.js` | +1 headless sibling | Placement must be inside the provider nest (needs `useAuth`/`useDataRefresh`), same position class as `TimezoneSync` |
| `lib/analytics.js` | Read-only consumer of `computeBudgetPeriods` | **Do not modify it.** Analytics and Reports both depend on its exact behaviour; Phase 1 wraps it, never edits it |
| `hooks/useBudgets.js` | **None** — `budgetStatus` is deliberately *not* called by the writer (1.2) | Retuning its `warn`/`healthy` thresholds must never change what a trophy means; this decoupling is the guarantee |
| Every read hook | Untouched, but a first sync calls `notifyChanged()` | Confirm it only fires when rows were actually inserted, not on every open |
| Supabase advisors | New table + policy | Run the security advisor after the migration; expect only the 2 pre-existing WARNs |

### 1.6 What This Phase Does NOT Include

- **No UI anywhere.** The Trophy Room still shows "Coming soon" at the end of
  Phase 1 — `useTrophies` is untouched until Phase 2.
- **No backfill of historical periods** — see 1.1; there are none to backfill.
- **No period-history display on Budget Detail.** The table makes it possible;
  it is not this feature (see Out of Scope).
- **No handling of the long-absence case.** A period that closes while the app
  sits unopened for months gets stamped whenever it's next opened, using the
  budget's amount at *that* moment rather than at true close time. Accepted:
  the window is bounded by how long the app goes unopened, and once stamped the
  row is immutable forever. A cron would narrow this; it is not worth the
  complexity (1.3). Note this is the one case `SETTLE_DAYS` does **not** help
  with — it delays the stamp, it doesn't reconstruct the amount history.
- **No versioning of a budget's `amount`.** Only the value at stamp time is
  recorded. A true audit would need an amount-history table; that is a bigger
  feature than the trophy justifies, and the append-only stamp already closes
  the exploit that mattered.
- **No `updated_at`, no edit path, no delete path.** The table is append-only by
  design — nothing in the app ever updates or deletes a row in it.

### 1.7 Phase 1 Checklist — Before Marking Complete

Schema & policy:

- [ ] The migration is applied and `information_schema.columns` confirms
      `user_id` carries `DEFAULT auth.uid()` (the standing rule).
- [ ] RLS is enabled and the policy uses `(select auth.uid())`, not a bare
      `auth.uid()`.
- [ ] Supabase security advisor run after the migration shows no new finding
      (expect only the 2 pre-existing WARNs).

Idempotency & concurrency:

- [ ] Writing the same `(budget_id, period_start)` twice does not error and does
      not create a second row (verified live, then cleaned up).
- [ ] The write path uses **`.upsert(...)`**, not `.insert(...)` — confirmed by
      running a sync twice in a row with no duplicate-key error.
- [ ] The payload omits `user_id` entirely and the column default fills it.

Which periods get stamped:

- [ ] A budget whose current period has **not** ended produces **no** row.
- [ ] A period that ended **yesterday** produces no row yet (`SETTLE_DAYS`), and
      the same period does get stamped once `SETTLE_DAYS` have passed.
- [ ] A transaction back-dated into a still-settling period **does** change that
      period's recorded `spent` — i.e. the settling window actually works.
- [ ] A `custom` budget whose `end_date` has passed produces exactly **one**
      row; one still in range produces none.
- [ ] A `calendar_month` budget created mid-month produces no row for that
      partial month before it ends (i.e. `computeBudgetPeriods`' `created_at`
      filter is doing its job).

Correctness of the verdict:

- [ ] `kept` is `true` for a period that ended at 99% of its limit, and `false`
      only when strictly over.
- [ ] A budget with `amount <= 0` is skipped by the writer and rejected by the
      CHECK constraint if forced (verified by a direct SQL insert attempt).
- [ ] A budget in a **non-active** account is stamped too — the writer is not
      filtered by `activeAccountId`.
- [ ] Two accounts with the same category do not contaminate each other's
      `spent` (the `app/report.js` leak class) — verified with a real
      two-account setup, not by reading the code.
- [ ] Switching a budget's `period_type` after it has stamped rows produces a
      *second* grid of rows carrying the new `period_type`, and does not
      overwrite or interleave with the first.

Failure behaviour:

- [ ] A direct SQL insert with `period_end = current_date` is **rejected** by
      the trigger (the clock-skew guard actually fires).
- [ ] A sync that stamps nothing does **not** call `notifyChanged()`.
- [ ] Killing the network mid-sync leaves the app usable with no visible error,
      and the next open completes the write.
- [ ] A single bad row cannot silently discard the whole batch — confirm what
      the upsert does on partial failure and that the next open retries.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 2 — Unlock Budget Keeper

### Goal

The four Budget Keeper tiles stop saying "Coming soon" and start showing real
progress, earn like every other trophy, and pay a reward on claim through the
existing `claimTrophy` path. Nothing new is invented for the claim flow — this
phase's whole job is to remove a sentinel and add four reward entries.

### Before Starting — Confirm Phase 1 is Approved

Also confirm, by reading:

- `hooks/useTrophies.js` — `EMPTY_STATS.keptBudgetPeriods` (line ~24) and
  `fetchStats`'s literal `keptBudgetPeriods: null` (line ~71). **Both** must
  change; the first is what an unauthenticated/empty render uses.
- `lib/trophies.js` `evaluateTrophies` — the `budget_keeper` case passes
  `keptBudgetPeriods === null` as `makeEntry`'s `locked` argument. Once the
  value is a real number, `locked` becomes `false` automatically and the tiles
  light up with no change to `makeEntry` itself.
- `lib/trophies.js` `HINTS.budget_keeper` — still prefixed `"Coming soon — "`.
  Must lose that prefix in this phase.
- `lib/rewards.js` `TROPHY_REWARDS` — and its comment block, which currently
  states Budget Keeper is deliberately absent because it "isn't yet computable
  at all." That comment must be corrected, not just worked around.
- `app/trophies.js` — the grid's `t.locked` branch renders "Coming soon". Verify
  no *other* group relies on that branch before assuming it becomes dead code
  (it should become unreachable; leave the branch in place regardless).

### 2.1 Database

**No database changes.** Phase 1's table is the only storage this feature needs.

### 2.2 Data Layer

- `hooks/useTrophies.js` `fetchStats` gains one query to
  `budget_period_outcomes` (`select budget_id, period_type, period_start, kept`,
  ordered by `budget_id, period_start`), added to the existing `Promise.all`.
- **New pure function in `lib/trophies.js`: `longestKeptRun(rows)`** — groups
  rows by **`(budget_id, period_type)`**, and per group finds the **longest
  consecutive run of `kept === true`** in `period_start` order, returning the
  maximum across all groups. Placed here (not in the hook) for the same reason
  `hasPerfectMonth` and `isCategorizerStreak` are here: it's a pure, testable
  rule about what a trophy means, and the hook's job is fetching, not defining.
  - **Grouping includes `period_type`, not just `budget_id`** — see the column
    comment in 1.1. A budget switched from weekly to monthly has two
    overlapping grids of rows covering the same real time; merging them into
    one run would count the same weeks twice, once as weeks and once inside a
    month. Each grid is its own run.
  - **"Consecutive" means consecutive rows within a group**, not
    calendar-adjacent periods. A budget with no transactions in a period still
    gets a row (spent 0, kept true), so gaps in the row sequence don't occur in
    practice — but stating the rule explicitly avoids a future session
    "fixing" it into calendar-gap detection.
  - The max is taken **per group, not summed across groups** — keeping two
    separate budgets for one month is not "2 periods in a row."
  - **It returns the longest run *ever*, not the current one.** This is what
    makes the trophy permanent: going over budget in November breaks your
    current run but must never un-earn a badge you already hold. The value is
    therefore monotonic — since rows are append-only and immutable, it can only
    ever climb. Any future change that could make it decrease is a bug, not a
    tuning decision.
- `EMPTY_STATS.keptBudgetPeriods` changes `null` → `0`. The `null` sentinel is
  retired entirely; `evaluateTrophies`'s `locked` argument for this group
  becomes permanently `false`.
- Client-side aggregation rather than a `v_*` view, deliberately: the row count
  is tiny (one per budget per elapsed period), `useTrophies` already does five
  round trips and computes `hasPerfectMonth`/`isCategorizerStreak` in JS, and a
  view would be a schema object to keep in sync for no measured gain. This is
  the skill's own "prefer client-side unless reused across many screens" rule.

### 2.3 Components

- `lib/trophies.js` — `HINTS.budget_keeper` loses its `"Coming soon — "` prefix,
  becoming `Keep a budget within its limit ${n} periods in a row` (and the
  singular case for tier 1: `Keep a budget within its limit for a full period`).
- `lib/rewards.js` — four new `TROPHY_REWARDS` entries. Scaled against the
  existing `planner` ladder (100/300/600), since keeping a budget is comparable
  in effort and Budget Keeper's top tier (12 periods ≈ a year) is a genuine
  long-haul. Amounts are **illustrative and tunable**, same rule as the rest of
  that file:

  | Tile | Reward |
  |---|---|
  | `budget_keeper:1` | `{ coins: 100, xp: 200 }` |
  | `budget_keeper:3` | `{ coins: 300, xp: 450 }` |
  | `budget_keeper:6` | `{ coins: 600, xp: 800, freezes: 1 }` |
  | `budget_keeper:12` | `{ coins: 1000, xp: 1200, freezes: 1 }` |

  **No `themeId` on any tier.** All six achievement-exclusive card themes are
  already allocated (`22-coin-store-and-reward-tiering.md` Phase 1: eclipse,
  borealis, orchid-dusk, prometheus, van-gogh, dusk-bloom) — inventing a
  seventh is a card-theme authoring job, not this feature's. `budget_keeper:12`
  is the natural home for one if a theme is ever authored for it; flagged here
  so the option isn't lost.
- **No component changes.** `app/trophies.js`'s Claim button already appears on
  the exact condition `t.earned && t.reward && !t.claimed`, and `claimTrophy`
  already resolves any tile id via `TROPHY_REWARDS`. Adding the map entries is
  sufficient to make all four tiles claimable — that generic path is precisely
  what `21-achievement-rewards-and-milestone-road.md` Phase 2 built.

### 2.4 Navigation / Integration

None. No route, no menu entry, no new screen.

### 2.5 Impact on Existing Features

| Existing | Impact | Watch for |
|---|---|---|
| `app/trophies.js` | Four tiles change from locked to live; four Claim buttons become possible | The `t.locked` "Coming soon" branch should become unreachable — leave it in place, don't delete it |
| `hooks/useTrophies.js` | +1 query in `Promise.all`; `keptBudgetPeriods` becomes real | `earnedCount`/`totalCount` shift — confirm the Menu unseen-dot doesn't fire spuriously for a user who already had these tiles visible-but-locked |
| `lib/rewards.js` | `TROPHY_REWARDS` gains 4 entries | Its comment block still claims Budget Keeper "isn't yet computable" — must be updated in the same edit |
| `claimTrophy` | Unchanged — four new valid `ref` values flow through it | Nothing to do; verify by claiming one |
| `24-achievement-celebration.md` | Its §1.6 excludes Budget Keeper "because it isn't computable yet" | That exclusion becomes stale if 24 is ever built after this — note it there when this lands |

### 2.6 What This Phase Does NOT Include

- **No retroactive credit.** A user only accumulates kept periods from Phase 1's
  ship date forward. There is no history to award (1.1).
- **No change to `claimTrophy`, `claimMilestone`, or `claimSpin`.**
- **No Budget Keeper entry in any celebration surface** beyond what every other
  trophy already gets.
- **No card theme reward** — see 2.3.

### 2.7 Phase 2 Checklist — Before Marking Complete

- [ ] All four Budget Keeper tiles render progress (`n/1`, `n/3`, …) instead of
      "Coming soon".
- [ ] `longestKeptRun` returns the **max per group**, not a sum across groups
      — verified with two budgets each having a short run.
- [ ] A broken run (one `kept: false` between two true runs) does not merge the
      two sides into one longer run.
- [ ] Rows for the same `budget_id` with **different `period_type`** values form
      two separate runs, not one merged run.
- [ ] Going over budget after earning a tier does **not** un-earn it — the
      returned value is the longest run ever, and never decreases.
- [ ] `EMPTY_STATS.keptBudgetPeriods` is `0`, and a signed-out/empty render
      shows all four tiles unearned rather than locked.
- [ ] Claiming `budget_keeper:1` writes exactly one `reward_events` row
      (`source: 'trophy'`, `ref: 'budget_keeper:1'`) and pays the stated amount.
- [ ] Claiming twice pays once (the existing idempotency guard still holds for
      these new refs).
- [ ] `TROPHY_REWARDS`' comment no longer claims Budget Keeper is uncomputable.
- [ ] `HINTS.budget_keeper` no longer says "Coming soon" for any tier.

**→ Stop here. Show the result and wait for approval.**

---

## Data Model Summary (Final State After All Phases)

```
budgets ──(budget_id, no FK — history outlives deletion)──► budget_period_outcomes
transactions ──(computeBudgetPeriods, client-side)─────────┘
                                                            │
                                          longestKeptRun()  ▼
                                    useTrophies.keptBudgetPeriods
                                                            │
                                          evaluateTrophies  ▼
                                       budget_keeper tiles (1/3/6/12)
                                                            │
                                              claimTrophy   ▼
                                                     reward_events
```

### `budget_period_outcomes` — Schema

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, `default gen_random_uuid()` |
| `user_id` | uuid | RLS, FK → `auth.users` ON DELETE CASCADE, **`DEFAULT auth.uid()`** |
| `budget_id` | uuid | **No FK** — deleting a budget must not erase earned history |
| `account_id` | uuid | Which account's ledger the period was measured against |
| `period_type` | text | Frozen — `period_type` is editable on a budget, and runs group on `(budget_id, period_type)` so two grids never merge |
| `period_start` | date | Local calendar date — read with `parseISO`, never `new Date()` |
| `period_end` | date | Same |
| `amount` | numeric | The limit **in force when the period closed**, frozen. `CHECK (amount > 0)` |
| `spent` | numeric | Actual spend in the period, frozen |
| `kept` | boolean | `amount > 0 && spent <= amount` — computed explicitly, not delegated to `budgetStatus` |
| `created_at` | timestamptz | `default now()` |

Guards, and what each one is actually defending against:

| Guard | Defends against |
|---|---|
| `UNIQUE (budget_id, period_start)` | The writer running on every app open; two devices syncing at once |
| `CHECK (amount > 0)` | `budgetStatus`' `amount <= 0 → 'healthy'` short-circuit making a ₹0 budget permanently "kept" |
| `CHECK (period_end >= period_start)` | A malformed range from any future writer |
| `BEFORE INSERT` trigger on `period_end >= current_date` | A device with a fast clock stamping an unfinished period's partial spend, permanently |
| `SETTLE_DAYS = 3` (client) | Back-dated transactions arriving after the stamp froze — the likeliest way this feature would wrongly say you kept a budget |
| Append-only, no update/delete path | The farm: raise a budget's limit, retroactively "keep" every past period, claim, lower it back |

No view — Phase 2 aggregates client-side (2.2).

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| Trophy Room (`app/trophies.js`) | Four locked tiles become live and claimable | Phase 2 |
| `hooks/useTrophies.js` | +1 query, `null` sentinel retired | Phase 2 |
| `lib/rewards.js` | +4 `TROPHY_REWARDS` entries, comment corrected | Phase 2 |
| `lib/analytics.js` | Read-only reuse of `computeBudgetPeriods` | **None — do not modify** |
| `app/_layout.js` | +1 headless sibling | Phase 1 |
| `24-achievement-celebration.md` | Its Budget Keeper exclusion goes stale | Note in that doc when this lands |

---

## Out of Scope (All Phases)

- **Period history on Budget Detail** (`app/budget/[id].js`) — the table makes
  "how has this budget actually done over time" answerable for the first time,
  and it's the most obvious follow-up. Deliberately not bundled: this feature
  is about unlocking a trophy, and a history chart is its own design problem.
  Future build.
- **A `pg_cron` writer** — rejected in 1.3; revisit only if the
  stamped-on-next-open imprecision ever causes a real complaint.
- **Backfilling pre-ship history** — nothing to backfill (1.1).
- **Budget Keeper card theme** — no seventh achievement theme exists (2.3).
- **Changing `budgetStatus`' thresholds** — `warn` counting as kept is a
  deliberate reading of "kept the budget", not an accident of reusing that
  function.
- **Streak Keeper rewards** — separate question, deliberately unrewarded
  because milestones already pay (`21`, `00-index.md`). Not touched here.
