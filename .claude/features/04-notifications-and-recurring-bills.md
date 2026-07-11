# Feature: Notifications & Recurring Bills
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/04-notifications-and-recurring-bills.md`
**Status**: Planned
**Last Updated**: July 2026

---

## Context

FLO currently gives the user no feedback loop beyond the numbers on each
screen. There are three distinct, sequenced pieces of work here, deliberately
bundled into one doc because they build on each other:

1. **In-app toasts** — a Sonner-style transient banner layer. Confirms saves,
   surfaces errors, and warns when a transaction pushes a budget or plan over
   its limit. Pure client-side UI; no backend, no OS permissions. Buildable
   immediately.
2. **Recurring bills & subscriptions** — a new data model for money that
   repeats (rent, Netflix, EMIs). Without a *due date* concept there is
   nothing meaningful to remind the user about, so this must land **before**
   scheduled notifications — which is the whole reason it's sequenced here.
3. **Local scheduled notifications + bell notification center** — OS-level
   reminders (bill due, daily log nudge, budget reset) that fire even when the
   app is closed, plus an in-app inbox behind the Home header bell listing
   current actionable alerts.

**Why local, not remote push**: FLO is single-user, single-device, and every
event happens because the user did something in the app — there is no
server-side event source. Local scheduled notifications (device-only, no
backend) cover every genuinely useful case. Remote push would need a Supabase
Edge Function + `pg_cron` + Expo push tokens to re-implement what local
scheduling already does. It is explicitly **out of scope** (see the bottom of
this doc).

This feature reuses: the bottom-sheet Provider/Context/`forwardRef` pattern,
the `useDataRefresh` version-counter, `v_budgets_with_spent` /
`v_plans_with_totals` (for threshold detection and the alert feed), the
account-scoping pattern (`activeAccountId`), the AsyncStorage-for-device-prefs
pattern already used by `AccountContext` (`flo.activeAccountId`), and
`theme/tokens.js`.

---

## Phase Overview

```
Phase 1 — Toast system
  A custom ToastProvider + useToast() + animated host; wire save/delete
  confirmations and replace standalone error surfaces.

Phase 2 — Smart budget/plan toasts
  On transaction save, detect if it pushed a budget into warn/over or a plan
  past its target, and toast a warning.

Phase 3 — Bills & subscriptions: data + management
  New `bills` table; a Bills screen (list of upcoming/overdue) + Add/Edit Bill
  sheet; menu-sheet entry. Track recurring money without touching the ledger yet.

Phase 4 — Bills: pay → transaction (+ due-today prompt)
  A pay-confirm step (editable amount, or skip-cycle) creates a real
  transaction and advances the due date; an on-open modal surfaces bills
  due today/overdue. Overdue/upcoming states computed client-side.

Phase 5 — Local scheduled notifications
  Install expo-notifications; permission flow; notification settings in
  Settings; schedule bill-due reminders + a daily log reminder; deep-link taps.

Phase 6 — Bell notification center
  Make the Home header bell open a sheet listing current actionable alerts
  (overdue bills, over/near-limit budgets, plans ending/over). Dot reflects
  whether any alerts exist. Computed feed — nothing new stored.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Toast System ✅ Complete

### Goal
The app gains a transient, auto-dismissing banner ("toast") that any screen or
sheet can trigger via a `useToast()` hook. At the end of this phase, saving,
editing, or deleting a transaction shows a confirmation toast, and standalone
errors (that today use `Alert.alert` or vanish silently) surface as error
toasts. It's the Sonner equivalent: in-the-moment feedback, gone in a few
seconds. No persistence, no OS notifications.

### Before Starting — Confirm With Codebase
1. Read `app/_layout.js` — confirm the provider nesting order and where a new
   `ToastProvider` should sit so `useToast()` is callable from **both** screens
   and sheets (it must wrap `BottomSheetModalProvider` and everything below).
2. Read `components/Button.js` and `components/Card.js` to match the
   from-scratch component style (this app builds its own primitives; we build
   the toast, not add a library).
3. Confirm `react-native-safe-area-context` is already a dependency (it is —
   used in `app/settings.js`) for top-inset positioning.
4. Read `components/AddTransactionSheet.js` `handleSave`/`handleDelete` — the
   first call sites to wire (success toast after `notifyChanged()` +
   `dismiss()`; error toast instead of only inline `error` for the save/delete
   failure path — keep the inline form-validation `error` for "Enter an amount").
5. Confirm `colors` has `success`-ish tokens — there is no `success` color;
   use `colors.income`/`colors.incomeBg` for success, `colors.danger`/`dangerBg`
   for error, `colors.warn`/`warnBg` for warn, `colors.ink`/`inkCard` for info.

### 1.1 Database
No database changes in this phase.

### 1.2 Data Layer
No hooks. The toast queue is React state inside `ToastProvider`.

`useToast()` returns `{ showToast }`:

```js
showToast({
  message: 'Transaction saved',
  variant: 'success',          // 'success' | 'error' | 'warn' | 'info'  (default 'info')
  actionLabel: 'Undo',         // optional
  onAction: () => {...},        // optional; runs then dismisses
  duration: 3000,               // optional ms; default 3000, 5000 if action present
});
```

Multiple toasts stack (max 3 visible; older ones drop). Each auto-dismisses on
its timer; tap-to-dismiss; the whole host is `pointerEvents="box-none"` so it
never blocks the UI underneath.

### 1.3 Components

```
components/
  Toast.js        ← NEW. Exports ToastProvider, useToast, and the internal ToastHost.
```

- **`ToastProvider`** — holds the queue (`useState` array of `{ id, ...opts }`),
  exposes `showToast` via context (memoized), renders `{children}` then
  `<ToastHost toasts={...} onDismiss={...} />`.
- **`ToastHost`** — absolutely positioned `View` pinned to the top using
  `useSafeAreaInsets().top`, `pointerEvents="box-none"`, high `zIndex`/`elevation`.
  Maps toasts to `<ToastItem>`.
