# Feature: Plans That Actually Collect
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/09-plans-that-collect.md`
**Status**: All 3 phases built (bundle- & DB-verified; on-device pending)
**Last Updated**: 2026-07-14

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

## Phase 1 — Add From History ✅ Complete

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

- [x] `/plan/<id>` still renders after the routing restructure *(route tree
      verified — `[id]/index.js` + `[id]/history.js` siblings, clean bundle
      confirms Metro resolved both; on-device render pending — needs
      `npx expo start -c`, see note)*
- [x] The candidate list includes **untagged** transactions (the `neq`-skips-NULL
      trap) — **verified against the real DB**: 22 expenses, all `plan_id IS
      NULL`; the `plan_id.is.null,plan_id.neq.X` OR-clause keeps all 22, a bare
      `.neq` keeps 0
- [x] Transactions in another plan appear, labelled, and can be reassigned
      *(synthetic query: other-plan row → shown; reassign = bulk `UPDATE ...
      plan_id`; muted `Pill` wired in the row)*
- [x] Transactions already in **this** plan do not appear *(synthetic query:
      this-plan row → hidden)*
- [x] The list is scoped to the **plan's** account, not the active one
      (`usePlanCandidates` filters on `plan.account_id`)
- [x] Date range seeds from the plan's `start_date`/`end_date` when present
      (`seededRef` effect; falls back to last 30 days)
- [x] Bulk assign writes `plan_id` for every selected row and calls
      `notifyChanged()`; Plan Detail shows them immediately on return *(code
      path verified; on-device return-refresh pending)*
- [x] Footer total matches the sum of what's ticked (computed from the selected
      map, stable across filter changes)
- [x] `npx expo export --platform android` bundles clean *(1 Android bundle,
      7.74 MB, no errors)*

### 1.8 Implementation Notes (2026-07-14)

- **Routing restructure done via `git mv`** so history is preserved:
  `app/plan/[id].js` → `app/plan/[id]/index.js`, plus new
  `app/plan/[id]/history.js`. All relative imports in `index.js` deepened one
  level (`../../` → `../../../`). No content change to the detail screen beyond
  imports + the new button. All three `router.push('/plan/${id}')` call sites in
  `app/(tabs)/plans.js` resolve unchanged (Plans is currently a **tab**,
  `app/(tabs)/plans.js` — the skill's nav table listing it as a pushed
  `app/plans.js` is stale).
- **`usePlanCandidates(plan, { from, to, categoryId })`** scopes to
  `plan.account_id` (not `activeAccountId`), expenses only, and expresses the
  exclusion as `.or('plan_id.is.null,plan_id.neq.' + planId)` — the NULL-safe
  form. Verified live (see checklist).
- **"Add from history" is a second button stacked under "Add Expense"** (not
  side-by-side) — `Button` renders `fontSize.xl` extrabold with no icon slot, so
  two on one row cramped the longer label. Vertical stack, outline variant for
  the secondary action.
- **Selection persists across filter changes**: `selected` is an `id → tx` map,
  so the footer count/total reflect everything ticked even after the
  date/category filter hides some rows. Select-all toggles only the currently
  visible set. This matches the doc's "running total of what you're about to
  attribute".
- **`node_modules` was only partially installed in this environment** (419 pkgs,
  `expo-share-intent` missing) — ran `npm install` (→ 834 pkgs) before the export
  would run. Not a code issue.
- **On-device still pending** (no Android SDK/device here, same as every other
  recent feature): actually navigating `/plan/<id>` and `/plan/<id>/history`,
  the return-refresh showing new members on Plan Detail, and the
  `DateTimePicker` UX. **Restart the dev server with `npx expo start -c`** before
  testing — a new route *directory* isn't picked up by an already-running Metro
  (standing rule from `07-onboarding.md`).

**→ Stop here. Show the result and wait for approval.**

---

## Phase 2 — Collecting Mode ✅ Complete

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

- [x] `plan_collecting_mode` migration applied; the partial unique index exists
      *(verified live: `is_collecting boolean NOT NULL DEFAULT false`; index
      `plans_one_collecting_per_account ON plans (user_id, account_id) WHERE
      is_collecting`)*
- [x] Turning collecting on for plan B clears it from plan A **in the same
      account** — **verified directly in the DB** (a DO block armed A, then
      cleared-and-armed B; clear-then-set succeeded)
- [x] The DB **rejects** two collecting plans in one account — **verified
      directly**: the second `insert ... is_collecting=true` raised
      `unique_violation`, caught in the test block
- [x] A new transaction defaults into the collecting plan, and the plan is
      **visibly selected** in the sheet before saving *(code: `setPlanId(payload?.
      plan_id ?? collectingPlan?.id ?? null)`; the collecting plan is in
      `activePlans`, so it resolves and shows in the "Add to Plan" field, green
      and clearable; on-device confirm pending)*
- [x] Editing an existing transaction does **not** reassign its plan *(the
      collecting default is in the `else`/new-entry branch only; the `payload?.id`
      edit branch sets `plan_id` from the tx and is untouched)*
- [x] An auto-detected transaction lands in the collecting plan *(both
      `DetectedTransactionHandler` and `ShareIntentHandler` call `openAdd(...)`
      with no `plan_id` → inherit the default; on-device confirm pending)*
- [x] A collecting plan in account A does **not** capture a transaction created
      in account B *(`useCollectingPlan` is scoped to `activeAccountId`, so a new
      entry only ever sees its own account's collecting plan — guard by design)*
- [x] Marking the plan complete clears `is_collecting` *(`toggleStatus` now
      writes `{ status: 'completed', is_collecting: false }`)*
- [x] The Plans list shows a "Collecting" pill on the armed plan *(both active
      card variants: dark card shows "Collecting" in place of "Active"; no-target
      card gains a "Collecting" pill)*
- [x] `npx expo export --platform android` bundles clean *(7.75 MB, no errors)*

### 2.8 Implementation Notes (2026-07-14)

- **Migration `plan_collecting_mode` applied via Supabase MCP** (not hand-pasted).
  Adds `plans.is_collecting boolean NOT NULL DEFAULT false` + the partial unique
  index. Security advisor after the DDL showed **only the two pre-existing WARNs**
  (`delete_current_user` SECURITY DEFINER, leaked-password-protection) — no new
  finding. No view was recreated, so the `security_invoker` standing rule didn't
  apply.
- **`v_plans_with_totals` deliberately NOT changed** (as the doc's Data Model
  Summary intends) — it doesn't carry `is_collecting`. Which plan is armed is read
  through the new **`hooks/useCollectingPlan.js`** (scoped to `activeAccountId` —
  the load-bearing account guard), and every "is this plan collecting?" check
  compares `plan.id === collectingPlan?.id`.
- **`lib/plans.js` → `setPlanCollecting({ planId, accountId, collecting })`**
  centralises the clear-then-set ordering the unique index requires. Used by the
  Plan Detail toggle; `AddPlanSheet` inlines the same ordering in its save flow
  (it interleaves with the insert/update of the other plan fields).
- **Custom `components/Switch.js` (user request, mid-phase)** — a shadcn-style
  toggle: brand-lime track when on, neutral track when off, sliding white thumb
  (RN `Animated`, non-native driver since it animates `backgroundColor`). Drop-in
  for RN's `Switch` (`value`/`onValueChange`/`disabled`). **Swapped into all six
  call sites**: Settings (×4), `AddBillSheet` (which had hand-rolled
  `trackColor`/`thumbColor` — now removed), onboarding `reminders.js` (×2), plus
  the two new Phase-2 switches (`AddPlanSheet`, Plan Detail).
- **`PayBillSheet` left untouched** — it never calls `openAdd`, so a bill payment
  can't default into a collecting plan (correct per the doc: a bill is not part of
  your trip).
- **On-device still pending** (no Android SDK/device here): the visible-selection
  behaviour in the sheet, an auto-detected transaction actually landing in the
  plan, and the switch/pill live updates.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 3 — Where The Money Went ✅ Complete

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

- [x] Donut renders from the transactions already on screen (no new query) —
      `computeCategoryBreakdown(transactions, 'expense')` runs on the same
      `transactions` array `useTransactions({ planId: id })` already fetched
- [x] Category colours come from `getCategoryColor`, matching Analytics — same
      function, same fallback (`colors.mutedLight`) for an uncategorized entry
- [x] The card is hidden when the plan has fewer than 2 categories
      (`showBreakdown = categoryBreakdown.length >= 2`)
- [x] Percentages sum to 100 and the ranked list matches the donut — true by
      construction (`computeCategoryBreakdown`'s `pct = amount/total*100` over the
      same `total`), and **verified against the DB**: a temp plan with 3
      categories (₹300/₹200/₹100 expense + a ₹5000 income row) confirmed
      `v_plans_with_totals.total_spent` (600) exactly equals the raw
      expense-only sum, and the income row is excluded — the donut's center
      "Total" and the ranked amounts are guaranteed consistent
- [x] `npx expo export --platform android` bundles clean (7.75 MB, no errors)

### 3.8 Implementation Notes (2026-07-14)

- **No new hook, no new query** — `app/plan/[id]/index.js` computes
  `categoryBreakdown`/`donutSegments` via `useMemo` straight from the
  `transactions` state `useTransactions({ planId: id })` already holds. Card
  placed above "Expenses", titled "Where it went", mirroring `app/analytics.js`'s
  layout (`DonutChart` + a ranked `Card` list) but **without deltas** — Plan
  Detail has no "prior period" concept the way Analytics does, so
  `computeCategoryDeltas` was deliberately not reused, only
  `computeCategoryBreakdown` + `getCategoryColor`.
- **Verified the total-consistency invariant directly against the DB**, not just
  by reading the pure function: inserted a temp plan + 3 expense categories +
  1 income transaction, confirmed `v_plans_with_totals.total_spent` (the
  donut's center figure) exactly equals the expense-only sum the breakdown is
  built from, and that the income row is excluded from both — then deleted all
  test rows. `v_plans_with_totals`'s lateral already filters
  `tx.type = 'expense'`, so this was never at risk of drifting, but it's now
  proven rather than assumed.
- **All 3 phases of `09-plans-that-collect.md` are now built.** Remaining Out
  of Scope items (`exclude_from_budgets`, plans-as-savings-goals, suggested
  membership, recurring plans) stand as originally flagged — none were revisited.
- **Bug fixed: "Rendered more hooks than during the previous render" on Plan
  Detail** — found via real on-device testing immediately after this phase
  shipped. The two new `useMemo` calls (`categoryBreakdown`/`donutSegments`)
  were placed *after* the existing `if (!plan) return null` guard. On the
  first render `plan` is still `null` (loading), so React bails out before
  reaching those hooks; once `usePlan` resolves and re-renders, it reaches two
  hooks it never called before — a hook-count mismatch, which React rejects
  outright. **Standing rule for this codebase**: hooks (`useMemo`/`useState`/
  `useEffect`/etc.) must always sit *above* any early `return` in a component,
  never below it — only plain derived `const`s and JSX may follow a guard like
  this. Fixed by moving both `useMemo` calls above the guard (they don't
  actually reference `plan`, only `transactions`, so no logic changed).
- **Bug fixed: donut rendered with no visible colored segments** — found via
  real on-device testing right after the hooks fix above. `hooks/useTransactions.js`
  (which Plan Detail's transaction list — and therefore this phase's
  `categoryBreakdown` — is built from) selected
  `category:categories(id, name, icon)`, **missing `color`**. Every category
  came back with `category.color === undefined`, so `getCategoryColor` fell
  back to `colors.mutedLight` for every segment, indistinguishable from the
  donut's own grey track. Fixed by adding `color` to that select, matching
  `hooks/usePlanCandidates.js` and `hooks/useBills.js`, which already fetch
  it. `useAnalyticsData.js` uses `categories(*)` (all columns), which is why
  Analytics' donut never hit this. **Standing rule**: any hook whose rows feed
  a category-colored chart or swatch must select `color` explicitly —
  `useBudgetDetail.js` still omits it deliberately (no chart on that screen).
- **`DonutChart.js` gained a small 3px flat-cut gap between segments** (user
  request, following the dataviz skill's 2px-surface-gap mark spec, bumped
  slightly for this chart's thicker 22px stroke) and a larger center-amount
  font (`fontSize.lg` → `fontSize.heading`). Both are shared by Analytics'
  Categories donut too, since `DonutChart` is one component. **A rounded-corner
  version ("rounded-sm", not a full pill) was attempted via a custom filled
  `<Path>` with hand-derived corner fillets** (d3 `arc().cornerRadius()`-style)
  but shipped a real visual defect (misaligned/overlapping segments, confirmed
  on-device) that couldn't be diagnosed without a live renderer — the risk of
  further blind SVG arc-sweep-flag debugging wasn't worth it, so it was reverted
  to plain `strokeLinecap="butt"` (flat, sharp-cut ends) with just the gap. If
  rounded corners are wanted again, budget for on-device iteration, not a
  single blind attempt.
- **Collecting switch relocated** (user feedback, on-device: it "looks
  hidden" below the action buttons, next to "Mark as Complete") — moved from
  the bottom of the scroll view to directly under the header, above the
  "Total spent" summary card, so it's the first thing visible with no
  scrolling. It had been grouped visually with a rare status action
  ("Mark as Complete") when it's really an ongoing mode the user needs to
  both see and toggle often (arm before a trip, disarm after) — matching the
  doc's own "visibility is non-negotiable" requirement for this control.

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
