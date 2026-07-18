# Feature: Server-Driven Push Notifications
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/17-server-push-notifications.md`
**Status**: All 4 phases built, awaiting combined on-device verification.
**Last Updated**: July 2026

---

## Context

Every notification FLO sends today — the daily logging nudge, bill-due
reminders, report-ready alerts — is scheduled **entirely on-device** via
`expo-notifications` (`lib/notifications.js`). This was a deliberate,
documented call (`04-notifications-and-recurring-bills.md`'s Out of Scope:
*"FLO has no server-side event source; local scheduling covers every useful
case"*), but it doesn't hold up in practice: the daily nudge specifically
works by pre-scheduling a **rolling 30-day window of individually
date-triggered local alarms** (`buildReminderPlan` in `lib/koban.js`),
rebuilt on every app open. Android's Doze/battery management actively
deprioritizes exact alarms scheduled weeks in advance — more aggressively on
some OEMs than stock Android — which is why reminders don't feel as
reliable as apps that push from a server.

This feature replaces local scheduling with a real server-driven pipeline:
a Supabase Edge Function on a `pg_cron` schedule, sending through Expo's
push API to registered device tokens. It also fixes two things the local
system structurally couldn't do: check **real server-side state** at send
time (skip the evening nudge if the user already logged today — impossible
to know weeks ahead when the local alarms were scheduled), and be
**timezone-aware per user** from day one rather than assuming everyone's in
`Asia/Kolkata`.

**Explicitly unaffected by this feature**: `06-transaction-auto-detect.md`'s
bank-notification-listener auto-detect prompt. That's a different mechanism
entirely — a native `NotificationListenerService` that must survive the app
being fully killed, which is exactly why it can't depend on a server or a
live JS context (its own Hard Constraint 1). It stays native-only,
sideload/`full`-variant-only, and nothing here changes it.

---

## Notification voice — reuses the greeting-copy rules, not generic push text

Per `lib/greetings.js`'s established voice (itself pulled from
`05-koban-engagement.md`'s codified rules): sentence case, no exclamation
marks, no emoji, second person, never shame the user for *spending* — only
gently nudge for not *logging*. Reminder copy is dynamic the same way
greetings are — a fixed table keyed by trigger × day of week, not a single
static string repeated forever, and not randomized either. "Log it" reads
as a competent bookkeeper checking in, not "Don't forget to track your
spending!! 💸".

Every reminder notification also carries a **"Log now" action button**
(`Notifications.setNotificationCategoryAsync`) that opens
`AddTransactionSheet` directly — tapping the button *or* the notification
body itself both do this, mirroring `06-transaction-auto-detect.md`'s
"Log it" one-tap precedent rather than making the user open the app and
then hunt for the ⊕ button.

---

## Phase Overview

```
Phase 1 — Push token capture + one proven send
  Register the device's Expo push token to Supabase; manually trigger one
  real push from the server and confirm it arrives, including with the app
  fully closed. Proves the pipe before any reminder logic is built on it.

Phase 2 — Cron-driven smart daily nudge (replaces the local Koban reminder)
  Two daily server-sent reminders (morning, evening), timezone-aware per
  user, the evening one skipped if they already logged today. Dynamic
  warm copy + "Log now" action button. Old local nudge scheduling removed.

Phase 3 — Bill-due + report-ready onto the same pipeline
  Same Edge Function, two more trigger types, reading straight from
  Postgres instead of the client re-deriving state locally. Old local
  scheduling for these removed too.

Phase 4 — Settings polish + observability
  Real push-registration status in Settings, a "send me a test
  notification" button. The confidence-building, premium-feel pass.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Push Token Capture + One Proven Send

### Goal
A signed-in user's device registers a real Expo push token into Supabase.
A manually-triggered Edge Function call sends one push to that token and it
arrives on the device — including with FLO fully closed. This proves EAS
push credentials, the dev-build requirement, and the storage pipeline
before any reminder logic is built on top of it. Deliberately tiny, same
"prove the risky part first" shape as `06-...md` Phase 1.

### Before Starting — Confirm With Codebase
1. Confirm `app.json`'s `extra.eas.projectId` (already present:
   `080548cb-69f6-469e-a3da-38cac92c7b9c`) — used directly, no new EAS setup.
2. Read `lib/notifications.js`'s Expo-Go `require()` guard (lines ~8–19) —
   the new push-registration code needs the identical guard.
   `getExpoPushTokenAsync` is a **remote** API; per Expo's SDK 54 docs,
   remote push is unavailable in Expo Go on Android from SDK 53 onward
   (iOS Expo Go still works) — **a development build is required to test
   this phase's Android path.**
