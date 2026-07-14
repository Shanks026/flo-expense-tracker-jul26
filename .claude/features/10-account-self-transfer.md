# Feature: Account Self-Transfer
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/10-account-self-transfer.md`
**Status**: Phase 1 built (bundle- & DB-verified; on-device pending)
**Last Updated**: 2026-07-14

---

## Context

FLO has multiple accounts (`02-accounts.md`) but no way to record moving money
*between* them. Today the only workaround is a fake expense in one account and a
fake income in the other — which lies to every budget, analytics breakdown, and
income/expense total, because those are real `expense`/`income` rows.

A transfer is money **moving**, not earned or spent: your net worth is unchanged,
but each account's balance shifts. This feature adds a third **Transfer** tab to
`AddTransactionSheet` (alongside Expense/Income) with **From** and **To** account
pickers — the GPay self-transfer model. It closes the one honest gap in the
multi-account model.

**Settled with the user during planning (2026-07-14):**

- **Modelled as two linked rows, not one.** A transfer writes a `transfer_out`
  row in the source account and a `transfer_in` row in the destination, sharing a
  `transfer_id`. This keeps FLO's "one `account_id` per row, balance is computed"
  invariant intact — each account's ledger stays self-contained, exactly as every
  account-scoped hook already assumes.
- **Two new `type` values, not a reuse of `income`/`expense` + a flag.** This is
  the load-bearing decision: every existing aggregation filters on the *exact*
  string `'income'` or `'expense'` (`v_budgets_with_spent`, `v_plans_with_totals`,
  `v_global_summary`'s income/expense totals, `computeCategoryBreakdown`,
  `computeDayOfWeek`, …), so new type values are **excluded from all of them for
  free, with no query changes**. The alternative (reuse + `AND transfer_id IS
  NULL` everywhere) fails *open* — forget one filter and a transfer silently
  inflates spending. New types fail *closed*.
- **Full lifecycle in one phase** (user's call): create, edit, and delete are all
  in Phase 1. Editing/deleting operate on the **pair** (by `transfer_id`), never a
  single half.
- **Transfers show inline in the normal transaction lists** (user's call), styled
  distinctly (transfer icon, neutral colour, "Transfer to/from X"), never counted
  in any spent/earned figure.

**Explicitly rejected during planning:**

- **Single row with `to_account_id`.** Would force `v_global_summary` to stop
  grouping cleanly by `account_id`, and the destination account's transaction list
  wouldn't show the incoming leg without every account-scoped query learning about
  a second account column. Two rows is the lower-total-complexity choice here.
- **Blocking a transfer that overdraws the source account.** FLO never blocks a
  normal expense from taking an account negative; a transfer stays consistent with
  that. No balance guard.
- **Category/merchant on a transfer.** A transfer has no category by definition —
  `category_id` stays NULL.

---

## Phase Overview

```
Phase 1 — Self-transfer (full lifecycle)
  Schema: two new transaction types + transfer_id/transfer_account_id columns +
  v_global_summary balance update. A Transfer tab in AddTransactionSheet with
  From/To pickers writes a linked pair; editing and deleting act on the pair.
  Transfer rows render distinctly in the transaction lists and are excluded from
  every spent/earned figure and from the streak.
