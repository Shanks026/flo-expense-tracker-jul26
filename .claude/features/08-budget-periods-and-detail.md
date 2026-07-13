# Feature: Budget Periods & Budget Detail
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/08-budget-periods-and-detail.md`
**Status**: Planned
**Last Updated**: July 2026

---

## Context

Two problems, one root.

**1. Nobody can tell what window a budget covers.** `v_budgets_with_spent`
computes `spent` between `date_trunc('week'|'month', CURRENT_DATE)` and that
period's end — i.e. the current **calendar** week (Monday→Sunday, since
Postgres `date_trunc('week')` is ISO) or **calendar** month (1st→last). The card
says only "This Week" / "This Month". The user's mental model was "7 days from
the day I created it", and nothing in the UI ever contradicted that, because
nothing in the UI ever states the actual dates. This surfaced as "the selected
duration is not proper" — it isn't a bug in the SQL, it's a window the product
never shows you.

**2. There is nowhere to go.** Tapping a budget card opens the edit sheet. There
is no way to see *what* was spent — only the total. The number is unexplained by
construction.

Both are fixed by the same thing: **the view must expose the period bounds it is
already computing internally.** Once `period_start`/`period_end` are columns, the
card can name the window, and the detail screen can list exactly the transactions
that produced `spent` without re-deriving the window client-side (and risking a
client/SQL disagreement about what "this week" means).

**Decisions taken with the user before writing this doc:**

- **Calendar stays the default.** Existing week/month budgets keep their exact
  current meaning. A new `custom` type (explicit start/end, one-off, no
  recurrence) covers the case nothing covers today — a trip, a festival week, a
  wedding month. Anchored-recurring ("7 days from creation") and rolling
  ("trailing 30 days") were both **rejected**: anchored makes two budgets created
  on different days reset on different days, so the Budgets tab stops being
  comparable at a glance; rolling quietly breaks the word *remaining*, because a
  window with no end has nothing to be remaining *against*, and yesterday's spend
  silently falls out the back overnight.
- **The detail screen is spend-focused.** Spent / limit / remaining, days left,
  pace, and the transactions in the window. **No income** — a budget is a
  spending cap, and putting income beside it invites the reading that it funds
  the budget. No charts this round (see Out of Scope).

---

## Phase Overview

```
Phase 1 — Period model + visible windows
  budgets.period → period_type ('calendar_week' | 'calendar_month' | 'custom')
  + start_date/end_date. The view exposes period_start/period_end, and every
  budget card names its actual window ("13–19 Jul") instead of "This Week".

Phase 2 — Budget detail screen
  app/budget/[id].js — spent/limit/remaining, days left, pace, and the
  transactions that make up the number. Card tap navigates here; editing moves
  into the detail screen.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Period Model + Visible Windows ✅ Complete

### Goal

A budget can be a calendar week, a calendar month, or a **custom date range**.
Every budget card states the window it actually covers, so "how is this number
calculated" is answerable by looking at it. No existing budget changes meaning.

### Before Starting — Confirm With Codebase

1. **`budgets` live columns** — confirm `period` is still `text` (`'week'` |
   `'month'`) and that `period_type`/`start_date`/`end_date` don't already
   exist. Use the Supabase MCP, not memory.
2. **`v_budgets_with_spent`'s current definition** — `pg_get_viewdef`. The SQL
   below rewrites it; diff against what's actually live first.
3. **Everything that reads `budget.period`** — at minimum
   `app/(tabs)/budgets.js` (the "This Week"/"This Month" label),
   `components/AddBudgetSheet.js` (the period picker), and
   **`lib/analytics.js`'s `computeBudgetPeriods`** (branches on
   `budget.period === 'month'`, hard-codes `weekStartsOn: 1`). Grep for
   `\.period` — a missed call site is a silent `undefined` after the column is
   dropped.
4. **`components/ProgressBar.js`'s status handling** — `00-index.md` records a
   known gap: it special-cases `'danger'` but not `'over'`, so an over-limit bar
   renders brand-lime instead of red. Not this feature's job, but it's about to
   become more visible; flag it if it's still true.

### 1.1 Database

One migration. Order matters: the view depends on `budgets.period`, so it must
be dropped before the column can be.

**`security_invoker = true` is set explicitly on the recreated view** — see the
standing rule in `00-index.md`. Recreating a view through the MCP's migration
role silently resets it to definer behaviour, which bypasses RLS on the
underlying tables. This has bitten this project once already.

