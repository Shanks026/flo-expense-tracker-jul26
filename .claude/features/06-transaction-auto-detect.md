# Feature: Transaction Auto-Detect (Bank Notification Listener)
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/06-transaction-auto-detect.md`
**Status**: Planned
**Last Updated**: July 2026

---

## Context

`03-sms-share-import.md` got logging down to: long-press the bank SMS → Share →
FLO → sheet opens pre-filled. Real progress, but still a manual round trip that
requires the user to *remember* to do it. The transaction they forget to share is
the transaction that never gets logged.

This feature closes the loop. FLO listens (with explicit permission) to
notifications posted by **bank and UPI apps**, parses out the amount and
direction, and proactively fires a heads-up notification:

> **₹450 debited — log it?**
> HDFC Bank · Log it / Not mine

Tapping **Log it** opens FLO with the Add Transaction sheet pre-filled. That's
the entire feature: from "I have to remember to log this" to "I have to tap once."

**This is the single highest-leverage feature in the app** — friction is the only
reason expense trackers get abandoned — and also, by a wide margin, the riskiest.
Everything below is written to be honest about that.

This feature reuses: `lib/smsParser.js`'s regex heuristics (ported to Kotlin — see
the duplication note in Phase 2), `AddTransactionSheet.open({ amount, type, note })`
(already supports prefill, built for share-intent), the `ShareIntentHandler`
sibling-component pattern in `app/_layout.js:38-51`, `app/settings.js`'s
permission-state row pattern from `04-...md` Phase 5, and `theme/tokens.js`.

---

## The Three Hard Constraints (read before anything else)

These were established by research, not assumption, and they dictate the entire
design. Do not re-litigate them mid-build.

### 1. It must work with FLO **fully closed**, which rules out the obvious library

There is a real Expo module for this —
[`expo-android-notification-listener-service`](https://github.com/SeokyoungYou/expo-android-notification-listener-service)
(v1.1.0, MIT, built against Expo SDK 52 / RN 0.76). It is **not sufficient**, for
a structural reason:

Its entire API is `addListener('onNotificationReceived', cb)` — **a JS event
emitter**. Events only reach that callback while the JavaScript runtime is alive.
Android will happily keep the native `NotificationListenerService` bound with
FLO's Activity destroyed, but there is then **no JS context to deliver into**.

A bank notification arriving while FLO is swiped away — i.e. *almost always* —
would be silently dropped. That's not a rough edge; that's the feature not
existing.

> **Precision on "closed", added during Phase 1 implementation**: Android
> distinguishes two things a user might call "closing the app," and this
> feature's viability rests entirely on which one is meant.
> - **Swiped away from Recents** — a correctly manifest-declared
>   `NotificationListenerService` is rebound by the OS independent of the
>   app's Activity or task. This is the normal case a user means by "the app
>   is closed," and it's exactly how Pushbullet, IFTTT-style notification
>   mirrors, etc. work. **This is the case Phase 1 must be tested against.**
> - **Force-stopped** (system Settings → Apps → Force Stop) — Android
>   *deliberately* revokes the listener binding here as a user/OS control that
>   no app can override. Testing against this would make a correctly-working
>   feature look broken. Not the target case.

**Therefore: detection, parsing, dedupe, persistence, and the prompt notification
all happen in native Kotlin.** JavaScript is never in the hot path. JS only ever
*drains* a queue that native has already filled. This is why we write our own
Expo module (~250 lines of Kotlin) instead of installing one.

### 2. Play Protect **blocks browser-sideloaded APKs** that declare this permission

`NOTIFICATION_LISTENER` is one of four permissions Google Play Protect classifies
as high-risk (with `READ_SMS`, `RECEIVE_SMS`, `ACCESSIBILITY`). An app declaring
any of them, installed from an *"internet-sideloading source"* — a browser
download, a messaging app, a file manager — has its **installation automatically
blocked**.
([Play Protect developer guidance](https://developers.google.com/android/play-protect/warning-dev-guidance))

India was a pilot market for this enforcement, so it will be hit in practice.

**Operational consequence for testing — this matters, get it right:**

| Install path | Works? |
|---|---|
| `npx expo run:android` (adb, over USB) | ✅ Not an internet-sideload |
| EAS build → download APK **to your computer** → `adb install app.apk` | ✅ Same |
| EAS build → tap the download link **on the phone** | ❌ **Blocked by Play Protect** |
| Google Play (incl. internal testing track) | ✅ Not sideloading |

So: EAS testing is fine, but the artifact must be pushed over USB, never tapped
on the phone.

### 3. Play review is a real risk, so the feature must be **strictly additive**

Play's stated *allowed* uses for notification access are narrow — *"health and
fitness apps that relay notifications to wearables"* and *"apps that aggregate
notifications to help users focus."* An expense tracker reading bank alerts is
**not obviously on that list**, though it is arguable (Indian expense apps have
shipped exactly this), and the *disallowed* use — *"access notification content
without explicit user consent"* — is one we clearly don't commit, since the user
must manually grant notification access in system settings **and** opt in inside
FLO.

The user's plan is to publish to Play. So this is a declared-use review that
might fail.

**Design rule, non-negotiable:** FLO must be **100% functional with this feature
removed**. Manual entry and the share-intent path stay untouched and remain the
primary flows. Everything in this doc is additive: one native module, one settings
section, one root handler component. If Play rejects the permission, we delete
those and lose a convenience — never the app.

Do **not** make anything else in FLO depend on this feature's presence.

### Bonus constraint: the allowlist excludes Google Messages

Watch **bank and UPI apps' own notifications only**. Reading the notification
Google Messages posts for a bank *SMS* is functionally an end-run around the
SMS-permission policy Play explicitly targets ("must not use alternative methods
to derive data granted by SMS permissions") — near-certain rejection, and the
same landmine `03-sms-share-import.md` already dodged once.

Yes, this means missing bank alerts that only arrive by SMS. That's the price of
being publishable, and the share-intent path already covers those.

---

## Phase Overview

```
Phase 1 — Native module + permission + raw capture (app-closed proof)
  The riskiest ~20% of the work, isolated. Build the Expo module, get FLO into
  Android's notification-access screen, capture raw notifications from
  allowlisted packages into a native queue. Prove — with FLO swiped away from
  Recents — that they're still captured. No parsing, no prompt. If this phase
  fails, the feature is dead and we've spent the minimum finding out.