```

**After the phase: stop and wait for approval.**

---

## Phase 1 — Self-Transfer (Full Lifecycle) ✅ Complete

### Goal

From the ⊕ Add sheet, pick **Transfer**, choose **From** and **To** accounts and
an amount, and save — FLO writes a linked `transfer_out`/`transfer_in` pair, both
accounts' balances update immediately, and nothing about it touches any budget,
plan, analytics total, or the streak. Tapping the transfer later re-opens it for
editing (as a pair) or deletion (removing both halves). The movement is visible in
the Transactions list, clearly marked as a transfer.

### Before Starting — Confirm With Codebase

1. **`transactions.account_id`'s FK delete rule** — confirm it (likely `ON DELETE
   CASCADE` from `add_accounts`). It decides what happens to a transfer's sibling
   row when an account is deleted; the `transfer_account_id ON DELETE SET NULL`
   below is the safety net for the surviving leg's counterpart reference. The
   `AddAccountSheet` in-use guard already blocks deleting an account that has any
   transactions, so this is defence-in-depth, not the primary path.
2. **`AddTransactionSheet.open(payload)`** — re-read the exact `open()` branching
   (`payload?.id` = edit, else new) and the `type` segment. This feature adds a
   third segment value `'transfer'` and a whole alternate field set; verify the
   current state before editing (it gained the Phase-2 collecting-plan default in
   `09-plans-that-collect.md` — `setPlanId(payload?.plan_id ?? collectingPlan?.id
   ?? null)` — which must **not** fire in transfer mode).
3. **`useAccount()`** (`lib/AccountContext.js`) — confirm it exposes the full
   `accounts` array (it does), which the From/To pickers and the `transferLabel`
   counterpart lookup both read.
4. **`AmountText`** (`components/AmountText.js`) — its `type` colour map has no
   entry for the new types; confirm the exact shape before extending it (an
   unmapped `type` currently yields `undefined` colour).
5. **`app/(tabs)/transactions.js` and `app/(tabs)/index.js`** — the two list
   renderers. Confirm `transactions.js`'s `totals` reduce (`if income → received
   else → spent`) and Home's recent-list row shape before changing them; a
   transfer must not fall into the `else`/spent bucket.
6. **`hooks/useStreak.js` + `lib/streak.js`** — confirm where transaction rows are
   fetched and that `computeStreak` buckets every row into the logged-days set;
   transfers must be excluded so they can't inflate the streak or `todayTotals`.
7. **`crypto.getRandomValues`** — confirm `react-native-get-random-values` is
   imported at app entry (it is, for `lib/supabase.js`), so the client-side
   `uuidv4()` in `lib/transfers.js` has a working CSPRNG.

### 1.1 Database

**Migration `account_self_transfer`** — paste into the Supabase SQL editor
(applied via MCP by the assistant, per this session's workflow) **before** any
component code:

```sql
-- 10-account-self-transfer.md Phase 1
-- Migration name: account_self_transfer

-- 1. Allow the two new transaction types.
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check
  check (type = any (array['income'::text, 'expense'::text, 'transfer_in'::text, 'transfer_out'::text]));

-- 2. Link the two rows of a transfer (transfer_id), and record each row's
--    counterpart account (transfer_account_id) so a row can render "Transfer to
--    X" with no join. Both nullable — normal income/expense rows leave them NULL.
alter table public.transactions
  add column if not exists transfer_id uuid,
  add column if not exists transfer_account_id uuid references public.accounts(id) on delete set null;

-- Pair lookups: edit/delete a transfer by its shared id.
create index if not exists idx_transactions_transfer_id
  on public.transactions (transfer_id) where transfer_id is not null;

-- 3. Recreate v_global_summary. A transfer must move balance between accounts but
--    NEVER count as income or expense. Only in_hand_balance changes: the
--    income/expense/month figures already filter on the exact type string, so
--    transfers are excluded from them with no change. security_invoker MUST be
--    re-set (standing rule, 00-index.md) — recreating a view resets it.
drop view if exists public.v_global_summary;
create view public.v_global_summary as
select
  account_id,
  coalesce(sum(amount) filter (where type = 'income'), 0) as total_income,
  coalesce(sum(amount) filter (where type = 'expense'), 0) as total_expense,
  coalesce(sum(amount) filter (where type = 'income'), 0)
    + coalesce(sum(amount) filter (where type = 'transfer_in'), 0)
    - coalesce(sum(amount) filter (where type = 'expense'), 0)
    - coalesce(sum(amount) filter (where type = 'transfer_out'), 0) as in_hand_balance,
  coalesce(sum(amount) filter (where type = 'income' and occurred_at >= date_trunc('month', current_date)::date), 0) as month_income,
  coalesce(sum(amount) filter (where type = 'expense' and occurred_at >= date_trunc('month', current_date)::date), 0) as month_expense
from public.transactions
group by account_id;

alter view public.v_global_summary set (security_invoker = true);
```

**Post-migration verification (before writing UI):** run the security advisor
(expect only the two known pre-existing WARNs, no new `security_definer_view`);
confirm an account with no transfers reports the same `in_hand_balance` as before
(transfer sums are 0 → backward-compatible); and with a test transfer pair,
confirm the source balance drops by X, the destination rises by X, and
`total_income`/`total_expense`/`month_*` are unchanged. Clean up test rows.

### 1.2 Data Layer

**`lib/transfers.js`** (new) — the transfer mutations + display helpers. Lives in
`lib/` (not inline in the sheet) because `isTransfer`/`transferLabel` are consumed
by multiple render sites, and the clear-pair mutation logic is worth one home:

```js
isTransfer(tx)                         // tx.type === 'transfer_in' || 'transfer_out'
transferLabel(tx, accounts)            // "Transfer to Checking" / "Transfer from Savings"
                                       //   (falls back to "Transfer" if counterpart deleted)
