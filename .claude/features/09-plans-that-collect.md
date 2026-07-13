# Feature: Plans That Actually Collect
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/09-plans-that-collect.md`
**Status**: Planned
**Last Updated**: July 2026

---

## Context

A plan is a **collection** — a bag of transactions you deliberately put things
into (settled with the user, 2026-07-13). Membership is explicit: a transaction
belongs to a plan only if its `plan_id` points at it. A budget, by contrast, is
a *rule evaluated over* your transactions and has no members at all.

That explicit membership is the feature's strength and its whole problem:
**a plan only ever collects what you remembered to tag, at the moment you typed
it in.** There are exactly two ways a `plan_id` is ever set today — the "Add to
Plan" picker in `AddTransactionSheet`, and the "Add Expense" button on Plan
Detail (which pre-fills it). Both are per-transaction, in the moment.

That is why Plans got so little use it lost its tab slot in July (and why it's
now been swapped back — the user wants to actually use it). Two things made it
worse:

- **Auto-detect (`06`) bypasses tagging entirely.** Transactions now arrive
  pre-filled from a bank notification, and `plan_id` is the one field a
  detected transaction cannot guess. The faster the capture path, the more
  reliably the plan stays empty.
- **There is no way to assemble a plan after the fact.** You cannot say
  "everything between the 3rd and the 10th was the Goa trip." An
  explicit-membership model with no bulk membership editing is a strange gap.

This feature closes the tagging gap. It adds no new concepts — it makes the
existing one work.

**Explicitly rejected during planning** (raised, considered, not built):

- **Auto-tagging by date range.** A plan has `start_date`/`end_date`, so it's
  tempting to sweep everything in that window into it. No: your rent and your
  electricity bill fall inside your holiday too. Collecting mode (Phase 2) is an
  **explicit toggle** for exactly this reason.
- **`exclude_from_budgets` on a plan.** Real (a wedding shouldn't wreck your
  Food budget), but it's a separate product decision about what budgets *mean*,
  and it changes `v_budgets_with_spent`. Kept out; see Out of Scope.
- **Plans as savings goals.** The app can't currently decide whether a plan is a
  spending envelope or a savings goal — `v_plans_with_totals` only ever sums
  expenses, and the pace vocabulary (`over_pace`, not `behind`) settles it as a
  *cap*. That question must be answered before anything is built on top of it,
  and this feature deliberately does not answer it. See Out of Scope.

---

## Phase Overview

```
Phase 1 — Add from history
  A plan can be assembled AFTER the fact: filter your existing transactions by
  date range and category, multi-select, and bulk-assign them to the plan. The
  missing half of an explicit-membership model.

Phase 2 — Collecting mode
  Exactly one plan per account can be "collecting". While it is, new
  transactions default into it — including auto-detected and shared ones.
  Turns plans from "remember to tag" into "it just collects". Makes
  start_date/end_date earn their keep.

Phase 3 — Where the money went
  Category breakdown on Plan Detail, reusing lib/analytics.js's existing pure
  compute functions. A plan's donut has many slices (unlike a category
  budget's, which has exactly one) — this is where charts genuinely belong.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Add From History

### Goal

From a plan, open a screen listing your existing transactions, filter them by
date range and category, tick the ones that belong, and assign them all to the
plan in one action. A trip you forgot to tag as it happened can be reconstructed
in thirty seconds instead of by editing forty transactions one at a time.

### Before Starting — Confirm With Codebase

1. **`transactions.plan_id`** — confirm it's nullable, FK → `plans(id)`, and
   **`ON DELETE SET NULL`** (verified 2026-07-13: it is). Bulk assignment is
   just an UPDATE of this column; nothing else moves.
2. **`useTransactions`** (`hooks/useTransactions.js`) — takes
   `{ month, type, categoryId, planId, limit }`. It has **no date-range
   filter**, only whole-month. This screen needs `from`/`to`, so either extend
   that hook or write a dedicated one — decide by reading it, and prefer
   extending only if it doesn't complicate the five existing call sites.
3. **`app/plan/[id].js`** — the route this screen hangs off. Note the routing
   restructure below; check whether `expo-router` in this version resolves
   `app/plan/[id]/index.js` cleanly before committing to it.
4. **`usePlan(planId)`** — the singular-detail hook; the new screen needs the
   plan's `account_id`, `start_date`, `end_date` to seed its defaults.

### 1.1 Database

**No database changes in this phase.** Bulk assignment is
`update transactions set plan_id = $1 where id in (...)`. This is the payoff of
the existing model — the collection is already just a column.

### 1.2 Data Layer