Phase 2 — Native parse + heads-up prompt with actions
  Port the SMS regexes to Kotlin. A matched notification posts FLO's own
  heads-up: "₹450 debited — log it?" with Log it / Not mine. Dedupe.

Phase 3 — Wire into the app + Settings
  "Log it" (or next app open) drains the queue and opens AddTransactionSheet
  pre-filled. Settings gains a Transaction Detection section: opt-in toggle,
  permission state, deep-link to system settings, and the watched-app list.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Native Module + Permission + Raw Capture

### Goal
FLO appears under Android's **Settings → Notifications → Device & app
notifications** (notification access). Granting it means notifications from
allowlisted bank/UPI packages are captured into a native persistent queue —
**including while FLO is swiped away from Recents.** (Not the same as
force-stopped — see the correction below.) On next app open, JS drains the queue
and shows the raw payloads in an `Alert`. That's it. This proves the native
bridge, the permission flow, and — the thing everything depends on — that capture
survives the app being killed.

Deliberately tiny. This is the phase that decides whether the feature is possible.

### Before Starting — Confirm With Codebase
1. Confirm `android/` exists (generated by `expo prebuild`, gitignored per
   `.gitignore:11`) and that `app.json`'s `plugins` array is still the source of
   truth — we add a **local** Expo module, so `app.json` config stays minimal.
