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
was fully Expo-Go-testable; this was the first to require a custom dev
client — `04-notifications-and-recurring-bills.md` Phase 5
(`expo-notifications`) is the second. Both add a native module and its own
permissions merged in via the module's bundled Android manifest (Gradle
autolinking) — check `npx expo prebuild`'s regenerated
`android/app/src/main/AndroidManifest.xml` after adding any new native
dependency, the same way both of these were verified.

**Standing rule — installing a native-permission build for testing**
(added 2026-07-12, `06-transaction-auto-detect.md`'s Phase 1 go/no-go round):
any app declaring a Play Protect "sensitive permission" (`NOTIFICATION_LISTENER`,
`READ_SMS`/`RECEIVE_SMS`, `ACCESSIBILITY`) hits **two separate** Android
protections when tested via a non-Play-Store build, not one:
1. **Play Protect's internet-sideload block** — triggers only when the APK is
   downloaded/tapped *on the phone itself* (browser, chat app, file manager).
   Installing via `adb install` or `npx expo run:android` over USB or wireless
   debugging avoids it entirely — that install path isn't "sideloading" by
   Play Protect's own definition. If you must tap-install on the phone, Play
   Store → profile icon → Play Protect → gear icon → toggle off "Scan apps
   with Play Protect" → accept the "Pause Play Protect instead?" prompt
   (auto-resumes the next day).
2. **Android's "Restricted settings"** — separate from the above, and **not**
   avoided by `adb`. Blocks *granting* the permission itself (shows "For your
   security, this setting is currently unavailable" / a warning about
   financial-data visibility) for **any** non-Play-Store install, adb included.
   Fixed per-install via the installed app's own App Info screen → ⋮ menu →
   "Allow restricted settings." Expect this on every fresh install of any
   future feature needing this permission class, until the app ships via
   Google Play — at which point neither protection applies.

**Standing rule — local scheduled notifications are best-effort on OEM Android
skins, not a FLO bug** (added 2026-07-12, `05-koban-engagement.md`'s Post-Phase-1
Round 2): FLO does not hold `SCHEDULE_EXACT_ALARM` (Play-restricted to
alarm-clock apps), so every local notification — daily reminder, bill
reminders, and anything scheduled the same way in the future — uses Android's
**inexact** `AlarmManagerCompat.setAndAllowWhileIdle()`, which the OS is free to
defer. On top of that, aggressive OEM skins (Vivo/iQOO's OriginOS confirmed;
likely similar on Xiaomi/Oppo/OnePlus) run their **own** background-process
killer with no public API, which can drop a correctly-scheduled alarm entirely
regardless of what the Android API promised. Signature to recognize this,
rather than re-debugging FLO's scheduling logic: a short-interval test
notification (`sendTestNotification()` in `lib/notifications.js`) fires fine,
but anything scheduled hours out silently never arrives. Settings → Notifications
→ "Battery settings" deep-links to the fixable half (stock Android Doze
exemption); the OEM-specific half (Vivo/iQOO: Settings → Battery → High
background power consumption, and Settings → Apps → Autostart) has no
programmatic fix and must be configured manually on-device.

**Standing rule — `user_id DEFAULT auth.uid()`**: every existing table's
`user_id` column has `DEFAULT auth.uid()` (`accounts`, `budgets`,
`categories`, `plans`, `transactions` — confirmed live via
`information_schema.columns`), because every client-side insert in this
codebase omits `user_id` from the payload entirely and relies on that
default. A new table's `CREATE TABLE` SQL must include it too, or every
insert fails with a *misleading* RLS-policy error (`new row violates
row-level security policy`) instead of the more obvious NOT NULL error —
because `user_id` lands as `NULL`, which fails `WITH CHECK ((select
auth.uid()) = user_id)` before it ever hits the not-null constraint. Caught
once already (2026-07-11, `bills` table, `04-notifications-and-recurring-bills.md`
Phase 3 → surfaced by real on-device testing in Phase 4, not by any advisor —
fixed via `ALTER TABLE bills ALTER COLUMN user_id SET DEFAULT auth.uid()`).
When writing a new table's SQL, verify against an existing table's
`information_schema.columns` output, not from memory — this is now also
called out in the `flo-feature` skill's data-patterns reference.

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
| 04 | `04-notifications-and-recurring-bills.md` | In-app toasts → recurring bills/subscriptions → local scheduled notifications + bell notification center | ✅ Complete (all 6 phases built); pending on-device verification of Phase 5's notifications (needs a new EAS build — native module) |
| 05 | `05-koban-engagement.md` | Notification visibility fix → transaction-based streaks → Koban's escalating/varied reminder copy → in-app streak display → mascot icon (last, blocked on user art) | 🚧 **Phases 1–4 built** — heads-up channels (Phase 1, on-device confirmed working); `lib/streak.js` + `hooks/useStreak.js` (Phase 2, 39/39 verified incl. DST); `lib/koban.js` copy engine + `buildReminderPlan()` rolling window (Phase 3, 25/25 verified); `StreakCalendar`/`StreakCelebration` in-app UI (Phase 4, added after the user found Phases 2-3 had no visible surface — 9/9 verified). `formatMoney` hoisted to `lib/money.js`. Awaiting on-device confirmation of Phases 3-4 — no Android SDK here. Phase 5 (mascot icon) blocked on user art |
| 06 | `06-transaction-auto-detect.md` | Bank/UPI (+ SMS, personal-use-only) notification listener → native parse → "₹450 debited, log it?" heads-up → pre-filled Add Transaction | ✅ **Go/no-go PASSED on real device** (2026-07-12) — core mechanism confirmed working. `modules/flo-notification-listener/` (local Expo module, 3rd native module after share-intent/notifications); `lib/detect.js`; `DetectedTransactionHandler` in `app/_layout.js`; Transaction Detection card in `app/settings.js`. **Allowlist reversed for personal use** — SMS/Messages added (`PERSONAL_USE_EXTRA_PACKAGES`, must be removed before any store submission — see doc). Swipe-away-specifically-isolated test still pending; otherwise on-device-verified |
| 07 | `07-onboarding.md` | First-run onboarding (Welcome → Name account → First expense → Reminders & streak → Auto-detect → All set) | 🚧 **All 3 phases built**, bundle-verified only — awaiting on-device confirmation (no Android SDK here). Gated on `profiles.onboarded_at` (new column; existing users backfilled, so the flow only ever fires for **new** signups). Built from the `claude-design/` mock, which predated Koban/Bills/auto-detect — the detect step and the streak framing are additions to that design, not in it |

---

## Schema Reference

Current live schema in Supabase, reconstructed from application code (no
migration files exist). Keep this in sync as feature files land.

### Tables

| Table | Columns | Notes |
|---|---|---|
| `profiles` | `id` (=`auth.users.id`), `full_name`, `currency` (default `'INR'`), `avatar_url`, `created_at`, `onboarded_at` | `avatar_url` + the `avatars` storage bucket exist in code (`EditProfileSheet.js`) but aren't in `FEATURE_PLAN.md`'s original data model — added ad hoc during Phase 5, undocumented until now. **`avatar_url` stores the storage object *path* (`{user_id}/avatar.jpg`), not a URL** (since the bucket went private, 2026-07-11) — read it through a signed URL, don't render it directly. |
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
| `avatars` | Profile avatar images, uploaded via `expo-image-picker` in `EditProfileSheet.js`. Path is `{user_id}/avatar.jpg` (one per user, `upsert:true`). **Private bucket** (since `private_avatars_and_self_delete`, 2026-07-11) — the app stores the object *path* in `profiles.avatar_url` and renders it via a 24h **signed URL** generated in `useProfile` (`createSignedUrl`); the owner's existing `avatars_owner_select` RLS policy permits the signing. On account deletion the file is physically removed by the client Storage API (`deleteAccount` in `AuthContext`) and the metadata row is cleared by the `on_auth_user_deleted` trigger as a safety net (covers Dashboard-initiated deletes too). **Note**: direct `DELETE FROM storage.objects` is blocked by `protect_objects_delete` unless `storage.allow_delete_query='true'` is set for the transaction — the trigger does this; app code deletes via the Storage API instead. |

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
| 2026-07-11 | `cascade_delete_user_data` | Deleting an auth user now fully purges their data. Changed `accounts_user_id_fkey` from `NO ACTION` → `ON DELETE CASCADE` — it was the one `user_id` FK not cascading, and because every user always has ≥1 account, `NO ACTION` was *blocking* auth-user deletion entirely (FK violation), not merely leaving orphans. Added `public.handle_user_delete()` (SECURITY DEFINER) + `on_auth_user_deleted` BEFORE DELETE trigger on `auth.users` (mirrors the existing `handle_new_user` insert trigger) to delete the user's avatar from the `avatars` storage bucket, which has no FK to `auth.users` and would otherwise orphan. All other `user_id` FKs (`profiles.id`, `transactions`, `budgets`, `plans`, `categories`) were already CASCADE from the original build. |
| 2026-07-11 | `revoke_execute_on_user_delete_trigger` | `REVOKE EXECUTE` on `handle_user_delete()` from `public`/`anon`/`authenticated` — the advisor (0028/0029) flagged it as callable via `/rest/v1/rpc`. Trigger functions never need API-role EXECUTE; revoking removes it from the exposed RPC surface. |
| 2026-07-11 | `private_avatars_and_self_delete` | Made the `avatars` bucket **private** (`storage.buckets.public = false`); avatars are now served via short-lived signed URLs. Repurposed `profiles.avatar_url` to store the object **path** (`{user_id}/avatar.jpg`) instead of a full public URL, and migrated/nulled existing rows accordingly. Added `public.delete_current_user()` (SECURITY DEFINER, `authenticated`-only) — lets a signed-in user delete their own `auth.users` row, cascading everything (via `cascade_delete_user_data`). |
| 2026-07-13 | `add_profiles_onboarded_at` | Added `profiles.onboarded_at` (nullable timestamptz, no default) — the first-run onboarding flag (`07-onboarding.md` Phase 1). NULL = hasn't finished onboarding; `OnboardingGate` in `app/_layout.js` reads it. **Backfilled every existing row to `now()`** so no existing user is dragged through the flow — the flag only fires for signups created after this migration. `handle_new_user` deliberately **not** changed: it inserts only `(id, full_name)`, so new profiles get NULL and onboard for free. |
| 2026-07-11 | `fix_user_delete_trigger_storage_guard` | Critical follow-up: `storage.objects` has a `protect_objects_delete` BEFORE-DELETE trigger that rejects any direct delete unless the session GUC `storage.allow_delete_query = 'true'`. `handle_user_delete()` was doing a direct delete, so it would have raised `42501` and **blocked** every auth-user deletion. Fixed by `perform set_config('storage.allow_delete_query','true',true)` before the delete. **Standing rule**: any DB code that deletes from `storage.objects` directly must set this GUC transaction-locally first, or use the Storage API instead. |

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
  (`assets/FLO_LOGO.svg` — a lime-square badge with "FLO" as the actual
  wordmark artwork, not an icon + separate text label), rendered via
  `react-native-svg`'s `SvgXml` with the SVG source inlined as a string
  constant (this project has no Metro SVG-file-loader configured, so the
  file isn't imported directly — keep the inline string in sync if
  `FLO_LOGO.svg` changes). `<Logo size radius />`. Used on the Sign In
  screen in place of the old placeholder (a generic Lucide arrow icon in
  an ink tile + a separate "FLO" `<Text>`) — since the logo already
  contains the wordmark, don't pair it with another text label elsewhere.
- **App icon/splash/adaptive-icon/favicon are branded** (resolved
  2026-07-11, were Expo's generic gray-bullseye placeholders before) —
  `assets/icon.png` (solid lime bg), `adaptive-icon.png`/`splash-icon.png`
  (transparent glyph-only), `favicon.png`, all sourced from `FLO_LOGO.svg`
  and exported by the user (no SVG rasterization tooling in this
  environment). `android.adaptiveIcon.backgroundColor` in `app.json`
  changed from the old cream `#F6F7F3` to brand lime `#BBDC12` to match,
  since the foreground is now transparent rather than a solid tile.
  `splash.backgroundColor` deliberately stayed cream — that's the app's
  real background color, so the transition out of the splash screen
  doesn't color-flash. Verified via `npx expo prebuild` succeeding
  cleanly with the new assets (regenerates native icon resources).
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
- **Onboarding** (`07-onboarding.md`, all 3 phases built 2026-07-13) —
  `lib/onboarding.js` holds the step registry (`ONBOARDING_STEPS`), and both
  the progress dots and the "where does Continue go" routing derive from it,
  so a step added/removed/filtered renumbers everything automatically. A step
  can carry a `supported` predicate and is then **dropped from the flow
  entirely** where it can't work (the auto-detect step on iOS/Expo Go) — that's
  the pattern to copy for any future platform-conditional step, rather than
  stubbing or disabling one. Screens live in `app/onboarding/`, all built on
  `components/OnboardingScaffold.js`.
- **`OnboardingGate`** (`app/_layout.js`) — third instance of the
  `ShareIntentHandler` pattern (side-effect-only component, returns `null`,
  sibling of `<Stack>` *inside* the providers). It needs `useProfile` →
  `useDataRefresh`, and `RootNavigator` defines `DataRefreshProvider`, so this
  logic **cannot** live in `RootNavigator`'s own redirect effect. Redirects on
  `profiles.onboarded_at` being NULL. Anything else that needs to gate routing
  on user data must go here too, not in `RootNavigator`.
- **`components/Confetti.js`** — the project's first real animation.
  `react-native-reanimated` (~4.1.1) was already a dependency via
  `@gorhom/bottom-sheet`, so animation is available without adding anything —
  an earlier plan wrongly assumed it wasn't. One shared value per piece, fires
  once, honours `AccessibilityInfo.isReduceMotionEnabled()`, `pointerEvents:
  none`. Reuse (or extend) this rather than reaching for a confetti library.
- **`WATCHED_APP_LABELS` now lives in `lib/detect.js`**, not `app/settings.js`
  (moved 2026-07-13, `07-onboarding.md` Phase 3). It's the auto-detect consent
  disclosure — the text stating which apps FLO reads — and it's now rendered in
  both Settings and the onboarding detect step. One definition, two consumers:
  a drifted copy would make the disclosure untrue, not just untidy. Keep it in
  sync with `DEFAULT_ALLOWED_PACKAGES` directly above it.
- **`MenuSheet.js`** (added in `01-analytics.md` Phase 1) — the hub sheet
  opened from Home's header (avatar + new menu icon), listing Analytics and
  Settings. Follows the same Provider/Context/`forwardRef` shape as the
  other sheets, but its rows navigate (`router.push`) instead of submitting
  a form. Add new global, non-tab destinations here rather than a new tab
  or a bespoke header button.
- **Account deletion** (`AuthContext.deleteAccount`, added 2026-07-11) —
  removes the avatar via the Storage API (best-effort, while still authed),
  calls the `delete_current_user()` RPC (deletes `auth.users` → cascades all
  data + fires the avatar-cleanup trigger), then `signOut({ scope: 'local' })`
  so logout completes even though the server-side session no longer exists.
  Triggered from Settings via a `Modal` confirmation (Delete Everything /
  Cancel, with inline loading + error). **Log Out** moved out of Settings to
  the `MenuSheet` (Home header menu); Settings' destructive action is now
  Delete Account only.
- **Signed avatar URLs** — the `avatars` bucket is private, so avatars are
  never rendered from a stored URL. `useProfile` returns `avatarUrl` (a 24h
  signed URL freshly generated from `profiles.avatar_url`'s path on every
  refetch) alongside `profile`. Any screen showing an avatar consumes
  `avatarUrl`, not `profile.avatar_url`. `EditProfileSheet` uploads to the
  fixed path and saves that path (not a URL) to `profiles.avatar_url`.
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
  activeAccountId)`; categories never do (global). **Fixed 2026-07-11**:
  its fetch now depends on `session?.user?.id` (via `useAuth()`), not just
  `useDataRefresh`'s `version` — it originally only refetched on
  `notifyChanged()`, so a fetch that ran before sign-in completed
  (correctly empty, pre-auth) never got revisited once a session existed,
  leaving `activeAccountId` stuck `null` indefinitely (found via the first
  real on-device test: no account name on Home, `account_id` NOT NULL
  violation on save). **General lesson for any future provider that
  resolves-once-and-caches client state** (not just re-fetches blindly
  like the plain read hooks do): if what it resolves can depend on auth
  state, it needs `session` in its own dependency list, not just
  `version` — `version` only changes on explicit mutations, never on
  sign-in/sign-out by itself.
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
- **Bug: categories not loading after sign-in/sign-up** (found & fixed
  2026-07-11, real on-device repro — "create an account, add a
  transaction, categories don't show", reproduced in the EAS APK too) —
  same root cause as the earlier `AccountContext` bug, but in a different
  place. Most read hooks (`useTransactions`, `useBudgets`, `usePlans`,
  `useGlobalSummary`, `useDailyTotals`, `useAnalyticsData`) depend on
  `activeAccountId` in their `refetch` `useCallback`, so once
  `AccountContext` was fixed to depend on `session`, those hooks got
  "accidentally" refetched too — `activeAccountId` going from `null` to a
  real id changes `refetch`'s identity, which reruns their `useEffect`.
  **`useCategories.js` and `useAllAccountSummaries.js` are the only two
  read hooks that fetch data *not* scoped by `activeAccountId`** (categories
  are global; the all-accounts summary is deliberately unfiltered) — so
  neither had anything forcing a refetch once auth resolved. Both mount as
  part of always-mounted providers (`AddTransactionSheetProvider`,
  `AddBudgetSheetProvider`, `AccountSwitcherSheetProvider`), so their first
  fetch can run before/without a session (RLS-filtered to empty), and
  nothing about signing in or signing up itself calls `notifyChanged()` —
  so the empty result stuck forever. Fixed by giving both the same
  `session`-dependency treatment as `AccountContext`: `useAuth()` →
  `userId = session?.user?.id` → included in the `refetch` `useCallback`
  deps, guarded with an early "not signed in → empty, stop loading" return.
  **Standing rule, generalized from the earlier single-instance note**: any
  read hook whose `refetch` has no dependency that changes once auth
  resolves (i.e., it doesn't depend on `activeAccountId` or similar)
  *must* depend on `session`/`userId` directly, or it will silently never
  recover from a pre-auth empty fetch. When adding a new global
  (non-account-scoped) hook, check this first.

---

## Security Audit (2026-07-11)

Full pass over the app requested before the next EAS build ("check for
security and vulnerabilities, token issues"). Scope: secrets/git history,
session/token storage, OAuth flow, Supabase advisors, RLS on every table,
storage bucket policies, AndroidManifest permissions, EAS env var
visibility, `.gitignore`/`.env` handling, the new SMS/share-intent parser,
and a grep for `eval`/dynamic-code/unsafe patterns.

**Fixed this pass:**

| Finding | Fix |
|---|---|
| Supabase session (incl. long-lived refresh token) was persisted in plain, unencrypted `AsyncStorage` — readable by anything with filesystem access on a rooted device or via backup extraction. | `lib/supabase.js` now uses Supabase's official `LargeSecureStore`: the session blob is AES-256-CTR encrypted (`aes-js`) before it touches AsyncStorage; the encryption key itself lives in `expo-secure-store` (Android Keystore/iOS Keychain), never in AsyncStorage. AsyncStorage alone is now useless without the device's secure hardware store. Deps installed: `expo-secure-store`, `aes-js`, `react-native-get-random-values` (polyfills `crypto.getRandomValues`, required by the encrypt step). Verified via `npx expo export --platform android` bundling clean. **Side effect**: anyone with the old plaintext session in AsyncStorage (i.e. the user's already-installed APK) will have it silently fail to decrypt on next launch and fall back to signed-out — a one-time forced re-login after the next build, not a bug. |
| `android/app/src/main/AndroidManifest.xml` (applies to release, not just debug) carried `SYSTEM_ALERT_WINDOW`, `RECORD_AUDIO`, `VIBRATE` — none used by any code in this app, injected by Expo's generic baseline template/dependencies. Unused permissions are pure attack surface and a Play Store review flag. | `app.json` → `android.blockedPermissions` strips all three via manifest-merger `tools:node="remove"`. Verified regenerated via `npx expo prebuild --no-install --clean`. `READ/WRITE_EXTERNAL_STORAGE` deliberately left alone — genuinely declared by `expo-image-picker` for the real avatar-upload feature. **`VIBRATE` un-blocked again 2026-07-12** (`05-koban-engagement.md` Phase 1) — now genuinely used: heads-up notification channels vibrate on arrival. Not bloat anymore; don't re-strip it on a future audit without checking this note. |
| `lib/smsParser.js` had no ceiling on input length or parsed amount — the Android share target accepts text from *any* installed app, not just Messages, so it's untrusted input. | Added `MAX_INPUT_LENGTH` (2000 chars, truncate before parsing) and `MAX_SANE_AMOUNT` (₹1 crore, reject anything above as garbage/overflow) in `lib/smsParser.js`. Re-verified all parser cases (13 existing + new oversized-input/garbage-amount cases) via a throwaway test script. |
| RLS policies on all 5 tables re-evaluated `auth.uid()` per row (`auth_rls_initplan` advisor). | Already fixed earlier this session — see `fix_rls_initplan_and_missing_index` in Applied Migrations above. Re-confirmed clean on this pass. |
| 3 views went `SECURITY DEFINER` (RLS bypass) after a migration recreated them. | Already fixed earlier this session — see `fix_views_security_invoker`. Re-confirmed `security_invoker = true` on all three on this pass. |

**Checked, no issue found:** no hardcoded secrets/keys in source or git
history (`EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY` are meant to be public —
anon key + RLS is the correct model, not a leak); Google OAuth uses PKCE
(`exchangeCodeForSession`, not implicit flow) via `expo-auth-session`; no
`eval`/`Function()`/dynamic `require` anywhere; `avatars` storage bucket
policy correctly scopes reads/writes to the owning user; `.env` is
gitignored and never committed; EAS env vars for `preview`/`development`
are `plaintext` visibility (correct — anon key, not a real secret) with no
`sensitive`/`secret` values needed.

**Still open, not fixable from here**: Supabase Auth's leaked-password-
protection is disabled — this is a Dashboard-only toggle (Authentication →
Policies), no MCP tool exposes it. Recommend the user enable it manually
before the next build.

**New legitimate permissions from `expo-notifications`** (2026-07-11,
`04-notifications-and-recurring-bills.md` Phase 5) — `POST_NOTIFICATIONS`
(Android 13+ runtime notification permission) and `RECEIVE_BOOT_COMPLETED`
(re-arms scheduled local notifications after a device reboot; without it
every pending bill reminder would silently vanish on restart) are both
declared in `expo-notifications`' own bundled Android manifest and merged in
automatically — same mechanism as `expo-image-picker`'s storage permissions
above. Not added to `blockedPermissions`; both are genuinely used by the new
Bill/Daily reminder feature. If a future audit sees these, this is why.

- **Bug fixed: Android hardware back button exited the app while any sheet
  was open** (found via real on-device testing, 2026-07-11) — `@gorhom/
  bottom-sheet` v5.2.14 has **no built-in Android back-button handling at
  all** (confirmed: no `BackHandler` usage anywhere in the library's source).
  With nothing intercepting the press, it fell through to `expo-router`/React
  Navigation, and since Home is the root screen with nothing to pop to, that
  meant the OS default: exit the app. Fixed with a new shared hook,
  **`hooks/useSheetBackHandler.js`** — `const handleSheetChange =
  useSheetBackHandler(modalRef); <BottomSheetModal onChange={handleSheetChange} ...>`.
  It tracks the modal's own open/closed state via `onChange` (the only signal
  `@gorhom/bottom-sheet` exposes for this) and registers a
  `BackHandler.addEventListener('hardwareBackPress', ...)` that dismisses
  *that* sheet and returns `true` only while it's actually open — every sheet
  is mounted persistently (per the standing Provider/Context/`forwardRef`
  pattern) so all of them register a listener, but RN's `BackHandler`
  correctly invokes only the most-recently-registered one first, so only the
  currently-open sheet (if any) intercepts the press; the rest return `false`
  and let it fall through untouched. **Applied to all 11 sheets in the app**
  (`AddTransactionSheet`, `AddBudgetSheet`, `AddPlanSheet`, `AddBillSheet`,
  `PayBillSheet`, `AddCategorySheet`, `AddAccountSheet`,
  `AccountSwitcherSheet`, `EditProfileSheet`, `MenuSheet`, `AlertsSheet`).
  **Standing rule**: every new sheet must wire this hook — it's not
  optional/cosmetic, it's the only thing standing between a back-press and an
  unwanted app exit.

---

## Phase 1 Release (2026-07-11)

Everything built through this point — the v1 core (`FEATURE_PLAN.md`),
Analytics, Accounts, SMS Share Import, and Notifications & Recurring Bills
(`01`–`04` above), plus the Home/Analytics chart rework and the Bills↔Plans
tab swap — ships together in one EAS build as **Phase 1** of the
application. This section records the final pre-build audit and polish pass
that preceded it.

**Pre-build audit** (full codebase check, not just the pending diff, per
explicit request before starting the EAS build):
- Re-verified every hook against the session-dependency bug class (see the
  standing rule above) — `useAlerts` and `useSpendingTrend` (both new this
  pass) confirmed safe by composition / `activeAccountId` scoping.
- No dangling references to deleted `TrendChart.js`/`useDailyTotals.js`.
- No `console.log`/`debugger`/TODO left in app code; no hardcoded secrets
  (Supabase keys come from `.env`, gitignored; session storage still uses
  `LargeSecureStore`).
- All 11 sheets confirmed still wired to `useSheetBackHandler`.
- Bills↔Plans tab swap confirmed consistent across `_layout.js`, `TabBar.js`,
  and every `router.push` destination (`/plans`, `/bills`, `/analytics`,
  `/plan/[id]`).
- Supabase advisors re-run: `delete_current_user()`'s `SECURITY DEFINER` flag
  confirmed safe (scoped to `auth.uid()` only, with a null-session check);
  leaked-password-protection still open (Dashboard-only toggle, not fixable
  via MCP — recommend enabling manually).
- **Fixed**: `app.json` declares `userInterfaceStyle: "light"`, but
  `expo-system-ui` (required for Expo to actually enforce it natively) had
  never been installed — `expo prebuild` warned on every run. Installed
  `expo-system-ui`; prebuild now completes with no warnings.
- `npx expo prebuild --platform android` and `npx expo export --platform
  android` both verified clean (3965 modules, no errors) as the final gate
  before this build.

**UI polish** (Home hero card + account selector cards — `AmountText.js`,
`app/(tabs)/index.js`, `AccountSwitcherSheet.js`):
- Currency symbol (₹) now renders in a muted tone instead of the same bright
  color as the balance number, matching `AddTransactionSheet`'s existing
  amount-input treatment (where the ₹ is already de-emphasized against the
  bold digits). Added `AmountText`'s `muteCurrency` prop (opt-in,
  `colors.mutedDarker` on dark cards / `colors.mutedLight` on light ones) so
  every other `AmountText` call site (transaction rows, Analytics, Plan
  Detail) is untouched — this is scoped to just the two cards that were
  singled out.
- Tightened the gap between the "In Hand" label and the balance figure on
  both cards (`heroBalance`/`cardBalance` `marginTop` reduced).

**Deliberately deferred, not built**: persisting the income/expense chart's
visibility-toggle selection (per-account vs per-user vs not at all) — user
was leaning toward "unnecessary" after the tradeoffs were discussed; revisit
if it comes up again.