3. Confirm the existing permission-request flow in `lib/notifications.js`
   (`requestPermissionsAsync`) — reuse it; don't add a second prompt.
4. Verify `profiles`' exact current column list via
   `information_schema.columns` before writing the `ALTER TABLE` below —
   standing rule, not from memory.
5. Confirm an EAS development build is available for on-device testing, or
   budget time to run `eas build --profile development` first.

### 1.1 Database

```sql
-- One row per registered device. Unique on the token itself (not
-- user_id) — a user can have several devices, and dedup happens per-token.
CREATE TABLE push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  token text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push tokens"
  ON push_tokens FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Per-user reminder scheduling state — the server needs to read this, so
-- it lives in Postgres now instead of AsyncStorage (see Phase 2). Added
-- here, in Phase 1, so the column shape is settled before any function
-- reads it.
ALTER TABLE profiles
  ADD COLUMN timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN reminders_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN morning_reminder_time time NOT NULL DEFAULT '08:00',
  ADD COLUMN evening_reminder_time time NOT NULL DEFAULT '21:00';
```

### 1.2 Data Layer

- **`lib/pushToken.js`** (new) — `registerPushToken()`, guarded the same
  way as `lib/notifications.js`: confirms permission is granted, calls
  `Notifications.getExpoPushTokenAsync({ projectId: '080548cb-69f6-469e-a3da-38cac92c7b9c' })`,
  then `supabase.from('push_tokens').upsert({ token }, { onConflict: 'token' })`
  (`user_id` fills via the column default).
- Called from a new sibling handler in `app/_layout.js` — same placement
  and shape as `ShareIntentHandler`/`NotificationSync` (inside the
  provider nest, guarded on `session`), on mount and whenever permission
  newly becomes granted.
- **`supabase/functions/send-push/index.ts`** (new Edge Function).
  Phase 1 scope: accepts a user id, looks up their `push_tokens`, POSTs to
  `https://exp.host/--/api/v2/push/send` with a fixed test title/body.
  Built from the start to authenticate with the **service role key**
  (stored as an Edge Function secret via Supabase Vault, never shipped
  client-side) rather than the anon key — Phase 2's real cron job needs
  cross-user access regardless, so there's no reason to build a
  weaker Phase 1 auth model and swap it later.

### 1.3 Components
None.

### 1.4 Navigation / Integration
- `app/_layout.js` gains a `<PushTokenSync />` sibling.

### 1.5 Impact on Existing Features
| Area | Change | Watch for |
|---|---|---|
| `lib/notifications.js` | None yet | Local scheduling (nudge/bills/reports) keeps running unchanged until Phases 2–3 remove pieces of it — brief double-coverage during the transition is expected, not a bug |

### 1.6 What This Phase Does NOT Include
- No cron, no real reminder logic, no copy, no action buttons (Phase 2).
- No Settings UI changes (Phase 4).
- No removal of any existing local scheduling.