**Routing restructure (do this first, it's the only structural change):**

```
app/plan/[id].js          →  app/plan/[id]/index.js      (unchanged content)
                          +  app/plan/[id]/history.js    (new)
```

A dynamic route file and a directory of the same name can't coexist; this is the
standard expo-router way to give `[id]` children. `/plan/<id>` must keep working
exactly as before — verify by navigating, not by assuming.

**`hooks/usePlanCandidates.js`** (new) — the transactions a plan *could* collect:

```js
usePlanCandidates(plan, { from, to, categoryId })
  → { transactions, loading }
```

- Expenses only, in **the plan's own `account_id`** (not `activeAccountId` — same
  reasoning as `useBudgetDetail`: the screen is keyed by an id from explicit
  navigation, so it must match the plan, not whatever account is active).
- `.gte('occurred_at', from)` / `.lte('occurred_at', to)`, optional
  `.eq('category_id', …)`.
- **Excludes transactions already in *this* plan** (`.neq('plan_id', plan.id)` —
  careful: `neq` skips NULLs in Postgres, so this must be expressed as
  `.or('plan_id.is.null,plan_id.neq.' + plan.id)` or filtered client-side.
  **This is the single most likely bug in the phase** — get it wrong and
  untagged transactions vanish from the list, which is precisely the set the
  user came here for. Verify with a real query, not by reading the docs.)
- Transactions belonging to a *different* plan are **shown, not hidden**, with
  their plan name — selecting one reassigns it. Hiding them would be a silent
  lie about what's in the window.

**Mutation** — inline in the screen:

```js
await supabase.from('transactions').update({ plan_id: plan.id }).in('id', selectedIds);
notifyChanged();
```

Then `router.back()` to the plan, which will already show them.

### 1.3 Components

```
app/plan/[id]/history.js        The picker screen
hooks/usePlanCandidates.js      Candidate transactions for a plan
```

**`history.js`** — header ("Add to {plan name}", back), then:

- **Date range** — two date fields (`DateTimePicker`, as in `AddBudgetSheet`).
  Seeded from the plan's `start_date`/`end_date` when it has them; otherwise the
  last 30 days. The plan's own dates finally do something useful.
- **Category filter** — an "All" chip plus the expense categories, same chip row
  as elsewhere.
- **The list** — each row: category icon, name, date, note, amount, and a
  checkbox. A row already in another plan shows that plan's name in a muted pill.
