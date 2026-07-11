# Feature: Accounts
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/02-accounts.md`
**Status**: Planned
**Last Updated**: July 2026

---

## Context

FLO currently has one implicit, invisible account: every transaction, budget, and plan belongs to the user as a whole. This feature makes that account explicit and allows more than one — the user can keep separate ledgers (e.g. "Personal", "Business", "Family") where each transaction lives in exactly one account, and Home, Transactions, Budgets, Plans, and Analytics all read through the lens of the **active account**. Decisions settled during discussion (2026-07-11): the concept is named **Accounts** (not "realms" — that was Plans' old codename in `FEATURE_PLAN.md` — and not "cards", which reads as payment cards); a **"Personal" account is auto-created silently on signup** rather than gating first sign-in behind a create screen; **categories stay shared** across accounts as reference data.

Timing note: `transactions`, `budgets`, and `plans` were wiped to 0 rows on 2026-07-11, so the backfill portion of the migration is trivial. The existing user still needs a default account created.

---

## Phase Overview

```
Phase 1 — Schema + active-account plumbing + transactions scoped
  Full database migration (accounts table, account_id everywhere, views,
  trigger), AccountContext with persisted active account, switcher sheet,
  create-account sheet, Home + Transactions scoped.

Phase 2 — Budgets + Plans scoped
  Budgets and Plans tabs, their sheets, and Plan Detail all read and write
  the active account. Pure frontend — all SQL landed in Phase 1.

Phase 3 — Analytics scoped + account management
  Analytics reads the active account; accounts can be renamed and deleted
  (with in-use guard and last-account guard).
```

**After each phase: stop and wait for approval before proceeding.**

**Consistency caveat between phases**: after Phase 1, budgets/plans still read across all accounts until Phase 2 lands. Acceptable only because the database currently has no budget/plan data — don't create a second account and start splitting real data until Phase 2 is approved.

---

## Phase 1 — Schema + active-account plumbing + transactions scoped ✅ Complete (pending on-device confirmation)

### Goal
The database knows about accounts end to end (all SQL for the whole feature lands here). The app has an active account: a "Personal" account exists for the current user, its name shows on the Home hero card, tapping it opens a switcher sheet listing accounts with a "New Account" action, and switching changes which transactions Home and the Transactions tab show. New transactions are written into the active account.

### Before Starting — Confirm With Codebase
- Confirm the live `handle_new_user` trigger definition via MCP (`SECURITY DEFINER`, `SET search_path TO 'public'`) before replacing it — it was last modified by the `add_category_colors` migration and must keep its security settings exactly.
- Confirm `v_global_summary`'s exact current column list via MCP — replacing a view's column set requires `DROP VIEW` + `CREATE VIEW`, not `CREATE OR REPLACE`.
- Confirm `hooks/useGlobalSummary.js` uses `.select('*').single()` — the grouped view returns **no row** for an account with zero transactions, so this must become `.eq('account_id', …).maybeSingle()` with the existing `EMPTY` fallback.
- Confirm `lib/AuthContext.js` provider nesting in `app/_layout.js` to decide where `AccountProvider` mounts (needs session, must wrap everything that reads data — directly inside `DataRefreshProvider`).
- Confirm `AddTransactionSheet.js`'s edit path (`open(payload)` with `payload.id`) so editing preserves the transaction's original `account_id` rather than reassigning it to the active account.

### 1.1 Database

One migration, `add_accounts`, containing the entire feature's SQL:

```sql
-- 1. Accounts table (follows standard FLO table shape + (select auth.uid()) RLS convention)
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#BBDC12',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounts_select_own ON public.accounts FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY accounts_insert_own ON public.accounts FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY accounts_update_own ON public.accounts FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY accounts_delete_own ON public.accounts FOR DELETE USING ((select auth.uid()) = user_id);
CREATE INDEX idx_accounts_user ON public.accounts(user_id);

-- 2. Default "Personal" account for every existing user
INSERT INTO public.accounts (user_id, name)
SELECT id, 'Personal' FROM auth.users;

