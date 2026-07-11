# FLO — Feature Index

Tracks what's been planned/built using the `flo-feature` skill, and serves
as the running schema reference since no SQL migration files are committed
in this repo — the Database section of each feature file below is the
durable record for that change.

**Supabase MCP is connected** (as of 2026-07-11, project `uergtlcfpwajztqgncim`)
— schema truth can now be pulled live via `list_tables`/`list_migrations`
instead of reconstructed from application code. Supabase itself already
tracks 11 migrations from the original build (`flo_core_schema` through
`flo_avatars_scope_read_policy`) — they were just never mirrored into this
repo. Prefer checking live state over this doc when the two might have
drifted; update this doc when you do.

**Project gained native folders** (2026-07-11, `03-sms-share-import.md`
Phase 1) — this was a pure-JS/Expo-managed project until `expo-share-intent`
required a native manifest entry. `android/`/`ios/` are now generated via
`npx expo prebuild` and gitignored, not committed — `app.json`'s `plugins`
array is still the source of truth, same as before. `package.json`'s
`android`/`ios` npm scripts now run `expo run:android`/`expo run:ios`
(dev-client) instead of `expo start --android`/`--ios` (Expo Go); plain
`npm start`/`npx expo start` is unchanged. Every feature before this one
was fully Expo-Go-testable; this is the first to require a custom dev
client, and only for this one feature — see `03-sms-share-import.md`.

**Standing rule — view security_invoker**: any migration that does
`DROP VIEW`/`CREATE VIEW` or `CREATE OR REPLACE VIEW` via the MCP must
explicitly `SET (security_invoker = true)` on the new view (in the same
migration, or a same-migration `ALTER VIEW ... SET (security_invoker = true)`
right after). Recreating a view through the MCP's migration role resets
this silently, which makes the view run with the *owner's* privileges and
bypass RLS on the underlying tables — a real security hole, not a lint
nitpick. Caught once already (2026-07-11, `add_accounts` → 3 views went
SECURITY DEFINER, fixed by `fix_views_security_invoker`). Run the security
advisor immediately after any view-recreating migration and treat any new
`security_definer_view` ERROR as a stop-everything blocker.

---

## Foundation

Built before this process existed, in one commit
(`Implement FLO expense tracker through Phase 5`). Full spec:
`FEATURE_PLAN.md` at the repo root. Covers: auth, transactions + dashboard,
budgets, plans, settings + category management. Treat `FEATURE_PLAN.md` as
historical — don't re-plan anything it already covers, just reference its
data model.

---

## Feature Files

| # | File | Feature | Status |
|---|---|---|---|
| — | `FEATURE_PLAN.md` (repo root) | Core app (auth/transactions/budgets/plans/settings) | ✅ Complete (v1) |
| 01 | `01-analytics.md` | Analytics (shared filter + Overview/Transactions/Categories/Budgets/Plans graphs) | ✅ Complete (all 3 phases built, pending final on-device confirmation) |
| 02 | `02-accounts.md` | Accounts (multiple ledgers; active-account scoping for transactions/budgets/plans/analytics) | ✅ Complete (all 3 phases built, pending on-device confirmation) |
| 03 | `03-sms-share-import.md` | SMS Share Import (Android share-target → parsed prefill → Add Transaction) | 🚧 All 3 phases implemented; awaiting on-device verification (no device in this environment) |

---

## Schema Reference

Current live schema in Supabase, reconstructed from application code (no
migration files exist). Keep this in sync as feature files land.

### Tables