- **`ToastItem`** — a single banner. `Animated` slide-down + fade-in on mount,
  fade-out on dismiss. Left accent/icon by variant (`lucide-react-native`:
  `Check` / `TriangleAlert` / `Info` / `X`), message text, optional action
  button. Styled from `tokens.js` (rounded `radii.card`, `colors.ink` card for
  info, tinted bg per variant). Match the shadow/elevation used on `Card`.

### 1.4 Navigation / Integration
- Mount `ToastProvider` in `app/_layout.js` **around** `BottomSheetModalProvider`
  (inside `AccountProvider`), so both screens and sheets can call `useToast()`
  and toasts render above screen content. Toasts are shown *after* a sheet
  dismisses, so host-vs-sheet z-order isn't a concern in practice.
- Wire `AddTransactionSheet.handleSave`: on success →
  `showToast({ message: editingId ? 'Transaction updated' : 'Transaction saved', variant: 'success' })`.
- Wire `AddTransactionSheet.handleDelete`: on success →
  `showToast({ message: 'Transaction deleted', variant: 'success' })`.
- Save/delete **failure** paths → `showToast({ message: <error>, variant: 'error' })`
  (in addition to, or instead of, the existing inline error — keep inline for
  the "Enter an amount" validation only).

### 1.5 Impact on Existing Features
| Area | Change | Watch for |
|---|---|---|
| `app/_layout.js` | One new provider in the tree | Order — must wrap the sheet providers |
| `AddTransactionSheet.js` | Adds `useToast()` + success/error toasts | Don't double-report (inline + toast) for the same validation error |

### 1.6 What This Phase Does NOT Include
- No budget/plan threshold logic (Phase 2).
- No wiring of the *other* sheets (Budget/Plan/Category/Account/Profile) — only
  Add Transaction. Those can be wired opportunistically later; not required here.
- No OS notifications, no persistence, no bell inbox.

### 1.7 Phase 1 Checklist — Before Marking Complete
- [x] `components/Toast.js` exports `ToastProvider`, `useToast`, mounted in `_layout.js`.
- [x] `useToast()` throws a clear error if used outside the provider (matches other contexts).
- [x] A toast appears on transaction save/update/delete and auto-dismisses.
- [x] Toasts stack (≤3), tap-to-dismiss works, host never blocks touches beneath it.
- [x] Variants render distinct colors/icons from `tokens.js` (no inline hex, aside from `rgba()` alpha-overlays for the icon badge — an established pattern already used in `IconTile.js`/`settings.js`).
- [x] Save/delete errors surface as an error toast.
- [x] `npx expo export --platform android` bundles cleanly.

**→ Stop here. Show the result and wait for approval.**

### Implementation Notes
- No deviations from the plan. `components/Toast.js` built from scratch
  (`Animated` slide-down + fade, no library), mounted in `app/_layout.js`
  wrapping `BottomSheetModalProvider` per the plan (inside `AccountProvider`).
- `AddTransactionSheet.js`: save/delete failures now show an error toast
  instead of the old inline `error` text; the "Enter an amount" client-side
  validation still uses inline `error` (kept, as planned — it's about an
  unsubmitted field, not a request failure).
- Icon badge on `ToastItem` uses a translucent overlay (`rgba(0,0,0,0.06)` on
  light variants, `rgba(255,255,255,0.16)` on the dark `info` variant) since a
  flat token color would either vanish against the tinted background or clash
  — this is the same technique `IconTile.js` already uses, not a new pattern.
- **Scope expanded post-approval (2026-07-11)**: after testing Phase 1+2, the
  user expected toasts across the whole app, not just Add Transaction — the
  original "Phase 1 wires only Add Transaction, others opportunistically
  later" scoping (1.6) read as a bug when tested end-to-end. Wired the same
  toast pattern into every remaining mutation-bearing sheet in one pass:
  `AddBudgetSheet`, `AddPlanSheet`, `AddAccountSheet`, `AddCategorySheet`,
  `EditProfileSheet` (create/update/delete → success toast; save/delete
  failure → error toast; unsubmitted-field validation stays inline `error`,
  unchanged), `AccountSwitcherSheet` (switching to a different account →
  "Switched to `<name>`", suppressed if re-selecting the already-active one),
  and `manage-categories.js`'s delete action (was `Alert.alert('Error', ...)`
  on failure, now an error toast; added a success toast). Left alone by
  design: `Alert.alert` destructive-confirmation/guard dialogs (delete
  confirmation, "in use" guards) — those still block for a decision and
  aren't a toast's job; `MenuSheet`'s Log Out (navigates away immediately);
  Settings' Delete Account flow (has its own modal with inline error, and
  navigates to sign-in on success — a toast would be orphaned by the redirect).

### Toast Trigger Reference (Current State, After Scope Expansion)

| Sheet / Screen | Success toast | Error toast | Notes |
|---|---|---|---|
| `AddTransactionSheet` | "Transaction saved" / "Transaction updated" / "Transaction deleted" | ✓ save/delete failure | Plus Phase 2 warn toasts on over-threshold budget/plan (new expense only) |
| `AddBudgetSheet` | "Budget created" / "Budget updated" / "Budget deleted" | ✓ save/delete failure | |
| `AddPlanSheet` | "Plan created" / "Plan updated" / "Plan deleted" | ✓ save/delete failure | |
| `AddAccountSheet` | "Account created" / "Account updated" / "Account deleted" | ✓ save/delete failure | "In use" / "cannot delete" guards stay `Alert.alert`, unchanged |
| `AddCategorySheet` | "Category created" | ✓ save failure | Create-only sheet (no edit path exists) |
| `EditProfileSheet` | "Profile updated" | ✓ permission denied, upload failure, save failure | |
| `AccountSwitcherSheet` | "Switched to `<name>`" | — | Suppressed when re-selecting the already-active account |
| `manage-categories.js` | "Category deleted" | ✓ delete failure | "In use" guard stays `Alert.alert` |
| `MenuSheet` (Log Out) | — | — | Navigates away immediately; a toast would be orphaned |
| Settings (Delete Account) | — | ✓ (inline in its own modal, not a toast) | Navigates to sign-in on success |