- **Select-all** for the current filter — the whole point is bulk.
- **Sticky footer** — "Add N transactions · ₹X" (running total, so the user sees
  what they're about to attribute), disabled at zero selected.
- Empty state: plain centred message, per convention.

**`app/plan/[id]/index.js`** — one new button, "Add from history", next to the
existing "Add Expense".

### 1.4 Navigation / Integration

`/plan/[id]` → "Add from history" → `/plan/[id]/history` → back on save.

### 1.5 Impact on Existing Features

| Feature | Impact | Watch for |
|---|---|---|
| `app/plan/[id].js` | Moves to `app/plan/[id]/index.js` | Every `router.push('/plan/' + id)` must still resolve — grep and test |
| `transactions` | `plan_id` written in bulk | `notifyChanged()` after, or Plan Detail and `v_plans_with_totals` won't update |
| `v_plans_with_totals` | Nothing — it already sums by `plan_id` | The plan's totals update for free; that's the design working |
| Budgets | **Unaffected, by design** — the budget lateral never looks at `plan_id`, so a transaction pulled into a plan still counts against its budget | This is correct (the money still left your Food budget) but will surprise; don't "fix" it here |

### 1.6 What This Phase Does NOT Include

- Removing a transaction from a plan in bulk (single-remove already exists via
  the transaction's own edit sheet).
- Any auto-suggestion of what belongs ("these 12 look like your trip").
- Collecting mode (Phase 2).

### 1.7 Phase 1 Checklist — Before Marking Complete

- [ ] `/plan/<id>` still renders after the routing restructure
- [ ] The candidate list includes **untagged** transactions (the `neq`-skips-NULL
      trap above — verified against a real query with a NULL `plan_id` row present)
- [ ] Transactions in another plan appear, labelled, and can be reassigned
- [ ] Transactions already in **this** plan do not appear
- [ ] The list is scoped to the **plan's** account, not the active one
- [ ] Date range seeds from the plan's `start_date`/`end_date` when present
- [ ] Bulk assign writes `plan_id` for every selected row and calls
      `notifyChanged()`; Plan Detail shows them immediately on return
- [ ] Footer total matches the sum of what's ticked
- [ ] `npx expo export --platform android` bundles clean

**→ Stop here. Show the result and wait for approval.**

---

## Phase 2 — Collecting Mode

### Goal

Turn on "collecting" for the Goa plan when you leave, off when you're back.
While it's on, every new transaction — typed, shared from an SMS, or
auto-detected from a bank notification — defaults into that plan, visibly and
overridably. The plan fills itself.

### Before Starting — Confirm Phase 1 is Approved

Then verify:

1. **`AddTransactionSheet`'s `open(payload)`** — exactly where `planId` is seeded
   for a new entry (`setPlanId(payload?.plan_id ?? null)`), and that the plan
   picker renders `activePlans` from `usePlans()`.
2. **Every path that creates a transaction**: the ⊕ tab, Plan Detail's "Add
   Expense", `ShareIntentHandler`, `DetectedTransactionHandler`, and
   `PayBillSheet`. The first four all funnel through `openAdd(payload)`. **Bill
   payment does not** — decide deliberately whether a bill payment should land
   in a collecting plan (recommendation: **no** — a bill is not part of your
   trip; it's the world carrying on without you).
3. **`AccountContext`** — `activeAccountId`, for the account guard below.

### 2.1 Database

```sql
-- 09-plans-that-collect.md Phase 2
-- Migration name: plan_collecting_mode

-- While a plan is collecting, new transactions default into it.
alter table public.plans
  add column if not exists is_collecting boolean not null default false;

-- At most ONE collecting plan per account. Enforced in the database, not just
-- the UI: two collecting plans would make "which plan does this transaction go
-- to" ambiguous, and the answer would depend on row order. A partial unique
-- index is the standard way to express "at most one true per group".
--
-- Scoped per (user_id, account_id), not per user: plans are account-scoped, and
-- a plan can only ever collect transactions in its own account (see the guard
-- in 2.2). One collecting plan per account is the only coherent granularity.
create unique index if not exists plans_one_collecting_per_account
  on public.plans (user_id, account_id)
  where is_collecting;
```

**Turning collecting ON must turn it off elsewhere in the same account**, or the
index will (correctly) reject the write. Do that in a single statement so it
can't half-apply:

```sql
-- Called from the client as two chained updates, or better, one RPC.
-- Recommendation: two updates in sequence is fine here (single-user app, and
-- the unique index is the real guarantee) — but the clear MUST run first, or
-- the set will violate the index.
update public.plans set is_collecting = false
  where account_id = $1 and is_collecting;      -- clear first
update public.plans set is_collecting = true  where id = $2;   -- then set
```

### 2.2 Data Layer

**`useCollectingPlan()`** (new, `hooks/useCollectingPlan.js`) — returns the
active account's collecting plan, or `null`:

- Queries `plans` where `is_collecting` and `account_id = activeAccountId`.
- **The account guard is load-bearing**: `transactions.plan_id` has no
  constraint tying it to the same account as the transaction, so a collecting
  plan in account A could silently swallow a transaction created in account B —
  producing a plan whose contents span accounts, which nothing else in the app
  expects. Scope the hook to `activeAccountId` and the problem cannot occur.
- Subscribed to `useDataRefresh`'s `version` like every read hook.

**`AddTransactionSheet`** — in `open(payload)`, for a **new** entry only (never
when editing, `payload?.id`):

```js
setPlanId(payload?.plan_id ?? collectingPlan?.id ?? null);
```

An explicit `plan_id` in the payload (Plan Detail's "Add Expense") always wins
over the collecting default. **Editing an existing transaction must never have
its plan silently reassigned** — that would rewrite history every time you fixed
a typo.

**Visibility is non-negotiable.** When the plan came from collecting mode rather
than the user, the sheet shows it as a normal, obvious selection in the existing
"Add to Plan" field — not a hidden default. The user must be able to see it and
clear it before saving. This is the line between "it just collects" and "it
silently mis-files my money".

### 2.3 Components

- **`AddPlanSheet`** — a "Collect new transactions into this plan" switch.
  Turning it on clears the flag on any other plan in the same account first (see
  the SQL note above).
- **`app/(tabs)/plans.js`** — the collecting plan's card shows a **"Collecting"**
  pill so it's obvious at a glance which one is armed. A plan silently eating
  your transactions with no indication anywhere is the nightmare version of this
  feature.
- **`app/plan/[id]/index.js`** — the same switch, so it can be turned off from
  the plan you're looking at.
- **Marking a plan complete clears `is_collecting`** — a finished trip must not
  keep collecting. Wire this into the existing `toggleStatus`.

### 2.4 Navigation / Integration

No new routes.

### 2.5 Impact on Existing Features

| Feature | Impact | Watch for |
|---|---|---|
| `AddTransactionSheet` | New default for `planId` on create | Must NOT apply when editing |
| `DetectedTransactionHandler` / `ShareIntentHandler` | Both call `openAdd(...)`, so they inherit the default for free | This is the main point of the phase — a detected bank transaction lands in the trip |
| `PayBillSheet` | **Deliberately not affected** | A bill is not part of your trip |
| `plans` | +1 column, +1 partial unique index | Clear-then-set ordering, or the index rejects the write |
| Plan completion | Clears `is_collecting` | Otherwise a finished plan keeps eating transactions |

### 2.6 What This Phase Does NOT Include

- Auto-tagging by date range (rejected — see Context).
- More than one collecting plan at a time (the index forbids it deliberately).
- Bill payments defaulting into a plan.

### 2.7 Phase 2 Checklist — Before Marking Complete

- [ ] `plan_collecting_mode` migration applied; the partial unique index exists
- [ ] Turning collecting on for plan B clears it from plan A **in the same
      account** — verified by two plans, not by reading the code
- [ ] The DB **rejects** two collecting plans in one account (test it directly;
      the index is the real guarantee, the UI is a convenience)
- [ ] A new transaction defaults into the collecting plan, and the plan is
      **visibly selected** in the sheet before saving
- [ ] Editing an existing transaction does **not** reassign its plan
- [ ] An auto-detected transaction lands in the collecting plan
- [ ] A collecting plan in account A does **not** capture a transaction created
      in account B
- [ ] Marking the plan complete clears `is_collecting`
- [ ] The Plans list shows a "Collecting" pill on the armed plan
- [ ] `npx expo export --platform android` bundles clean

**→ Stop here. Show the result and wait for approval.**

---

## Phase 3 — Where The Money Went

### Goal

Plan Detail answers "what did we actually spend it on", not just "how much".

### Before Starting — Confirm Phase 2 is Approved

Then verify:

1. **`lib/analytics.js`** — `computeCategoryBreakdown(transactions, type)` and
   `getCategoryColor(category)` (takes the whole category object, not an id).
2. **`components/DonutChart.js`** — its exact props, as used in `app/analytics.js`.
3. **`usePlanCandidates`/Plan Detail's transaction list** — the breakdown is
   computed from transactions the screen **already has**. No new query.

### 3.1 Database

No database changes in this phase.

### 3.2 Data Layer

None. `computeCategoryBreakdown` is pure and already takes exactly what Plan
Detail already holds. This phase is the payoff for that function having been
written pure in the first place.

### 3.3 Components

- **`app/plan/[id]/index.js`** — a "Where it went" card: donut + a ranked
  category list with amounts and share-of-total.
- Hidden entirely below ~2 categories — a one-slice donut is a circle, and a
  circle is not information. (This is precisely why charts were cut from the
  *budget* detail screen, where a category budget always has exactly one slice.)

### 3.4–3.5 Navigation / Impact

No routes. No impact beyond Plan Detail.

### 3.6 What This Phase Does NOT Include

- Day-of-week or trend charts on a plan — a trip is too short for either to say
  anything. Revisit for long-running plans if it comes up.
- Comparing a plan against another plan.

### 3.7 Phase 3 Checklist — Before Marking Complete

- [ ] Donut renders from the transactions already on screen (no new query)
- [ ] Category colours come from `getCategoryColor`, matching Analytics
- [ ] The card is hidden when the plan has fewer than 2 categories
- [ ] Percentages sum to 100 and the ranked list matches the donut
- [ ] `npx expo export --platform android` bundles clean

**→ Stop here. Show the result and wait for approval.**

---

## Data Model Summary (Final State After All Phases)

```
plans
  id, user_id, account_id, name, icon, target_amount (nullable),
  start_date, end_date (nullable), status ('active'|'completed'), created_at
  is_collecting  boolean NOT NULL DEFAULT false          ← NEW (Phase 2)
    + partial unique index (user_id, account_id) WHERE is_collecting
      — at most one collecting plan per account, enforced in the DB

transactions
  plan_id  →  unchanged. Still the ONLY expression of plan membership.
              Phase 1 writes it in bulk; Phase 2 defaults it on create.
              ON DELETE SET NULL — deleting a plan un-tags, never deletes.

No new tables. No new views. Nothing derived is stored — v_plans_with_totals
already computes a plan's totals from plan_id, and it needs no change at all
for any of this.
```

---

## Out of Scope (All Phases)

- **`exclude_from_budgets` on a plan** — a trip currently blows through your
  ordinary budgets, because `v_budgets_with_spent`'s lateral never looks at
  `plan_id`. Excluding a plan's spend from budgets is a real idea and a clean
  SQL change, but it redefines what a budget *means*. Needs its own decision.
- **Plans as savings goals** — `v_plans_with_totals` sums expenses only, and the
  pace vocabulary settles `target_amount` as a spending cap. If a plan should
  instead accumulate *contributions* toward a goal, that is a different feature
  (income/transfers, not expenses) and it must be decided before anything else
  is layered on plans. Flagged, not answered.
- **Suggested membership** ("these 12 transactions look like your trip") — needs
  a heuristic worth trusting; bulk-select with filters gets 90% of the value
  with 0% of the guessing.
- **Plan templates / recurring plans** — a plan is a one-off by definition. If
  something recurs, it's a bill or a budget.
