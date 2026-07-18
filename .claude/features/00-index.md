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

**Product decision — auto-detect is PERSONAL-USE-ONLY and will never be
published** (settled 2026-07-17). The `06-transaction-auto-detect.md`
notification-listener feature (`modules/flo-notification-listener/`,
`lib/detect.js`, `DetectedTransactionHandler`, the Settings "Transaction
Detection" card) is **not shippable to Google Play or the App Store and never
will be** — the reasons are architectural, not a to-do list (full analysis in
`IDEAS-subscription-and-store.md` Part 1):
- **iOS: impossible.** No app can read other apps' notifications; there is no
  equivalent API and never will be. Any store build of FLO ships with **zero**
  auto-detection on iOS.
- **Android: policy-fraught even after cleanup.** The current allowlist is
  store-illegal (`PERSONAL_USE_EXTRA_PACKAGES`/`WATCHED_APP_LABELS` include the
  Messages app — reading a bank SMS notification = reading the SMS, which Play's
  SMS/Call Log policy targets), and notification-listener access is itself a
  Play "sensitive permission" that is reviewable and rejectable.
**Consequence for all future work**: this feature stays as-is for the author's
own personal build **only**. It is **not** part of any store release, **not**
the basis of the paid tier, and must **not** be counted on when sequencing
monetisation or a store submission — the cross-platform paid backbone is AI
(receipt scan + categorisation), per `IDEAS-subscription-and-store.md`. Do not
re-propose gating, polishing, or store-hardening auto-detect; treat it as a
frozen personal-use bonus. (The store-submission strip-list in that doc's Part 1
still applies **if** a store build is ever cut with the module present — but the
default is that it simply isn't shipped.)

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
| — | `IDEAS-subscription-and-store.md` | **Idea** — monetisation (never gate the ledger, gate the leverage) **and the store-readiness problem it exposes**: auto-detect is iOS-impossible, Play-policy-fraught, and currently ships a personal-use-only SMS allowlist that must be stripped before submission. Conclusion: the paid tier **cannot** rest on auto-detect; AI (receipt scan + categorisation) is the cross-platform backbone. **Part 3 added 2026-07-17**: the free/Pro split ships live from day one of the store release (day-one limits = no grandfathering problem), the tier split (1 account/2 budgets/1 plan free; basic report never gated), create-time-only enforcement, the grandfathering doctrine for future tightening, and the master build sequence (Edge Function → AI → pricing → sub screens → launch → gamification). Read before planning monetisation, a store release, or sequencing any of it. | 📋 Reference |
| — | `IDEAS-personal-onboarding.md` | **Idea** — conversational/personal onboarding v2 (MCQ questions → reflection screen → commitment → signup), a rework of `07`. Records the psychology, the one rule that keeps it honest (every question must configure something real), and the pre-auth technical wrinkle. | 📋 Reference |
| — | `IDEAS-gamification.md` | **Idea** — single-player gamification: earned-only coins (behavior-keyed, never amount-keyed), streak freeze as the anchor item, free trophy room, hero-card themes as "card designs" (incl. seasonal free-to-equip/earn-to-keep), deterministic pick-1-of-3 milestone chests, skin display surfaces + avatar bundles, dual-track cosmetics-only IAP, and the fill-agnostic promo card (house content at launch → AdMob later at scale, Pro always ad-free). Records **why leaderboards, gacha, and purchasable coins are rejected** and the no-spend-day/streak-semantics wrinkle — read before re-proposing any of them. Ends with a quick-wins-first implementation flow. | 📋 Reference |
| — | `IDEAS-ai-features.md` | **Idea** — AI as the cross-platform, gate-able Pro backbone (since auto-detect can't ship to a store). The one insight: every AI feature is the same "unstructured input → transaction draft → confirm → write" shape, so build **one Edge Function proxy** with input adapters, not separate backends. Covers AI categorisation (the cheap backbone), merchant→category memory (a lookup, not AI), receipt scanning (the cash blind-spot + how it should record: an attribute of a transaction, never a separate "Receipts" ledger), the advisor/insights layer, bill detection, budget suggestions, and NL search. Records the **non-negotiables** (key server-side, never auto-insert, category-constrained, metered), each feature's **cost/gating profile**, why **voice input is parked** (STT cost — revisit when widgets land), and the **build order nested into the subscription master sequence** (proxy → AI core → pricing → sub screens → launch → additive Pro). Read with `IDEAS-subscription-and-store.md`. | 📋 Reference |
| — | `IDEAS.md` | **Ideas backlog** — unscheduled, unphased. Verified gaps (no transfers, no search, no merchant capture, dead `profiles.currency`), the AI discussion (categorisation before receipt scanning, and why), and the two open product decisions blocking plans. Read before proposing a new feature; graduate an idea into a numbered doc when it's picked up. | 📋 Reference |
| — | `FEATURE_PLAN.md` (repo root) | Core app (auth/transactions/budgets/plans/settings) | ✅ Complete (v1) |
| 01 | `01-analytics.md` | Analytics (shared filter + Overview/Transactions/Categories/Budgets/Plans graphs) | ✅ Complete (all 3 phases built, pending final on-device confirmation) |
| 02 | `02-accounts.md` | Accounts (multiple ledgers; active-account scoping for transactions/budgets/plans/analytics) | ✅ Complete (all 3 phases built, pending on-device confirmation) |
| 03 | `03-sms-share-import.md` | SMS Share Import (Android share-target → parsed prefill → Add Transaction) | 🚧 All 3 phases implemented; awaiting on-device verification (no device in this environment) |
| 04 | `04-notifications-and-recurring-bills.md` | In-app toasts → recurring bills/subscriptions → local scheduled notifications + bell notification center | ✅ Complete (all 6 phases built); pending on-device verification of Phase 5's notifications (needs a new EAS build — native module) |
| 05 | `05-koban-engagement.md` | Notification visibility fix → transaction-based streaks → Koban's escalating/varied reminder copy → in-app streak display → mascot icon (last, blocked on user art) | 🚧 **Phases 1–4 built** — heads-up channels (Phase 1, on-device confirmed working); `lib/streak.js` + `hooks/useStreak.js` (Phase 2, 39/39 verified incl. DST); `lib/koban.js` copy engine + `buildReminderPlan()` rolling window (Phase 3, 25/25 verified); `StreakCalendar`/`StreakCelebration` in-app UI (Phase 4, added after the user found Phases 2-3 had no visible surface — 9/9 verified). `formatMoney` hoisted to `lib/money.js`. Awaiting on-device confirmation of Phases 3-4 — no Android SDK here. Phase 5 (mascot icon) blocked on user art |
| 06 | `06-transaction-auto-detect.md` | Bank/UPI (+ SMS, personal-use-only) notification listener → native parse → "₹450 debited, log it?" heads-up → pre-filled Add Transaction | 🔒 **PERSONAL-USE-ONLY — never published** (decision 2026-07-17, see the standing note above; full reasoning in `IDEAS-subscription-and-store.md` Part 1). iOS-impossible + Play-policy-fraught, so it is frozen as the author's own bonus and is **not** part of any store release or the paid tier. **Go/no-go PASSED on real device** (2026-07-12) — core mechanism confirmed working. `modules/flo-notification-listener/` (local Expo module, 3rd native module after share-intent/notifications); `lib/detect.js`; `DetectedTransactionHandler` in `app/_layout.js`; Transaction Detection card in `app/settings.js`. **Allowlist reversed for personal use** — SMS/Messages added (`PERSONAL_USE_EXTRA_PACKAGES`, must be removed before any store submission — see doc). Swipe-away-specifically-isolated test still pending; otherwise on-device-verified |
| 08 | `08-budget-periods-and-detail.md` | Budget period model (`calendar_week`/`calendar_month`/**`custom`** date range) + visible period labels + budget detail screen | 🚧 **Both phases built**, bundle- and SQL-verified; awaiting on-device confirmation. `budgets.period` **dropped** → `period_type` + `start_date`/`end_date`; `v_budgets_with_spent` now exposes `period_start`/`period_end` (the keystone — the card can finally name its window, and the detail screen filters by the *same* bounds `spent` came from). Tapping a budget card now opens `/budget/[id]` instead of the edit sheet |
| 07 | `07-onboarding.md` | First-run onboarding (Welcome → Name account → First expense → Reminders & streak → Auto-detect → All set) | 🗄️ **Superseded by `12-personal-onboarding.md`** (2026-07-14) — v2 is a substantial rework, not a patch: the pre-auth intro replaces Welcome, auto-detect is cut from the flow entirely, and `done.js` was rebuilt. `app/onboarding/welcome.js`/`detect.js` and `components/OnboardingScaffold.js`/`OnboardingProgress.js` (all built here) were **deleted** in `12`'s Phase 3 cleanup once nothing referenced them. Retained from this feature: `account.js`/`expense.js`/`reminders.js` (restyled, logic intact), `Confetti.js`, `PartyPopper.js`, the `profiles.onboarded_at` flag and its gate mechanics. Read this doc for the historical build log (the stale-read race fix, the vertical-rhythm iterations, the streak-celebration user-scoping bug) — `12` doesn't repeat it |
| 12 | `12-personal-onboarding.md` | Personal onboarding v2 — a conversational pre-auth Introduction (12 screens: problem → aha stat → name/age/income → goal/leak/habit → reflection) that hands into sign-up framed as "save your progress," then a post-auth Climax (real budget created from the leak answer, report cadence, reminders) and Conclusion (journey/free/commitment/all-set) | ✅ **All 3 phases built** (2026-07-14), bundle-verified; on-device pending. **The gate inverts**: `RootNavigator` now makes a signed-out two-way choice (intro vs sign-in, via a device-local `introSeen` flag) while `OnboardingGate` still owns all signed-in routing — disjoint by session, same invariant `07` established. One schema change: `profiles.onboarding_answers` (jsonb) — **income is deliberately never stored**, it lives only in the pre-auth AsyncStorage draft (`lib/onboardingDraft.js`) and sizes the first budget before being cleared on finish. New shared components: `OnboardingScreen` (light/brand/ink scaffold + progress bar), `OnboardingReveal` (spring-based staggered entrance), `CountUp`, `OnboardingChoice`. `lib/koban.js` gained an opt-in `tone` param (`toneFromCommitment`) on `pickNudge`/`buildReminderPlan`, scoped to the tiers where pressure genuinely varies — recap copy untouched. Auto-detect is cut from onboarding entirely (see `06`'s store-readiness note) |
| 11 | `11-reports.md` | Weekly/monthly reports covering ALL of the user's accounts (headline delta, stats, category donut, budget/plan status, biggest transaction), with an in-place period picker (presets + custom range) so every report doubles as a custom report, scheduled push + bell delivery, and CSV export. | 🚧 **Phases 1–2 built, Phase 3 CSV done** (2026-07-14), bundle-verified; on-device pending. **No schema change** — config + seen-state in AsyncStorage (`lib/reports.js`). `hooks/useAnalyticsData.js` gained an `allAccounts` param (default `false`, `app/analytics.js` unaffected). New `app/report.js`, `components/ReportPeriodPicker.js` (a centred `Modal` dialog, not a bottom sheet — the trigger sits at the screen's top), `components/ReportReadyCard.js` (Home card), `hooks/useReportDue.js` (shared live due-check, also feeds `useAlerts`' new `info`-severity bell alert), `lib/export.js` (CSV, via newly-added `expo-sharing`/`expo-file-system`). Settings gained a "Reports" cadence card; Menu gained a "Reports" row; both Report and Analytics gained a header Export button. Scheduling uses genuine repeating `WEEKLY`/`MONTHLY` OS triggers (verified against the installed `expo-notifications` version's real type defs — caught a real weekday-numbering mismatch, 1=Sun vs JS's 0=Sun, before it shipped). `expo-file-system@19`'s API was found to have been completely rewritten (`File`/`Directory`/`Paths` classes; the old string-path functions still exist but throw at runtime) — caught by reading the installed version's actual types, not memory. Caught and fixed a real cross-account budget leak (categories are global) in Phase 1 — see doc's Implementation Notes. PDF export not started, pending an explicit go-ahead. |
| 10 | `10-account-self-transfer.md` | Account-to-account self-transfer: a third **Transfer** tab in `AddTransactionSheet` (From/To pickers) writing a linked `transfer_out`/`transfer_in` pair. Moves balances between accounts but is excluded from all spent/earned totals, budgets, analytics, and the streak. | 🚧 **Phase 1 built** (2026-07-14), bundle- & DB-verified; on-device pending. Migration `account_self_transfer` (2 new `type` values + `transfer_id`/`transfer_account_id` + `v_global_summary` balance recreate). New `lib/transfers.js`; `AddTransactionSheet` Transfer mode (full create/edit/delete); `AmountText` transfer tones; transfer rendering in Transactions/Home; streak + `computeBiggestTransaction` exclusions. |
| 09 | `09-plans-that-collect.md` | Make Plans' explicit-membership model usable: **Phase 1** add-from-history bulk-tagger; **Phase 2** collecting mode (one armed plan per account, new txns default in); **Phase 3** category-breakdown donut on Plan Detail | 🚧 **All 3 phases built** (2026-07-14), bundle- & DB-verified; on-device pending. P1: route restructured `app/plan/[id].js` → `[id]/index.js` + new `[id]/history.js`; `hooks/usePlanCandidates.js` (no DB change). P2: `plans.is_collecting` + partial unique index (migration `plan_collecting_mode`); `hooks/useCollectingPlan.js`, `lib/plans.js`; new transactions default into the armed plan via `AddTransactionSheet`. Also added branded **`components/Switch.js`** (replaced RN `Switch` everywhere). P3: "Where it went" donut + ranked category list on Plan Detail, reusing `lib/analytics.js`'s `computeCategoryBreakdown`/`getCategoryColor` — no new query, no new DB. |

---

## Schema Reference

Current live schema in Supabase, reconstructed from application code (no
migration files exist). Keep this in sync as feature files land.

### Tables

| Table | Columns | Notes |
|---|---|---|
| `profiles` | `id` (=`auth.users.id`), `full_name`, `currency` (default `'INR'`), `avatar_url`, `created_at`, `onboarded_at`, `onboarding_answers` | `avatar_url` + the `avatars` storage bucket exist in code (`EditProfileSheet.js`) but aren't in `FEATURE_PLAN.md`'s original data model — added ad hoc during Phase 5, undocumented until now. **`avatar_url` stores the storage object *path* (`{user_id}/avatar.jpg`), not a URL** (since the bucket went private, 2026-07-11) — read it through a signed URL, don't render it directly. **`onboarding_answers`** (jsonb, nullable, added 2026-07-14, `12-personal-onboarding.md`): `{ age_range, goal, leak_category, tracking_habit, commitment }` — a bag for personalisation + future callbacks, not filtered on in SQL. **Income is deliberately never stored anywhere** — it lives only in the pre-auth AsyncStorage draft and sizes the first budget before being cleared. |
| `categories` | `id`, `user_id`, `name`, `icon`, `color` (text, hex, `NOT NULL DEFAULT '#BBDC12'`), `type` (`'income'`\|`'expense'`), `is_default` | Seeded on signup: Food, Travel, Shopping, Bills, Coffee, Groceries, Other (expense); Salary, Freelance, Other (income) — 10 rows, each with a curated `color` (see `add_category_colors` migration below). `color` added 2026-07-11; picked via a curated swatch grid in `AddCategorySheet.js`, currently consumed only by Analytics (not tinted elsewhere in the app). **Global — not scoped by account, shared across all of a user's accounts.** |
| `accounts` | `id`, `user_id`, `name`, `description` (nullable), `color` (text, hex, `NOT NULL DEFAULT '#BBDC12'`), `created_at` | Added 2026-07-11 (`add_accounts` migration, `02-accounts.md` Phase 1). Every user always has ≥1 account; `handle_new_user` auto-creates a "Personal" account on signup. Active account is client-side state (`lib/AccountContext.js`), persisted to AsyncStorage — not itself a DB concept. |
| `transactions` | `id`, `user_id`, `account_id` (NOT NULL, added 2026-07-11), `type` (`'income'`\|`'expense'`\|`'transfer_in'`\|`'transfer_out'`), `amount` (always positive), `category_id`, `plan_id`, `note`, `occurred_at` (date), `created_at`, `transfer_id` (uuid, nullable), `transfer_account_id` (uuid, nullable, FK → `accounts` ON DELETE SET NULL) | The single source of truth — every summary is computed from this table. **`transfer_in`/`transfer_out` added 2026-07-14** (`10-account-self-transfer.md`): a self-transfer is two rows sharing a `transfer_id`, each carrying the counterpart account in `transfer_account_id`. They move per-account balance (`v_global_summary`) but are excluded from every spent/earned total, budget, plan, analytics fn, and the streak — **because those all filter on the exact type string `'income'`/`'expense'`**. Any NEW aggregation must keep that exact-type discipline, or it will accidentally count transfers. |
| `budgets` | `id`, `user_id`, `account_id` (NOT NULL), `name`, `amount`, `period_type` (`'calendar_week'`\|`'calendar_month'`\|`'custom'`), `start_date`/`end_date` (custom only, else NULL), `category_id` (nullable = overall), `created_at` | **`period` was dropped 2026-07-13** (`08-budget-periods-and-detail.md`) — grep for `.period` before assuming otherwise. Calendar types recur forever; `custom` is a one-off explicit range that **ends** (excluded from alerts once past). Two CHECK constraints: valid `period_type`, and custom-requires-both-dates / calendar-requires-neither. "spent" is always computed for the current period, never stored. |
| `plans` | `id`, `user_id`, `account_id` (NOT NULL, added 2026-07-11), `name`, `icon`, `target_amount` (nullable), `start_date`, `end_date` (nullable), `status` (`'active'`\|`'completed'`), `created_at`, `is_collecting` (boolean, NOT NULL DEFAULT false, added 2026-07-14) | `is_collecting`: while true, new transactions in the plan's account default into it (`09-plans-that-collect.md` Phase 2). **Partial unique index `plans_one_collecting_per_account (user_id, account_id) WHERE is_collecting`** — at most one collecting plan per account, DB-enforced. `v_plans_with_totals` deliberately does **not** expose it; read via `hooks/useCollectingPlan.js` (scoped to `activeAccountId`). Arming clears any other collecting plan in the account first (clear-then-set, `lib/plans.js`). |

### Views (computed reads)

| View | Purpose |
|---|---|
| `v_global_summary` | Per-account (added `account_id`, `GROUP BY account_id`, 2026-07-11): total income, total expense, in-hand balance, this-month income/expense **for one account**. Returns no row for an account with zero transactions — query with `.eq('account_id', …).maybeSingle()`, not `.single()`. **Recreated 2026-07-14** (`10-account-self-transfer.md`): `in_hand_balance = (income + transfer_in) − (expense + transfer_out)` so a transfer moves balances between accounts; `total_income`/`total_expense`/`month_*` unchanged (still exact-type filters → transfers excluded). `security_invoker = true` re-set. |
| `v_budgets_with_spent` | Each budget + current-period `spent`/`remaining` (negative when over). Gained `account_id` 2026-07-11. **Rewritten 2026-07-13** (`08-...md`): now also exposes **`period_start`/`period_end`** — the window `spent` is computed over — plus `period_type`, `start_date`/`end_date` and `category_color`. Any UI that needs to know or display a budget's window **must read these columns**, never re-derive the period client-side: a client that computes its own "this week" can disagree with the `spent` figure printed beside it, and both halves look correct in isolation. The one sanctioned exception is `previewPeriodDates()` in `lib/budgets.js`, which must show a window *before* a row exists — it duplicates the view's `CASE` and is commented on both sides. |
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
| 2026-07-13 | `budget_period_types` | `08-budget-periods-and-detail.md` Phase 1. Dropped `budgets.period`; added `period_type` (`calendar_week`\|`calendar_month`\|`custom`) + `start_date`/`end_date`, with CHECK constraints (valid type; custom-requires-both-dates, calendar-requires-neither). Recreated `v_budgets_with_spent` exposing `period_start`/`period_end`/`period_type`/`start_date`/`end_date`/`category_color`, and re-set `security_invoker = true` (standing rule — verified via `pg_class.reloptions` and a clean security advisor run). Backfill (`'week'`→`calendar_week`) was a no-op: `budgets` had 0 rows. Verified live by inserting one budget of each type and reading the view back (calendar_week → Mon–Sun; calendar_month → 1st–EOM; custom → its own dates), then deleting them. |
| 2026-07-14 | `account_self_transfer` | `10-account-self-transfer.md` Phase 1. Widened `transactions_type_check` to allow `transfer_in`/`transfer_out`; added `transactions.transfer_id` (uuid, nullable) + `transfer_account_id` (uuid, nullable, FK → `accounts(id)` ON DELETE SET NULL) + partial index `idx_transactions_transfer_id`. Recreated `v_global_summary` with the transfer-aware `in_hand_balance` (re-set `security_invoker = true`). Verified live: a ₹1000 test transfer moved balances ±1000 with income/expense totals unchanged; advisor clean (only the 2 pre-existing WARNs). |
| 2026-07-14 | `plan_collecting_mode` | `09-plans-that-collect.md` Phase 2. Added `plans.is_collecting` (boolean NOT NULL DEFAULT false) + partial unique index `plans_one_collecting_per_account ON plans (user_id, account_id) WHERE is_collecting` (at most one collecting plan per account). No view recreated (so no `security_invoker` step). Verified live: column shape, index def, and a DO-block test proving the index rejects a second collecting plan in one account and that clear-then-set works. Security advisor after: only the two pre-existing WARNs, no new finding. |
| 2026-07-13 | `add_profiles_onboarded_at` | Added `profiles.onboarded_at` (nullable timestamptz, no default) — the first-run onboarding flag (`07-onboarding.md` Phase 1). NULL = hasn't finished onboarding; `OnboardingGate` in `app/_layout.js` reads it. **Backfilled every existing row to `now()`** so no existing user is dragged through the flow — the flag only fires for signups created after this migration. `handle_new_user` deliberately **not** changed: it inserts only `(id, full_name)`, so new profiles get NULL and onboard for free. |
| 2026-07-14 | `add_profiles_onboarding_answers` | `12-personal-onboarding.md` Phase 1. Added `profiles.onboarding_answers` (nullable jsonb, no default). NULL until a user finishes the v2 pre-auth intro; both existing profiles confirmed NULL and already onboarded, so neither is dragged into the flow. No view recreated → no `security_invoker` step. Advisor clean (only the 2 pre-existing WARNs) both immediately after and after Phases 2–3. |
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

- **Logo revamp to the arrow "flow" mark (2026-07-15)** — the user replaced
  the app's icon-level branding around the same two-arrow vector used for
  `OnboardingArrowMotif.js`. `assets/icon.png` (1024×1024, solid lime bg,
  arrow-only glyph, no wordmark), `assets/adaptive-icon.png` (transparent bg,
  arrow inside the safe zone), `assets/splash-icon.png`, and
  `assets/favicon.png` were all updated to match and verified correct.
  `assets/notification-icon.png` (96×96, white-on-transparent, no wordmark —
  Android force-renders this as a flat silhouette regardless of source color,
  so white is convention not requirement) was verified via `npx expo prebuild
  --platform android --clean`, confirming Expo generated all five density
  variants (`mdpi`–`xxxhdpi`) under `android/app/src/main/res/drawable-*/`.
  One real near-miss caught in this pass: the app icon file was briefly
  renamed `Icon.png` (capital I) — harmless on Windows' case-insensitive
  filesystem, but would have broken silently on EAS Build's case-sensitive
  Linux runners, since `app.json`'s `"icon": "./assets/icon.png"` is
  lowercase. Renamed back before it could ship.
  **New `components/ArrowMark.js`** — the bare arrow (no lime badge, no
  wordmark), same inlining pattern as `Logo.js`/`OnboardingArrowMotif.js` (no
  Metro SVG-file-loader configured). Swapped into `app/sign-in.js` in place of
  `Logo.js`, which read as too heavy/boxed on the auth screens. **`Logo.js` is
  now unused anywhere in the app** (confirmed via grep) — left in place rather
  than deleted, since the user may want it repointed at the new arrow mark
  (instead of the old lettered "FLO" wordmark in `assets/FLO_LOGO.svg`) rather
  than retired outright; flagging here so it isn't mistaken for dead code to
  clean up blindly.
  **Confirmed with the user**: `assets/LogoIconSVG.svg` (1024×1024, lime bg +
  arrow, no text) *is* the full new brand mark — there is no separate
  wordmark-bearing "full logo" coming. The brand direction going forward is
  arrow-only.
- **`components/Skeleton.js` / `components/FadeIn.js`** (added 2026-07-15,
  `12-personal-onboarding.md` post-launch follow-up) — the app-wide pattern for
  a screen whose data hooks already expose a `loading` boolean (most do — see
  the "Loading = a simple `loading` boolean" convention) but the screen never
  reads it, so the hook's default/empty value renders as if it were the real
  answer (₹0 balances, a real empty state) before popping to the actual data a
  beat later. `Skeleton` is a neutral placeholder block (slow opacity breathe,
  skipped under reduce-motion); `FadeIn` is a one-time 240ms fade+6px-rise
  mounted once a section's `loading` flips false. Both are reanimated-based
  (already a dependency), animate-first/snap-on-reduce (start immediately,
  only snap to final frame if reduce-motion resolves true later — see the
  `OnboardingReveal` lesson below). Deliberately more restrained than
  onboarding's spring/pop reveals — this is the main app, seen many times a
  day. **Rolled out app-wide 2026-07-15** (same-day follow-up request): Home,
  Transactions, Budgets, Bills, Plans, and Analytics all now wire `loading`
  from their existing data hooks into `Skeleton`/`FadeIn` — every one of those
  hooks already exposed `loading` per this app's own convention, the screens
  just weren't reading it.
  **Also surfaced a real (not cosmetic) bug this same pass**: Budget Detail
  (`app/budget/[id].js`), Plan Detail (`app/plan/[id]/index.js`), and Plan
  History (`app/plan/[id]/history.js`) all fell straight through to
  `if (!record) return null` with no loading branch at all, rendering a
  BLANK screen (not just a wrong-value flash) for the whole time their detail
  hook (`useBudgetDetail`/`usePlan`) was in flight. Fixed with a centred
  `ActivityIndicator` branch ahead of the null-check, matching the pattern
  `app/streak.js` already had right. `app/report.js` was checked and already
  handled this correctly (`if (!period) return <Text>Loading report…</Text>`,
  and its "quiet period" empty state was already gated on `!loading`) — no
  change needed there. `app/settings.js`/`app/manage-categories.js` were
  checked and don't exhibit the misleading-value bug (no numeric/list
  empty-state text that could flash incorrectly), so were deliberately left
  alone rather than gaining unnecessary skeleton complexity.
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
- **`lib/transfers.js`** (added 2026-07-14, `10-account-self-transfer.md`) — the
  self-transfer model: `isTransfer(tx)`, `transferLabel(tx, accounts)` (resolves
  "Transfer to/from X" from the counterpart account, no join), and the pair
  mutations `logTransfer`/`updateTransfer`/`deleteTransfer`. A transfer is **two
  rows** (`transfer_out` + `transfer_in`) sharing a client-generated `transfer_id`;
  edit = insert-new-pair-then-delete-old (crash-safe); delete = by `transfer_id`.
  **Standing rule for any transaction rendering**: a row can now be a transfer —
  branch on `isTransfer(tx)` before assuming `type` is income/expense (icon,
  label, colour), and any hook feeding a category-colour chart still needs
  `color` in its select. Transfer legs carry `category_id`/`plan_id` NULL.
- **`components/DonutChart.js` is shared** by Analytics' Categories tab and
  Plan Detail's "Where it went" card (added 2026-07-14, `09-plans-that-collect.md`
  Phase 3) — any change to it (gap size, corner style, center-label font)
  affects both screens at once. Any hook whose rows feed it must select the
  category's `color` column explicitly — `hooks/useTransactions.js` was
  missing it (only `id, name, icon`), which silently rendered every segment as
  the same grey fallback; fixed to match `usePlanCandidates.js`/`useBills.js`.
  `useAnalyticsData.js` was never affected (`categories(*)`, all columns).
- **`components/Switch.js`** (added 2026-07-14, `09-plans-that-collect.md`
  Phase 2) — the app's toggle control: shadcn-style, brand-lime track when on,
  neutral (`chipBg`) when off, sliding white thumb (RN `Animated`, non-native
  driver — it animates `backgroundColor`). Drop-in for React Native's `Switch`
  (`value`/`onValueChange`/`disabled`). **Use this, not the platform `Switch`,
  for every toggle** — all six existing call sites were migrated to it (Settings
  ×4, `AddBillSheet`, onboarding `reminders.js` ×2, plus `AddPlanSheet` and Plan
  Detail's collecting toggle). Extra props like `trackColor`/`thumbColor` aren't
  needed (and were removed from `AddBillSheet` where they'd been hand-rolled).
- **`hooks/useAlerts.js` gained a third severity tier, `info`** (added
  2026-07-14, `11-reports.md` Phase 2) — the prior model was strictly binary
  (`danger`/`warn`); `info` is for good-news/neutral alerts (currently just
  "your report is ready") that would read wrong painted amber/red. Sorts last
  (`SEVERITY_ORDER: { danger: 0, warn: 1, info: 2 }`). `AlertsSheet.js` styles
  it with brand-lime-on-`inkCard` — reusing that same file's own pre-existing
  "you're all caught up" empty-state combo, not a new colour pairing. Any
  future non-problem alert (an achievement, a completed goal, etc.) should use
  this tier rather than overloading `warn`.
- **`hooks/useReportDue.js`** — the live "is a scheduled report due and
  unseen right now" check, shared by the Home `ReportReadyCard` and the bell's
  `info` alert (`useAlerts`) so both can never disagree about what counts as
  due. Like every other alert source in this app, nothing is stored — it's a
  read of AsyncStorage settings + seen-state, recomputed on `userId`/`version`
  change. Model for any future feature needing the same value read from two
  UI surfaces.
- **`expo-notifications@0.32.17` genuinely supports repeating `WEEKLY` and
  `MONTHLY` triggers** (`SchedulableTriggerInputTypes.WEEKLY`/`MONTHLY`,
  confirmed by reading the installed package's own type defs, not assumed) —
  set once, fire forever, no rolling-reschedule dance needed the way bills/the
  daily reminder require (those need per-occurrence content variation; a
  fixed-content repeating notification doesn't). **`WeeklyTriggerInput.weekday`
  uses 1–7 with 1=Sunday** — NOT JS's `Date#getDay()` 0=Sun..6=Sat convention
  used everywhere else in this codebase's own date handling. Any future
  feature scheduling a weekly OS notification must convert
  (`lib/reports.js`'s `toExpoWeekday()` is the one existing conversion point);
  getting this wrong silently schedules the notification on the wrong day.
  `MonthlyTriggerInput.day` is a plain 1-indexed day-of-month (no conversion
  needed) but does **not** clamp for short months — a day-31 cadence simply
  skips firing in Feb/Apr/Jun/Sep/Nov.
- **`expo-file-system@19` (installed 2026-07-14, `11-reports.md` Phase 3)
  completely rewrote its API** around `File`/`Directory`/`Paths` classes —
  the old string-path functions (`writeAsStringAsync`, `getInfoAsync`,
  `cacheDirectory`, etc.) **still exist as exports from the main package but
  are deprecated stubs that throw at runtime**, not just lint warnings; the
  real replacement is `expo-file-system/legacy` if the old API is truly
  wanted, or (preferred, what this codebase uses) the current class API:
  `new File(Paths.cache, filename).write(content)` — note `.write()` is
  **synchronous**, not a Promise. Confirmed by reading this installed
  version's actual `.d.ts` files, not from memory of an older SDK — any
  future feature touching file I/O should do the same rather than assume the
  old API still works. `expo-sharing`'s API (`isAvailableAsync`/
  `shareAsync(uri, options)`) is unchanged. `lib/export.js`'s `buildTransactionsCsv`/
  `shareCsv` are the reference implementation.
- **`lib/budgets.js`** (added 2026-07-13, `08-...md`) — `formatPeriodLabel`,
  `budgetPeriodDates`, `isBudgetEnded`, `daysLeftInPeriod`,
  `computeBudgetPace`, `previewPeriodDates`. `computeBudgetPace` reuses the
  settled `on_track`/`over_pace`/`under_pace` vocabulary from
  `computePlanPace` — a budget, like a plan target, is a spending *cap*, so
  `ahead`/`behind` reads ambiguously. Don't reinvent the labels.
- **Date-only strings from Postgres need `parseISO`, not `new Date()`**
  (`lib/budgets.js`) — `new Date('2026-07-13')` parses as **UTC** midnight,
  which lands on the *previous day* for any negative UTC offset. `parseISO`
  treats a date-only string as *local* midnight, which is what a calendar
  date means. Applies to every `date` column in this schema
  (`occurred_at`, `period_start`/`period_end`, `start_date`/`end_date`).
- **`useBudgetDetail(budgetId)`** — like `usePlan(planId)`, deliberately
  **not** filtered by `activeAccountId`: it's keyed by an id that came from
  explicit navigation, so it scopes to *that record's* `account_id`. This is
  the standing pattern for any future singular-detail hook.
- **Bug fixed: streak celebration was suppressed across accounts on a shared
  device** (found 2026-07-13 during onboarding's first real run, fixed in
  `05-koban-engagement.md`'s `StreakCelebration.js`) — the "already celebrated
  today" guard used a bare AsyncStorage key (`flo.streak.lastCelebrated`) with
  **no user scoping**, so once *any* account celebrated on a device, every
  other account on that device was silently skipped for the rest of the day.
  Now keyed `flo.streak.lastCelebrated.${userId}`. **Standing rule**: any
  AsyncStorage key holding *user*-scoped state (as opposed to genuinely
  device-scoped state like notification permissions) must include the user id.
  This device has more than one account signed into it in practice — that is a
  real configuration, not a hypothetical.
- **Adding a new route DIRECTORY needs `npx expo start -c`** (learned
  2026-07-13, `07-onboarding.md`) — Expo Router builds its route tree from a
  Metro `require.context` over `app/`, and a dev server started before the
  directory existed keeps serving a tree without it. `router.replace()` to a
  route the tree doesn't know about does **not** crash and does **not** render
  the unmatched-route screen: it warns to the console and silently leaves you
  where you were. This cost a full debugging round that looked, from the
  symptom, exactly like a broken navigation guard. Restart with `-c` before
  suspecting the code.
- **Onboarding v2** (`12-personal-onboarding.md`, all 3 phases built
  2026-07-14 — supersedes `07`'s mechanics, described here in its final
  state). `lib/onboarding.js` holds **two** ordered lists: `INTRO_STEPS` (the
  12-screen pre-auth Introduction, its own progress-bar span) and `STEPS` (the
  post-auth Act 2 + Act 3 flow: account → expense → budget → reports →
  reminders → journey → free → commitment). Both the progress bar
  (`OnboardingScreen`'s `progress` prop) and the "where does Continue go"
  routing derive from whichever list is active, so a step added/removed
  renumbers everything automatically. `getSteps()`'s `supported` predicate
  pattern (drop a step entirely, don't stub it) is preserved for any future
  platform-conditional step — nothing currently uses it (auto-detect's step
  was cut, not made conditional, since it can never ship to the stores). All
  screens now build on **`components/OnboardingScreen.js`** (light/brand/ink
  backgrounds + a thin progress bar), not the retired `OnboardingScaffold.js`/
  `OnboardingProgress.js` (deleted in `12`'s Phase 3 once nothing imported
  them). Pre-auth screens live in `app/onboarding/intro/`; post-auth screens
  in `app/onboarding/` directly.
- **`lib/onboardingDraft.js`** (added `12-personal-onboarding.md` Phase 1) —
  the pre-auth answer store. `getDraft()`/`setDraftAnswer()` hold the intro's
  answers in AsyncStorage (deliberately **not** user-scoped — it exists before
  a user identity does), plus a device-local `introSeen` flag consumed by
  `RootNavigator`. `pickDurableAnswers()` whitelists which draft keys get
  flushed to `profiles.onboarding_answers` (`age_range`, `goal`,
  `leak_category`, `tracking_habit`, `commitment`) — **`income_band` and
  `name` are never persisted**: income sizes the first budget in-session only,
  name rides in via signup metadata. `clearDraft()` runs once, at the very end
  of `useOnboarding().finish()`.
- **`components/OnboardingReveal.js`** (added `12-personal-onboarding.md`
  Phase 1, tuned post-Phase-1 per user feedback) — the staggered
  landing-page-style entrance every onboarding screen's content uses.
  Spring-based (`withSpring`, not a fixed-duration ease) with a scale pop, not
  just fade/translateY — a linear ease reads as mechanical once several items
  stagger in sequence. Reduce-motion aware, mirroring `Confetti.js`'s guard
  but inverted (revealed content must still appear, just without animation).
  `app/onboarding/_layout.js`'s `Stack` also gained `animation: 'fade'` so the
  screen-to-screen transition doesn't visually compete with each screen's own
  entrance.
- **`OnboardingGate`** (`app/_layout.js`) — third instance of the
  `ShareIntentHandler` pattern (side-effect-only component, returns `null`,
  sibling of `<Stack>` *inside* the providers). It needs `useProfile` →
  `useDataRefresh`, and `RootNavigator` defines `DataRefreshProvider`, so this
  logic **cannot** live in `RootNavigator`'s own redirect effect. Redirects on
  `profiles.onboarded_at` being NULL — to `/onboarding/account` (the Act 2
  resume point, changed from `07`'s `/onboarding/welcome` by
  `12-personal-onboarding.md` Phase 1, since a signed-in user is already past
  the pre-auth intro). Anything else that needs to gate routing on user data
  must go here too, not in `RootNavigator`.
- **The gate is now a genuine three-state split** (`12-personal-onboarding.md`
  Phase 1) — `RootNavigator` still owns *all* of `!session`, but that's now a
  two-way choice: a device that hasn't seen the pre-auth intro
  (`lib/onboardingDraft.js`'s async `introSeen` flag) goes to
  `/onboarding/intro/opener`; everyone else goes to `/sign-in`.
  `RootNavigator` sets `introSeen` whenever any session appears (sign-in,
  sign-up, or a restored session), so a later signed-out state on the same
  device never re-shows the sales intro. The disjoint-by-session invariant
  from `07`'s screen-flicker fix is preserved exactly: `RootNavigator` still
  never touches `session`, `OnboardingGate` still never touches `!session`.
  The redirect waits while `introSeen` is still resolving (`null`) rather than
  guessing, so nothing flashes the wrong screen. The DB flag
  (`profiles.onboarded_at`) remains the one true one-time guarantee across
  devices/reinstalls — `introSeen` is only a device-local shortcut, and even if
  it's wiped, the opener screen's "Already have an account? Sign in" link
  routes a returning user straight to `/sign-in` regardless.
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
- **`ProgressBar` over-limit colour — FIXED 2026-07-13** (was a known gap
  since `01-analytics.md` Phase 3). `components/ProgressBar.js` only had a
  `'danger'` key in `FILL_BY_STATUS`, not `'over'` — which is what
  `budgetStatus()` actually returns — so an over-limit bar fell through to
  the default **brand lime**: a green progress bar on a budget you'd blown,
  on the Budgets tab and in Analytics both. `dark` cards separately
  hard-coded the fill to brand, so a dark summary card could never show red
  at all. Both fixed in `08-budget-periods-and-detail.md` Phase 2. If a new
  status value is ever added to `budgetStatus()`, add it to
  `FILL_BY_STATUS` in the same commit — the fallback fails *green*, which
  is the worst possible direction for a failure of this kind.
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
  (added post-Phase-3, see `02-accounts.md`). **Generalized 2026-07-14**
  (`11-reports.md`) — `useAnalyticsData` gained an `allAccounts` boolean that
  does the exact same "drop the filter, guard on `userId` instead of
  `activeAccountId`" move across all four of its queries (two transaction
  windows + `v_budgets_with_spent` + `v_plans_with_totals`). **Caveat for any
  new all-accounts aggregation**: `categories` are global, not account-scoped
  (see the `categories` row below) — a computation keyed by `(account,
  category)`, like a budget's spent-in-category, must pre-filter to the
  specific account first or it will silently sum every account's spending in
  that category. `computeBudgetPeriods` in `lib/analytics.js` has no
  account_id filter of its own (never needed one — every prior caller already
  passed single-account data), so the caller must filter before invoking it
  once the transactions array spans more than one account. Caught and fixed in
  `app/report.js`; not a bug in `lib/analytics.js` itself.
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
- **Two feature variants (auto-detect / no-detect) × two build formats
  (APK / AAB) = four EAS profiles** (2026-07-15, restructured same day) —
  the `FLO_VARIANT` env var (read in `app.config.js`) and the Android build
  format are **orthogonal**: variant toggles the notification-listener
  module, format is just apk-vs-aab. So `eas.json` crosses them into four
  profiles built on two `extends` bases (`preview` = internal APK,
  `production` = store AAB + `autoIncrement`):

  | Profile | Format | Variant | Auto-detect | Use |
  |---|---|---|---|---|
  | `lite` | AAB | lite | off | Play Store submission |
  | `lite-preview` | APK | lite | off | sideloadable no-detect build |
  | `full` | AAB | full | on | internal/closed-testing bundle |
  | `full-preview` | APK | full | on | sideload-only, with auto-detect |

  **`full` changed from APK → AAB** in this restructure; the old sideload
  APK-with-auto-detect build is now **`full-preview`**. `submit` profiles
  are `lite` and `full` (the two AABs). Both driven by a single
  `FLO_VARIANT` env var read in `app.config.js` (anything `!== 'lite'` →
  auto-detect on). Commenting out JS call sites alone
  cannot exclude the feature: `modules/flo-notification-listener`'s
  `BIND_NOTIFICATION_LISTENER_SERVICE` manifest fragment merges in via
  AGP's manifest merger the moment the module directory is present and
  autolinked, regardless of whether any JS calls it. `app.config.js`
  instead rewrites `package.json`'s `expo.autolinking.exclude` as a side
  effect (idempotent — only dirties the file when the exclude list
  actually changes) before prebuild's native project generation runs.
  Verified via `npx expo-modules-autolinking resolve --platform android`:
  20 modules found normally, 19 (no `flo-notification-listener`) under
  `FLO_VARIANT=lite`. `lib/detect.js`'s `IS_SUPPORTED_PLATFORM` gate and
  `app/settings.js`'s Transaction Detection section both also read the same
  flag (`Constants.expoConfig.extra.autoDetectEnabled`) — without the
  JS-side gate too, the lite APK would crash at boot trying to `require()`
  a native module that was deliberately excluded from the build.

  Build commands:
  ```
  npx eas build --platform android --profile lite           # Play Store — AAB, no auto-detect
  npx eas build --platform android --profile lite-preview   # APK, no auto-detect
  npx eas build --platform android --profile full           # AAB, with auto-detect
  npx eas build --platform android --profile full-preview   # sideload APK, with auto-detect
  ```
  The `full` **AAB** is for internal/closed-testing tracks — a `full`
  variant was never meant for a *public* Play Store release regardless of
  format: Google's sensitive-permissions policy restricts notification-
  listener access to apps where it's a disclosed core feature, with its own
  review form. The public store build is `lite`; `full-preview` is the
  direct-APK-download path (see `06-transaction-auto-detect.md`).

  Also this same pass: removed dev/test-only rows from `app/settings.js`
  (Replay onboarding, Send test notification, Show scheduled — none
  end-user-relevant) and fixed a real bug in `app/_layout.js`: signing out
  in the same app session that just signed up (no full reload in between —
  the normal Expo Go test loop) re-read a stale local `introSeen === false`
  and wrongly sent a returning user back through the full pre-auth intro
  instead of straight to `/sign-in` — `persistIntroSeen()` was writing
  AsyncStorage but never updating the local React state that actually
  drives the redirect.
- **Streak copy: "Day 0" dropped, reverted to "Day 1"; 🐱/Koban references
  stripped from all streak titles** (2026-07-15) — `05-...md`'s original
  "Day 0" convention (a deliberate call at the time, see that doc's Phase
  2/3) turned out to disagree with how every other streak product counts a
  first day (Duolingo etc. all show Day 1), and reads as an off-by-one
  since `current` was already `1` internally the whole time — only the
  *label* ever said 0. Reverted in `lib/koban.js` (`RECAP_POOLS.new_streak`,
  `RECAP_NOTIFICATION_POOLS.new_streak`, `streakHeadline`) and
  `lib/streak.js`'s comment; `app/(tabs)/index.js`'s header chip and
  `app/streak.js`'s hero number, which had briefly grown an
  `isNewStreak ? 0 : current` relabel to match the old convention, were
  reverted back to the raw `current` value — no relabeling needed anywhere
  now that display and internal count agree. Also stripped 🐱/😿/"Koban"
  personification ("paw", "lucky cat") from every streak title across
  `NUDGE_POOLS`, `RECAP_POOLS`, and `RECAP_NOTIFICATION_POOLS` — mascot art
  doesn't exist yet (Phase 5, blocked on user art), so a placeholder cat
  voice was premature; 🎉 (generic celebration, not mascot-specific) was
  kept on milestone copy. `recapEyebrow()`'s "STREAK STARTED" pill was also
  dropped for a new streak (returns `null`) — every new_streak title
  already says "streak"/"day 1" outright, so the pill was pure repetition.
  `StreakCelebration.js` now conditionally omits the eyebrow pill entirely
  when absent. `StreakDays.js`'s 7-day row was also reversed to newest-first
  (`.reverse()`) — a young streak's one or two real lit days used to sit at
  the tail of a mostly-empty row; now the thing worth celebrating leads.
- **New onboarding step: `app/onboarding/balance.js`** (2026-07-15) —
  inserted into `STEPS` between `account` and `expense`. Without it, the
  demo expense the very next screen invites was the account's first-ever
  row, so a brand-new user's first look at Home was a negative balance —
  technically correct, but a bad first impression when the fix is just
  asking what they already have. Deliberately minimal compared to
  `expense.js`: a single amount field, no type toggle/category
  chips/date/plan/note, framed as a casual "what's already yours" ask
  rather than "record a transaction" — auto-picks `incomeCategories[0]` and
  inserts with `note: 'Starting balance'`, same `Add & Continue` / `I'll do
  this later` skip pattern as every other optional onboarding entry.
  `expense.js`'s title changed from "Add your first transaction" → "Add a
  transaction" since it's no longer necessarily the first row once this
  screen is used.
- **Standing gotcha: Reanimated v4's Babel plugin moved packages** (found
  2026-07-19, via `17-server-push-notifications.md`'s adjacent onboarding
  testing — not itself a push-notifications bug). `react-native-reanimated`
  is on v4.x in this project (see the Confetti.js note above), which split
  its worklets compiler out into a separate `react-native-worklets`
  package — `babel.config.js` must reference
  `plugins: ['react-native-worklets/plugin']`, **not** the old
  `'react-native-reanimated/plugin'`. With the stale path, worklets
  (`useAnimatedStyle`/`useSharedValue` callbacks) silently fail to compile:
  shared values still update, but the derived animated *style* never
  reflects it, so the affected component sits frozen on its initial frame
  (often invisible — opacity 0, or translated off-screen). Symptom on this
  project: `app/onboarding/intro/reflection.js`'s falling-card entrance and
  `OnboardingReveal`'s pop-in both rendered nothing but the plain Button
  until fixed. **This is a project-wide Babel config**, not scoped to one
  screen — every Reanimated-driven animation in the app (the account hero
  carousel's swipe, `Switch`, `AccountDots`, `StreakCelebration`, etc.) was
  reading the same stale plugin, so if a similarly "just doesn't animate"
  bug turns up anywhere else, check this file first before assuming the
  individual component's logic is wrong. Fixed by pointing at
  `react-native-worklets/plugin`; confirmed the package actually exports a
  `plugin` entry before making the change, not just going on the upstream
  GitHub issue describing the same migration gap.

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