-- 3. account_id on the three activity tables (empty today, but backfill
--    defensively by user's oldest account so this migration is rerunnable
--    against a DB that has data)
ALTER TABLE public.transactions ADD COLUMN account_id uuid REFERENCES public.accounts(id);
UPDATE public.transactions t SET account_id =
  (SELECT a.id FROM public.accounts a WHERE a.user_id = t.user_id ORDER BY a.created_at LIMIT 1);
ALTER TABLE public.transactions ALTER COLUMN account_id SET NOT NULL;
CREATE INDEX idx_transactions_account ON public.transactions(account_id);

ALTER TABLE public.budgets ADD COLUMN account_id uuid REFERENCES public.accounts(id);
UPDATE public.budgets b SET account_id =
  (SELECT a.id FROM public.accounts a WHERE a.user_id = b.user_id ORDER BY a.created_at LIMIT 1);
ALTER TABLE public.budgets ALTER COLUMN account_id SET NOT NULL;
CREATE INDEX idx_budgets_account ON public.budgets(account_id);

ALTER TABLE public.plans ADD COLUMN account_id uuid REFERENCES public.accounts(id);
UPDATE public.plans p SET account_id =
  (SELECT a.id FROM public.accounts a WHERE a.user_id = p.user_id ORDER BY a.created_at LIMIT 1);
ALTER TABLE public.plans ALTER COLUMN account_id SET NOT NULL;
CREATE INDEX idx_plans_account ON public.plans(account_id);

-- 4. v_global_summary becomes per-account (column set changes → drop + recreate)
DROP VIEW public.v_global_summary;
CREATE VIEW public.v_global_summary AS
SELECT
  account_id,
  COALESCE(sum(amount) FILTER (WHERE type = 'income'), 0) AS total_income,
  COALESCE(sum(amount) FILTER (WHERE type = 'expense'), 0) AS total_expense,
  COALESCE(sum(amount) FILTER (WHERE type = 'income'), 0)
    - COALESCE(sum(amount) FILTER (WHERE type = 'expense'), 0) AS in_hand_balance,
  COALESCE(sum(amount) FILTER (WHERE type = 'income'
    AND occurred_at >= date_trunc('month', CURRENT_DATE)::date), 0) AS month_income,
  COALESCE(sum(amount) FILTER (WHERE type = 'expense'
    AND occurred_at >= date_trunc('month', CURRENT_DATE)::date), 0) AS month_expense
FROM transactions
GROUP BY account_id;

-- 5. v_budgets_with_spent: expose account_id and count only same-account spend
--    (recreate with the existing definition — confirm live definition via MCP
--    first — plus: b.account_id in the select list, and
--    "AND tx.account_id = b.account_id" added to the lateral spent subquery)
-- 6. v_plans_with_totals: expose p.account_id in the select list. The spent
--    lateral keys on tx.plan_id which is already account-consistent because
--    the app only offers active-account plans in the picker; no tx filter change.
--    (Both use CREATE OR REPLACE VIEW with account_id appended as the last
--    column, which Postgres permits; if it errors, DROP + CREATE.)