```sql
-- 08-budget-periods-and-detail.md Phase 1
-- Migration name: budget_period_types

-- The view reads budgets.period, so it has to go first.
drop view if exists public.v_budgets_with_spent;

-- 1. The new period model.
--    calendar_week  — current Mon–Sun (unchanged meaning from 'week')
--    calendar_month — current 1st–EOM  (unchanged meaning from 'month')
--    custom         — explicit start_date..end_date, one-off, does not recur
alter table public.budgets
  add column if not exists period_type text not null default 'calendar_month',
  add column if not exists start_date date,
  add column if not exists end_date date;

-- 2. Carry every existing budget across with its meaning intact.
update public.budgets
   set period_type = case period when 'week' then 'calendar_week'
                                 else 'calendar_month' end;

-- 3. Now the values are known-good, constrain them.
alter table public.budgets
  add constraint budgets_period_type_ck
    check (period_type in ('calendar_week', 'calendar_month', 'custom'));

-- 4. custom needs both dates; the calendar types must not carry any, so a
--    stale start_date can never silently outlive a type change.
alter table public.budgets
  add constraint budgets_custom_dates_ck check (
    (period_type = 'custom'
       and start_date is not null
       and end_date is not null
       and end_date >= start_date)
    or
    (period_type <> 'custom'
       and start_date is null
       and end_date is null)
  );

-- 5. The legacy column is now fully replaced.
alter table public.budgets drop column period;

-- 6. Recreate the view, now exposing the bounds it was already computing
--    internally. period_start/period_end are the whole point of this phase:
--    the card can name the window, and the detail screen (Phase 2) filters
--    transactions by the SAME bounds the `spent` number came from, rather than
--    re-deriving "this week" client-side and disagreeing with the SQL.
create view public.v_budgets_with_spent as
with bounds as (
  select
    b.*,
    case b.period_type
      when 'calendar_week'  then date_trunc('week',  current_date)::date
      when 'calendar_month' then date_trunc('month', current_date)::date
      when 'custom'         then b.start_date
    end as period_start,
    case b.period_type
      when 'calendar_week'  then (date_trunc('week',  current_date) + interval '6 days')::date
      when 'calendar_month' then (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date
      when 'custom'         then b.end_date
    end as period_end
  from public.budgets b
)
select
  b.id,
  b.user_id,
  b.account_id,
  b.name,
  b.amount,
  b.period_type,
  b.start_date,
  b.end_date,
  b.period_start,
  b.period_end,
  b.category_id,
  b.created_at,
  c.name  as category_name,
  c.icon  as category_icon,
  c.color as category_color,
  coalesce(t.spent, 0::numeric)            as spent,
  b.amount - coalesce(t.spent, 0::numeric) as remaining
from bounds b
left join public.categories c on c.id = b.category_id
left join lateral (
  select sum(tx.amount) as spent
  from public.transactions tx
  where tx.user_id    = b.user_id
    and tx.account_id = b.account_id
    and tx.type       = 'expense'
    and (b.category_id is null or tx.category_id = b.category_id)
    and tx.occurred_at >= b.period_start
    and tx.occurred_at <= b.period_end
) t on true;

-- STANDING RULE — do not remove. Without this the view runs as its owner and
-- bypasses RLS on budgets/transactions/categories.
alter view public.v_budgets_with_spent set (security_invoker = true);
```

`category_color` is added to the select while the view is being rewritten
anyway — Phase 2's detail header wants it, and adding it now avoids a second
view rewrite (each one is a fresh chance to lose `security_invoker`).

**Run the security advisor immediately after applying** and treat any new
`security_definer_view` ERROR as a stop-everything blocker.

### 1.2 Data Layer

- **`hooks/useBudgets.js`** — no query change (still `select('*')`), but callers
  now receive `period_type`, `period_start`, `period_end`, `start_date`,
  `end_date`, `category_color`. `budgetStatus()` is untouched.