### 1.7 Phase 1 Checklist — Before Marking Complete
- [x] `push_tokens` table + RLS applied, confirmed via `information_schema`/`pg_policies`.
- [x] `profiles` gains `timezone`/`reminders_enabled`/`morning_reminder_time`/`evening_reminder_time`, confirmed via `information_schema`.
- [x] `send-push` Edge Function deployed (`verify_jwt: true`, matching `ai-interpret`'s default).
- [x] `lib/pushToken.js` + `<PushTokenSync />` (in `app/_layout.js`) written; both pass a syntax check.
- [ ] **On-device, needs your machine:** EAS development build installed (Expo Go cannot test Android push — confirmed against the SDK 54 docs this session).
- [ ] **On-device:** signing in produces a row in `push_tokens`.
- [ ] **On-device:** manually invoking `send-push` (`supabase functions invoke send-push --body '{"userId":"<your-id>"}'`, or the dashboard's Invoke tab) delivers a real push — **including with FLO fully closed, not just backgrounded.**
- [ ] Expo Go still boots without crashing (not yet run — no way to launch Expo Go from this environment).

**→ Everything buildable from here is done. Stop here — the remaining checklist items need your device. Report back what happens and I'll mark this phase complete or fix whatever breaks.**

### Implementation Notes

- **A prerequisite this doc originally missed, found via real on-device
  testing (2026-07-19)**: a locally-built release APK (`./gradlew
  assembleRelease`, not through `eas build`) produced zero rows in
  `push_tokens` after sign-in — `curl`-ing `send-push` correctly returned
  `{"sent":0,"message":"no push tokens registered for this user"}`, i.e.
  the pipeline itself is fine, nothing was ever registered client-side.
  Root cause, confirmed against the current Expo docs (not assumed): this
  project has **no Firebase project and no `google-services.json`**
  anywhere (`app.json` has no `android.googleServicesFile` key). Android
  push requires Firebase/FCM configuration in the built app *before*
  `getExpoPushTokenAsync()` can succeed at all — independent of whether
  the build goes through `eas build` or a local Gradle build, since this
  is a native Firebase SDK requirement baked into the APK, not something
  either build path provisions automatically.
- **Two separate credential requirements, easy to conflate**:
  1. **On-device** — `google-services.json` must exist in the build for
     the native FCM registration `getExpoPushTokenAsync()` depends on to
     succeed at all. Missing this is what's blocking right now.
  2. **At Expo, server-side** — a Firebase **service account key**
     uploaded via `eas credentials` (Android → production → Google
     Service Account), so Expo's push relay (`exp.host/--/api/v2/push/send`,
     what `send-push` calls) can actually authenticate to FCM V1 and
     deliver. Not yet reachable — token registration has to succeed first.
- **Fix, steps 1–3 done (2026-07-19)**: Firebase project `flo26-7de68`
  created, Android app registered under package `com.anonymous.flo`
  (verified the `google-services.json` package name matches `app.json`'s
  before wiring it in), file placed at the project root,
  `"googleServicesFile": "./google-services.json"` added under
  `expo.android` in `app.json`. **Not yet done**: step 4 (Firebase Console
  → Project settings → Service accounts → Generate new private key →
  upload via `eas credentials`) — needed before real delivery works, even
  after a rebuild fixes token registration. Also not yet done: the actual
  rebuild — `expo prebuild` needs to re-run so the regenerated `android/`
  folder picks up the Google Services Gradle plugin + file, since it
  wasn't present the first time `android/` was generated.
- **`lib/pushToken.js`'s silent-catch fixed to actually log** — the
  original code caught `getExpoPushTokenAsync()` failures and returned
  them, but nothing ever printed them anywhere, so this exact failure mode
  was invisible from `adb logcat`. Added `console.error` calls on both the
  catch branch and the `push_tokens` upsert error branch — a release build
  doesn't strip `console.*` in this project (no such babel plugin
  configured), so these are now visible without needing a debug build.

---

## Phase 2 — Cron-Driven Smart Daily Nudge

### Goal
Two real server-sent reminders a day — morning and evening — timezone-aware
per user, with the evening one skipped for anyone who's already logged a
transaction that day. Warm, day-of-week-varied copy matching
`lib/greetings.js`'s voice, with a "Log now" action button that opens
`AddTransactionSheet` directly. The old local rolling-window nudge
(`buildReminderPlan`) is removed — replaced, not run in parallel.

### Before Starting — Confirm Phase 1 Is Approved
1. Re-read `lib/koban.js`'s `buildReminderPlan` and `lib/notifications.js`'s
   `rescheduleAll` — identify exactly which lines schedule the **nudge**
   specifically (channel `flo.reminders.nudge`) as distinct from bill-due
   (`flo.bills.due`) and report-ready (`flo.reports.ready`) — only the
   nudge portion is removed this phase.
2. Re-read `app/settings.js`'s reminder toggle + `DateTimePicker` row, and
   `app/onboarding/reminders.js` — both currently read/write AsyncStorage
   key `flo.notif.dailyReminder`. Swap the persistence layer to the new
   `profiles` columns; keep the UI shape identical. The old AsyncStorage
   key becomes dead and can be left unread — no migration needed for a
   handful of existing local profiles.
3. Re-read `lib/streak.js`'s day-bucketing (`created_at`-based "did they
   log today") — the evening nudge's "already logged" check must use the
   **same definition of today** the streak uses, or the two could disagree.

### 2.1 Database

```sql
-- Idempotency log — the same claim-once pattern IDEAS-gamification.md's
-- reward_events already proposes for the same reason: a retried or
-- overlapping cron run must not send the same trigger to the same user
-- twice in one local day.
CREATE TABLE reminder_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  trigger text NOT NULL, -- 'morning_nudge' | 'evening_nudge' (bill_due/report_ready join in Phase 3)
  ref text NOT NULL,     -- idempotency key, e.g. '2026-07-19' — the user's LOCAL date for this trigger
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, trigger, ref)
);

ALTER TABLE reminder_sends ENABLE ROW LEVEL SECURITY;

-- Written only by the Edge Function via the service-role key (bypasses
-- RLS) — this SELECT policy is for the user's own visibility/debugging
-- only; no INSERT policy needed since clients never write here directly.
CREATE POLICY "Users view own reminder sends"
  ON reminder_sends FOR SELECT
  USING ((select auth.uid()) = user_id);
```

### 2.2 Data Layer