---

## Phase 2 — Smart Budget/Plan Toasts ✅ Complete

### Goal
When the user saves an **expense**, if that expense pushes a relevant budget to
≥80% (`warn`) or over 100% (`over`) for the current period, or pushes a plan
past its `target_amount`, a warning toast tells them immediately (e.g. "Food
budget at 92% this month" / "Over your Goa Trip plan by ₹1,200"). This is the
in-app equivalent of an alert, delivered at the exact moment it becomes true.

### Before Starting — Confirm Phase 1 is Approved
1. Re-read `hooks/useBudgets.js` — confirm `budgetStatus(spent, amount)` returns
   `'healthy' | 'warn' | 'over'` and the view columns (`spent`, `remaining`,
   `amount`, `category_id`, `period`, `account_id`).
2. Re-read `hooks/usePlans.js` / `v_plans_with_totals` columns (`total_spent`,
   `remaining`, `target_amount`, `status`, `account_id`).
3. Confirm the save flow order in `AddTransactionSheet.handleSave`: insert →
   `notifyChanged()` → dismiss. The threshold check must read **post-insert**
   state, so it queries the views *after* the insert succeeds.

### 2.1 Database
No database changes. Reuses `v_budgets_with_spent` and `v_plans_with_totals`.

### 2.2 Data Layer
New pure helper module so the logic is testable and out of the sheet:

```
lib/alerts.js   ← NEW
```

- `budgetToastForSave({ categoryId, accountId })` — after a successful expense
  insert, query `v_budgets_with_spent` for the active account where
  `category_id = categoryId` OR `category_id IS NULL` (overall budget). For each,
  compute `budgetStatus(spent, amount)`; if `warn`/`over`, return a message
  string. Returns the single most-severe message (`over` beats `warn`) or `null`.
- `planToastForSave({ planId })` — if `planId` set, query `v_plans_with_totals`
  for that plan; if `target_amount` is set and `total_spent > target_amount`,
  return "Over your <name> plan by ₹X". Else `null`.

Both are plain async functions taking the ids and doing their own Supabase read
(not hooks — they run once, imperatively, right after save). Money formatted
with the standard `₹${Math.round(n).toLocaleString('en-IN')}` helper.

### 2.3 Components
No new components. `AddTransactionSheet` calls the helpers after a successful
save and passes any returned message to `showToast({ variant: 'warn' })`.

### 2.4 Navigation / Integration
In `AddTransactionSheet.handleSave`, after `notifyChanged()` and before/after
`dismiss()` (order such that the toast still fires post-dismiss):

```js
if (!editingId && type === 'expense') {
  const budgetMsg = await budgetToastForSave({ categoryId, accountId: activeAccountId });
  const planMsg = planId ? await planToastForSave({ planId }) : null;
  if (budgetMsg) showToast({ message: budgetMsg, variant: 'warn' });
  if (planMsg) showToast({ message: planMsg, variant: 'warn' });
}
```

(Keep the plain "Transaction saved" success toast from Phase 1; a warn toast is
additive.)

### 2.5 Impact on Existing Features
| Area | Change | Watch for |
|---|---|---|
| `AddTransactionSheet.js` | Two extra reads after save | Slight latency; run after dismiss so the sheet closes snappily. Only on expense inserts, not edits. |

### 2.6 What This Phase Does NOT Include
- Not on edits or deletes (only new expense inserts).
- No "crossing" detection (was-healthy→now-warn). It toasts whenever the result
  is warn/over, which can repeat if the user keeps adding while already over —
  accepted as a v1 simplification; note it in Implementation Notes.
- No income/refund alerts. No plan-nearing (only strictly over target).

### 2.7 Phase 2 Checklist — Before Marking Complete
- [x] `lib/alerts.js` exports `budgetToastForSave` and `planToastForSave`.
- [x] Saving an expense that pushes a category or overall budget to ≥80% toasts a warn.
- [x] Saving an expense to a plan past its target toasts a warn.
- [x] No toast when under all thresholds; no threshold toast on edits/income.
- [x] Sheet still dismisses immediately (no visible lag from the extra reads).
- [x] Bundles cleanly.

**→ Stop here. Show the result and wait for approval.**

### Implementation Notes
- No deviations from the plan. `lib/alerts.js` queries `v_budgets_with_spent`
  filtered to `account_id` + (`category_id = categoryId` OR `category_id IS
  NULL`) via a single PostgREST `.or()` call, picks the most-severe result
  (`over` beats `warn`) using the existing `budgetStatus` helper from
  `useBudgets.js`, and separately checks the attached plan's
  `v_plans_with_totals` row against its `target_amount`.
- `AddTransactionSheet.handleSave`: the success toast still fires immediately
  after `dismiss()`; the two threshold reads run after that, so the sheet
  closes with no perceptible delay and the warn toast(s) simply appear a beat
  later, stacking on top of the success toast (Phase 1's 3-toast queue).
- As flagged in the plan, this toasts on every warn/over save, not just the
  crossing — confirmed with the user as acceptable for v1 (repetitive-toast
  concern was raised during planning and explicitly deferred, not revisited
  during implementation).
- Not wired into `AddBudgetSheet`/`AddPlanSheet`/`AddAccountSheet` — per
  Phase 1's precedent, only Add Transaction is a tracked deliverable; other
  sheets pick up `useToast()` opportunistically.

---

## Phase 3 — Bills & Subscriptions: Data + Management ✅ Complete

### Goal
The user can record recurring money — subscriptions (Netflix), bills (rent,
electricity), EMIs — each with an amount, a cadence (weekly/monthly/yearly), a
next due date, an optional category, and an account. A new **Bills** screen
lists them grouped by upcoming vs overdue, and an Add/Edit Bill sheet
creates/edits/deletes them. This phase is useful on its own: a subscription
tracker. It does **not** yet touch the transactions ledger (that's Phase 4).

### Before Starting — Confirm With Codebase
1. Read `components/AddBudgetSheet.js` as the closest structural template
   (account-scoped create/edit with category picker + a period-ish select).
2. Read `components/AddAccountSheet.js`'s **delete guard** — Phase 3 must add
   `bills` to the account-in-use check so an account with bills can't be deleted
   out from under them (or is fallback-switched), matching how transactions/
   budgets/plans are guarded there.
3. Confirm `MenuSheet.js` `ITEMS` array — add a "Bills" entry (route `/bills`)
   alongside Analytics/Settings.
4. Read `app/(tabs)/budgets.js` for the list-screen layout idiom (header, cards,
   empty state, `useSafeAreaInsets`) to match Bills to it.
5. Confirm the new-migration FK conventions from `00-index.md`: `user_id` →
   `auth.users` **`ON DELETE CASCADE`** (so account deletion / Phase-02 cascade
   work without another migration), `account_id` → `accounts`, `category_id` →
   `categories` `ON DELETE SET NULL`.

### 3.1 Database

Paste into the Supabase SQL editor, confirm applied, then build against it.
**This block is the durable schema record for `bills`.**

```sql
CREATE TABLE public.bills (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id     uuid NOT NULL REFERENCES public.accounts(id),
  category_id    uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name           text NOT NULL,
  amount         numeric NOT NULL CHECK (amount > 0),
  cadence        text NOT NULL CHECK (cadence IN ('weekly', 'monthly', 'yearly')),
  next_due_date  date NOT NULL,
  last_paid_date date,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own bills"
  ON public.bills FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- FK-covering indexes (matches the perf-advisor standard set in 00-index.md
-- and the pattern already on transactions/budgets/plans/accounts — every one
-- of those has a user_id index too, not just account_id/category_id)
CREATE INDEX idx_bills_user_id     ON public.bills (user_id);
CREATE INDEX idx_bills_account_id  ON public.bills (account_id);
CREATE INDEX idx_bills_category_id ON public.bills (category_id);
```

Notes:
- No `updated_at` — consistent with the rest of the schema.
- `last_paid_date` (nullable) records the last time the user actually marked
  this bill **paid** (a real payment — *not* a skipped cycle, so the "Last
  paid …" label never lies). It's a plain *fact* ("this happened on this
  date"), not a derived running total, so it doesn't violate the
  compute-don't-store rule — and since a paid bill becomes an ordinary
  transaction with **no `bill_id` back-link** (see Phase 4), it genuinely can't
  be derived. Used only to show "Last paid …" on the bill card. Null until
  first paid.
- No view. A bill's `amount` is the expected charge, not a derived total, so it
  doesn't violate the compute-don't-store rule. Overdue/upcoming is computed
  client-side from `next_due_date` (Phase 4).
- RLS uses `(select auth.uid())` per the standing perf rule.

### 3.2 Data Layer

```
hooks/useBills.js   ← NEW
```

Standard read-hook shape (subscribed to `version`, account-scoped like
`useBudgets`):

```js
const { data } = await supabase
  .from('bills')
  .select('*, category:categories(name, icon, color)')
  .eq('account_id', activeAccountId)
  .order('next_due_date', { ascending: true });
```

Returns `{ bills, loading, refetch }`. A plain exported helper
`billStatus(nextDueDate)` → `'overdue' | 'due_soon' | 'scheduled'`
(`due_soon` = within 3 days), used by the list and later the alert feed.

Mutations (create/edit/delete) live inline in `AddBillSheet` per the mutation
pattern, calling `notifyChanged()` on success.

### 3.3 Components

```
app/
  bills.js               ← NEW. Pushed screen: list of bills, grouped overdue → due soon → scheduled.
components/
  AddBillSheet.js        ← NEW. Provider/Context/forwardRef create+edit+delete sheet.
```

- **`app/bills.js`** — header ("Bills") with back button (matches
  `settings.js`), a "＋ Add" affordance opening `AddBillSheet`, and a list of
  bill cards: name, category icon, cadence label, next-due date
  (`format(date, 'd MMM')`), amount, an optional "Last paid …" line
  (`last_paid_date`, hidden until first paid), and a small status pill
  (overdue = danger, due soon = warn, scheduled = neutral). Empty state matches
  the other tabs. Account-scoped to the active account.
- **`AddBillSheet.js`** — fields: name, amount, cadence
  (weekly/monthly/yearly segment), next due date, category (chip row like
  AddTransactionSheet, expense categories), an "Active" toggle (pause without
  deleting).
  - **Next-due-date UX** (decided in planning): cadence alone can't set the
    date (monthly ≠ *which* day), so there's an explicit next-due-date
    `DateTimePicker`. It **auto-fills a suggestion but stays fully editable** —
    default to today on open; when the user changes cadence, bump the
    suggestion forward by that interval from today (`addWeeks/Months/Years`)
    *only if the user hasn't manually set a date yet*, so we never overwrite an
    explicit choice. Cadence governs how the date advances after each payment
    (Phase 4); the picker is the anchor for the *first* due date.
  - Create/edit/delete, inline validation error, `notifyChanged()` on success,
    success toast (reuse Phase 1). Writes `account_id: activeAccountId` on
    create; never reassigns it on edit (matches budgets/plans).

### 3.4 Navigation / Integration
- `MenuSheet.js`: add `{ key: 'bills', label: 'Bills', route: '/bills', icon: <Receipt/> }`
  to `ITEMS` (import `Receipt` from lucide). Bump the sheet snap point for the
  extra row.
- `AddAccountSheet.js` delete guard: include a `bills` in-use count in the
  existing check.

### 3.5 Impact on Existing Features
| Area | Change | Watch for |
|---|---|---|
| `MenuSheet.js` | New "Bills" row + taller snap point | — |
| `AddAccountSheet.js` | Delete guard now also counts bills | Don't let an account with bills be silently deleted |
| Account cascade | `bills.user_id` is CASCADE, so user-deletion still fully purges | Confirm in `00-index.md`'s deletion notes |

### 3.6 What This Phase Does NOT Include
- No "mark as paid", no transaction creation, no due-date advancing, no
  skip-cycle, no due-today prompt (all Phase 4). `last_paid_date` exists in the
  schema but stays null this phase.
- No notifications (Phase 5). Bills are visible only inside the app.
- No auto-detection of bills from transactions/SMS.

### 3.7 Phase 3 Checklist — Before Marking Complete
- [x] `bills` table (incl. `last_paid_date`) + RLS + indexes applied; SQL block matches live schema.
- [x] `useBills` returns account-scoped bills ordered by due date; `billStatus` helper exported.
- [x] Bills screen lists/creates/edits/deletes bills; reachable from the menu sheet.
- [x] `AddBillSheet` writes `account_id`, validates, toasts on save.
- [x] Next-due-date field auto-suggests (from cadence) but stays editable; never overwrites a manual choice.
- [x] Deleting an account with bills is guarded in `AddAccountSheet`.
- [x] Bundles cleanly.

**→ Stop here. Show the result and wait for approval.**

### Implementation Notes
- Applied directly via the Supabase MCP (`apply_migration`), not manual
  SQL-editor paste — consistent with how every other migration this session
  has been handled (the MCP is connected; see `00-index.md`). Verified via
  `information_schema.columns` and the security/performance advisors after.
- **Caught by the performance advisor, not the plan**: the original SQL block
  only indexed `account_id`/`category_id`, missing a `user_id` index — every
  other table (`transactions`, `budgets`, `plans`, `accounts`) has one
  (`idx_*_user`), and the advisor flagged `bills_user_id_fkey` as uncovered
  immediately after applying. Fixed with a follow-up `idx_bills_user_id`
  migration; the doc's SQL block (3.1) has been corrected to include it so
  future copy-paste doesn't reintroduce the gap. Security advisor was and
  remains clean (only the two pre-existing, unrelated items).
- `hooks/useBills.js`: `billStatus` uses `differenceInCalendarDays` +
  `startOfDay` (both `date-fns`) rather than raw `Date` subtraction, to avoid
  time-of-day/DST edge cases when comparing dates.
- `AddBillSheet.js`: "Active/Paused" is a segmented control (matching the
  Week/Month, Expense/Income segments already used throughout the app), not
  React Native's `Switch` — `Switch` isn't used anywhere else in this
  codebase and would have introduced a visually inconsistent control.
- Category picker on `AddBillSheet` reuses `AddBudgetSheet`'s exact
  toggle-then-chip-grid pattern (not `AddTransactionSheet`'s always-visible
  horizontal chip row), since both are "optional category" fields — the doc's
  own "closest structural template" guidance.
- `app/bills.js` follows `settings.js`/`manage-categories.js`'s pushed-screen
  shape (`SafeAreaView` + back button, light theme) rather than the tab
  screens' `Screen` wrapper, since Bills is reached via the menu sheet, not a
  tab. Status pill (`Pill` component, reused as-is) only renders for
  `overdue`/`due_soon`, mirroring how the Budgets tab hides its pill for the
  `healthy` state — no pill for `scheduled`.
- No deviations from the plan otherwise.

---

## Phase 4 — Bills: Pay → Transaction (+ Due-Today Prompt)

### Goal
A bill becomes actionable through a **pay-confirm step**: the user reviews the
bill, tweaks the amount if it varies (electricity), and marks it paid — which
creates a real expense transaction and advances `next_due_date` by cadence.
They can also **skip a cycle** (advance the date, no transaction) when a charge
didn't happen. And on app open, a **due-today prompt modal** proactively
surfaces any bills due today or overdue so they're paid on time, not forgotten.
Now bills flow into the ledger and balances/budgets reflect them.

This phase folds in the user's refined vision (2026-07-11 planning discussion):
editable amount at pay time, skip-cycle, and the on-open due prompt. The
"2–3 days before / day before" *push* reminders remain Phase 5 (they need OS
notifications); this phase is the in-app pay experience.

### Before Starting — Confirm Phase 3 is Approved
1. Re-read `AddTransactionSheet.handleSave`'s insert payload shape (columns:
   `type, amount, category_id, plan_id, occurred_at, note, account_id`).
2. Confirm `date-fns` `addWeeks`/`addMonths`/`addYears` are available
   (`date-fns` is already a dependency).
3. Re-read `app/settings.js`'s `Modal`-based delete-account confirmation as the
   pattern for the due-today modal (transparent overlay, card, action buttons).
4. Confirm the AsyncStorage device-pref pattern (`flo.activeAccountId` in
   `AccountContext`) for the "last shown" key the due prompt uses.

### 4.1 Database
No schema changes — `last_paid_date` already exists (Phase 3). This phase is
the first to write to it. (Still no `bill_id` FK on `transactions` — a paid
bill becomes a plain transaction; back-link remains **out of scope**.)

### 4.2 Data Layer

```
lib/bills.js   ← NEW (shared because two surfaces call it: the Bills list and
                 the due-today modal — this is exactly the reuse case that
                 justifies a helper over an inline mutation)
```

- `advanceDueDate(dateStr, cadence)` — pure: returns the next `yyyy-MM-dd`
  after applying `addWeeks/addMonths/addYears(…, 1)`.
- `markBillPaid(bill, { amount, occurredAt })` — `amount` defaults to
  `bill.amount`, `occurredAt` defaults to today:
  1. Insert a transaction `{ type: 'expense', amount, category_id:
     bill.category_id, plan_id: null, occurred_at: occurredAt, note: bill.name,
     account_id: bill.account_id }`.
  2. If insert fails → return the error (do **not** advance; caller shows an
     error toast).
  3. Update the bill: `next_due_date = advanceDueDate(bill.next_due_date,
     bill.cadence)`, `last_paid_date = occurredAt`.
  4. Return success; caller calls `notifyChanged()` + success toast
     "`<name>` marked paid".
- `skipBillCycle(bill)` — advances `next_due_date` only (no transaction, does
  **not** touch `last_paid_date`, so "Last paid …" stays truthful). Caller
  `notifyChanged()` + info toast "Skipped `<name>` this cycle".

`billStatus` (from Phase 3) drives the visible overdue/due-soon pills and, in
Phase 6, the alert feed.

### 4.3 Components

```
components/
  PayBillSheet.js     ← NEW. Provider/Context/forwardRef confirm sheet.
  DueBillsModal.js    ← NEW. On-open prompt for due/overdue bills.
```

- **`PayBillSheet`** — opened via `usePayBillSheet().openPayBill(bill)` from
  both the Bills list ("Mark paid" on a card) and the due-today modal. Shows:
  bill name, an **editable amount** field (pre-filled with `bill.amount`), the
  paid date (defaults today, editable via `DateTimePicker`), and actions:
  **Mark as Paid** (calls `markBillPaid` with the edited amount/date), **Skip
  this cycle** (calls `skipBillCycle`), and Cancel. On success: dismiss,
  `notifyChanged()`, toast. Dark sheet matching the others. *Optional, if
  trivial*: after a successful pay, run Phase 2's `budgetToastForSave` so a
  bill that blows a budget still warns — reuse it, since the helper already
  exists.
- **`DueBillsModal`** — a `Modal` (like Settings' delete confirmation) that, on
  app open, lists the active account's bills with `next_due_date <= today`
  (due today + overdue), each with a **Mark paid** (→ opens `PayBillSheet`) and
  the modal offering a **Later** dismiss. Shows **at most once per calendar
  day**, gated by an AsyncStorage key `flo.dueBills.lastShown` (a `yyyy-MM-dd`
  string; show only if stored date < today, then write today). Renders nothing
  when there are no due bills. One modal listing all due bills — never one
  modal per bill.

### 4.4 Navigation / Integration
- Bills screen (`app/bills.js`): each card's primary action opens
  `PayBillSheet`; overdue/due-soon cards can also show it more prominently.
- `PayBillSheetProvider` mounted in `app/_layout.js` alongside the other sheet
  providers.
- `DueBillsModal` mounted as a sibling near `<Stack>` in `_layout.js` (the
  `ShareIntentHandler` spot — it needs `useBills`, `usePayBillSheet`, and the
  account context, so it can't be `RootNavigator` itself).

### 4.5 Impact on Existing Features
| Area | Change | Watch for |
|---|---|---|
| Transactions/Home/Budgets | A paid bill now appears as a transaction and moves balances | Correct account + category; the edited amount + chosen date |
| `app/_layout.js` | New sheet provider + due-modal sibling | Provider order; modal must not fight the sign-in redirect (only show when a session + active account exist) |
| Bills list | Cards gain pay/skip actions + "Last paid …" | — |

### 4.6 What This Phase Does NOT Include
- No `bill_id` link on the created transaction (it's a normal transaction after;
  edit/delete it like any other).
- No "undo paid" beyond deleting the created transaction manually (the bill's
  date has already advanced).
- **No cross-account due detection** — the due-today modal (and pay actions) are
  scoped to the *active* account, consistent with the rest of the app. A bill
  due in a non-active account surfaces only after switching to it. Deferred;
  same scoping as the Phase 6 alert feed.
- No push/OS reminders (Phase 5).

### 4.7 Phase 4 Checklist — Before Marking Complete
- [ ] `lib/bills.js` exports `advanceDueDate`, `markBillPaid`, `skipBillCycle`.
- [ ] `PayBillSheet` marks paid with an **editable amount** + date → correct expense transaction; advances `next_due_date`; sets `last_paid_date`.
- [ ] Skip-cycle advances the date with **no** transaction and leaves `last_paid_date` untouched.
- [ ] Transaction-insert failure does not advance the date (error toast).
- [ ] Balances/budgets update (via `notifyChanged`); success/info toasts show.
- [ ] Due-today modal shows due/overdue bills on open, at most once per day, nothing when none due; "Later" dismisses; "Mark paid" opens `PayBillSheet`.
- [ ] Modal never appears on the sign-in screen / with no active account.
- [ ] "Last paid …" shows on paid bills; overdue/due-soon pills reflect the advanced date.
- [ ] Bundles cleanly.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 5 — Local Scheduled Notifications

### Goal
The app can notify the user **when it's closed**: a reminder a few days before
each active bill's due date, and an optional daily "log your spending" nudge. A
Notifications section in Settings lets the user opt in (Android 13+ permission
prompt) and toggle each reminder type. Tapping a notification deep-links into
the app.

### Before Starting — Confirm With Codebase
1. Read the Expo SDK 54 notifications docs
   (`https://docs.expo.dev/versions/v54.0.0/sdk/notifications/`) before writing
   code — trigger types (daily, calendar/date), the Android channel
   requirement, and the Android 13+ `POST_NOTIFICATIONS` opt-in.
2. `npx expo install expo-notifications`; add its config plugin to `app.json`
   `plugins`. This is a **legitimate new dependency** (no way to do OS
   notifications without it).
3. Check `app.json` `android.blockedPermissions` — `VIBRATE` is currently
   blocked (stripped as unused in the security pass). If notification vibration
   is wanted, remove `VIBRATE` from `blockedPermissions`; otherwise leave it and
   notifications simply won't vibrate. Decide and note it.
4. Confirm this needs a **rebuild** (native change) — won't appear via JS-only
   reload; call that out to the user before the phase, like the share-intent
   feature.
5. Reuse the AsyncStorage device-pref pattern from `AccountContext`
   (`flo.activeAccountId`) for notification settings keys.

### 5.1 Database
No database changes. Notification preferences are **device-local**, stored in
AsyncStorage (like the active account), not in Postgres — they don't sync and
don't belong in the ledger.

Keys:
- `flo.notif.enabled` — master opt-in ('true'/'false')
- `flo.notif.dailyReminder` — '{ enabled, hour, minute }' JSON
- `flo.notif.billReminders` — '{ enabled, daysBefore }' JSON

### 5.2 Data Layer

```
lib/notifications.js   ← NEW
```

- `requestPermission()` — wraps `Notifications.requestPermissionsAsync()`, sets
  the Android channel (`setNotificationChannelAsync`) first.
- `rescheduleAll({ bills, settings })` — the single source of truth for what's
  scheduled: `cancelAllScheduledNotificationsAsync()` then schedule fresh:
  - **Bill reminders**: for each active bill, a calendar/date trigger at
    `next_due_date` − `daysBefore` days, 9:00am, titled "<name> due <in N days>".
    Skip past dates. Data payload `{ route: '/bills' }`.
  - **Daily reminder**: a daily trigger at the chosen hour/minute, "Log today's
    spending?", data `{ route: '/(tabs)' }`.
  - Local scheduled notifications are finite and cheap to rebuild; cancel-all +
    reschedule avoids drift, mirroring the version-counter philosophy.
- `useNotificationSync()` — a tiny hook mounted once (e.g. in `_layout.js`
  sibling like `ShareIntentHandler`) that calls `rescheduleAll` on app start,
  whenever `version` changes (bills edited), and whenever settings change. Also
  registers a response listener that routes on tap.

### 5.3 Components

```
components/NotificationSettingsSheet.js   ← NEW (or a section added to Settings)
```

- A Notifications block in `app/settings.js` (new `Card` of rows): master
  toggle (triggers the permission prompt on first enable), "Daily reminder"
  (toggle + time picker), "Bill reminders" (toggle + days-before stepper: 1/2/3
  days). Persists to AsyncStorage and calls `rescheduleAll`.
- Use the existing row styling from `settings.js`; `Switch` from react-native.

### 5.4 Navigation / Integration
- `app/_layout.js`: mount `useNotificationSync()` (as a null-rendering sibling
  component near `ShareIntentHandler`).
- Tap handling: notification response → `router.push(data.route)`.
- `app.json`: expo-notifications plugin; possibly un-block `VIBRATE`.

### 5.5 Impact on Existing Features
| Area | Change | Watch for |
|---|---|---|
| `app.json` / native | New plugin + permission → **requires a rebuild** | Tell the user; won't show via OTA/JS reload |
| `app/settings.js` | New Notifications section | Permission-denied state must be handled (show "enable in system settings") |
| Security pass | New `POST_NOTIFICATIONS` permission is expected/legitimate | Update `00-index.md` so it isn't flagged as bloat later |

### 5.6 What This Phase Does NOT Include
- No remote/push notifications, no Expo push tokens, no Edge Functions.
- No budget-reset / monthly-digest notifications yet (can be added to
  `rescheduleAll` later; keep Phase 5 to bill + daily reminders).
- No per-bill custom reminder times (one global `daysBefore`).

### 5.7 Phase 5 Checklist — Before Marking Complete
- [ ] `expo-notifications` installed + configured in `app.json`; VIBRATE decision recorded.
- [ ] Enabling notifications requests permission (Android 13+) and handles denial.
- [ ] Bill reminders schedule at `next_due_date − daysBefore`; past dates skipped.
- [ ] Daily reminder fires at the chosen time when enabled.
- [ ] Editing/paying a bill reschedules (no stale/duplicate notifications).
- [ ] Tapping a notification deep-links to the right screen.
- [ ] Settings persist across app restarts (AsyncStorage).
- [ ] Bundles cleanly; note the rebuild requirement to the user.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 6 — Bell Notification Center

### Goal
The Home header bell (today a static icon with a dead red dot) becomes a real
control: tapping it opens a sheet listing the user's **current actionable
alerts** — overdue/due-soon bills, budgets at/over limit, plans over target or
ending soon. The dot shows only when at least one alert exists. Each row
deep-links to the relevant screen. This is a **computed feed** — nothing new is
stored, honoring FLO's derive-don't-store principle.

### Before Starting — Confirm Phase 5 is Approved
1. Read `app/(tabs)/index.js` header — the `bellButton`/`bellDot` markup (static
   `View`); it needs to become a `Pressable` opening the sheet, with the dot
   conditional on alert count.
2. Confirm the feeds available: `useBills` + `billStatus` (Phase 3/4),
   `useBudgets` + `budgetStatus`, `usePlans` (`v_plans_with_totals`).
3. Reuse the `MenuSheet.js` sheet shape for `AlertsSheet`.

### 6.1 Database
No database changes. (No `notifications` table — the feed is computed live.)

### 6.2 Data Layer

```
hooks/useAlerts.js   ← NEW
```

Aggregates current alerts from existing hooks/views (active account scoped):
- Overdue bills (`billStatus === 'overdue'`) and due-soon bills.
- Budgets where `budgetStatus(spent, amount)` is `warn`/`over`.
- Plans with `target_amount` and `total_spent > target_amount`, and (optionally)
  active plans with an `end_date` within 7 days.

Returns `{ alerts, count }` where each alert is
`{ id, kind, severity, title, subtitle, route }`. Sorted most-severe first.

**Dot/"unseen" behavior**: v1 keeps it simple — the dot shows when `count > 0`.
An AsyncStorage `flo.alerts.lastSeen` timestamp to distinguish new-since-last-open
is **deferred** (computed alerts lack stable timestamps); note this in
Implementation Notes rather than building read/unread tracking.

### 6.3 Components

```
components/AlertsSheet.js   ← NEW. Provider/Context/forwardRef, MenuSheet-style.
```

- Lists `useAlerts().alerts`; each row: severity-colored icon, title, subtitle,
  chevron; tap → `router.push(alert.route)` + dismiss. Empty state: "You're all
  caught up." Dark sheet matching `MenuSheet`.

### 6.4 Navigation / Integration
- `app/(tabs)/index.js`: wrap the bell in `Pressable` → `openAlerts()`; render
  `bellDot` only when `useAlerts().count > 0`.
- Mount `AlertsSheetProvider` in `_layout.js` alongside `MenuSheetProvider`.

### 6.5 Impact on Existing Features
| Area | Change | Watch for |
|---|---|---|
| Home header | Bell becomes interactive; dot becomes meaningful | Was purely decorative before |
| `_layout.js` | One more sheet provider | Provider order (needs account/data context) |

### 6.6 What This Phase Does NOT Include
- No read/unread persistence (deferred, noted above).
- No stored notification log / history.
- No push; no marking alerts "done" (they clear when the underlying state clears
  — pay the bill, the alert goes away).

### 6.7 Phase 6 Checklist — Before Marking Complete
- [ ] `useAlerts` returns a sorted, account-scoped feed from existing data.
- [ ] Bell opens `AlertsSheet`; rows deep-link; empty state shows when clear.
- [ ] Dot shows iff `count > 0`.
- [ ] Paying an overdue bill / fixing a budget removes its alert (via `notifyChanged`).
- [ ] Bundles cleanly.

**→ Stop here. Show the result and wait for approval.**

---

## Data Model Summary (Final State After All Phases)

```
auth.users
  └─ bills (NEW)                      ← recurring money; user_id ON DELETE CASCADE
       ├─ account_id → accounts       (account-scoped, like budgets/plans)
       └─ category_id → categories    (ON DELETE SET NULL)

transactions (unchanged)              ← Phase 4 pay inserts a normal expense here
  (no bill_id link in v1)

Computed / derived (nothing stored):
  toasts            → transient React state (Phase 1–2)
  due-today prompt  → useBills + AsyncStorage "last shown" date (Phase 4)
  scheduled notifs  → device OS + AsyncStorage prefs (Phase 5)
  alert feed        → useAlerts() over bills + v_budgets_with_spent
                      + v_plans_with_totals (Phase 6)
```

### `bills` — Schema
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, `default gen_random_uuid()` |
| `user_id` | uuid | RLS, FK → `auth.users` **`ON DELETE CASCADE`** |
| `account_id` | uuid | NOT NULL, FK → `accounts` (account-scoped) |
| `category_id` | uuid | nullable, FK → `categories` `ON DELETE SET NULL` |
| `name` | text | NOT NULL |
| `amount` | numeric | NOT NULL, `CHECK (amount > 0)` — expected charge, not derived |
| `cadence` | text | `CHECK IN ('weekly','monthly','yearly')` — how `next_due_date` advances after each payment |
| `next_due_date` | date | NOT NULL; user-set anchor (auto-suggested), advanced by cadence on pay/skip |
| `last_paid_date` | date | nullable; set on pay (not skip) — powers "Last paid …" |
| `is_active` | boolean | NOT NULL default true (pause without deleting) |
| `created_at` | timestamptz | `default now()` (no `updated_at`) |

No view — `amount` is an input, not a computed total; overdue/upcoming is
derived client-side via `billStatus(next_due_date)`.

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| `app/_layout.js` | Gains ToastProvider (P1, done), PayBillSheetProvider + DueBillsModal sibling (P4), notification-sync sibling (P5), AlertsSheetProvider (P6) | Careful provider ordering |
| `AddTransactionSheet.js` | Success/error toasts (P1) + threshold toasts (P2) | Keep inline validation for "Enter an amount" |
| `MenuSheet.js` | New "Bills" entry (P3) | Taller snap point |
| `AddAccountSheet.js` | Delete guard counts bills (P3) | — |
| `app/settings.js` | Notifications section (P5) | Handle permission-denied |
| `app/(tabs)/index.js` | Bell becomes interactive (P6) | — |
| `app.json` / native | expo-notifications plugin + permission (P5) | Requires a rebuild; update security notes in `00-index.md` |
| Account deletion cascade | `bills.user_id` CASCADE keeps full purge working (P3) | Note in `00-index.md` deletion section |

---

## Out of Scope (All Phases)

- **Remote / push notifications** — Expo push tokens, Supabase Edge Functions,
  `pg_cron`. FLO has no server-side event source; local scheduling covers every
  useful case. Revisit only if multi-device sync is ever added.
- **Bill auto-detection** — inferring recurring bills from transaction history
  or SMS. Future build.
- **`bill_id` back-link on transactions** — a paid bill creates a plain
  transaction with no FK back to the bill. Enough for v1.
- **Read/unread + notification history** — the bell feed is current-state only;
  no stored log, no per-alert seen-state (deferred, Phase 6 notes).
- **Budget-reset / monthly-digest scheduled notifications** — easy to add to
  `rescheduleAll` later; Phase 5 ships bill + daily reminders only.
- **Cross-account due detection** — the due-today modal and bell feed are
  active-account-scoped; a bill due in a non-active account surfaces only after
  switching. Future build (needs an all-accounts bills query).
- **`bill_id` back-link / variable-amount history** — pay creates a plain
  transaction; the edited amount lives on the transaction, not tracked back on
  the bill beyond `last_paid_date`.
- **Recurring income (salary)** — bills are expenses only in v1.
- **iOS notifications** — the app targets Android (share-intent is Android-only
  already); iOS local notifications would likely work but are untested/unscoped.

**Note**: "wiring toasts into every sheet" was originally listed here as
out-of-scope but was **completed** during Phase 1 testing (see the Toast
Trigger Reference table under Phase 1) — every mutation-bearing sheet now
toasts.