2. Read `app/_layout.js:38-51` (`ShareIntentHandler`) — the drain handler in
   Phase 3 is a direct copy of this shape (a sibling of `<Stack>` *inside* the
   provider nest, because `RootNavigator` can't consume providers it defines).
3. Confirm `app.json`'s `android.package` is `com.anonymous.flo` — the native
   module's Kotlin package path must match the prebuild output.
4. Confirm `newArchEnabled: true` — the module is written with the **Expo Modules
   API**, which supports the New Architecture natively. Do not use a legacy
   RN bridge module.
5. Read `lib/notifications.js:8-19` — the Expo Go `require()` guard. This module
   is native too, so `lib/detect.js` needs **the same treatment**, or it crashes
   Expo Go at boot on every route (the exact bug `04-...md` Phase 5 already ate).

### 1.1 Database
**No database changes — in any phase.** This feature has zero database footprint.
A detected-but-unconfirmed transaction is not a transaction; it lives in a native
queue until the user confirms it, at which point it becomes an ordinary row via
the existing `AddTransactionSheet` insert path.

### 1.2 Data Layer

```
modules/flo-notification-listener/          ← NEW. Local Expo module.
  expo-module.config.json
  android/src/main/java/com/anonymous/flo/detect/
    FloDetectModule.kt                      ← Expo Modules API surface
    FloNotificationListenerService.kt       ← the NotificationListenerService
    DetectionStore.kt                       ← SharedPreferences-backed queue
  index.ts                                  ← JS API
lib/detect.js                               ← NEW. Expo-Go-guarded wrapper (see step 5).
```

**Why a local module** (`modules/`, not a published package): it's ~250 lines,
it's specific to FLO's parsing, and vendoring it means no dependency on an
unmaintained third party for the app's riskiest native surface. `expo-module.config.json`
+ `npx expo prebuild` autolinks it — no manual Gradle edits.

**JS API** (`lib/detect.js`, every function no-op-guarded for Expo Go):

```js
isSupported()                  // false in Expo Go
hasNotificationAccess()        // reads Settings.Secure enabled_notification_listeners
openNotificationAccessSettings()  // ACTION_NOTIFICATION_LISTENER_SETTINGS — cannot be prompted, only deep-linked
setEnabled(bool)               // FLO's own opt-in, separate from the OS grant
setAllowedPackages(string[])
drainDetections()              // returns [] and clears the native queue atomically
```

**Native behaviour (Phase 1 scope):**
- `FloNotificationListenerService.onNotificationPosted(sbn)`:
  - Ignore unless `setEnabled(true)` **and** `sbn.packageName` ∈ allowlist.
  - Extract `EXTRA_TITLE`, `EXTRA_TEXT`, `EXTRA_BIG_TEXT` from
    `sbn.notification.extras`.
  - Append `{ packageName, title, text, postedAt }` to `DetectionStore`.
- `DetectionStore` — a JSON array in `SharedPreferences`. Capped at 20 entries
  (drop oldest). **Persistence is the whole point**: it must survive the JS
  runtime not existing, and the app process being killed and restarted.

**Allowlist** (Phase 1 — hardcoded constant, made visible in Settings in Phase 3):
```
com.google.android.apps.nbu.paisa.user   (Google Pay India)
com.phonepe.app                          (PhonePe)
net.one97.paytm                          (Paytm)
+ the user's own bank apps — to be confirmed on-device in Phase 1
```
**Explicitly NOT `com.google.android.apps.messaging`** — see the bonus constraint
above. This is a policy decision, not an oversight.

The real package names must be **confirmed on-device**, not guessed: Phase 1's
raw-capture `Alert` is exactly how we discover what the user's actual bank apps
post and under what package name. Expect to widen the list after the first test.

### 1.3 Components
None. Phase 1 surfaces its result via `Alert.alert` — the same proof-of-plumbing
approach `03-sms-share-import.md` Phase 1 used, and for the same reason.

### 1.4 Navigation / Integration
- A temporary drain-on-open call in `app/_layout.js` (sibling component, modelled
  on `ShareIntentHandler`) → `Alert.alert(JSON.stringify(detections))`.
- A temporary "Grant notification access" button (Settings) calling
  `openNotificationAccessSettings()`. Made permanent and proper in Phase 3.
- `npx expo prebuild` to autolink the module; **new EAS build required**.

### 1.5 Impact on Existing Features
| Area | Change | Watch for |
|---|---|---|
| Native manifest | Adds `BIND_NOTIFICATION_LISTENER_SERVICE` + a `<service>` entry | **This is the permission that makes browser-sideloaded installs fail.** Install via adb from here on |
| Expo Go | Must still boot | `lib/detect.js` needs the `require()` guard, same as `lib/notifications.js` |
| Everything else | None | Feature is strictly additive |

### 1.6 What This Phase Does NOT Include
- No parsing (Phase 2). Raw text only.
- No prompt notification (Phase 2), no dedupe (Phase 2).
- No AddTransactionSheet wiring (Phase 3), no real Settings UI (Phase 3).

### 1.7 Phase 1 Checklist — Before Marking Complete
- [x] `modules/flo-notification-listener/` autolinks — confirmed via `npx expo-modules-autolinking resolve --platform android`, which lists it, with no `package.json`/workspace wiring needed (local modules under `modules/` are discovered automatically).
- [x] `npx expo prebuild --clean` regenerates `android/` without error, with the module's own manifest fragment (`modules/flo-notification-listener/android/src/main/AndroidManifest.xml`) present and well-formed — **verified by reading the file**.
- [x] Expo Go still boots — `lib/detect.js` follows the guarded-`require()` pattern; `npx expo export --platform android` bundles cleanly (3969 modules) with `require('../modules/flo-notification-listener')` resolving through Metro, same shape as `lib/notifications.js`'s `expo-notifications` guard.
- [x] `npx tsc --noEmit` passes — the module's TS wrapper type-checks against `expo`'s `requireNativeModule`.
- [ ] **Not verified from this environment — no Android SDK installed here.** The generated `android/app/src/main/AndroidManifest.xml` is *not* the merged manifest — manifest merging is a Gradle build-time step (`processDebugManifest`), not a prebuild-time one. **The actual proof that the `<service>` merged in, and that the Kotlin compiles, only exists once you run `npx expo run:android` or an EAS build.**
- [ ] **On-device:** FLO appears in Android's notification-access screen and can be granted.
- [ ] **On-device:** a notification from an allowlisted app is captured.
- [ ] **On-device, THE critical test:** swipe FLO away from Recents (not force-stop — see the correction above) → trigger a bank notification → reopen FLO → **the notification is in the drained queue.** If this fails, the feature is not viable — stop and report.
- [ ] **On-device:** the user's real bank/UPI package names + their notification text shapes are recorded in the Implementation Notes (needed to write Phase 2's parser).
- [ ] Non-allowlisted apps' notifications are **not** captured.
- [ ] Bundles cleanly — confirmed for the JS bundle (above); native compile still needs your machine.

**→ Stop here. This phase is a go/no-go gate. Show the result and wait for approval.**

### Implementation Notes