-- 7. Signup trigger: add the default account (keep SECURITY DEFINER +
--    search_path exactly as live; this is the full body with one insert added)
--    insert into public.accounts (user_id, name) values (new.id, 'Personal');
--    …before the existing profiles + categories inserts.
```

(Items 5–7 are written as instructions rather than full SQL because their bodies must be copied from the **live** definitions at implementation time, per the skill's rule of verifying against reality — the live trigger has been modified twice since `FEATURE_PLAN.md`.)

Apply via MCP `apply_migration`, then verify with `list_tables` + a select from each view + advisors run.

### 1.2 Data Layer

**`lib/AccountContext.js`** — new. Mirrors `AuthContext`'s shape:
- Fetches the user's accounts (ordered by `created_at`), subscribes to `useDataRefresh`'s `version`.
- Holds `activeAccountId`, persisted to AsyncStorage (key `flo.activeAccountId`); on load, falls back to the first account if the stored id no longer exists.
- Exposes `{ accounts, activeAccount, activeAccountId, setActiveAccount, loading }` via `useAccount()`.
- Mounted in `app/_layout.js` directly inside `DataRefreshProvider` (needs auth session; must wrap all sheets and screens).

**Hook changes (this phase)**:
- `useTransactions` — add `.eq('account_id', activeAccountId)`; add `activeAccountId` to the `useCallback` deps so switching refetches.
- `useDailyTotals` — same.
- `useGlobalSummary` — `.eq('account_id', activeAccountId).maybeSingle()`, keep the `EMPTY` fallback for accounts with no transactions yet.

**Mutation changes (this phase)**:
- `AddTransactionSheet.handleSave` — creates include `account_id: activeAccountId`; edits do **not** touch `account_id` (a transaction stays in the account it was made in).
- Account creation in `AddAccountSheet` (below) inserts `{ name, description, color }` and calls `notifyChanged()`.

### 1.3 Components

```
components/
  AccountSwitcherSheet.js   — Provider + Context + forwardRef sheet; lists accounts
                              (color dot, name, active check), tap to switch +
                              dismiss; "New Account" row opens AddAccountSheet
  AddAccountSheet.js        — create form: name (required), description (optional),
                              color (CATEGORY_COLORS swatch grid, same UI as
                              AddCategorySheet); Phase 3 extends it for editing
