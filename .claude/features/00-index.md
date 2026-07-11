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
| 02 | `02-accounts.md` | Accounts (multiple ledgers; active-account scoping for transactions/budgets/plans/analytics) | 📝 Planned — awaiting user go-ahead |

---

## Schema Reference

Current live schema in Supabase, reconstructed from application code (no
migration files exist). Keep this in sync as feature files land.

### Tables

| Table | Columns | Notes |
|---|---|---|
| `profiles` | `id` (=`auth.users.id`), `full_name`, `currency` (default `'INR'`), `avatar_url`, `created_at` | `avatar_url` + the `avatars` storage bucket exist in code (`EditProfileSheet.js`) but aren't in `FEATURE_PLAN.md`'s original data model — added ad hoc during Phase 5, undocumented until now. |
| `categories` | `id`, `user_id`, `name`, `icon`, `color` (text, hex, `NOT NULL DEFAULT '#BBDC12'`), `type` (`'income'`\|`'expense'`), `is_default` | Seeded on signup: Food, Travel, Shopping, Bills, Coffee, Groceries, Other (expense); Salary, Freelance, Other (income) — 10 rows, each with a curated `color` (see `add_category_colors` migration below). `color` added 2026-07-11; picked via a curated swatch grid in `AddCategorySheet.js`, currently consumed only by Analytics (not tinted elsewhere in the app). |
| `transactions` | `id`, `user_id`, `type` (`'income'`\|`'expense'`), `amount` (always positive), `category_id`, `plan_id`, `note`, `occurred_at` (date), `created_at` | The single source of truth — every summary is computed from this table. |
| `budgets` | `id`, `user_id`, `name`, `amount`, `period` (`'week'`\|`'month'`), `category_id` (nullable = overall), `created_at` | Recurring by period type — "spent" is always for the *current* period, computed, never stored. |
| `plans` | `id`, `user_id`, `name`, `icon`, `target_amount` (nullable), `start_date`, `end_date` (nullable), `status` (`'active'`\|`'completed'`), `created_at` | |

### Views (computed reads)

| View | Purpose |
|---|---|
| `v_global_summary` | Total income, total expense, in-hand balance, this-month income/expense. |
| `v_budgets_with_spent` | Each budget + current-period `spent`/`remaining` (negative when over). |
| `v_plans_with_totals` | Each plan + `total_spent`/`remaining` vs target. |

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

**Still open, not fixed**: Security advisor flags leaked-password-protection
as disabled (Auth setting, not schema — toggle in Supabase dashboard under
Authentication → Policies, or ask to investigate the Auth API for it).

**Data reset (2026-07-11)**: `transactions`, `budgets`, and `plans` were
fully cleared at the user's request (fresh start after testing) — all now
0 rows. `categories` untouched (10 rows, with colors). If a future session
sees Analytics/Budgets/Plans as empty, this is why — not a bug.

---

## Shared Infrastructure Notes

- **`useDataRefresh`** (`lib/DataRefreshContext.js`) — version-counter
  pattern; every read hook depends on it, every mutation calls
  `notifyChanged()`. The entire cache-invalidation strategy.
- **Bottom sheet pattern** — Provider + Context + `forwardRef`, one per
  create/edit flow, mounted once in `app/_layout.js`. See
  `referenced/flo-data-patterns.md` in the `flo-feature` skill for the
  exact shape.
- **`CategoryIcon.js`** — curated icon-key → `lucide-react-native`
  component map, plus `CATEGORY_ICON_KEYS` for icon pickers and
  `CATEGORY_COLORS` (10-swatch curated palette) for color pickers.
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
- **Known gap surfaced by Phase 3, not fixed (out of scope for
  `01-analytics.md`)**: `components/ProgressBar.js`'s status-to-color
  logic only special-cases `'danger'`, not `'over'` (the actual status
  value `budgetStatus()` returns) — an over-limit progress bar silently
  falls back to the default brand color instead of red, both on the live
  Budgets tab and in Analytics. Worth a small standalone fix later.