- **`lib/reminderCopy.js`** (new, client-adjacent but consumed by the Edge
  Function — see note below) — a 14-entry table (2 triggers × 7 days),
  same shape and voice as `lib/greetings.js`: `{ title, body }` keyed by
  `(trigger, dayOfWeek)`, e.g. morning-Monday's title might be "A clean
  slate, {name}" / body "Log today's first one before the week gets busy."
  Deno (the Edge Function runtime) can't `import` an Expo/RN file directly
  — this table gets **duplicated** into the Edge Function in Deno-compatible
  form (a plain `.ts` object, no RN imports), the same accepted-duplication
  precedent `06-...md` already uses for `lib/smsParser.js`'s Kotlin twin.
  Note the "keep both in sync" comment in both files.
- **`supabase/functions/send-push/index.ts`** extended with the real cron
  logic:
  ```
  for trigger in ['morning', 'evening']:
    target_time = trigger == 'morning' ? morning_reminder_time : evening_reminder_time
    candidates = profiles where reminders_enabled = true
      and current 15-min bucket of (now() AT TIME ZONE timezone) matches target_time
    if trigger == 'evening':
      candidates -= anyone with a transaction today (their LOCAL today, same
                    day-bucketing rule as lib/streak.js)
    candidates -= anyone already in reminder_sends for (trigger, their local date)
    for each remaining candidate:
      copy = reminderCopy[trigger][their local day-of-week]
      send push (title, body, categoryId: 'reminder-nudge', data: { type: 'nudge' })
        to every token in push_tokens for that user
      insert into reminder_sends (trigger, ref: their local date)
  ```
