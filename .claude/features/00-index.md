# FLO — Feature Index

Tracks what's been planned/built using the `flo-feature` skill, and serves
as the running schema reference since no SQL migration files are committed
in this repo — the Database section of each feature file below is the
durable record for that change.

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
| 01 | `01-analytics.md` | Analytics (shared filter + Overview/Transactions/Categories/Budgets/Plans graphs) | 📝 Planned |

---

## Schema Reference

Current live schema in Supabase, reconstructed from application code (no
migration files exist). Keep this in sync as feature files land.

### Tables

| Table | Columns | Notes |
|---|---|---|
| `profiles` | `id` (=`auth.users.id`), `full_name`, `currency` (default `'INR'`), `avatar_url`, `created_at` | `avatar_url` + the `avatars` storage bucket exist in code (`EditProfileSheet.js`) but aren't in `FEATURE_PLAN.md`'s original data model — added ad hoc during Phase 5, undocumented until now. |
| `categories` | `id`, `user_id`, `name`, `icon`, `type` (`'income'`\|`'expense'`), `is_default` | Seeded on signup: Food, Travel, Shopping, Bills, Coffee, Groceries (expense); Salary, Freelance (income). |
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

Every table: `auth.uid() = user_id`, all operations. No public/token-based
read paths anywhere.

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
  component map, plus `CATEGORY_ICON_KEYS` for icon pickers.
- **`theme/tokens.js`** — colors, radii, spacing, fontFamily, fontSize.
  Single source for all styling.
- **Google Sign-In** — `AuthContext.signInWithGoogle` is fully implemented
  (`expo-auth-session`/`expo-web-browser`/`expo-linking`) but the UI button
  in `sign-in.js` is currently disabled/unreachable, per `FEATURE_PLAN.md`'s
  v1 default of email/password only.
- **Known gap**: Settings → Currency row is static text ("₹ INR"), not
  wired to `profiles.currency` despite the column existing. Not yet
  scheduled as a feature file.