| Table | Columns | Notes |
|---|---|---|
| `profiles` | `id` (=`auth.users.id`), `full_name`, `currency` (default `'INR'`), `avatar_url`, `created_at` | `avatar_url` + the `avatars` storage bucket exist in code (`EditProfileSheet.js`) but aren't in `FEATURE_PLAN.md`'s original data model — added ad hoc during Phase 5, undocumented until now. |
| `categories` | `id`, `user_id`, `name`, `icon`, `color` (text, hex, `NOT NULL DEFAULT '#BBDC12'`), `type` (`'income'`\|`'expense'`), `is_default` | Seeded on signup: Food, Travel, Shopping, Bills, Coffee, Groceries, Other (expense); Salary, Freelance, Other (income) — 10 rows, each with a curated `color` (see `add_category_colors` migration below). `color` added 2026-07-11; picked via a curated swatch grid in `AddCategorySheet.js`, currently consumed only by Analytics (not tinted elsewhere in the app). **Global — not scoped by account, shared across all of a user's accounts.** |
| `accounts` | `id`, `user_id`, `name`, `description` (nullable), `color` (text, hex, `NOT NULL DEFAULT '#BBDC12'`), `created_at` | Added 2026-07-11 (`add_accounts` migration, `02-accounts.md` Phase 1). Every user always has ≥1 account; `handle_new_user` auto-creates a "Personal" account on signup. Active account is client-side state (`lib/AccountContext.js`), persisted to AsyncStorage — not itself a DB concept. |
| `transactions` | `id`, `user_id`, `account_id` (NOT NULL, added 2026-07-11), `type` (`'income'`\|`'expense'`), `amount` (always positive), `category_id`, `plan_id`, `note`, `occurred_at` (date), `created_at` | The single source of truth — every summary is computed from this table. |
| `budgets` | `id`, `user_id`, `account_id` (NOT NULL, added 2026-07-11), `name`, `amount`, `period` (`'week'`\|`'month'`), `category_id` (nullable = overall), `created_at` | Recurring by period type — "spent" is always for the *current* period, computed, never stored. **`account_id` column exists but hooks don't filter by it yet** — that's `02-accounts.md` Phase 2. |
| `plans` | `id`, `user_id`, `account_id` (NOT NULL, added 2026-07-11), `name`, `icon`, `target_amount` (nullable), `start_date`, `end_date` (nullable), `status` (`'active'`\|`'completed'`), `created_at` | Same Phase 2 caveat as `budgets` — column exists, hooks don't filter by it yet. |

### Views (computed reads)

| View | Purpose |
|---|---|
| `v_global_summary` | Per-account (added `account_id`, `GROUP BY account_id`, 2026-07-11): total income, total expense, in-hand balance, this-month income/expense **for one account**. Returns no row for an account with zero transactions — query with `.eq('account_id', …).maybeSingle()`, not `.single()`. |
| `v_budgets_with_spent` | Each budget + current-period `spent`/`remaining` (negative when over). Gained `account_id` 2026-07-11; the `spent` lateral now also filters `tx.account_id = b.account_id`. |
| `v_plans_with_totals` | Each plan + `total_spent`/`remaining` vs target. Gained `account_id` 2026-07-11 (no filter change to the `spent` lateral — see `02-accounts.md` Phase 1 for why). |

All three views have `security_invoker = true` set explicitly — see the
standing rule above.

### Storage

| Bucket | Purpose |
|---|---|
| `avatars` | Profile avatar images, uploaded via `expo-image-picker` in `EditProfileSheet.js`. |

### RLS

Every table: `(select auth.uid()) = user_id` (`= id` for `profiles`), all
operations. No public/token-based read paths anywhere. Wrapped in `select`
since the 2026-07-11 `fix_rls_initplan_and_missing_index` migration — see
below; write new policies the same way from the start, not
`auth.uid() = user_id` directly, to avoid the per-row re-evaluation the
Supabase performance advisor flags.

### Applied Migrations Since Original Build

| Date | Migration | What |
|---|---|---|
| 2026-07-11 | `fix_rls_initplan_and_missing_index` | Rewrote all RLS policies to use `(select auth.uid())` (Supabase advisor: `auth_rls_initplan`, WARN, was on all 5 tables); added `idx_budgets_category_id` covering index (advisor: `unindexed_foreign_keys`, INFO). Applied directly via Supabase MCP, not yet mirrored to a repo migration file. |
| 2026-07-11 | `add_category_colors` | Added `categories.color` (NOT NULL, default lime); backfilled curated colors for the 10 default categories by name+type; updated `handle_new_user` to seed colors for future signups (preserved its existing `SECURITY DEFINER`/`search_path` exactly). Applied via Supabase MCP, not yet mirrored to a repo migration file. |
| 2026-07-11 | `add_accounts` | New `accounts` table + RLS; `account_id` (NOT NULL) added to `transactions`/`budgets`/`plans` with defensive backfill; `v_global_summary` dropped+recreated grouped by `account_id`; `v_budgets_with_spent`/`v_plans_with_totals` gained `account_id`; `handle_new_user` also creates a default "Personal" account. `02-accounts.md` Phase 1. |
| 2026-07-11 | `fix_views_security_invoker` | Immediate follow-up to `add_accounts` — see the standing rule above. Set `security_invoker = true` on all three views after recreating them silently reset it to definer behavior (RLS bypass). |