- **Simpler than planned: no config plugin needed for the `<service>` element.**
  The original plan (before implementation) assumed a JS config plugin using
  `withAndroidManifest`. It turns out unnecessary: an Expo module is an
  ordinary Android library (Gradle) module, and its own
  `android/src/main/AndroidManifest.xml` is folded into the app's final
  manifest by AGP's standard library-manifest merger — the same mechanism
  `00-index.md` already documents for `expo-notifications`' bundled
  `POST_NOTIFICATIONS`/`RECEIVE_BOOT_COMPLETED` declarations. So the `<service>`
  (with its `BIND_NOTIFICATION_LISTENER_SERVICE` permission and intent-filter)
  lives directly in the module's manifest fragment — no plugin JS file exists
  in this feature at all. Used the **fully-qualified** `android:name` (not a
  `.`-relative one) to avoid any ambiguity in how the merger resolves a
  relative class name against this fragment's `namespace` vs. the app's final
  package.
- **Scaffolded via `npx create-expo-module@latest --local`** rather than
  hand-built from scratch — the CLI's flags (`--platform android`,
  `--features Function AsyncFunction`) produce a working Kotlin/Gradle/TS
  skeleton verified against this project's actual Expo version, which is
  safer than reconstructing Gradle/autolinking wiring from documentation
  fragments. Deleted the template's generated View/WebView example
  (`FloNotificationListenerView.kt/.tsx`, `.web.ts/.tsx`) — this feature has
  no UI component, only functions. Trimmed `expo-module.config.json` from
  `["apple", "android", "web"]` to `["android"]` — the CLI's template still
  listed apple/web platforms despite the `--platform android` flag (no files
  were generated for them, but the config list needed a manual fix).
- **Local-module autolinking confirmed empirically, not from docs** — the
  Expo docs page for local modules doesn't state whether `modules/*` is
  scanned by default or needs `package.json` wiring. Rather than guess, ran
  `npx expo-modules-autolinking resolve --platform android` directly, which
  listed `flo-notification-listener` with zero `package.json`/workspace
  changes — confirming `modules/*` autolinking is automatic in this Expo
  version.
- **`hasNotificationAccess()` reads `Settings.Secure` key
  `"enabled_notification_listeners"`** — there's no public SDK constant for
  this key; hardcoding the string is the standard, widely-used approach (it's
  what `NotificationManagerCompat.getEnabledListenerPackages()` reads
  internally). The flattened-component-name check
  (`"${packageName}/${ServiceClass.name}"`) matches the format Android stores
  in that setting.
- **`NotificationPrefs` is a SharedPreferences-backed singleton**, deliberately
  shared by both `FloNotificationListenerModule` (JS bridge) and
  `FloNotificationListenerService` (OS-bound, independent lifecycle) — see
  Hard Constraint 1. `drainQueue()` is a synchronized read-then-clear so a
  detection is never delivered to JS twice. The queue caps at 20 entries,
  dropping the oldest.
- **What's built vs. what's temporary-debug-only**: `lib/detect.js` and the
  full native module (Module + Service + Prefs) are Phase 1's real,
  durable deliverable. The `app/settings.js` "Transaction Detection (debug)"
  card added alongside them is **scaffolding, not the real UI** — a bare
  grant-access row, an enable toggle that hardcodes `DEFAULT_ALLOWED_PACKAGES`,
  and a "drain queue → Alert.alert(JSON)" button, exactly matching this
  phase's stated goal of proving the plumbing. It gets replaced by the real
  card in Phase 3.
- **Verification boundary, stated plainly**: this environment has JDK 17 but
  **no Android SDK installed**, so nothing Gradle-dependent could be run here
  — no manifest-merge verification, no Kotlin compile, no on-device test. This
  matches every other native phase in this project's history
  (`03-sms-share-import.md`, `04-notifications-and-recurring-bills.md` Phase
  5) — both were verified on the user's device, not from this environment.
  What *was* verified here: `expo prebuild` succeeds, the module autolinks,
  `npx tsc --noEmit` passes, and `npx expo export --platform android` bundles
  cleanly (3969 modules, no resolution errors) — i.e. everything checkable
  short of an actual native build.
- **Real bank/UPI package names are still unconfirmed.**
  `DEFAULT_ALLOWED_PACKAGES` in `lib/detect.js` (Google Pay, PhonePe, Paytm)
  are best-guess standard package IDs, not verified against the user's actual
  installed apps. Confirming them — and discovering what other apps (bank-app-
  specific, not just UPI wallets) need adding — is explicitly part of the
  on-device checklist above, via the debug "drain queue" button.

**Next: on your device.**
1. `npx expo run:android` (installs via adb — not a browser download, see Hard
   Constraint 2) or push a fresh EAS build via `adb install`.
2. Settings → "Transaction Detection (debug)" → tap **Notification access** →
   grant FLO access in the system screen → come back to Settings (screen
   remounts, re-checks) → confirm it now reads "Granted".
3. Toggle **Enable detection** on.
4. Trigger a real notification from GPay/PhonePe/Paytm/your bank app (e.g.
   send yourself a small UPI amount).
5. Swipe FLO away from Recents (not force-stop). Trigger another notification.
   Reopen FLO → Settings → **Show captured** → confirm both appear.
6. Report back the real package names and raw `title`/`text` shapes for
   whatever you use — that's what Phase 2's parser gets written against.

---

## Phase 2 — Native Parse + Heads-Up Prompt