- **`pg_cron` + `pg_net`** (new migration): enable both extensions, then
  schedule the function every 15 minutes:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;

  SELECT cron.schedule(
    'send-reminders',
    '*/15 * * * *',
    $$
    SELECT net.http_post(
      url := '<edge-function-url>/send-push',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{"mode":"cron"}'::jsonb
    );
    $$
  );
  ```
  The service role key is read from **Supabase Vault** at call time, never
  pasted into the migration/cron-job text itself — exact secret name to be
  finalized against whatever's already stored (check `vault.secrets`
  before assuming `service_role_key` is the right name).
- **Notification category / action button** — registered once client-side
  at app startup (extends whatever already calls Android channel setup in
  `lib/notifications.js`):
  ```js
  Notifications.setNotificationCategoryAsync('reminder-nudge', [
    { identifier: 'log-now', buttonTitle: 'Log now', options: { opensAppToForeground: true } },
  ]);
  ```
  `useNotificationSync()`'s existing tap-response listener (live listener +
  `getLastNotificationResponseAsync` for cold start) is extended: when the
  response's `notification.request.content.data.type === 'nudge'`
  (regardless of whether it was the `log-now` action or the notification
  body itself that was tapped), call `openAdd()` directly — same one-tap
  principle as `06-...md`'s "Log it".
- **`hooks/useProfile.js`** — `updateProfile()` already supports the
  `silent` option; the reminder-prefs write from Settings reuses it
  directly rather than a new hook (four columns, one existing update path).

### 2.3 Components
- `app/settings.js` — existing reminder toggle + `DateTimePicker` rows,
  same UI, now reading/writing `profiles` via `useProfile()` instead of
  AsyncStorage.
- `app/onboarding/reminders.js` — same swap; defaults must still present
  as **on**, 8:00 AM / 9:00 PM to match current onboarding behavior.

### 2.4 Navigation / Integration
None new — `openAdd()` (from `useAddTransactionSheet()`) already exists and
already opens pre-filled or empty.

### 2.5 Impact on Existing Features
| Area | Change | Watch for |
|---|---|---|
| `lib/notifications.js` | Nudge-scheduling portion of `rescheduleAll` removed | Bill-due/report-ready scheduling in the same file must NOT be touched this phase — Phase 3's job |
| `lib/koban.js` | `buildReminderPlan` removed (or left dead and unimported — decide at implementation time based on whether anything else references it) | Confirm no other caller before deleting |
| `app/settings.js` | Reminder row's persistence source changes | AsyncStorage key `flo.notif.dailyReminder` goes unread — leave it, don't migrate |
| `app/onboarding/reminders.js` | Same swap | Defaults must match current behavior exactly |

### 2.6 What This Phase Does NOT Include
- Bill-due and report-ready notifications — still local this phase (Phase 3).
- No Settings "test send" button (Phase 4).
- No push for anything except the two daily nudges.

### 2.7 Phase 2 Checklist — Before Marking Complete
- [x] `reminder_sends` table + RLS applied, confirmed via `information_schema`.
- [x] `pg_cron`/`pg_net` enabled, `send-reminders` job scheduled every 15 min, confirmed active via `cron.job`.
- [x] `has_logged_on_relative_day(uuid, text, int)` created, confirmed `EXECUTE` revoked from `anon`/`authenticated` (only `postgres`/`service_role` can call it).
- [x] `send-push` redeployed (v2) with real cron logic + state-aware copy.
- [x] Settings (`app/settings.js`) and onboarding (`app/onboarding/reminders.js`) both swapped from AsyncStorage to `profiles` columns; both pass a syntax check.
- [x] `lib/notifications.js`'s local nudge scheduling removed (bills/reports untouched); `lib/koban.js` trimmed to just the in-app celebration screen's copy (`pickRecap`/`recapEyebrow`/`recapCta`/`streakHeadline` — still used by `app/streak.js`/`StreakCelebration.js`).
- [x] "Log now" category registered client-side (`lib/pushToken.js`'s `ensureCategories`); `useNotificationSync`'s tap listener opens `AddTransactionSheet` for any `data.type === 'nudge'` notification (button or body tap).
- [ ] **On-device, needs your machine:** a device with its system timezone changed away from `Asia/Kolkata` receives its morning nudge at the correct **local** time, not IST.
- [ ] **On-device:** logging a transaction before the evening window suppresses that evening's nudge; not logging lets it through.
- [ ] **On-device:** copy correctly reflects `loggedYesterday` state (momentum vs restart pool — see Implementation Notes) and matches the established voice.
- [ ] **On-device:** the "Log now" action button and a plain tap on the notification body both open `AddTransactionSheet`.
- [ ] Old local nudge scheduling no longer fires (no leftover locally-scheduled nudge notifications post-migration).

### Implementation Notes

- **Copy redesign, mid-phase (2026-07-19, user feedback)**: the original
  plan keyed `reminderCopy` by day-of-week (14 fixed entries), matching
  `lib/greetings.js`'s shape. Real feedback during the build: that read as
  "generic notification filler that happens to mention which day it is,"
  not something that actually reacts to whether the user needs the nudge.
  Redesigned to key on **`loggedYesterday`** instead (a `momentum` pool vs
  a `restart` pool, per trigger) — the one piece of real state that's cheap
  to check server-side and actually changes what's worth saying: morning
  either protects momentum ("You're ahead of yourself") or offers a clean
  restart; evening (which only ever fires when today's unlogged) either
  says today broke something real ("You missed it today") or that it was
  an ordinary quiet day. Both example phrases from the user's own feedback
  message are now literal lines in the copy table. Still rotates within a
  pool (3 lines each) using day-of-week as a pick index only — not as the
  thing that decides what's said.
- **`has_logged_on_relative_day`, generalized instead of two functions**:
  rather than separate `has_logged_today`/`has_logged_yesterday` RPCs, one
  function takes `p_days_ago` — called with `0` for the evening skip-check
  and `1` for the copy-state check. Same day-bucketing convention as
  `lib/streak.js` (`created_at`, not `occurred_at` — counts showing up and
  logging, not backfilled dates).
- **Vault avoided entirely, simpler than originally planned**: the doc's
  Phase 2 spec called for storing the service-role key in Supabase Vault so
  `pg_cron`'s `net.http_post` call could authenticate to `send-push`. Not
  needed — Supabase's `verify_jwt` gate accepts *any* validly-signed
  project JWT, and the anon key (already public, already shipped in the
  client bundle) satisfies it just as well as the service-role key would.
  The function's own privileged reads still use its auto-injected
  `SUPABASE_SERVICE_ROLE_KEY` internally, same as Phase 1 — that key never
  needs to leave the function's runtime, so there's nothing to store in
  Postgres at all.
- **Combined with Phase 1 rather than gated behind it**, per the same
  precedent `06-transaction-auto-detect.md`'s Phases 2–3 already set: the
  user's build cycle is ~1 hour (cache cleared, local Gradle), so waiting
  for a Phase-1-only on-device confirmation before writing Phase 2 would
  have cost a second full rebuild for no benefit. Everything server-side
  (migrations, the Edge Function) is already live regardless of what the
  current in-flight build proves; only the client-side pieces (Settings,
  push-token registration, the category/tap-routing) need this build to
  actually verify.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 3 — Bill-Due + Report-Ready Onto the Same Pipeline

### Goal
Bill-due and report-ready notifications move onto `send-push`, as two more
trigger types reading directly from Postgres (`bills`, whatever backs
report-ready state) instead of the client re-deriving them locally.

### Before Starting — Confirm Phase 2 Is Approved
1. Re-read `04-notifications-and-recurring-bills.md` Phase 5's exact
   bill-due logic (days-before default, local send time) and
   `11-reports.md`'s report-ready trigger condition — port the
   **conditions**, not just the channel names.
2. Verify `bills`' exact columns (`next_due_date`, `is_active`, etc.) via
   `information_schema` before writing the query.

### 3.1 Database

```sql
ALTER TABLE profiles
  ADD COLUMN bill_reminders_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN bill_reminder_days_before int NOT NULL DEFAULT 2,
  ADD COLUMN report_cadence text NOT NULL DEFAULT 'off',
  ADD COLUMN report_weekday int NOT NULL DEFAULT 1,
  ADD COLUMN report_day_of_month int NOT NULL DEFAULT 1,
  ADD COLUMN report_time time NOT NULL DEFAULT '09:00',
  ADD COLUMN report_cadence_started_at timestamptz;