**Still open, not fixed**: Security advisor flags leaked-password-protection
as disabled (Auth setting, not schema — toggle in Supabase dashboard under
Authentication → Policies, or ask to investigate the Auth API for it).

**Data reset (2026-07-11)**: `transactions`, `budgets`, and `plans` were
fully cleared at the user's request (fresh start after testing) — all now
0 rows. `categories` untouched (10 rows, with colors). If a future session
sees Analytics/Budgets/Plans as empty, this is why — not a bug.

---

## Shared Infrastructure Notes

- **`components/Logo.js`** (added 2026-07-11) — the real FLO brand mark
  (`assets/FLO_LOGO.svg`), rendered via `react-native-svg`'s `SvgXml` with
  the SVG source inlined as a string constant (this project has no
  Metro SVG-file-loader configured, so the file isn't imported directly —
  keep the inline string in sync if `FLO_LOGO.svg` changes). `<Logo size
  radius />`. Used on the Sign In screen in place of the old placeholder
  (a generic Lucide arrow icon in an ink tile). App icon/splash/adaptive-
  icon/favicon PNGs are a separate, still-open item — see below.
- **Known gap**: `assets/icon.png`, `splash-icon.png`, `adaptive-icon.png`,
  `favicon.png` are still Expo's generic template placeholders (the
  default gray target/bullseye), not the FLO logo — `app.json` points at
  them but they were never regenerated. Needs proper exports of
  `FLO_LOGO.svg` (1024×1024 solid-background version for `icon.png`;
  1024×1024 *transparent*-background glyph-only version, safe-zone
  centered, for `adaptive-icon.png`/`splash-icon.png`; 48×48 solid for
  `favicon.png`) — deferred to the user rather than generated in-repo
  (no SVG rasterization tooling available in this environment).
- **`useDataRefresh`** (`lib/DataRefreshContext.js`) — version-counter
  pattern; every read hook depends on it, every mutation calls
  `notifyChanged()`. The entire cache-invalidation strategy.
- **Bottom sheet pattern** — Provider + Context + `forwardRef`, one per
  create/edit flow, mounted once in `app/_layout.js`. See
  `referenced/flo-data-patterns.md` in the `flo-feature` skill for the
  exact shape.
- **`CategoryIcon.js`** — curated icon-key → `lucide-react-native`
  component map, plus `CATEGORY_ICON_KEYS` for icon pickers and
  `CATEGORY_COLORS` (14-swatch curated palette, grew from 10 on
  2026-07-11 — added blue/red/navy/gold) for color pickers. Shared by
  both the category picker (`AddCategorySheet.js`) and the account color
  picker (`AddAccountSheet.js`) — add new swatches here once, both pick
  them up.
- **`useAllAccountSummaries`** (`hooks/useAllAccountSummaries.js`, added
  `02-accounts.md` post-Phase-3) — fetches `v_global_summary` with no
  `account_id` filter, returning `{ [account_id]: summaryRow }` for every
  account the user has. Relies on the view already being grouped by
  `account_id` (Phase 1) — no schema change needed. Used by
  `AccountSwitcherSheet` to show each account's balance in its card;
  reuse this instead of calling `useGlobalSummary` in a loop.
- **`theme/tokens.js`** — colors, radii, spacing, fontFamily, fontSize.
  Single source for all styling.
- **`MenuSheet.js`** (added in `01-analytics.md` Phase 1) — the hub sheet
  opened from Home's header (avatar + new menu icon), listing Analytics and
  Settings. Follows the same Provider/Context/`forwardRef` shape as the
  other sheets, but its rows navigate (`router.push`) instead of submitting
  a form. Add new global, non-tab destinations here rather than a new tab
  or a bespoke header button.