### Goal
A captured bank notification becomes an actionable prompt. Native parses the
amount and direction, dedupes, and posts FLO's own heads-up notification —
**₹450 debited — log it?** — with **Log it** and **Not mine** actions. Still no
app wiring; the prompt appears and its buttons work, but "Log it" just opens FLO.

### Before Starting — Confirm Phase 1 is Approved
1. Re-read Phase 1's Implementation Notes for the **real** notification text
   shapes captured on-device. Write the Kotlin regexes against **those**, not
   against the constructed samples `lib/smsParser.js` was built from.
2. Re-read `lib/smsParser.js` — specifically `findAmount`'s balance-context guard
   (`Avl Bal:` lookback) and `findDirection`'s earliest-match rule. Both are
   hard-won and must be ported, not reinvented.
3. Confirm `05-koban-engagement.md` Phase 3's channel work — if it has landed,
   reuse `ensureChannels()`. If not, this phase creates `flo.txn.detected`
   (`IMPORTANCE_HIGH`) natively and independently.

### 2.1 Database
No database changes.

### 2.2 Data Layer

**Kotlin parser** (`TransactionParser.kt`) — a direct port of `lib/smsParser.js`:
- Amount: `(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)`, skipping any match preceded
  within 25 chars by balance wording (`avl bal`, `available balance`, `bal:`).
- Direction: expense `debited|spent|withdrawn|paid|debit`, income
  `credited|received|deposited|refund(ed)?|credit` — whichever appears **earliest**
  wins (handles "A/c debited by Rs.X; MERCHANT credited").
- Returns null rather than guessing wrong. **A false positive is far worse than a
  miss** — it trains the user to ignore the prompt.

> ⚠️ **Known duplication, accepted deliberately.** The regexes now live in two
> places: `lib/smsParser.js` (JS, share-intent) and `TransactionParser.kt`
> (Kotlin, this feature). They cannot be shared across the language boundary, and
> the alternative — sending raw text to JS to parse — is exactly the design that
> breaks when the app is killed (see Hard Constraint 1). **If you tune one, tune
> the other.** Note it in both files.

**Dedupe** — banks often post the same alert twice (app + SMS mirror, or an
update to the same notification). Key on
`sha1(packageName + normalisedText)`; ignore a repeat within 5 minutes. Store the
recent keys in `DetectionStore`.

**Prompt notification** (posted natively via `NotificationManager` — *not* via
`expo-notifications`, which would require a live JS context):
- Channel `flo.txn.detected`, `IMPORTANCE_HIGH` → heads-up.
- Title: `₹450 debited — log it?` / `₹2,000 credited — log it?`
- Body: the source app's label + a trimmed snippet.
- Action **"Log it"** → opens FLO's launcher Activity (the queue drain in Phase 3
  does the rest).
- Action **"Not mine"** → a `BroadcastReceiver` that removes the entry from
  `DetectionStore` and cancels the notification. **Never opens the app** — a
  dismissal that forces you to open the app is not a dismissal.

**Deliberate design choice: no URL deep-link.** Tapping "Log it" just launches
FLO normally; JS drains the queue on open. This avoids `expo-router` path
collisions entirely, and it handles the multi-detection case for free (three
notifications while you were away → one open → three prompts, not three competing
deep links).

### 2.3 Components
None.

### 2.4 Navigation / Integration
None yet — "Log it" opens the app, which does nothing with the queue until Phase 3.

### 2.5 Impact on Existing Features
| Area | Change | Watch for |
|---|---|---|
| Notification shade | FLO now posts notifications from native, not just `expo-notifications` | Distinct channel; must not collide with `05-...md`'s channels |
| `lib/smsParser.js` | Unchanged, but now has a Kotlin twin | Keep them in sync — comment in both |

### 2.6 What This Phase Does NOT Include
- No AddTransactionSheet prefill (Phase 3), no Settings UI (Phase 3).
- No category/merchant inference — amount + direction only, same as share-intent.
- No auto-insert. **A detected transaction is never written to the database
  without the user confirming it.** Non-negotiable: a parser that silently
  creates wrong rows in someone's ledger is worse than no feature.