```

### 3.2 Data Layer

Same `send-push` Edge Function, extended with two more send functions
(`sendBillDue`, `sendReportReady`) alongside Phase 2's `sendNudges`, run in
parallel from `runCron`. Same `reminder_sends` idempotency table, two more
`trigger` values (`bill_due`, `report_ready`) — `bill_due`'s `ref` is
`${billId}:${date}` (not just `date`), since one user can have several
bills due the same day, each needing its own claim.

- **Bill-due**: ports `lib/notifications.js`'s removed local logic exactly —
  fixed 9:00 AM local, `next_due_date − bill_reminder_days_before`. Title/
  body unchanged (`"{name} due in N days"` / `"₹X — tap to review"`).
- **Report-ready**: ports `lib/reports.js`'s `reportDueMoment`/`isReportDue`
  *conditions* (weekly weekday match, monthly day-of-month with short-month
  clamping, `cadenceStartedAt` anchoring) — simplified from that function's
  client-side "most recent due moment ≤ now" backward scan into "is now,
  in the user's local time, within the configured day+time bucket," which
  is all a 15-minute-bucketed cron needs. `reportDueMoment`/`isReportDue`
  themselves are **untouched** — still exactly what drives the Home
  ReportReadyCard and bell alert, unaffected by this phase.
- **Settings/onboarding write-through, not a full migration**: unlike
  Phase 2's `reminders_enabled`/reminder times (which read AND write
  `profiles` directly), bill/report settings keep AsyncStorage as the
  source of truth for every existing in-app read (`app/report.js`,
  `hooks/useReportDue.js`, `app/settings.js` display, onboarding) — `
  setBillReminderSettings`/`setReportSettings` just **also** write the same
  values to `profiles` now, so the server has something to read. Deliberate
  scope choice: those read call sites are numerous and unrelated to this
  feature; a write-through mirror gets the server what it needs without
  rippling a persistence-layer change through code this phase has no
  reason to touch.

### 3.3 Components
None. Settings/onboarding UI unchanged — same toggles/pickers, their
handlers just no longer call the removed `rescheduleAll`/`sync()`.

### 3.4 Navigation / Integration
None new — bill-due and report-ready still route via `data.route`
(`/bills`, `/report`), exactly as they did when locally scheduled.
**Deviation from the original plan**: the doc originally speculated a
bill-due action button opening `PayBillSheet` directly (mirroring the
nudge's "Log now"). Not built — matched the existing local behavior
exactly (plain tap → route, no button) rather than add scope beyond what
was asked. A "Pay now" action button is a reasonable future enhancement,
not implemented here.

### 3.5 Impact on Existing Features
| Area | Change | Watch for |
|---|---|---|
| `lib/notifications.js` | Local bill-due/report-ready scheduling removed entirely; `rescheduleAll`/`doRescheduleAll` deleted (nothing left to schedule). File now only manages permission + Android channels + local debug helpers | Bill/report settings *display* (Settings, onboarding, report screen) is untouched — only the removed local scheduler's consumers |
| `lib/reports.js` | `setReportSettings` now also writes to `profiles` | `getReportSettings`/`reportDueMoment`/`isReportDue` unchanged |
| `hooks/useStreak.js` | Stale comment referencing the removed `rescheduleAll` fixed | No behavior change — `fetchStreak` still used by the hook itself |
| `app/onboarding/commitment.js` | Stale comment fixed (referenced `toneFromCommitment`, removed in Phase 2) | No behavior change |

### 3.6 What This Phase Does NOT Include
- A "Pay now" bill-due action button (see 3.4's deviation note).
- Any change to `reportDueMoment`/`isReportDue`/the Home ReportReadyCard/bell — all client-side, all unaffected.
- A full migration of bill/report settings off AsyncStorage (see 3.2's write-through note).

### Implementation Notes

- **Security advisor caught a real gap, fixed immediately**:
  `has_logged_on_relative_day` was created without a pinned `search_path`
  (mutable search_path — a function resolving unqualified names, like this
  one's `transactions`, is vulnerable to a role shadowing that name in an
  earlier schema on its path). Re-created with `SET search_path = public`;
  confirmed via `get_advisors` that the warning cleared and nothing else
  regressed.
- **One warning left deliberately unaddressed**: `pg_net` installed in the
  `public` schema (Supabase's advisor recommends a dedicated schema). Not
  fixed this pass — moving an already-wired extension
  (`ALTER EXTENSION ... SET SCHEMA`) right before the user's combined
  on-device test risks destabilizing the cron pipeline for a WARN-level,
  commonly-accepted default (this is how most Supabase projects that
  enable `pg_net` end up configured). Worth revisiting once the feature is
  confirmed working end-to-end, not before.

### 3.7 Phase 3 Checklist — Before Marking Complete
- [x] `profiles` gains the 7 new bill/report columns, confirmed via `information_schema`.
- [x] `send-push` redeployed (v3) with `sendBillDue`/`sendReportReady` alongside `sendNudges`.
- [x] `lib/notifications.js`'s local bill/report scheduling removed; `rescheduleAll`/`doRescheduleAll` deleted entirely; every caller (`app/settings.js`, `app/onboarding/reminders.js`) updated.
- [x] `setBillReminderSettings`/`setReportSettings` mirror to `profiles`; both pass a syntax check.
- [x] Full repo sweep for stale `rescheduleAll`/`sync()` references — none remaining outside explanatory comments.
- [ ] **On-device, needs your machine:** a bill due in N days (matching your configured `bill_reminder_days_before`) produces a push at 9:00 AM local, routing to `/bills` on tap.
- [ ] **On-device:** a weekly/monthly report cadence produces a push at the configured day+time, routing to `/report` on tap.
- [ ] **On-device:** turning a cadence on doesn't immediately notify for a cycle that predates it (`report_cadence_started_at` anchor working server-side).
- [ ] Old local bill/report scheduling no longer fires (no leftover locally-scheduled notifications post-migration).

**→ Stop here. Show the result and wait for approval.**

---

## Phase 4 — Settings Polish + Observability

### Goal
Settings shows real push-registration state (token present/absent) and a
"send me a test notification" button, so the user can confirm the pipeline
is working without waiting for the next scheduled window.

### 4.1 Database
No changes.

### 4.2 Data Layer
`lib/pushToken.js` gains two functions:
- **`getPushTokenStatus(userId)`** — "does at least one `push_tokens` row
  exist for this user" (a single-column, `limit(1)` read; doesn't need to
  know which token is this specific device's, just that registration
  succeeded at some point).
- **`sendTestPush(userId)`** — invokes the **real** `send-push` Edge
  Function via `supabase.functions.invoke('send-push', { body: { userId } })`,
  using Phase 1's manual single-user test path. Deliberately not the same
  thing as `lib/notifications.js`'s existing `sendTestNotification()`
  (local-only, proves the heads-up channel works) — this is the only way to
  verify the actual server → Expo → device round trip without waiting for a
  cron window.

### 4.3 Components
`app/settings.js` — one new row in the Notifications card (after Bill
Reminders): status text ("This device is registered" / "Not registered
yet" / "Needs a development build") plus a "Send test" link, disabled while
sending or while unregistered. Re-checked on mount and on every foreground
(`AppState` → active), same pattern as the Transaction Detection card's own
`hasNotificationAccess()` re-check — registration happens fire-and-forget
at app boot (`usePushTokenSync`), so it may genuinely still be in flight
the first time this screen opens.

### 4.4 Navigation / Integration
None new.

### 4.5 Impact on Existing Features
| Area | Change | Watch for |
|---|---|---|
| `app/settings.js` | One new row, two new state variables, no changes to existing rows besides border adjustments (the row that used to be last in the Notifications card no longer is) | — |

### 4.6 What This Phase Does NOT Include
- Any change to the actual send logic (Phases 1–3) — purely an observability layer on top.
- A "last successful send" timestamp — `reminder_sends` has this data if it's ever wanted, but wasn't surfaced this pass (diminishing returns vs. the registration-status + test-send pair, which covers the real "is this broken" question).

### 4.7 Phase 4 Checklist — Before Marking Complete
- [x] `getPushTokenStatus`/`sendTestPush` added to `lib/pushToken.js`; passes a syntax check.
- [x] Settings' new push-status row wired up (status text + test-send button), re-checked on mount/foreground.
- [x] `@supabase/supabase-js` client version (`2.110.2`) confirmed to support `functions.invoke`.
- [ ] **On-device, needs your machine:** the status row correctly shows "registered" once `push_tokens` has a row for this device.
- [ ] **On-device:** tapping "Send test" delivers a real push (same as Phase 1's curl test, but from inside the app).
- [ ] **On-device:** the row correctly shows "Needs a development build" in Expo Go, and "Not registered yet" before sign-in/registration completes.

**→ Stop here. Show the result and wait for approval.**

### Post-Phase-4: a real functional gap found and fixed (2026-07-19)

While polishing unrelated onboarding UX, re-reading `usePushTokenSync`
(Phase 1) turned up a genuine bug, not just a Phase 4 nicety:
**`registerPushToken` only gets called when the signed-in `userId`
changes** (`usePushTokenSync`'s effect dependency). For a brand-new
sign-up, that effect fires once at mount — **before** notification
permission has been requested anywhere — so it correctly no-ops
(`perms.granted` is false). Nothing then re-triggers a retry once
permission is actually granted moments later, in either
`app/onboarding/reminders.js`'s "Enable Notifications" button or
`app/settings.js`'s Notifications toggle. Net effect: granting permission
never actually registered a push token until the app happened to be fully
restarted — meaning every fresh sign-up got **zero** server-sent reminders
by default, silently, with no error anywhere.

Fixed in both places: call `registerPushToken(userId)` explicitly right
after `requestPermission()` resolves `granted: true`, rather than relying
on `usePushTokenSync`'s userId-change effect to have already covered it.
Settings' version also calls the Phase 4 `refreshPushStatus()` afterward,
so the new status row reflects the fix immediately instead of waiting for
the next foreground check.

**Also fixed the same pass, unrelated to push notifications specifically**
but found via the same round of onboarding testing: `babel.config.js` was
still pointing at the pre-v4 `react-native-reanimated/plugin` path instead
of `react-native-worklets/plugin` (Reanimated v4 split its worklets
compiler into a separate package) — see `00-index.md`'s Shared
Infrastructure Notes for the full writeup, since this is a project-wide
Babel config issue, not scoped to this feature.

---

## Data Model Summary (Final State After All Phases)

```
profiles
  + timezone, reminders_enabled, morning_reminder_time, evening_reminder_time