```

Both follow the `AddBudgetSheet.js` Provider/Context/`forwardRef` pattern exactly; providers mount in `app/_layout.js` alongside the others.

### 1.4 Navigation / Integration

- `app/(tabs)/index.js` (Home hero card): the "In Hand" label row gains the active account's name as a tappable pill (color dot + name + chevron), opening `AccountSwitcherSheet`. This is the single switching entry point for v1.
- `app/_layout.js`: mount `AccountProvider`, `AccountSwitcherSheetProvider`, `AddAccountSheetProvider`.

### 1.5 Impact on Existing Features

| Existing Feature | Impact | Watch for |
|---|---|---|
| Home | Hero shows active-account name; balance/chart/recent become account-scoped | `maybeSingle()` fallback when the account has no transactions |
| Transactions tab | List scoped to active account | Month totals recompute on switch |
| Add Transaction sheet | Writes `account_id` on create | Edits must not reassign account |
| Budgets/Plans tabs | **Not yet scoped** (Phase 2) | See consistency caveat — don't split real data across accounts until Phase 2 |
| Signup | Trigger also creates "Personal" | Preserve `SECURITY DEFINER` + `search_path` |

### 1.6 What This Phase Does NOT Include
- Budgets/Plans/Analytics scoping (Phases 2–3)
- Account rename/delete (Phase 3)
- Transfers between accounts, "All accounts" combined view, per-account currency — out of scope for the whole feature

### 1.7 Phase 1 Checklist — Before Marking Complete
- [x] Migration applied and verified via MCP; advisors show no new warnings; existing user has a "Personal" account
- [x] Fresh signup gets profile + categories + "Personal" account (trigger updated and inspected via `pg_get_functiondef`; not exercised with an actual new signup)
- [x] Home hero shows the active account name; tapping opens the switcher
- [x] Creating a second account from the switcher works (name/description/color) and switches to it
- [x] Switching accounts changes Home balance, 7-day chart, recent list, and the Transactions tab; active account survives app restart (AsyncStorage-backed)
- [x] New transactions land in the active account; editing a transaction made in account A while account B is active keeps it in A
- [x] An account with zero transactions shows ₹0 balances, not a crash (`maybeSingle` path)

### Implementation Notes

**Critical finding during migration, fixed same session**: recreating `v_global_summary` (`DROP`+`CREATE`) and `v_budgets_with_spent`/`v_plans_with_totals` (`CREATE OR REPLACE`) reset all three views off `security_invoker`, which made them run with the view *owner's* privileges instead of the querying user's — silently bypassing RLS on the underlying tables. The security advisor caught it immediately after `add_accounts` was applied (3 new ERROR-level `security_definer_view` findings that weren't there before). Fixed with a follow-up migration (`fix_views_security_invoker`) setting `security_invoker = true` explicitly on all three. **Standing rule going forward, logged in `00-index.md`: any `DROP`/`CREATE OR REPLACE VIEW` via the MCP must explicitly set `security_invoker = true` (or run the security advisor immediately after and treat any new ERROR as a stop-everything blocker) — the MCP's migration role does not preserve this automatically.**

Other notes:
- Two migrations landed instead of one (`add_accounts`, then the `security_invoker` fix) — kept as two for an honest audit trail rather than squashing, since the second was a direct correction of the first.
- Found and reused an existing (previously decorative) "All accounts" pill in the Home hero card (`app/(tabs)/index.js`) instead of adding new UI — it already had the right shape (dot + label), just needed to be wired to `activeAccount` and made pressable.
- `useAnalyticsData`, `useCategories`, `useBudgets`, `usePlans` were deliberately **not** touched this phase — budgets/plans scoping is Phase 2, Analytics is Phase 3, categories stay global forever.
- Verified via `npx expo export --platform android` (3795 modules, clean) plus direct MCP queries confirming zero NULL `account_id`s and correct view row shapes. On-device interactive confirmation (switching accounts, creating one, watching Home update) still needed from you — this tool has no attached device.

**Post-approval UI polish** (requested after on-device testing, same hero card): the account pill/name treatment went through a second round based on how it actually looked on device —
- Account name promoted to a proper heading inside the black card (color dot from `activeAccount.color` + name, `fontFamily.bold`/`fontSize.lg` after an initial too-heavy `extrabold`/`heading` pass), with a tight `lineHeight` on the name so the dot centers against the visible glyphs rather than Manrope's extra built-in leading.
- The pill itself now reads "Manage" with a chevron (was redundantly repeating the account name) — same `openAccountSwitcher` action.
- Income/Expenses below the balance dropped their `inkCard` box background + padding (now plain transparent containers) and gained a small colored `TrendingUp`/`TrendingDown` icon next to each label (`colors.income` / `colors.dangerStrong`) — static semantic indicators (money in vs out), not a computed trend.
- All verified via `npx expo export`; no schema/hook changes, styling + `app/(tabs)/index.js` JSX only.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 2 — Budgets + Plans scoped ✅ Complete (pending on-device confirmation)

### Goal
Budgets and Plans become fully account-scoped: the tabs list only the active account's items, new budgets/plans are created in the active account, plan pickers only offer active-account plans, and Plan Detail's numbers are unchanged (they were already per-plan). After this phase the app is consistent across accounts.

### Before Starting — Confirm Phase 1 is Approved
- Re-read `AccountContext` as actually built (not as planned)
- Confirm `v_budgets_with_spent` and `v_plans_with_totals` expose `account_id` and the budgets view's spent lateral filters `tx.account_id = b.account_id` (landed in Phase 1's migration — verify live via MCP, don't assume)

### 2.1 Database
No database changes — all SQL landed in Phase 1.

### 2.2 Data Layer
- `useBudgets` — `.eq('account_id', activeAccountId)`, dep on `activeAccountId`.
- `usePlans` / `usePlan` — same for the list; `usePlan(planId)` needs no account filter (already keyed by id) but inherits correct data.
- `AddBudgetSheet.handleSave` / `AddPlanSheet.handleSave` — include `account_id: activeAccountId` on create; never reassign on edit.

### 2.3 Components
No new components. `AddTransactionSheet`'s plan picker already consumes `usePlans().activePlans`, so it narrows to the active account automatically.

### 2.4 Navigation / Integration
None beyond the hook/sheet changes.

### 2.5 Impact on Existing Features

| Existing Feature | Impact | Watch for |
|---|---|---|
| Budgets tab | Scoped to active account | Budget "spent" already same-account via the view |
| Plans tab + Plan Detail | List scoped; detail unchanged | Pushing Plan Detail for a plan, then switching accounts from Home, then returning — detail still shows that plan by id (acceptable; it's an explicit navigation target) |
| Add Transaction plan picker | Only active-account plans | — |

### 2.6 What This Phase Does NOT Include
- Analytics scoping, account management (Phase 3)

### 2.7 Phase 2 Checklist — Before Marking Complete
- [x] Budgets created in account A don't appear when account B is active; spend in B never moves A's budgets (verified live via the `v_budgets_with_spent` definition — `tx.account_id = b.account_id` in its spent lateral, confirmed via MCP before implementing)
- [x] Plans behave the same; the Add Transaction plan picker only offers active-account plans (`usePlans().activePlans`, unchanged, now fed account-scoped data)
- [x] Home's budget cards — N/A, Home doesn't render budget cards in the current build (only the hero + 7-day chart + recent transactions); no such surface exists to check
- [x] Creating budgets/plans writes the active account's `account_id`

### Implementation Notes

Built exactly as planned, no deviations. `usePlan(planId)` (singular, used by Plan Detail) was deliberately left unscoped as specified — it's already keyed by a specific plan id from explicit navigation, so it doesn't need an account filter to return correct data.

Re-confirmed live view definitions via MCP before touching any hook (per "Before Starting"): both `v_budgets_with_spent` and `v_plans_with_totals` already exposed `account_id`, and the budgets view's spent lateral already had `tx.account_id = b.account_id` — exactly as Phase 1 left them, no surprises.

Verified via `npx expo export --platform android` (3795 modules, clean — same module count as Phase 1 since no new files, only edits to 4 existing hooks/sheets). On-device confirmation still needed: create budgets/plans in two different accounts and confirm they don't cross-contaminate.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 3 — Analytics scoped + account management ✅ Complete (pending on-device confirmation)

### Goal
Analytics reads only the active account, and accounts are manageable: rename, change color/description, and delete — guarded so an account with any transactions/budgets/plans can't be deleted, and the last remaining account can never be deleted.

### Before Starting — Confirm Phase 2 is Approved
- Re-read `useAnalyticsData` as built — it fetches transactions ×2 (current + prior range), `v_budgets_with_spent`, `v_plans_with_totals`
- Re-read `app/manage-categories.js`'s in-use guard + `Alert.alert` pattern to mirror for account deletion

### 3.1 Database
No database changes.

### 3.2 Data Layer
- `useAnalyticsData` — all four fetches gain `.eq('account_id', activeAccountId)`; dep on `activeAccountId`.
- Account mutations (in `AddAccountSheet`, now also handling edit): update name/description/color; delete with guards:
  1. Count transactions, budgets, plans with this `account_id` (three `head: true` count queries, like the category guard). If any > 0 → `Alert.alert('Account in use', …)`.
  2. If it's the only account → `Alert.alert('Cannot delete', 'You need at least one account.')`.
  3. If deleting the currently active account (only reachable when empty) → switch active to another account first, then delete.

### 3.3 Components
- `AddAccountSheet` gains the edit mode (open with an existing account, same pattern as `AddBudgetSheet.open(budget)`), plus a delete row with `Alert.alert` confirm.
- `AccountSwitcherSheet` rows gain an edit (pencil) affordance opening `AddAccountSheet` in edit mode.

### 3.4 Navigation / Integration
Analytics screen itself is unchanged — scoping happens entirely in the hook. Optionally show the active account name in the Analytics header for clarity (small text under the title).

### 3.5 Impact on Existing Features

| Existing Feature | Impact | Watch for |
|---|---|---|
| Analytics (all 5 segments) | Scoped to active account | Deltas compare the same account's prior period |
| Account switcher | Gains edit affordance | — |

### 3.6 What This Phase Does NOT Include
- Transfers between accounts — future feature; if it ever lands, add a `transfer_group_id uuid` column to `transactions` pairing the two legs
- "All accounts" combined view
- Per-account currency; account sharing/multi-user

### 3.7 Phase 3 Checklist — Before Marking Complete
- [x] Every Analytics segment (Overview/Transactions/Categories/Budgets/Plans) changes when the account switches, including period-over-period deltas — all four `useAnalyticsData` queries scoped, `notifyChanged()`/`version` already drives the refetch
- [x] Rename/color/description edits reflect immediately in the switcher and Home hero — both read `accounts`/`activeAccount` from the same `AccountContext`, refetched on `notifyChanged()`
- [x] Deleting an account with any transactions, budgets, or plans is blocked with a clear message (three-count guard, mirrors `manage-categories.js`'s pattern exactly)
- [x] Deleting the last account is blocked
- [x] Deleting an empty non-active account works; deleting the empty active account switches to another first, then deletes
- [x] No crashes switching accounts rapidly — every account-scoped hook already guards `!activeAccountId` (from Phases 1–2) and the delete flow picks a fallback before deleting the active one

### Implementation Notes

Built as planned, one addition beyond the doc: `AddAccountSheet`'s edit mode reuses the exact same component/state machine as create (matching `AddBudgetSheet`'s `editingId` pattern precisely, per the doc's own instruction to mirror it) rather than a separate edit sheet — `open(account)` prefills when given an account, `open()`/`open(null)` resets to a blank create form.

Delete guard order matters and is implemented in this sequence: (1) in-use count check first, (2) last-account check second, (3) active-account fallback-switch only happens after both guards pass — so the fallback-switch code is only ever reached for an account that's confirmed empty and not the last one, exactly as the doc specified ("only reachable when empty").

Took the doc's optional suggestion (3.4) and added the active account name as a small subtitle under "Analytics" in the screen header — cheap, and removes ambiguity about which account's numbers you're looking at now that Analytics is scoped.

Verified via `npx expo export --platform android` (3795 modules, clean — same count as Phase 2, no new files). This closes out all 3 phases of `02-accounts.md`. On-device confirmation still needed: switch accounts inside Analytics and watch every segment change; try deleting an in-use account (should block), an empty non-active one (should work), and the last remaining account (should block).

**Post-approval UX enhancement** (requested after Phase 3 review): `AccountSwitcherSheet` rows redesigned into mini hero-style cards — each shows the account's In Hand balance and Income/Expense (with the same `TrendingUp`/`TrendingDown` icon treatment as the Home hero card), not just a name and color dot, so switching is an informed choice rather than a blind pick. New `hooks/useAllAccountSummaries.js` fetches `v_global_summary` **without** an `account_id` filter — since the view is already grouped by `account_id`, this returns one row per account for the user for free, no schema change. Sheet grew from a `'50%'` snap point / `BottomSheetView` to `'75%'` / `BottomSheetScrollView` to fit the taller cards. Verified via `npx expo export` (3796 modules, +1 for the new hook file).

**Follow-up visual iteration** (several rounds, same session): tried the account's own color as the full card background (full saturation, then a 16%-into-`inkCard` tinted version) — both rejected as "too contrasting" / inconsistent with the app's uniform dark-card language elsewhere (Home hero, Plan Detail, every sheet). **Settled back on plain `inkCard` + a small full-saturation color dot** as the identifier, which is what shipped. Also landed, smaller and orthogonal: more card padding (`spacing.xxl`), In Hand balance resized (`fontSize.amount` → `fontSize.hero`), Income/Expense collapsed from a 2-line/2-column layout into one line each (`icon · value · label`, side by side) with neutral `colors.mutedMid` icons instead of income/danger colors — deliberately different from Home's hero card, which kept green/red since it's a single-account glance view rather than a multi-card scan (same layout, different color call, both intentional). "New Account" changed from a plain icon+text row to an actual `Button` (`variant="primary"`), with `useSafeAreaInsets().bottom` added to the scroll content's bottom padding so it clears the phone's gesture bar; sheet snap point bumped to `'85%'`. Home hero's "Manage" pill went through the same lesson in miniature: solid brand fill read as too loud, settled on `colors.inkCard` background with brand-colored text/icon (mirrors the switcher card background exactly). Finally, `CATEGORY_COLORS` in `CategoryIcon.js` (shared by both category and account color pickers) grew from 10 to 14 swatches — added blue/red/navy/gold, kept muted/earthy rather than pure-saturated to match the existing set. All verified via `npx expo export`; no schema or hook-contract changes in this whole follow-up round, styling only.

**Real bug found via first on-device test** (2026-07-11, after installing an EAS `preview` build and signing up fresh): Home showed no account name after signup, and saving a transaction (via the new SMS-share prefill from `03-sms-share-import.md`) failed with a Postgres `account_id` NOT NULL violation. Root cause was in `lib/AccountContext.js`, not the server — `AccountProvider` fetched `accounts` once on mount, which can happen *before* a session exists (correctly returning zero rows pre-auth), and had no way to know to refetch once sign-in actually completed — nothing depended on `session`, only on `useDataRefresh`'s `version`, which nothing bumps during sign-up. `activeAccountId` stayed `null` indefinitely. A second, compounding bug: because `initialized` never got set true during that stale empty phase, the *next* time anything did refetch (e.g. manually creating an account), the "first resolution" logic ran again and could silently override an account the user had just explicitly picked, falling back to whichever account is oldest via `AsyncStorage` lookup.

**Fix**: `AccountProvider` now depends on `session?.user?.id` (via `useAuth()`) in two places — `refetch` re-runs when the signed-in user changes (not just on `version`), and a dedicated effect resets `initialized`/`activeAccountId` whenever `userId` changes, so a stale pre-auth fetch can never get permanently stuck. Also hardened both `AsyncStorage` calls with `.catch(() => ...)` (previously an unhandled rejection there would have had the exact same "stuck forever" symptom), and fixed `loading` to not hang forever in the edge case of a genuinely account-less authenticated user (e.g. if the signup trigger ever failed to seed one) — it now only waits on resolution when there's actually something to resolve.

Verified: live DB state checked directly via MCP before assuming anything — confirmed exactly one valid `accounts` row for this user, zero orphaned transactions/budgets/plans, so this was purely a client bug, no data repair needed. `npx expo export --platform android` clean after the fix. This has **not yet been re-verified on-device** (needs a new EAS build) — flagging honestly rather than claiming it's confirmed fixed.

**→ Stop here. Show the result and wait for approval.**

---

## Data Model Summary (Final State After All Phases)

```
auth.users
 └─ accounts (NEW: name, description, color)   ← active one persisted client-side
     ├─ transactions.account_id (NOT NULL)
     ├─ budgets.account_id     (NOT NULL)
     └─ plans.account_id       (NOT NULL)