### 2.7 Phase 2 Checklist — Before Marking Complete
- [x] `TransactionParser.kt` ports the balance-context guard and earliest-direction rule; both files carry the keep-in-sync comment (`lib/smsParser.js` and the Kotlin file).
- [x] `npx tsc --noEmit` passes; `npx expo export --platform android` bundles cleanly — confirms the JS-side type/shape changes (`DetectedNotification` gaining `id`/`amount`/`type`, the debug card's new display) didn't break anything checkable without a native build.
- [ ] **Not verified from this environment — no Android SDK.** Manual review only (no compiler): cross-file references checked (all 7 Kotlin files share one package, so no missing imports), `PendingIntent` flag/request-code usage checked against known Android pitfalls, `NumberFormat`-based Indian digit grouping used instead of a naive `%,d` (caught and fixed during review — see notes).
- [ ] **On-device:** a real bank notification produces a heads-up "₹X debited — log it?" **that drops down over the screen**.
- [ ] **On-device, with FLO swiped away from Recents:** the prompt still fires.
- [ ] "Not mine" dismisses and removes from the queue **without opening the app**.
- [ ] Duplicate bank alerts within 5 minutes produce **one** prompt.
- [ ] An OTP / promo / non-transaction notification from an allowlisted app produces **no** prompt.
- [ ] Bundles cleanly — JS confirmed above; native compile still needs your machine.

**→ Stop here. Show the result and wait for approval.**

### Implementation Notes

- **Combined-test deviation from the original plan (2026-07-12, user decision):**
  the plan originally gated Phase 2 behind an approved, on-device-verified
  Phase 1 — specifically so `TransactionParser.kt` could be written against
  **real** captured bank/UPI notification text. The user can't run an EAS
  build session-to-session right now, so by agreement all three phases are
  being built together and tested once, in one combined on-device pass.
  Consequence: `TransactionParser.kt` was written against the same
  constructed-sample reasoning `lib/smsParser.js` originally used, not real
  device data. This is a known, accepted position — `lib/smsParser.js`
  itself needed exactly one tuning pass after its own real-device test (see
  `03-sms-share-import.md` Phase 2's Implementation Notes) and required no
  structural rework. Expect the same here: **after your combined on-device
  test, report the raw `title`/`text` your bank/UPI apps actually post (the
  debug queue in Settings shows both), and the regexes in
  `TransactionParser.kt` — and, if the same gap exists, `lib/smsParser.js`
  — get tuned to match.**
- **Files added:** `TransactionParser.kt` (parser, direct port),
  `Detection.kt` (small in-memory data class passed Service→PromptNotifier),
  `PromptNotifier.kt` (posts the native heads-up prompt, creates the
  `flo.txn.detected` channel), `DismissDetectionReceiver.kt` (handles "Not
  mine", registered `exported="false"` in the module's manifest — only
  reachable via this app's own `PendingIntent`, not by another app sending
  the same broadcast action).
- **`NotificationPrefs` gained**: `id` on every queued detection (a `UUID`,
  generated at enqueue time — needed so "Not mine" can remove *this specific*
  entry via `removeDetection(id)` without touching the rest of the queue),
  `amount`/`type` (the parsed result, alongside the still-kept raw
  `title`/`text` for on-device debugging), and `isDuplicateAndRecord` (a
  5-minute SHA-256-keyed dedupe window, pruned lazily on every call rather
  than on a timer — this method is only ever called from
  `onNotificationPosted`, so there's no other place that needs pruning to
  happen).
- **Real bug caught during self-review, fixed before shipping**:
  `PromptNotifier`'s first draft formatted amounts with `String.format("%,d",
  ...)`, which groups by thousands (`1,234,567`) — not the Indian lakh/crore
  grouping (`12,34,567`) FLO's own money helper
  (`₹${Math.round(n).toLocaleString('en-IN')}`) uses everywhere else in the
  app. Fixed with `NumberFormat.getIntegerInstance(Locale("en", "IN"))`,
  which Android's ICU backend groups correctly. Would have shipped a
  visibly-wrong number format if not caught here.
- **Deliberately did not reuse `expo-notifications`** for the prompt, per the
  doc's design: it needs a live JS runtime to call
  `scheduleNotificationAsync` through, which is precisely what may not exist
  when a bank notification arrives (Hard Constraint 1). The prompt is posted
  directly via `android.app.NotificationManager` from Kotlin, on its own
  channel (`flo.txn.detected`, created lazily by `PromptNotifier`, independent
  of `05-koban-engagement.md`'s channels — no collision, per 2.5 above).
- **Known cosmetic limitation, noted in `PromptNotifier`'s own doc comment**:
  the prompt's status-bar icon is `context.applicationInfo.icon` (the app's
  launcher icon), not a dedicated white/transparent notification icon — none
  exists in this repo yet. This is the same "white blob" problem
  `05-koban-engagement.md` Phase 3 already documents for
  `expo-notifications`; whatever icon asset eventually gets produced for that
  should be reused here too.
- **"Log it" and the notification body tap use the same `PendingIntent`**
  (`context.packageManager.getLaunchIntentForPackage(context.packageName)`) —
  both just open FLO; Phase 3's `DetectedTransactionHandler` is what actually
  drains the queue and opens the sheet once the app is open. Reusing one
  `Intent` instance for both is deliberate, not an oversight.
- **Verification boundary, same as Phase 1**: no Android SDK in this
  environment, so nothing Gradle/Kotlin-compile-dependent could be checked
  here. What *was* verified: all 7 Kotlin files share one package (no missing
  cross-file imports possible), the JSON/manifest additions are well-formed,
  and the JS-side changes (`DetectedNotification` type, the debug display)
  type-check and bundle cleanly. The Kotlin itself is manually reviewed, not
  compiler-verified — flagging this plainly rather than implying a false
  level of confidence.

---

## Phase 3 — Wire Into the App + Settings

### Goal
The loop closes. Opening FLO (via "Log it" or normally) drains any pending
detections and opens `AddTransactionSheet` pre-filled with the amount and
direction — category, plan, and account stay manual, exactly as with share-intent.
Settings gains a real **Transaction Detection** section: FLO's own opt-in toggle,
live permission state, a deep-link to the system grant screen, and the list of
watched apps.

### Before Starting — Confirm Phase 2 is Approved
1. Re-read `AddTransactionSheet.open(payload)` — confirm it still reads
   `payload.amount` / `payload.type` / `payload.note` with safe fallbacks (added
   in `03-sms-share-import.md` Phase 3). **This feature adds no new prefill
   capability — it reuses that one.**
2. Re-read `app/settings.js:198-264` (the Notifications card) — the permission-
   state row, the "blocked → open system settings" hint, and the `unsupported`
   (Expo Go) case are all patterns to copy, not reinvent.
3. Re-read `ShareIntentHandler` (`app/_layout.js:38-51`) — including its
   `if (!session) return` guard. A detection draining while signed out would try
   to open the sheet over the sign-in screen with no categories or account
   loaded.

### 3.1 Database
No database changes.

### 3.2 Data Layer
No new hooks. `lib/detect.js`'s `drainDetections()` is called once, imperatively,
by the root handler.

### 3.3 Components

```
app/_layout.js         ← + <DetectedTransactionHandler /> sibling
app/settings.js        ← + Transaction Detection card
```

**`DetectedTransactionHandler`** — sibling of `<Stack>` inside the provider nest
(same placement and same reason as `ShareIntentHandler`). On mount and on
`AppState` → `active`:
- Guard: `session` exists, feature enabled, permission granted.
- `const pending = await drainDetections()`.
- For each, `openAdd({ amount, type, note })`. If more than one is pending, open
  them one at a time — the sheet is a single instance, so queue them and open the
  next after dismiss. **If that proves fiddly, open the first and toast
  "N more detected"** rather than building a queue UI; note the decision.

**Settings — Transaction Detection card** (mirrors the Notifications card):
- Master toggle (FLO's own opt-in — separate from the OS grant, and off by default).
- Permission row: granted → a check; not granted → **"Grant notification access"**
  → `openNotificationAccessSettings()`. Re-check on every screen focus, because
  the grant happens **outside the app** and there is no callback (same reason
  `getPermissionStatus()` exists in `lib/notifications.js`).
- Expo Go → the "needs a development build" message, same as notifications.
- A read-only list of watched apps, with a one-line honest explanation of what
  FLO reads and what it never reads. This is the "explicit user consent" Play's
  policy asks for — and it's the right thing to show regardless.

### 3.4 Navigation / Integration
Covered above. No new routes.

### 3.5 Impact on Existing Features
| Area | Change | Watch for |
|---|---|---|
| `AddTransactionSheet` | **None** — reuses the existing prefill payload | Don't add a new open() shape |
| `app/_layout.js` | One more sibling handler | Must be inside the provider nest; must guard on `session` |
| `app/settings.js` | One new card | Permission must be re-checked on focus, not cached |

### 3.6 What This Phase Does NOT Include
- No category/merchant inference (out of scope, all phases).
- No auto-insert without confirmation. Ever.
- No user-editable allowlist UI (read-only list this round).
- No transaction-history-based bill auto-detection (that's still `04-...md`'s
  out-of-scope note).

### 3.7 Phase 3 Checklist — Before Marking Complete
- [ ] **On-device:** bank notification → heads-up → **Log it** → FLO opens with the sheet pre-filled with the right amount and direction.
- [ ] **On-device:** same, with FLO swiped away from Recents beforehand.
- [x] Multiple pending detections all get surfaced — implemented as the doc's own pre-authorized fallback (first opened, rest toasted, not queued) rather than the richer per-dismiss queue, since `AddTransactionSheet` has no dismiss callback and adding one is out of scope for this phase (3.5: "don't add a new open() shape"). **On-device confirmation still needed.**
- [x] Draining while signed out does nothing — `DetectedTransactionHandler` guards on `session` before calling `hasNotificationAccess()`/`drainDetections()`, same pattern as `ShareIntentHandler`.
- [x] Settings shows live permission state and re-checks on foreground — implemented via an `AppState` listener (not `useFocusEffect`, which nothing else in this codebase uses), since returning from the system notification-access screen backgrounds/foregrounds the app without unmounting the pushed Settings screen. **On-device confirmation still needed.**
- [x] Master toggle off → nothing captured/prompted — enforced natively (`FloNotificationListenerService.onNotificationPosted` returns immediately if `!prefs.isEnabled()`, checked in Phase 1/2). **On-device confirmation still needed.**
- [x] Expo Go still shows "needs a development build" — the card always renders now (previously gated behind `isDetectSupported()`, hiding it entirely); an inline message replaces the interactive rows when unsupported, matching the existing Notifications card's Expo Go handling.
- [x] **Removing this feature entirely would leave FLO fully functional** — verified by inspection: `grep`-checked that `lib/detect.js` is imported only from `app/_layout.js` and `app/settings.js` (a stray match in `lib/smsParser.js` is a comment referencing the file path, not an import).
- [x] `npx tsc --noEmit` passes; `npx expo export --platform android` bundles cleanly.
- [ ] Bundles cleanly natively — still needs your machine (no Android SDK here, as in Phases 1–2).

**→ Stop here. Show the result and wait for approval.**

### Implementation Notes

- **`DetectedTransactionHandler`** added to `app/_layout.js` as a sibling of
  `<Stack>`, in the same slot as `ShareIntentHandler`/`NotificationSync`
  (inside every sheet provider, so `useAddTransactionSheet()` and
  `useToast()` both resolve). Runs on mount and on every `AppState` → active
  transition — not just mount — since a bank notification can arrive at any
  point while the app is merely backgrounded, not only before a fresh cold
  start.
- **Multiple-pending-detections tradeoff, stated plainly**: `drainDetections()`
  is an atomic native read-then-clear (Phase 1's design, so JS can never
  double-process an entry). That means once JS has them, whichever aren't
  immediately shown are **not recoverable** — there's no native "put it
  back" API, and building one (or a JS-side persisted retry queue) was
  judged disproportionate to what should be a rare case (multiple bank
  transactions landing between one app-open and the next). The toast
  ("N more detected — add them manually") is the only record; the user
  re-enters those by hand, same as if the feature didn't exist. This is the
  doc's own pre-authorized fallback (3.3: "If that proves fiddly, open the
  first and toast... note the decision"), chosen deliberately over silently
  implying the rest would resurface later, which they don't.
- **Settings card is no longer gated behind `isDetectSupported()`** — Phase
  1's debug version hid the entire section in Expo Go. The doc's Phase 3
  spec explicitly wants a visible "needs a development build" message
  instead (matching the Notifications card's own Expo Go handling), so the
  card now always renders; only its *contents* branch on support.
- **Watched-apps disclosure is a plain paragraph, not `subRow`** — caught
  during review before it shipped: `subRow`'s style
  (`flexDirection: 'row', justifyContent: 'space-between'`) is built for a
  label/value pair like "Remind me at / 8:00 PM", not a wrapping sentence: a
  multi-line `Text` inside it would have been squashed into that row layout
  instead of wrapping normally. Added a dedicated `watchedAppsRow`/
  `watchedAppsText` style pair instead of reusing `subRow` for something it
  wasn't built for.
- **`WATCHED_APP_LABELS`** (Google Pay / PhonePe / Paytm) is a small
  read-only display map in `app/settings.js`, matching `lib/detect.js`'s
  `DEFAULT_ALLOWED_PACKAGES` — per 3.6, no editable-allowlist UI this round,
  so it only needs to be readable, not a general package-name-to-label
  resolver.
- **Verification boundary, same as Phases 1–2**: no Android SDK in this
  environment. What *was* verified: the isolation claim (grep), and that all
  JS/TS changes across `app/_layout.js` and `app/settings.js` type-check and
  bundle cleanly (`tsc --noEmit`, `expo export --platform android`, 3969
  modules). Every on-device row above is unchecked and needs your combined
  test pass, per the Phase 2 combined-testing note.

---

## Data Model Summary (Final State After All Phases)

```
NO SCHEMA CHANGES. Zero database footprint.

Android NotificationListenerService (native, survives app-kill)
  └─ DetectionStore (SharedPreferences JSON queue, ≤20)
       └─ drained by JS on app open
            └─ AddTransactionSheet.open({ amount, type, note })
                 └─ user confirms → an ORDINARY transactions row
                    (no source flag, no back-link — indistinguishable
                     from a manually-typed one, by design)
```

A detected-but-unconfirmed transaction is **not** a transaction and never touches
Postgres.

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| `AddTransactionSheet` | None — reuses the `{ amount, type, note }` prefill built for share-intent | Phase 3 |
| `lib/smsParser.js` | Unchanged, but gains a Kotlin twin that must be kept in sync | Phase 2 |
| `app/settings.js` | New Transaction Detection card | Phase 3 |
| `app/_layout.js` | One new sibling handler | Phase 3 |
| Build workflow | **Browser-downloaded APKs will now be blocked by Play Protect.** Install via adb | Phase 1 |
| Play submission | Notification access requires a declared-use review that may fail | Before publishing |

---

## Out of Scope (All Phases)

- **Reading Google Messages / SMS notifications** — deliberately excluded. It's
  the SMS-permission end-run Play's policy targets. The share-intent path
  (`03-sms-share-import.md`) covers SMS-only banks, manually.
- **Auto-inserting a transaction without confirmation** — never. A parser that
  silently writes wrong rows into someone's ledger is worse than no feature.
- **Category, merchant, or account inference** — amount + direction only, same as
  share-intent. Category stays a deliberate human choice.
- **iOS** — impossible. No notification-access API exists, at any price.
- **A user-editable app allowlist** — read-only list in v1.
- **Sharing the parser between JS and Kotlin** — cannot cross the language
  boundary; the duplication is accepted and documented.
- **Using `expo-notifications` for the prompt** — it needs a live JS context,
  which is precisely what we don't have. The prompt is posted from native.