logTransfer({ fromAccountId, toAccountId, amount, occurredAt, note })
                                       // one .insert([outRow, inRow]) sharing a client uuidv4
                                       // transfer_id; category_id/plan_id NULL; user_id via
                                       // auth.uid() default (never set client-side)
deleteTransfer(transferId)             // .delete().eq('transfer_id', transferId) — both legs
updateTransfer(transferId, fields)     // delete the pair, then logTransfer the new values —
                                       // sidesteps re-mapping which leg is which on an
                                       // account swap; ids/created_at change, which is fine
                                       // (transfers are excluded from the streak's created_at)
```

- **`uuidv4()`** — a ~6-line v4 generator from `crypto.getRandomValues` (polyfill
  already present). Both legs of one transfer must share the *same* `transfer_id`,
  so it's generated once client-side; DB-default per-row ids won't do.
- Both rows carry the counterpart in `transfer_account_id` (out-row → destination,
  in-row → source) so either leg renders its label with no join.
- All mutations call `notifyChanged()` at their call site (the sheet) on success,
  same as every other mutation.

**No new hook.** Transfer rows arrive through the existing `useTransactions`
(they're ordinary rows in the account's ledger); the balance is the existing
`v_global_summary` via `useGlobalSummary`.

### 1.3 Components

**`AddTransactionSheet.js`** — the one substantial change. Add a third segment and
an alternate field set:

- **Segment** becomes `Expense · Income · Transfer`. The Transfer segment is shown
  **only when `accounts.length >= 2`** (a transfer needs two accounts); with one
  account it's omitted entirely.
- **Transfer mode** (`type === 'transfer'`):
  - Hides the category chips, the "Add to Plan" field, **and** the top "Adding to
    {activeAccount}" row (From/To replace it).
  - Shows two account pickers — **From** (defaults to the active account) and
    **To** (defaults to none). Same inline-picker shape as the existing plan
    picker in this sheet. **Selecting an account in one removes it from the
    other's options** (From ≠ To is structurally impossible).
  - Keeps the amount input, date, and note.
- **`open(payload)`**:
  - Editing a transfer (`isTransfer(payload)`): set `type='transfer'`,
    `editingTransferId = payload.transfer_id`, and map From/To from the tapped
    leg — `transfer_out` → From=`account_id`, To=`transfer_account_id`;
    `transfer_in` → the reverse. Seed amount/date/note.
  - New/other: unchanged. The `09` collecting-plan default stays in the
    new-entry branch and is irrelevant to transfer mode (transfer save ignores
    `planId`).
- **`handleSave`**: if `type==='transfer'`, validate (both accounts set,
  `from!==to`, amount>0) → `editingTransferId ? updateTransfer(...) :
  logTransfer(...)` → `notifyChanged()` → toast → dismiss. **Skip** the
  budget/plan post-save toast block entirely (a transfer affects neither).
- **`handleDelete`**: when editing a transfer, `deleteTransfer(editingTransferId)`
  (both legs), not the single-row `.eq('id', …)` delete.

**`AmountText.js`** — add the two new types to the colour map and sign logic:
`transfer_out` → `−` prefix, `transfer_in` → `+` prefix, both in a neutral tone
(`colors.mutedDarker`) so a transfer never wears income-green or expense-ink. One
small, localized extension.

### 1.4 Navigation / Integration

No new routes. Entry point is the existing ⊕ tab → `AddTransactionSheet`, now with
a Transfer segment. Editing/deleting is the existing "tap a transaction row" →
sheet flow, which already calls `openAdd(tx)` from every list.

### 1.5 Impact on Existing Features

| Feature | Impact | Watch for |
|---|---|---|
| `v_global_summary` | `in_hand_balance` now includes transfer legs; income/expense/month untouched | `security_invoker` must be re-set on recreate |
| `v_budgets_with_spent`, `v_plans_with_totals` | **None** — both filter `type='expense'`, so transfers are excluded automatically | Do not "add transfer handling"; the exclusion is the design |
| Analytics (`lib/analytics.js`) | Breakdowns/trends/day-of-week filter by exact type → transfers excluded free. **`computeBiggestTransaction` iterates all rows** → could return a transfer | Filter `computeBiggestTransaction` to expenses (or exclude transfers) |
| `app/(tabs)/transactions.js` | `totals` reduce (`else → spent`) would count a transfer as spent; rows need transfer rendering | Change the reduce to count only `expense`/`income`; render transfer rows via `transferLabel` + transfer icon + neutral `AmountText` |
| `app/(tabs)/index.js` (Home recent) | Same row-rendering change | Transfer icon/label/neutral amount, same as the Transactions tab |
| `lib/streak.js` / `hooks/useStreak.js` | A transfer must not count as a logged day or hit `todayTotals` | Exclude transfer rows (filter in the hook's query, or skip in `computeStreak`) |
| `AddTransactionSheet` | New segment + alternate fields + pair mutations | Collecting-plan default must not apply in transfer mode; edit maps From/To from the tapped leg |
| Auto-detect (`06-...md`) | **None** — it only ever produces `expense`/`income` prefills; it has no concept of a transfer | Leave untouched |
| Onboarding (`app/onboarding/expense.js`) | **None** — it's a separate screen, not `AddTransactionSheet`, so the Transfer tab never appears there | This satisfies "skip transfer in onboarding" for free |

### 1.6 What This Phase Does NOT Include

- A dedicated **Transfers** filter chip on the Transactions tab (transfers appear
  under "All" this round).
- Transfers as their own line in Analytics (they're deliberately absent from every
  analytics total; a "moved between accounts" stat is a possible future add).
- A collapsed single-line "all accounts" view that merges the two legs.
- Scheduled/recurring transfers (that's bill territory).
- Any balance/overdraft guard on the source account.

### 1.7 Phase 1 Checklist — Before Marking Complete

- [x] Migration `account_self_transfer` applied; `type` CHECK allows all four
      values; `transfer_id`/`transfer_account_id` columns + partial index exist
      *(verified live)*
- [x] Security advisor after the view recreate shows no new
      `security_definer_view`; `v_global_summary` has `security_invoker = true`
      *(verified: `{security_invoker=true}`, only the 2 pre-existing WARNs)*
- [x] A test transfer pair moves the source balance −X and destination +X, and
      leaves `total_income`/`total_expense`/`month_*` unchanged — **verified in
      DB**: ₹1000 Axis→SBI gave Axis 6527→5527, SBI 25000→26000, totals unchanged;
      test rows cleaned up
- [x] Transfer segment appears only with ≥2 accounts (`canTransfer`); From
      defaults to active, To to none; each picker excludes the other's choice
- [x] Saving writes exactly two rows sharing a `transfer_id` via one
      `.insert([out,in])`, correct `type`/`account_id`/`transfer_account_id` per
      leg, `category_id`/`plan_id` NULL; `notifyChanged()` fires *(code path;
      on-device confirm pending)*
- [x] Editing a transfer re-opens in transfer mode with From/To/amount recovered
      from the tapped leg; save replaces the pair (**insert-new-first, then
      delete-old** — a failed insert leaves the original intact)
- [x] Deleting a transfer removes **both** legs (`deleteTransfer` by `transfer_id`)
- [x] A transfer does **not** appear in any budget's spent, any plan's total, or
      any analytics breakdown/trend (exact-type filters); `computeBiggestTransaction`
      now excludes transfers
- [x] The Transactions tab "Spent"/"Received" totals ignore transfers (reduce
      counts only `expense`/`income`); rows render with the `ArrowLeftRight` icon,
      `transferLabel`, and a neutral ± amount
- [x] Home's recent list renders transfer rows the same way
- [x] A transfer does **not** count toward the streak or `todayTotals`
      (`fetchStreak` query filters `.in('type', ['income','expense'])`)
- [x] The collecting-plan default (`09`) does not attach a plan to either leg
      (transfer save never reads `planId`)
- [x] `npx expo export --platform android` bundles clean *(7.76 MB, no errors)*

### 1.8 Implementation Notes (2026-07-14)

- **Migration applied via MCP** and verified live: `type` CHECK widened to four
  values, `transfer_id` + `transfer_account_id` (FK → `accounts` ON DELETE SET
  NULL) added, `idx_transactions_transfer_id` partial index, `v_global_summary`
  recreated with `balance = (income + transfer_in) − (expense + transfer_out)`
  and `security_invoker` re-set. A real ₹1000 Axis→SBI test proved the balance
  moves ±1000 while `total_income`/`total_expense` stay put; rows cleaned up.
- **`transactions.account_id` FK is `NO ACTION`** (confirmed) — an account with
  any transaction can't be deleted at all, so a transfer leg can never be
  orphaned. `transfer_account_id ON DELETE SET NULL` is a never-fires safety net,
  and `transferLabel` falls back to a bare "Transfer" if it ever did.
- **`lib/transfers.js`** holds it all: `isTransfer`, `transferLabel`, a
  `crypto.getRandomValues`-based `uuidv4` (both legs share one client-generated
  `transfer_id`), `logTransfer` (one atomic `.insert([out,in])`),
  `deleteTransfer` (by `transfer_id`), and `updateTransfer` (insert-new-then-
  delete-old for crash-safety).
- **`AddTransactionSheet`** gained the third segment (shown only when
  `accounts.length >= 2`), a `From`/`To` `AccountField` pair with mutual
  exclusion, transfer-aware `open()`/`handleSave`/`handleDelete`, and hides the
  "Adding to {account}" row + category chips + Add-to-Plan in transfer mode. The
  budget/plan post-save toasts and the collecting-plan default are both naturally
  bypassed (transfer save returns before them / never reads `planId`).
- **Display**: `AmountText` gained `transfer_in`/`transfer_out` tones (muted, `+`
  / `−`). Transactions tab + Home recent render transfer rows with an
  `ArrowLeftRight` icon, `transferLabel`, and "Transfer" subtitle; the
  Transactions tab's Spent/Received reduce now counts only `expense`/`income`.
- **Exclusions**: `fetchStreak` filters `.in('type', ['income','expense'])` so
  transfers never touch the streak; `computeBiggestTransaction` filters to
  income/expense. Every other aggregation (budgets, plans, analytics breakdown/
  trend/day-of-week, `v_global_summary` income/expense) excluded transfers with
  **no change** — the exact-type-filter design working as intended.
- **On-device still pending** (no Android SDK here): creating/editing/deleting a
  transfer through the sheet, both balances updating on return, and the
  distinct-row rendering. The mechanism (DB + queries) is verified; the UI is
  bundle-verified only.

**→ Stop here. Show the result and wait for approval.**

---

## Data Model Summary (Final State After All Phases)

```
transactions  (no new table)
  type            'income' | 'expense' | 'transfer_in' | 'transfer_out'   ← 2 NEW values
  transfer_id     uuid, nullable        ← NEW. Shared by the two legs of one transfer.
  transfer_account_id  uuid, nullable   ← NEW. FK → accounts(id) ON DELETE SET NULL.
                                           The counterpart account, for display.
  (all other columns unchanged; category_id/plan_id NULL on transfer legs)