- **`lib/analytics.js` → `computeBudgetPeriods(budget, transactions, from, to)`**
  — **must be updated, it will break otherwise.** It currently branches on
  `budget.period === 'month'` (a column that no longer exists → `undefined` →
  silently falls through to the week branch for *every* budget, including
  monthly ones). Changes:
  - Branch on `period_type` instead.
  - `custom` has **exactly one period** — its own `start_date..end_date` — and
    does not recur, so it emits a single entry rather than walking a cursor.
  - Keep `weekStartsOn: 1` for `calendar_week`; it must stay in lockstep with
    Postgres's ISO `date_trunc('week')`. A mismatch here would make Analytics
    and the Budgets tab disagree about the same budget by one day.
- **New shared formatter** — `formatPeriodLabel(budget)` in `lib/budgets.js`
  (new file): `"13–19 Jul"`, `"Jul 2026"`, `"3 Aug – 12 Aug"`. Used by the card
  now and the detail header in Phase 2, so it lives in `lib/`, not inline in the
  screen.

### 1.3 Components

- **`components/AddBudgetSheet.js`** — the period control becomes a three-way
  segment: **Week · Month · Custom**. Choosing Custom reveals two date fields
  (`@react-native-community/datetimepicker`, already a dependency — see
  `AddTransactionSheet`'s date picker for the exact usage). Validation, inline
  as `error` state per the existing sheet convention: custom requires both dates
  and `end_date >= start_date` — i.e. the client mirrors
  `budgets_custom_dates_ck` so the user gets a sentence, not a Postgres
  constraint violation.
- **`app/(tabs)/budgets.js`** — the `"This Week"` / `"This Month"` line becomes
  `formatPeriodLabel(budget)`. This single line is the actual fix for the
  reported complaint: the window stops being a guess.
  - An **ended** custom budget (`period_end < today`) shows an "Ended" pill and
    a muted card. It doesn't recur, so its `spent` is final — that must read as
    deliberate, not as a budget that has stopped updating.

### 1.4 Navigation / Integration

No navigation changes in Phase 1. (Card tap still opens the edit sheet; Phase 2
changes that.)

### 1.5 Impact on Existing Features

| Feature | Impact | Watch for |
|---|---|---|
| `budgets` table | `period` **dropped**, replaced by `period_type` + `start_date`/`end_date` | Any missed `.period` reader becomes `undefined` — grep before applying |
| `v_budgets_with_spent` | Rewritten; +5 columns | `security_invoker` must be re-set (standing rule); run the advisor after |
| Analytics → Budgets section | `computeBudgetPeriods` **breaks silently** if not updated — `undefined !== 'month'` sends monthly budgets down the weekly branch | Fix in the same phase, not later |
| `AddBudgetSheet` | New period type + date fields | Editing an existing budget must preserve its type |
| Home / alerts (`lib/alerts.js`) | Reads `spent`/`amount` from the view, not `period` | Should be unaffected — verify with a grep, don't assume |
| Budgets tab | Label change only | — |

### 1.6 What This Phase Does NOT Include

- The detail screen (Phase 2).
- Rolling/trailing-window budgets, and anchored-from-creation budgets — both
  considered and rejected above.
- A configurable week-start day (Sun vs Mon). Weeks stay Monday-anchored,
  matching Postgres. With the real dates now on the card this is a stated fact
  rather than a hidden assumption; revisit only if it still grates.
- Auto-archiving or auto-renewing ended custom budgets.

### 1.7 Phase 1 Checklist — Before Marking Complete

- [x] `budget_period_types` migration applied; `budgets` has `period_type` +
      `start_date`/`end_date`, and **no** `period` column
- [~] Backfill correctness — **nothing to verify**: the `budgets` table has 0
      rows (the 2026-07-11 data reset). The `CASE` is trivial and correct by
      inspection, but it has never run against a real row. If an old budget
      appears from somewhere, this is untested.
- [x] `v_budgets_with_spent` returns `period_start`/`period_end`, and
      `security_invoker = true` is set (confirmed via `pg_class.reloptions`)
- [x] Supabase security advisor run after the migration: no new
      `security_definer_view` (the two WARNs are pre-existing)
- [x] Grep confirms no reader of the dropped column survives — the only hit is
      a comment. **The grep found two readers the plan had missed**:
      `hooks/useAlerts.js` and `app/analytics.js`; both fixed (see notes)
- [x] `computeBudgetPeriods` branches on `period_type`; `custom` yields exactly
      one period, clipped to the requested window
- [x] Budget cards show a real date range (`formatPeriodLabel`)
- [x] An ended custom budget shows an "Ended" pill, a muted card, and is
      excluded from the alerts feed
- [x] Custom `end < start` is refused in the sheet with a sentence; the DB
      constraint is a backstop, not the UI
- [x] **View verified live against all three period types** by inserting temp
      budgets and reading them back: custom → its own dates; calendar_month →
      `2026-07-01…07-31`; calendar_week → `2026-07-13…07-19` (a Monday, so the
      ISO week is right). One temp budget picked up a real ₹10,000 transaction
      and produced `remaining = −1,000`, exercising the lateral join and the
      over-budget path. Both CHECK constraints verified to reject bad input
      (inverted range; calendar type carrying stray dates). All temp rows
      deleted — `budgets` back to 0 rows.
- [x] `npx expo export --platform android` bundles clean (3,988 modules)
- [ ] **On device**: create a custom budget end-to-end and confirm the card,
      the range label, and the spent figure

**→ Stop here. Show the result and wait for approval.**

### Implementation Notes

- **The plan's call-site list was incomplete, and the grep-first step caught
  it.** §1.5 named `budgets.js`, `AddBudgetSheet.js` and `computeBudgetPeriods`.
  The actual grep found two more readers of `budget.period`:
  - `hooks/useAlerts.js:58` — the "% used this week/month" subtitle. Now uses a
    `BUDGET_PERIOD_PHRASE` map (`custom` → "in this period").
  - `app/analytics.js:315` — the per-period label in the Budgets analytics
    section. Now branches on `period_type`.
  Both would have silently produced wrong text rather than crashing, which is
  exactly the failure mode the checklist's grep item existed to prevent.
- **Ended custom budgets are excluded from the alerts feed** (`useAlerts`) — a
  small scope addition, but a direct consequence of introducing budgets that can
  end: a trip you overspent on last month would otherwise sit in the bell
  forever, un-actionable. Flagged rather than slipped in.
- **`lib/budgets.js` uses `parseISO`, not `new Date()`**, on the view's
  date-only strings. `new Date('2026-07-13')` parses as UTC midnight, which
  lands on the *previous day* for any negative UTC offset. `parseISO` treats a
  date-only string as local midnight, which is what a calendar date means.
- **`previewPeriodDates()` duplicates the view's `CASE`** in JS, because the
  sheet must show the window *before* a row exists to read `period_start` from.
  This is a deliberate, documented duplication (both sides commented) — if the
  two ever drift, the sheet promises a window the view doesn't honour. It's the
  one place the client is allowed to compute a period.
- **`category_color` added to the view** while it was being rewritten anyway —
  Phase 2's detail header wants it, and each view rewrite is a fresh chance to
  lose `security_invoker`.

---

## Phase 2 — Budget Detail Screen ✅ Complete

### Goal

Tapping a budget answers "where did that number come from" — the window, what's
left, how fast it's going, and every transaction inside it.

### Before Starting — Confirm Phase 1 is Approved

Then verify:

1. **`app/plan/[id].js`** — the precedent this mirrors (pushed detail route off a
   list card). Copy its structure: route shape, back header, how it reads its id.
2. **`hooks/usePlan(planId)`** — the singular-detail hook pattern, including its
   deliberate lack of an account filter (keyed by an id from explicit
   navigation). `useBudgetDetail` follows the same reasoning.
3. **`lib/analytics.js`'s `computePlanPace`** — and the settled
   `on_track`/`over_pace`/`under_pace` vocabulary (`00-index.md`). A budget is a
   spending cap, exactly like a plan target, so **reuse that label set**; don't
   invent `ahead`/`behind`.

### 2.1 Database

No database changes in this phase — Phase 1's `period_start`/`period_end` are
what make this screen possible without any.

### 2.2 Data Layer

**`hooks/useBudgetDetail.js`** (new):

```js
useBudgetDetail(budgetId)
  → { budget, transactions, loading, refetch }
```

- Fetches the budget row from `v_budgets_with_spent` (`.eq('id', budgetId)
  .maybeSingle()`), then its transactions with
  `.gte('occurred_at', budget.period_start)`, `.lte('occurred_at',
  budget.period_end)`, `.eq('type', 'expense')`, `.eq('account_id',
  budget.account_id)`, and `.eq('category_id', …)` **only when the budget has a
  category** (a null `category_id` is an overall budget — every expense counts).
- **The window comes from the view, never recomputed here.** That is the whole
  point of Phase 1: if this screen derived "this week" itself, it could disagree
  with the `spent` figure printed above the list, and the resulting bug would be
  a nightmare to see.
- Subscribes to `useDataRefresh`'s `version` like every other read hook.

**Pace** — reuse `computePlanPace`'s vocabulary via a small
`computeBudgetPace(budget)` in `lib/budgets.js`: elapsed fraction of the period
vs spent fraction of the limit → `on_track` | `over_pace` | `under_pace`. Pure,
client-side, no SQL. An ended custom budget has no pace (it's finished) — return
`null` and render nothing rather than a meaningless verdict.

### 2.3 Components

```
app/budget/[id].js        The detail screen
hooks/useBudgetDetail.js  Budget + its in-window transactions
lib/budgets.js            formatPeriodLabel (Phase 1) + computeBudgetPace
```

Screen structure, top to bottom:

- **Header** — back chevron, budget name, category icon tinted with
  `category_color` (or a `Wallet` for an overall budget), and an **Edit** action
  opening `AddBudgetSheet(budget)`.
- **Hero card** — remaining (large, red when negative — `AmountText` already
  handles the sign), `spent of amount` beneath it, `ProgressBar`, the period
  label (`13–19 Jul`), and `N days left` (or `Ended`).
- **Pace line** — one sentence: on track / spending too fast / comfortably under.
- **Transactions** — the expenses in the window, newest first, same row treatment
  as the Transactions tab. Tapping one opens `AddTransactionSheet(tx)` for edit,
  consistent with every other transaction list in the app.
- **Empty state** — a plain centred message when nothing has been spent yet, per
  the app's existing convention (no skeletons, no illustrations).

### 2.4 Navigation / Integration

- `app/(tabs)/budgets.js`: card `onPress` changes from `openAddBudget(b)` to
  `router.push('/budget/' + b.id)`. **Editing moves into the detail screen** —
  this is a deliberate behaviour change and the thing most likely to feel
  surprising, since tapping a card today opens the editor directly. It matches
  Plans (`app/plans.js` → `app/plan/[id].js`), so the app stays internally
  consistent rather than having two different meanings for "tap a card".

### 2.5 Impact on Existing Features

| Feature | Impact | Watch for |
|---|---|---|
| Budgets tab | Card tap navigates instead of opening the editor | The only route to editing is now via the detail screen — make Edit obvious |
| `AddBudgetSheet` | Opened from the detail screen too | Deleting a budget from there must `router.back()`, or the screen is left orphaned on a dead id |
| `AddTransactionSheet` | Opened from the detail list | Already handles an existing tx; editing one out of the window must refresh the list (`notifyChanged` covers it) |

### 2.6 What This Phase Does NOT Include

- **Charts.** Deliberate. `lib/analytics.js`'s compute functions
  (`computeCategoryBreakdown`, `computeDayOfWeek`, `computeTrend`) are pure and
  take `(transactions, from, to)`, so a donut/day-of-week chart scoped to the
  budget's window is *cheap* to add later and reuses the maths with zero
  duplication — but a category-scoped budget's category donut has exactly one
  slice, which is a strong hint this belongs to overall budgets only, if at all.
  Ship the list first and see whether the charts are actually wanted.
- **Income on this screen.** See Context.
- Budget-specific notifications ("you're 80% through"). `lib/alerts.js` already
  surfaces budget warnings in the bell; a separate scheduled notification is its
  own feature.

### 2.7 Phase 2 Checklist — Before Marking Complete

- [x] `/budget/[id]` renders name, category, period label, spent/limit/remaining,
      progress, days left and pace
- [x] Its transaction list is filtered by **the view's** `period_start`/
      `period_end` — `useBudgetDetail` reads the bounds off the budget row and
      passes them straight to `.gte()`/`.lte()`; it never derives a period
- [x] An overall (null-category) budget lists **all** expenses in the window
      (no category filter applied at all — filtering on a null `category_id`
      would have returned only uncategorised rows, a different and empty thing)
- [x] Deleting the budget navigates back instead of stranding the screen on a
      dead id (same `!loading && !budget → router.back()` guard as Plan Detail)
- [x] Editing a transaction from the list refreshes the numbers — the hook
      subscribes to `useDataRefresh`'s `version`, which every mutation bumps
- [x] The detail screen and the Budgets tab read the **same** row from the
      **same** view, so their numbers cannot disagree by construction
- [x] Empty state renders when nothing is spent yet
- [x] **`computeBudgetPace` verified by execution**, not inspection: day 1 of a
      7-day ₹7,000 budget → ₹1,000 spent = `on_track` (projects to exactly
      7,000), ₹3,000 = `over_pace`, ₹100 = `under_pace`; an ended budget →
      `null`; a future-dated custom budget → no inversion on negative elapsed
      days. Labels: `13 Jul – 19 Jul` / `July 2026` / `3 Aug – 12 Aug`.
- [x] `npx expo export --platform android` bundles clean (3,990 modules)
- [ ] **On device**: tap a budget → detail; edit; delete; confirm the numbers
      match the card

**→ Stop here. Show the result and wait for approval.**

### Implementation Notes

- **The `ProgressBar` known gap is fixed** (`00-index.md` had it logged since the
  Analytics build, and Phase 1's "Before Starting" said to flag it if still
  true — it was). `budgetStatus()` returns `'over'`, but `FILL_BY_STATUS` only
  had a `'danger'` key, so an over-limit bar fell through to the default **brand
  lime** — a green progress bar on a budget you'd blown, on the Budgets tab and
  in Analytics both. Additionally, `dark` cards hard-coded the fill to brand, so
  the new dark summary card could never have shown red at all. Both fixed; the
  status colour now applies on dark cards too. Out of this feature's strict
  scope, but the detail screen made it indefensible.
- **The category icon sits on a LIGHT tile even on the dark summary card.** The
  category palette includes charcoal, navy and slate, which vanish against a
  dark tile. `CATEGORY_COLORS` are all designed to read on a light background —
  which is exactly why the Budgets tab tints its icons the same way. This is the
  reason `category_color` was worth adding to the view.
- **`useBudgetDetail` does not filter by `activeAccountId`**, deliberately — it
  scopes to *the budget's own* `account_id`. Same reasoning as `usePlan(planId)`:
  it's keyed by an id that came from explicit navigation, so the list must match
  the budget, not whatever account happens to be active.
- **Tapping a budget card now navigates instead of opening the editor.** This is
  the behaviour change flagged in the plan. Editing moved behind the pencil in
  the detail header, matching Plans exactly (`app/plans.js` → `app/plan/[id].js`
  → pencil → `AddPlanSheet`).
- **No charts, as planned.** The pure compute functions in `lib/analytics.js` are
  window-parameterised and ready if they're wanted; a category budget's donut
  would have exactly one slice, which is the argument for waiting.

---

## Data Model Summary (Final State After All Phases)

```
budgets
  id, user_id, account_id, name, amount, category_id (nullable = overall),
  created_at
  period_type  text  'calendar_week' | 'calendar_month' | 'custom'   ← CHANGED
  start_date   date  custom only, else NULL                          ← NEW
  end_date     date  custom only, else NULL                          ← NEW
  (period      text  — DROPPED)

v_budgets_with_spent  (rewritten, security_invoker = true)
  … + period_start, period_end   ← the keystone: the window `spent` was
                                   computed over, exposed so the UI can name it
                                   and the detail screen can filter by it
  … + category_color             ← for the detail header's icon tint

No new tables. No stored derived values — `spent`/`remaining`/`period_start`/
`period_end` are all computed by the view on read, per FLO's core principle.
```

---

## Out of Scope (All Phases)

- **Rolling / trailing-window budgets** ("last 30 days") — rejected: a window
  with no end has nothing for "remaining" to be remaining *against*.
- **Anchored-recurring budgets** ("7 days from the day I made it") — rejected:
  budgets created on different days would reset on different days, so the
  Budgets tab loses a shared "this period" and stops being comparable at a
  glance. This was the user's original instinct; `custom` covers the real
  underlying need (a window that isn't the calendar's) without the cost.
- **Configurable week-start day** — weeks stay Monday-anchored (matching
  Postgres). Now *stated* on the card rather than hidden.
- **Charts on the detail screen** — see Phase 2.6. Cheap to add later precisely
  because the analytics maths is already pure and window-parameterised.
- **Income on the budget detail** — a budget caps spending; income beside it
  invites the reading that it funds the budget.
- **Budget rollover** (unspent amount carrying into the next period) — a real
  feature, a different one, and it would need stored state, which cuts against
  the everything-is-derived principle. Discuss properly if it comes up.