- **Google Sign-In** — `AuthContext.signInWithGoogle` is fully implemented
  (`expo-auth-session`/`expo-web-browser`/`expo-linking`) but the UI button
  in `sign-in.js` is currently disabled/unreachable, per `FEATURE_PLAN.md`'s
  v1 default of email/password only.
- **Known gap**: Settings → Currency row is static text ("₹ INR"), not
  wired to `profiles.currency` despite the column existing. Not yet
  scheduled as a feature file.
- **`getCategoryColor(category)`** (`lib/analytics.js`) — reads the
  category's stored `color` column directly (`category?.color ?? null`).
  Originally (Phase 2 of `01-analytics.md`) this hashed the category id
  into a fixed palette since categories had no stored color and looked
  poor/inconsistent in the donut chart; superseded 2026-07-11 by the
  `add_category_colors` migration, which added a real `color` column with
  curated defaults + a picker in `AddCategorySheet.js`. Takes the whole
  category object now, not just its id — update call sites accordingly.
- **"Pace" terminology for a spend-cap target** (`computePlanPace` in
  `lib/analytics.js`, Phase 3) — settled as `on_track` / `over_pace` /
  `under_pace`, not `ahead`/`behind`, because a plan's `target_amount` is
  a spending cap, not a savings goal, and ahead/behind reads ambiguously
  for that direction. Reuse this label set for any future pace-style
  indicator on plans or budgets.
- **`ShareIntentHandler` pattern** (`app/_layout.js`, added
  `03-sms-share-import.md` Phase 3) — a component that needs to call a
  sheet's `useAddXSheet()` hook (or read any other context defined
  *inside* `RootNavigator`'s own returned JSX) can't be `RootNavigator`
  itself — `RootNavigator` defines those providers, so it isn't their
  descendant. Pattern: extract a small side-effect-only component
  (returns `null`), render it as a sibling of `<Stack>` deep inside the
  provider nest, and put the app-wide-event-reacting logic there instead.
  Reuse this shape for any future feature that needs to react to
  something at the app root and also touch sheet/account/etc. state.
- **Known gap surfaced by Phase 3, not fixed (out of scope for
  `01-analytics.md`)**: `components/ProgressBar.js`'s status-to-color
  logic only special-cases `'danger'`, not `'over'` (the actual status
  value `budgetStatus()` returns) — an over-limit progress bar silently
  falls back to the default brand color instead of red, both on the live
  Budgets tab and in Analytics. Worth a small standalone fix later.
- **`AccountContext.js`** (`lib/AccountContext.js`, added
  `02-accounts.md` Phase 1) — every user always has ≥1 account (default
  "Personal" from `handle_new_user`). Holds `{ accounts, activeAccount,
  activeAccountId, setActiveAccount, loading }` via `useAccount()`;
  active account persisted to AsyncStorage (`flo.activeAccountId`),
  self-heals to the first account if the stored one no longer exists.
  Mounted in `app/_layout.js` directly inside `DataRefreshProvider`.
  Reads that should be account-scoped filter `.eq('account_id',
  activeAccountId)`; categories never do (global).
- **Accounts are fully wired** (`02-accounts.md`, all 3 phases complete
  2026-07-11): every account-relevant hook (`useTransactions`,
  `useDailyTotals`, `useGlobalSummary`, `useBudgets`, `usePlans`,
  `useAnalyticsData`) filters `.eq('account_id', activeAccountId)`; all
  four "Add" sheets (Transaction/Budget/Plan/Account) write it on create
  and never reassign it on edit. `AddAccountSheet` also handles edit +
  guarded delete (in-use check on transactions/budgets/plans, last-account
  check, active-account fallback-switch before deleting) — same pattern as
  `manage-categories.js`'s category guard. `usePlan(planId)` (singular,
  Plan Detail) is the one deliberate exception — keyed by id from explicit
  navigation, doesn't need an account filter.
- **`useAllAccountSummaries.js`** — fetches `v_global_summary` with no
  `account_id` filter, keyed into a `{ [account_id]: row }` map. Since the
  view is already `GROUP BY account_id`, this is the pattern for any
  future "show data across all accounts" need — no new view/RPC required,
  just drop the filter. Powers the account switcher's mini summary cards
  (added post-Phase-3, see `02-accounts.md`).