push_tokens (NEW)
  user_id → auth.users, token (unique), created_at

reminder_sends (NEW)
  user_id → auth.users, trigger, ref (idempotency key), created_at
  UNIQUE (user_id, trigger, ref)

pg_cron job "send-reminders" (every 15 min)
  └─ net.http_post → supabase/functions/send-push
       └─ queries profiles + push_tokens + reminder_sends + transactions/bills
            └─ POSTs to https://exp.host/--/api/v2/push/send
                 └─ arrives as a real OS push notification, "Log now" → AddTransactionSheet
```

### `push_tokens` — Schema
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, `default gen_random_uuid()` |
| `user_id` | uuid | RLS, FK → `auth.users`, `default auth.uid()` |
| `token` | text | Unique — one row per device |
| `created_at` | timestamptz | `default now()` |

### `reminder_sends` — Schema
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, `default gen_random_uuid()` |
| `user_id` | uuid | RLS, FK → `auth.users`, `default auth.uid()` |
| `trigger` | text | `'morning_nudge'` \| `'evening_nudge'` \| (Phase 3: `'bill_due'` \| `'report_ready'`) |
| `ref` | text | Idempotency key — the user's local date for the trigger |
| `created_at` | timestamptz | `default now()` |

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| `lib/notifications.js` | Local scheduling progressively removed as each piece moves server-side | Phases 2 (nudge) and 3 (bills/reports) |
| `lib/koban.js` | `buildReminderPlan` removed | Phase 2 |
| `app/settings.js` | Reminder rows' persistence source changes; new push status (Phase 4) | Phases 2 and 4 |
| `app/onboarding/reminders.js` | Persistence source changes | Phase 2 |
| `lib/greetings.js` | Voice/pattern reused, not modified | Reference only |
| `06-transaction-auto-detect.md` | **None** — structurally separate (native listener, not server push) | No action |

---

## Out of Scope (All Phases)

- **Per-user timezone changing mid-day / travel detection** — `timezone`
  syncs from the device on app open; if a user travels, their reminder
  times follow their new local clock next sync, not instantly. Fine for
  FLO's current usage pattern; revisit only if this becomes a real
  complaint.
- **Rich push content** (images, progress bars) — plain title/body/action
  button only. Nothing in FLO's current notification design calls for more.
- **`06-transaction-auto-detect.md`'s native listener/prompt** — explicitly
  a different mechanism, unaffected, not touched by this feature at all.
- **Multi-language reminder copy** — English only, matching the rest of
  the app.
- **A user-configurable "quiet hours" window beyond the two chosen times**
  — the two `profiles` reminder-time columns already let a user push their
  morning/evening times wherever they want; no separate do-not-disturb
  range on top of that.