categories — unchanged, shared across accounts
profiles   — unchanged

v_global_summary     → now GROUP BY account_id (one row per account with data)
v_budgets_with_spent → + account_id, spent counts same-account tx only
v_plans_with_totals  → + account_id
handle_new_user      → also inserts a 'Personal' account
```

### `accounts` — Schema
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, `default gen_random_uuid()` |
| `user_id` | uuid | RLS `(select auth.uid())`, FK → `auth.users`, `default auth.uid()` |
| `name` | text | NOT NULL |
| `description` | text | nullable |
| `color` | text | NOT NULL, default `'#BBDC12'`, from `CATEGORY_COLORS` swatches |
| `created_at` | timestamptz | `default now()` |

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| Every read hook | Gains `account_id` filter + dep | Phases 1–3 as scheduled |
| All three activity mutations | Write `account_id` on create, never on edit | Phases 1–2 |
| `v_global_summary` consumers | Single-row → per-account row (`maybeSingle`) | Phase 1 |
| Signup trigger | +1 insert | Phase 1 |
| Home hero | Account name pill + switcher entry | Phase 1 |
| Categories / Settings / Profile | None — global | None |

---

## Out of Scope (All Phases)

- **Transfers between accounts** — needs a linked transaction pair; schema is transfer-ready via a future `transfer_group_id` column, deliberately not added now
- **"All accounts" combined view** — re-complicates every screen; revisit only if genuinely missed after living with v1
- **Per-account currency** — profile-level currency remains the (still unwired) single setting
- **Account sharing / multi-user** — RLS stays strictly per-user; accounts are organizational, not a security boundary
- **Forced onboarding screen** — rejected in favor of the silent "Personal" default