A transfer = two rows:
  { account_id: FROM, type: 'transfer_out', transfer_account_id: TO,   transfer_id: T }
  { account_id: TO,   type: 'transfer_in',  transfer_account_id: FROM, transfer_id: T }
  → net across accounts = 0; each account's own balance shifts by ±amount.

v_global_summary   in_hand_balance = (income + transfer_in) − (expense + transfer_out)
                   income/expense/month figures unchanged (exact-type filters).
v_budgets_with_spent, v_plans_with_totals   UNCHANGED — filter type='expense', so
                   transfers are excluded automatically.

No new table. No new view. No stored derived numbers.
```

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| `v_global_summary` | Balance now includes transfer legs | Recreate with `security_invoker` (Phase 1) |
| `v_budgets_with_spent` / `v_plans_with_totals` | None (exact-type filters exclude transfers) | Nothing — verify only |
| `AddTransactionSheet` | Third segment + From/To pickers + pair mutations | Phase 1 |
| `AmountText` | Two new type tones | Phase 1 |
| Transactions tab + Home recent | Transfer row rendering; totals exclude transfers | Phase 1 |
| `lib/analytics.js` | `computeBiggestTransaction` must exclude transfers | Phase 1 |
| `lib/streak.js` / `useStreak` | Exclude transfers from streak + today totals | Phase 1 |
| Auto-detect, Onboarding | None | — |

---

## Out of Scope (All Phases)

- **A Transfers filter chip** on the Transactions tab — future, low cost.
- **Transfers surfaced in Analytics** as their own "moved between accounts" figure
  — deliberately absent from all analytics this round.
- **Recurring/scheduled transfers** — that's the bills model, not this.
- **Overdraft/balance guard** — FLO never blocks going negative; transfers match.
- **Merged single-line transfer display** in a combined all-accounts view — the
  two legs show in their own accounts' ledgers this round.
- **Category/merchant on a transfer** — a transfer has no category by definition.
