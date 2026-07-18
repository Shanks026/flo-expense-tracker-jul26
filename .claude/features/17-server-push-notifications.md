# Feature: Server-Driven Push Notifications
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/17-server-push-notifications.md`
**Status**: Planned
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
- [ ] `reminder_sends` table + RLS applied.
- [ ] `pg_cron`/`pg_net` enabled, job scheduled, confirmed via `cron.job`.
- [ ] A device with its system timezone changed away from `Asia/Kolkata` receives its morning nudge at the correct **local** time, not IST.
- [ ] Logging a transaction before the evening window suppresses that evening's nudge; not logging lets it through.
- [ ] Two consecutive/overlapping cron runs never produce a duplicate send (`reminder_sends` unique constraint confirmed to reject the second).
- [ ] Settings toggle/time-picker changes are visible in `profiles` immediately after saving.
- [ ] Copy varies correctly by day of week and matches the established voice (no exclamation marks, no emoji, sentence case).
- [ ] The "Log now" action button and a plain tap on the notification body both open `AddTransactionSheet`.
- [ ] Old local nudge scheduling no longer fires (no leftover locally-scheduled nudge notifications post-migration).

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

### 2.x — structurally identical to Phase 2
Same Edge Function, same `reminder_sends` idempotency table (two more
`trigger` values: `bill_due`, `report_ready`), same push-send mechanism,
same category/action-button pattern (a bill-due notification's action
button opens `PayBillSheet` instead of `AddTransactionSheet` — reuses
`usePayBillSheet()`, already exists). Full sub-section breakdown deferred
to implementation time once Phase 2 is proven, rather than speculatively
detailed now.

### Impact
| Area | Change | Watch for |
|---|---|---|
| `lib/notifications.js` | Bill-due/report-ready scheduling removed entirely | File may become nearly empty — decide whether it still has a reason to exist once nothing schedules locally |

**→ Stop here. Show the result and wait for approval.**

---

## Phase 4 — Settings Polish + Observability

### Goal
Settings shows real push-registration state (token present/absent) and a
"send me a test notification" button, so the user can confirm the pipeline
is working without waiting for the next scheduled window. The
confidence-building, "feels premium" pass — lower urgency, can slip behind
the other phases.

**→ Stop here. Show the result and wait for approval.**

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
