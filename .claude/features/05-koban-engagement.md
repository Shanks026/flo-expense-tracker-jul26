# Feature: Koban — Mascot, Engaging Reminders & Streaks
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/05-koban-engagement.md`
**Status**: 📋 Planned — sequenced **after** `06-transaction-auto-detect.md`
**Last Updated**: July 2026

> **Sequencing note (2026-07-12, first pass)**: this doc was written before
> `06-transaction-auto-detect.md`, but the user re-prioritised: *"the
> transaction-auto-detect is the important feature before gamification and
> mascot."* Correct call — auto-detect removes friction from the app's core
> loop, while Koban makes an existing loop more charming. `06` was built first
> (go/no-go passed on-device).
>
> **Sequencing note (2026-07-12, second pass — internal resequence)**: within
> this feature itself, the user set a further order, and it changes the phase
> structure below from the original write-up:
>
> *"notification fix -> streak foundation and then mascot... i will tell you my
> ideas for streaks and gamification once the notifications is done."*
>
> Read literally: **visibility fix → streak data → Koban's voice (copy) as the
> completion of "the notifications" → mascot (the actual illustrated icon) goes
> last**, deprioritized, and blocked on art the user is producing separately —
> *"i will come up with illustrations."* Full streak/gamification mechanics
> beyond the basic transaction-based count are **explicitly deferred** — build
> the foundation, not the game layer, until the user's ideas land.
>
> This also fixes a real dependency problem in the original phase order: the
> old Phase 2 (copy engine) needed streak data that didn't exist until the old
> Phase 1 finished, but wrote onto the *old* notification channel to "stay
> JS-only," which the new Phase 3 then had to immediately migrate off of. Since
> rebuilds are now routine (the user is already cycling EAS/adb builds for
> `06`), that JS-only constraint no longer buys anything — doing the channel
> work once, first, is strictly simpler.
>
> **`lib/streak.js` is already written** (built before either resequence) —
> pure, self-contained, imported by nothing yet. Its `isNewStreak`/"Day 1"
> naming needs one small update — see Phase 2 below — before `hooks/useStreak.js`
> gets built on top of it.

---

## Context

`04-notifications-and-recurring-bills.md` Phase 5 shipped a working daily
reminder. It is also completely forgettable — a single hardcoded string on a
repeating `DAILY` trigger (`lib/notifications.js:135-149`):

> **"Log today's spending?"** / *"Keep FLO up to date with today's transactions."*

Three defects, all confirmed by reading the code:

1. **It can never vary.** A repeating `DAILY` trigger bakes its content **once,
   at schedule time**, and repeats it verbatim forever. Varied copy, ₹ figures,
   or a streak count are impossible without changing the *scheduling
   architecture* — not just the strings. Fixed in Phase 3 (rolling window).
2. **It's invisible.** `lib/notifications.js:70-73` creates one channel at
   `AndroidImportance.DEFAULT`, which Android defines as *"makes a sound, but
   does not visually intrude."* A heads-up banner requires `HIGH`. This is the
   root cause of "it's buried under 100 other notifications." **Fixed first, in
   Phase 1 — this is the immediate, standalone win.**
3. **It nags people who already logged.** Interrupting someone with a reminder
   they've already acted on is the fastest way to train them to swipe FLO away
   unread. Fixed in Phase 3 (Nudge/Recap lane split).

The app has **no mascot, no emoji, and zero gamification** anywhere in source
(verified by grep — the only near-hits are `DeltaBadge` and Analytics' neutral
data labels). Existing copy is clean and terse; a notch warmer than a bank app,
but with no personality hook.

**Outcome, in the order it now ships**: notifications that actually pop up on
screen (Phase 1) → an honest, transaction-based streak (Phase 2) → varied,
streak-aware copy voiced as Koban (Phase 3) → real mascot artwork, whenever the
user's illustrations are ready (Phase 4, last, no code blocking on it).

This feature reuses: `rescheduleAll`'s cancel-and-rebuild philosophy, the
`useDataRefresh` version-counter, the standard read-hook shape, the Expo Go
`require()` guard (`lib/notifications.js:8-19`), the money helper
`₹${Math.round(n).toLocaleString('en-IN')}`, and `theme/tokens.js`'s brand lime
`#BBDC12`.

**Verified against the SDK 54 docs** (`https://docs.expo.dev/versions/v54.0.0/sdk/notifications/`)
before writing, per `AGENTS.md`:
- `channelId` **is** allowed on a `DATE` trigger input. ✅ (the whole rolling-window design in Phase 3 depends on this)
- `AndroidImportance` = `MIN | LOW | DEFAULT | HIGH | MAX`.
- `NotificationContentInput.subtitle` is **iOS-only**. Android gets **title + body**, full stop.
- There is **no large-icon API**. The eventual mascot icon lands as a monochrome small icon + an emoji in the title in the meantime.
- Plugin `icon` must be a **96×96 all-white PNG with transparency**; `color` tints it in the tray.

---

## Phase Overview

```
Phase 1 — Notification visibility fix (heads-up channels, requires a rebuild)
  New HIGH/LOW/HIGH channels (nudge/recap/bills), delete the immutable old
  'default' channel, unblock VIBRATE, sound on. Ships with the EXISTING
  generic copy — the fix is purely "it now actually pops up." No streak or
  copy-engine dependency. Also: fix AGENTS.md's stale Expo v52 pointer
  (trivial, zero-dependency, folded in here rather than left dangling).

Phase 2 — Streak foundation (pure, no UI)
  lib/streak.js + hooks/useStreak.js. Consecutive-days-with-a-transaction,
  computed from created_at in local time, plus today's income/expense
  totals. Nothing stored. Basis confirmed: transactions, not app-open/login.
  Full gamification design (freezes, richer milestones, display polish)
  explicitly DEFERRED — foundation only, pending the user's ideas.

Phase 3 — Koban's voice (copy engine + rolling scheduler)
  lib/koban.js tiered copy pools, streak-aware. Rewrite rescheduleAll from
  one repeating DAILY trigger into a rolling 30-day window of dated
  notifications, split into the Nudge/Recap lanes Phase 1 already built.
  This is "the notifications" being done, in the user's words.

Phase 4 — In-app streak display (added 2026-07-12, after Phase 2/3 shipped
  with no visible surface)
  A compact 30-day strip on Home (below the balance hero) + a full-page,
  Duolingo-style celebration on the day's first transaction, animated with
  react-native-reanimated (already a dependency, no new library). Reuses
  pickRecap for text — one voice, two surfaces. lib/streak.js's
  computeStreak gains a `history` field; no other data-layer change needed,
  exactly why Phase 2 was built the way it was.

Phase 5 — Mascot (illustrated icon) — LAST, deprioritized
  Blocked on user-supplied artwork ("i will come up with illustrations").
  No code work until art exists; when it does, it's one app.json plugin
  option + a rebuild. Not scheduled until the user brings the asset.

Phase 6 — Docs wrap-up
  00-index.md rollup once Phases 1-4 are actually built.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Architecture — the things that must change

### A. Channels come first now, not last
The original design put the channel migration in Phase 3, after the copy
engine, specifically to keep the copy-engine phase JS-only and rebuild-free.
That tradeoff no longer pays for itself — rebuilds are already routine — so
**Phase 1 does the channel work standalone**, shipping with the *existing*
generic copy. Phase 3 then writes the new escalating copy directly onto
channels that already exist, once.

### B. Two lanes, two channels (built in Phase 1, used by Phase 3)

| Lane | When | Channel ID | Importance | Job |
|---|---|---|---|---|
| **Nudge** | Nothing logged today | `flo.reminders.nudge` | **HIGH** — heads-up, sound | Get them into the app |
| **Recap** | Already logged today | `flo.reminders.recap` | **LOW** — silent, no banner | Reinforce the streak, close the loop |
| **Bills** | Bill due soon | `flo.bills.due` | **HIGH** — heads-up, sound | Actionable |

Streak **milestones** (day 7 / 30 / 100 — subject to revision once the user's
gamification ideas land) fire on the **HIGH** channel even when already
logged — a milestone earns the interrupt.

The Recap is deliberately silent. A notification that requires no action and
still interrupts you is how an app gets muted forever. Because it's a separate
channel, a user who doesn't want it can mute *just that one* from Android system
settings without losing the nudge — that's what channels are for, and it costs
zero settings UI.

> ⚠️ **Android notification channels are immutable after creation.** The existing
> `'default'` channel is already on-device at `DEFAULT` importance. Calling
> `setNotificationChannelAsync('default', { importance: HIGH })` is **silently
> ignored by Android** — the fix *must* ship **new channel IDs**, and delete the
> old one. Getting this wrong produces a change that appears correct in code and
> does nothing on the device.

### C. Scheduling: rolling window, not a repeating trigger (Phase 3)
Replace the single `DAILY` trigger with a **rolling 30-day window of
individually-dated (`DATE`) notifications**, each pre-baked with the copy for the
tier it would land in. `rescheduleAll()` is already
`cancelAllScheduledNotificationsAsync()`-based, so the window refreshes on every
app open and every data change.

**Tradeoff, accepted:** if the app isn't opened for 30 days, reminders run out.
Fine — at 30 days silent, the notification is not the problem.

**Corollary:** anything scheduled *outside* `rescheduleAll` gets silently wiped
on the next rebuild. All new notification types go inside it.

### D. Reschedule must react to transactions (Phase 3)
`useNotificationSync`'s reschedule effect currently depends on
`[bills, loading, settings]` (`lib/notifications.js:173-176`) — **a new
transaction reschedules nothing.** Add the `useDataRefresh` `version` counter.
Every transaction insert already calls `notifyChanged()`, so logging at 2pm swaps
tonight's 8pm notification from Nudge to Recap.

This is airtight rather than best-effort: **there is no path to create a
transaction without the app being open** (⊕ tab, Plan Detail, share-intent,
auto-detect, and `markBillPaid` all run in-app).

---

## Phase 1 — Notification Visibility Fix (requires a rebuild)

### Goal
Reminders stop hiding. A nudge drops down over whatever's on screen, with sound
and vibration. This ships with the **existing** generic copy
("Log today's spending?") — the fix here is purely visibility, decoupled from
streaks or Koban's voice, both of which land in later phases. The user can mute
each channel independently from Android system settings.

### Before Starting — Confirm With Codebase
1. **Fix `AGENTS.md` first** — it points at `https://docs.expo.dev/versions/v52.0.0/`
   but the project is on **SDK 54** (`expo@^54.0.35`, RN 0.81.5, New Architecture
   on). Trivial, zero-dependency, no reason to defer it to a terminal "docs"
   phase.
2. Re-read the SDK 54 channel docs — **do not work from memory** on
   `AndroidImportance` or `NotificationChannelInput`.
3. Confirm `ensureChannel()` (singular, `lib/notifications.js`) is currently
   only called from `requestPermission()` — i.e. lazily. This phase renames it
   to `ensureChannels()` (plural) and must also call it from `rescheduleAll()`,
   or a permission granted outside that path schedules against a channel that
   doesn't exist yet.
4. Confirm `app.json`'s `expo-notifications` plugin entry is still a bare string
   with no options, and that `VIBRATE` is still in `android.blockedPermissions`.
5. **This phase requires a new EAS/adb build.** `app.json` and channel changes
   are native — tell the user before starting, same as every prior native
   phase in this project.

### 1.1 Database
No database changes.

### 1.2 Data Layer

`ensureChannels()` replaces `ensureChannel()` in `lib/notifications.js`, called
from **both** `requestPermission()` and `rescheduleAll()`:

```js
const CHANNELS = {
  nudge: 'flo.reminders.nudge',   // AndroidImportance.HIGH, sound, lightColor #BBDC12, enableVibrate
  recap: 'flo.reminders.recap',   // AndroidImportance.LOW,  no sound
  bills: 'flo.bills.due',         // AndroidImportance.HIGH, sound, enableVibrate
};
await Notifications.deleteNotificationChannelAsync('default');  // the immutable old one
```

Also:
- `setNotificationHandler` → `shouldPlaySound: true`.
- The existing daily-reminder block and the bill-reminder block both move onto
  the new channel IDs (`flo.reminders.nudge` for the daily reminder — every slot
  is a "nudge" until Phase 3 adds the Recap-lane split; `flo.bills.due` for
  bills). Content gains `priority: AndroidNotificationPriority.HIGH`,
  `sound: true`, `color: '#BBDC12'`.
- Channel names are user-visible in Android settings: **"Daily nudge"**,
  **"Daily recap"** (created now, used starting Phase 3), **"Bill reminders"**.

**`app.json`**:
```jsonc
// android.blockedPermissions: REMOVE "android.permission.VIBRATE"
```
`VIBRATE` was blocked during an earlier security pass as unused bloat
(`04-...md` Phase 5 notes). It is now genuinely used — a heads-up with no buzz
reads as broken. **Record the reversal in `00-index.md`** so a future security
audit doesn't strip it again.

**No icon change this phase.** `app.json`'s `expo-notifications` plugin entry
stays a bare string — adding an `icon` option now would reference a file that
doesn't exist yet (Phase 4). Notifications render with the default app-icon
silhouette in the meantime; cosmetic, not blocking.

### 1.3 Components
No new components.

### 1.4 Navigation / Integration
No new routes. Same `data.route` payloads, same tap-routing, untouched.

### 1.5 Impact on Existing Features
| Area | Change | Watch for |
|---|---|---|
| `app.json` / native | `VIBRATE` unblocked | **Requires a new EAS/adb build.** Won't appear via JS reload |
| `lib/notifications.js` | `ensureChannel` → `ensureChannels`; existing content moves to new channel IDs | Old `'default'` channel deleted — users who muted it get a clean slate, unavoidable given channel immutability |
| Bill reminders | Move to `flo.bills.due` | Become heads-up too — an improvement, call it out |
| Daily reminder | Moves to `flo.reminders.nudge`; copy is **unchanged** this phase | Recap lane doesn't exist yet — every day is a nudge until Phase 3 |
| Security posture (`00-index.md`) | `VIBRATE` un-blocked | Must be recorded, or a future audit re-strips it |

### 1.6 What This Phase Does NOT Include
- No copy changes — still "Log today's spending?" verbatim. Phase 3's job.
- No streak awareness, no Nudge/Recap split in practice (channel exists, logic doesn't yet).
- No notification icon — Phase 4, blocked on user art.
- No settings UI changes.

### 1.7 Phase 1 Checklist — Before Marking Complete
- [x] `AGENTS.md` points at v54 docs, not v52.
- [x] Three channels created with the right importances; `'default'` deleted — `ensureChannels()` in `lib/notifications.js`.
- [x] `ensureChannels()` called from **both** `requestPermission()` and `rescheduleAll()`.
- [x] `app.json`: `VIBRATE` removed from `blockedPermissions` — confirmed via `npx expo prebuild --clean`, the regenerated `AndroidManifest.xml` now carries a plain `<uses-permission android:name="android.permission.VIBRATE"/>`, no longer stripped by `tools:node="remove"`.
- [x] `VIBRATE` reversal recorded in `00-index.md`'s security-audit table (the row that originally stripped it), not deferred to Phase 5.
- [x] `npx tsc --noEmit` passes; `npx expo export --platform android` bundles cleanly.
- [ ] **On-device:** the daily reminder **drops down over the screen**, with sound and vibration — not just into the shade.
- [x] **On-device: heads-up banner confirmed working** (user, 2026-07-12) — "phase 1 works".
- [ ] **On-device:** three separately-mutable channels ("Daily nudge", "Daily recap", "Bill reminders") appear under Android's app notification settings.
- [ ] Tapping still deep-links to Home.
- [x] Bundles cleanly — JS confirmed; native confirmed by the user's successful build/install.

**→ Phase 1 core is confirmed working on-device. Post-test fixes below.**

### Post-Phase-1 On-Device Testing Round (2026-07-12)

Heads-up notifications confirmed working. Two follow-up bugs reported and fixed.

#### 🐛 Bug 1 (fixed): the 1899 time-picker
The "Remind me at" display and the picker's initial value both used
`new Date(0, 0, 0, hour, minute)`. Year `0` → **1900**, and month/day `0` rolls
back to **31 Dec 1899**. India used *Madras Time* (**+5:21**) before 1906, not
modern IST (+5:30), so the tz database applies the historical offset to that
date. JS reads the hour/minute back correctly in-engine, but the **native
Android picker widget** re-converts the underlying UTC timestamp using the
*current* offset — landing ~9 minutes off, exactly matching the user's reported
"10-12 minutes ahead".

Reproduced directly (`TZ=Asia/Kolkata node`), not guessed. This was a display
bug on the way to becoming a *data* bug: a silently-shifted pre-fill saved a
wrong time if the user tapped OK without adjusting. Fixed with a `timeOnToday()`
helper that builds from today's date. Grepped — no other occurrence in the
codebase.

#### 🐛 Bug 2 (fixed): stale settings could silently wipe the entire schedule
**The likely cause of the user's "daily reminder never fires".** `rescheduleAll`
opens with `cancelAllScheduledNotificationsAsync()` and bails early if
`!settings.enabled`. It took `settings` as a **parameter**, and
`useNotificationSync` held a copy loaded **once at mount**, while
`app/settings.js` mutated and persisted its own separate copy.

Failure sequence: launch app with notifications off → turn them on and set a
time (Settings calls `rescheduleAll` with *fresh* settings; correctly scheduled)
→ **anything bumps the `useDataRefresh` version** — logging a transaction does,
and `06-transaction-auto-detect.md`'s GPay detection logs transactions
*automatically* — → `useNotificationSync`'s effect re-runs with its **stale
`enabled: false`** → cancels everything, schedules nothing. Silently. The user
was testing detection and the daily reminder in the same session, which is
exactly the sequence that triggers it.

**Fixed by removing the bug class, not patching the instance**: `rescheduleAll`
now reads settings from AsyncStorage *itself* (`rescheduleAll({ bills })` — the
`settings` param is gone). Every caller already persists before calling, so
storage is always current and a stale copy is now impossible to construct.
`useNotificationSync` holds no settings state at all anymore.

#### Not a bug: inexact alarms
`expo-notifications`' `ExpoSchedulingDelegate.setupAlarm()` uses
`AlarmManagerCompat.setExactAndAllowWhileIdle` **only if**
`alarmManager.canScheduleExactAlarms()`; otherwise it falls back to
`setAndAllowWhileIdle` (inexact). FLO deliberately does **not** hold
`SCHEDULE_EXACT_ALARM` (Google Play restricts it to alarm-clock/calendar apps),
so on Android 12+ reminders are **inexact and Android may defer them**,
especially with the screen off.

For a daily 8pm reminder, arriving at 8:04pm is fine — nobody notices. But it
makes *short-interval manual testing* ("set it 5 minutes out and wait")
unreliable, which is worth knowing before chasing a phantom bug. Use **Send test
notification** (a 3-second `TIME_INTERVAL`) to verify delivery instead. Also
verified from the native source that Expo's `DailyTrigger.nextTriggerDate()`
*does* fire the same day when the time is still ahead (it only rolls to tomorrow
if already past) — so "it always waits until tomorrow" was ruled out as a
hypothesis, not assumed away.

#### Diagnostics added (debug-only — remove before any store build)
Guessing at these bugs from the outside wasted a test cycle, so both are now
directly observable:
- **Settings → Notifications → "Show scheduled"** — lists what the OS
  *actually* has pending, with trigger times and channel IDs. Distinguishes a
  **scheduling** bug (not in the list) from a **delivery** bug (in the list but
  never arrives) — very different problems that look identical from the user's
  side.
- **Settings → Transaction Detection → "What FLO has seen"** — the native
  listener now records *every* allowlisted notification and the parser's verdict
  on it, **including ones that fail to parse** (`no-parse`) or get deduped. The
  normal queue drops those silently, so a wrong income/expense classification was
  previously invisible — this is what makes tuning `TransactionParser.kt` against
  *real* bank/UPI wording possible instead of guessing at text nobody has read.
  ⚠️ Persists raw notification content in SharedPreferences (capped at 15,
  clearable in-app). **Debug only — remove this, `NotificationPrefs.recordDebug`,
  and its Settings row before any store build.**

#### Still open: detection picks the wrong income/expense tab
Reported by the user; **root cause not yet known, and deliberately not guessed
at.** The JS prefill path was re-read and is correct
(`openAdd({ amount, type })` → `AddTransactionSheet.open()` sets `type` from the
payload), which points at `TransactionParser.kt` mis-classifying the direction —
but that can't be confirmed without seeing the *actual* GPay/bank notification
text, which nothing was recording. That's precisely what "What FLO has seen"
above now captures. **Next step: user triggers a transaction, reads that log,
and reports the raw title/text + the parser's verdict.**

### Post-Phase-1 Round 2: scheduled but never delivered — OEM battery killer, not a code bug (2026-07-12)

User report: **"Show scheduled" lists the daily reminder correctly, but it never
fires. Bills likely have the same problem."** Investigated by re-reading the
native scheduling source directly, not by guessing.

**Confirmed by code, not assumption**: both the daily reminder and bill
reminders schedule through the identical native path —
`Notifications.scheduleNotificationAsync()` → expo-notifications'
`ExpoSchedulingDelegate.setupAlarm()`
(`node_modules/expo-notifications/android/.../delegates/ExpoSchedulingDelegate.kt:105-119`):

```kotlin
private fun setupAlarm(triggerAtMillis: Long, operation: PendingIntent) {
  if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()) {
    AlarmManagerCompat.setExactAndAllowWhileIdle(...)
  } else {
    AlarmManagerCompat.setAndAllowWhileIdle(...)  // ← the only branch FLO ever hits
  }
}
```

FLO deliberately does not hold `SCHEDULE_EXACT_ALARM` (Google Play restricts it
to alarm-clock/calendar-category apps), so every local notification — daily
reminder **and** bill reminders, no exception — uses the **inexact** branch,
which Android is free to defer or drop entirely.

**The diagnostic signal that points at the specific cause**: the 3-second
"Send test notification" button fired correctly (confirmed when the user
reported the heads-up banner working), but an hours-out alarm never arrived at
all — not just late. Short-interval delivery working while longer-delay
delivery silently fails is the signature of an **OEM-level background-process
killer**, not inexact-alarm lateness alone: the user's phone (iQOO, OriginOS —
a Vivo sub-brand) is one of the more aggressive ones documented at
[dontkillmyapp.com/vivo](https://dontkillmyapp.com/vivo). These skins run their
own battery/process manager **on top of** stock Android Doze/App Standby, with
no public API — it can kill a correctly-scheduled `AlarmManager` alarm
regardless of what the Android API promised, unless the app is manually
whitelisted through the OEM's own settings.

**What was added — the one thing that's actually fixable from code**:
Settings → Notifications → **"Battery settings"** deep-links to
`android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS` (via React Native's
`Linking.sendIntent`, already used nowhere else in this codebase but a real,
documented RN API — verified against `node_modules/react-native/Libraries/Linking/Linking.js`
before using it). This opens Android's own battery-optimization list so the
user can set FLO to "Don't optimize."

Deliberately **not** implemented: `Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`
(the direct exemption *request* dialog) — that needs its own manifest
permission (`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`) which Google Play
scrutinizes with a declared-use review, comparable to the notification-listener
permission in `06-transaction-auto-detect.md`. The settings-list deep-link
needs no special permission at all — same "link to a system screen, nothing
new to declare" pattern as `openNotificationAccessSettings()`.

**What code cannot fix, recorded so it isn't re-investigated as a bug later**:
Vivo/iQOO's OriginOS layers a *separate*, proprietary background-process killer
with no public Android API — `IGNORE_BATTERY_OPTIMIZATION_SETTINGS` only
affects stock Android's Doze, not this second layer. There is no intent action
to deep-link directly into it (confirmed via research — this is exactly why
dontkillmyapp.com gives manual menu paths instead of a button). The user needs
to manually configure, wording varies by OriginOS version:
- **Settings → Battery → High background power consumption** → allow FLO
- **Settings → Apps (or More settings → Applications) → Autostart** → enable FLO
- Optionally: lock FLO in the Recents/task switcher (swipe up, tap the lock icon)

**Standing implication for this whole feature**: local scheduled notifications
on this class of device are inherently best-effort beyond a few seconds/minutes
out, **regardless of anything FLO's code does** — this isn't unique to the
daily reminder or bills, it would affect any future notification type the same
way. Worth remembering before spending more time chasing "why didn't it fire"
as if it were a FLO logic bug, once the two settings above are confirmed
configured.

**Not yet answered**: whether the 3-second test notification *reliably* fires
every time (confirming short-interval delivery is solid and this is purely a
long-delay/OEM-killer issue), or whether it was a one-off success. Worth the
user re-confirming once the battery settings above are configured, to see if
the daily reminder starts arriving.

---

## Phase 2 — Streak Foundation (pure, no UI)

### Goal
A correct, honest streak number exists and is queryable — consecutive calendar
days on which the user logged **at least one transaction** — along with today's
income/expense totals. Basis confirmed by the user: transactions, not app-open
or login. Nothing renders yet; this is the data Phase 3's copy needs. Delivered
as a pure function plus a hook, so an animated Home UI later needs zero
data-layer change.

**Scope discipline**: this phase builds the *foundation* — a correct count and
the day-0/day-N distinction below — not the full gamification layer (achievements,
weekly report, streak freezes, in-app display). The user shared their
gamification ideas on 2026-07-12 and chose to **build streaks first, then
reassess** — the design decisions from that discussion are recorded below so
they survive to whenever the gamification feature actually gets built, but
**none of them are in this phase's scope.**

---

### 🔒 Gamification Design Decisions (2026-07-12) — for the FUTURE feature doc, not this phase

These came out of a design discussion with the user and are recorded here so
they aren't re-litigated or silently reversed later. **Nothing below is built
in Phase 2 or Phase 3.** When the gamification/reporting feature is scoped, it
gets its own doc (likely `07-...`) and starts from these.

#### The governing principle: reward the logging, never the numbers

A streak rewards *logging every day* — the incentive points at the behaviour we
want. But any achievement tied to a spending **amount** points the wrong way: if
the user is one coffee away from losing a "stayed under budget" badge, the
cheapest way to keep it isn't to skip the coffee, it's to **not log the coffee**.
That corrupts their own ledger to protect a badge, and makes FLO actively worse
at its actual job.

**Therefore**: streaks and achievements reward **engagement**. Spending outcomes
get **reported**, honestly, with no reward attached. This single rule resolves
most of the design questions below — apply it to anything new.

#### Achievements — engagement-based only

All derivable from existing data; **no new tables** (compute-don't-store still
holds):

| Achievement | Data source |
|---|---|
| First transaction logged | `transactions` |
| 7 / 30 / 100-day streak | computed streak |
| Longest streak beaten | computed streak |
| Logged every day this week | computed streak |
| First budget / plan / bill created | existing tables |
| Bill paid on time | `bills.last_paid_date` vs `next_due_date` |

Deliberately **absent**: anything rewarding "spent less," "stayed under budget,"
or any other spending outcome — see the governing principle.

#### Weekly report — user chose: **notification + in-app screen**

A Sunday-evening notification as the hook, deep-linking into a proper weekly
report screen that holds the detail. Content is the user's own real data:

> **Your week: ₹4,200 out · ₹8,000 in · 12 entries**
> That's 18% below your 4-week average. Food was your biggest category at ₹1,600.

**History-sufficiency rule**: no "vs your average" comparison until there are
~4 weeks of data to compare against. Before that, the report states facts only —
it does **not** invent a baseline to sound clever.

#### ❌ REJECTED — "you spent 58% less than an average person"

The user originally proposed a comparison against an average person's spending.
**Dropped, by the user's own decision after discussion.** Recorded here with the
reasoning so it doesn't get reintroduced:

- **The data doesn't exist and never will.** FLO is single-user; there is no
  cohort, no benchmark, no population data anywhere in the schema. Any "average
  person" figure would be **invented and presented as a statistic** — in a
  *financial* app.
- **It poisons trust in every other number.** The moment the user thinks *"how
  would FLO even know that?"*, every real figure in the app becomes suspect. Bad
  trade for a moment of dopamine.
- **It backfires in both directions.** Told they spend *less* than average, a
  user reads it as permission to spend more; told they spend *more*, they get
  shamed by a number that was never real. Averages across income levels, cities
  and life stages are meaningless as a personal benchmark even when honest.
- **The honest version is strictly better**: compare the user to *themselves*
  (above). It's real, personal, and actionable.

If a benchmark is ever genuinely wanted, the only acceptable form is a
**published, citable external statistic** (e.g. RBI/NSO household expenditure
data), shown **explicitly labelled as an external figure** — never as a
personalised claim about the user. Even then: limited real value, high
misinterpretation risk.

---

### Before Starting — Confirm With Codebase
1. Read `lib/DataRefreshContext.js` — confirm `useDataRefresh()` returns
   `{ version, notifyChanged }`.
2. Read `hooks/useBills.js` — it is the canonical **global (non-account-scoped)**
   read hook. Confirm it depends on `session?.user?.id` rather than
   `activeAccountId`, and copy that dependency exactly. This matters: a hook with
   no `activeAccountId` dep has nothing to force a refetch once auth resolves, and
   will fetch pre-auth and return empty forever (the bug already fixed in
   `useCategories`/`useAllAccountSummaries` — standing rule in `00-index.md`).
3. Confirm `date-fns` exports `startOfDay`, `differenceInCalendarDays`, `subDays`
   (v4 is a dependency; `useBills` already uses the first two).
4. Confirm `transactions` has both `occurred_at` (date) and `created_at`
   (timestamptz) — the choice between them is the crux of this phase.

### 2.1 Database
**No database changes.** No `streaks` table, no counter column.

A streak is a derived number. Storing it would violate the app's core
compute-don't-store rule (`00-index.md`, `FEATURE_PLAN.md`) and would drift the
moment a transaction is deleted. It is computed on read from rows that already
exist.

### 2.2 Data Layer

```
lib/streak.js      ← Already written. One naming fix needed — see below.
hooks/useStreak.js ← NEW. Standard read-hook shape.
```

**`lib/streak.js`**

```js
computeStreak(rows, now) → {
  current,           // consecutive days logged, counting back from today (or
                     // yesterday if nothing yet today — at risk, not dead)
  longest,           // best run within the fetched window
  loggedToday,       // boolean — drives the Nudge/Recap lane split (Phase 3)
  daysSinceLastLog,  // 0 if logged today; Infinity if never logged
  isNewStreak,       // current === 1 && loggedToday — they started one TODAY
  isMilestone,       // loggedToday && current ∈ MILESTONES (7, 30, 100)
  todayTotals: { spent, earned, count },
}
```
`rows` = `[{ created_at, type, amount }]`. `now` is injected, never read from the
ambient clock — that's what makes it testable.

**Two decisions to hold the line on:**

- **`created_at`, not `occurred_at`.** `occurred_at` is user-editable and
  backdatable (`AddTransactionSheet` has a date picker, max = today). A 30-day
  streak could be "earned" by backfilling a month of receipts in one Sunday
  sitting. `created_at` measures *showing up*, which is the behaviour the streak
  exists to reward. **This must be stated in a code comment** — it looks like a
  bug to anyone who assumes the transaction date is the obvious field.
- **Local days, not UTC days.** `created_at` is `timestamptz` (stored UTC). At
  IST (+05:30), a transaction logged at 04:00 IST is 22:30 UTC *the previous
  day* — bucketing on the raw UTC date would silently break the streak for
  anyone who logs late at night or early in the morning. Bucket with `date-fns`
  `startOfDay(new Date(created_at))`, which resolves in the device's local zone.

**"Day 0" is the label for the very first streak-starting transaction — not
"Day 1."** This is a deliberate, user-specified convention, distinct from how
`current`/milestones are counted internally:

- `current === 0` — no streak at all (brand-new account, or a broken one). The
  nudge must say *"Start a streak"*, **never** *"don't break your streak."*
  Getting this wrong is the kind of bug that makes an app feel stupid.
- `isNewStreak` (`current === 1 && loggedToday`) — the account's very first
  transaction (or the first after a gap) just landed. **Displayed as "Day 0 —
  you've started a streak"**, not "Day 1." `current` itself still internally
  counts this as `1` (so tomorrow's continuation correctly reads `current ===
  2`, milestones stay simple integer comparisons, `longest` stays a normal
  count) — only the **display label** for this specific origin moment is
  "Day 0." This is a presentation-layer decision in `lib/koban.js` (Phase 3),
  not a change to `computeStreak`'s actual counting logic.
- The existing `isNewStreak` field name/semantics in `lib/streak.js` are
  correct as-is and need no code change — only the **copy that reads it**
  (Phase 3) needs updating from "Day 1" to "Day 0" framing. Flagging this now
  so Phase 3 doesn't reintroduce "Day 1" from the original write-up.

**`hooks/useStreak.js`** — one query, **global, not account-scoped** (a streak is
a habit, not a ledger view — the same reasoning that made `bills` global):

```js
const since = format(subDays(new Date(), 90), 'yyyy-MM-dd');
const { data } = await supabase
  .from('transactions')
  .select('created_at, type, amount')
  .gte('created_at', since)
  .order('created_at', { ascending: false });
```

Returns `{ ...computeStreak(rows, new Date()), loading, refetch }`. Depends on
`version` (per the standard hook pattern) **and** `session?.user?.id` (per the
`useBills` precedent in step 2 above).

90 days is enough to compute any streak worth showing and keeps the payload
small. A streak longer than 90 days will read as capped at 90 — an acceptable v1
limit, noted here so it isn't discovered as a bug later.

### 2.3 Components
None. No UI in this phase.

### 2.4 Navigation / Integration
None. Nothing imports `useStreak` yet — Phase 3 does.

### 2.5 Impact on Existing Features
| Area | Change | Watch for |
|---|---|---|
| Everything | None — two files, nothing imports them yet | Genuinely isolated |

### 2.6 What This Phase Does NOT Include
- No UI anywhere. No Home streak display, no animation (explicitly deferred by
  the user — *"streaks actually need a lot of research"*).
- No notification changes (Phase 3).
- No `streaks` table, no stored counter, no longest-ever persistence beyond the
  90-day window.
- **No gamification mechanics beyond the basic count** — no freezes, no repair,
  no leaderboards, no milestone tuning beyond the placeholder 7/30/100. The
  user is bringing their own design for this next; don't build ahead of it.

### 2.7 Phase 2 Checklist — Before Marking Complete
- [x] `lib/streak.js` exports `computeStreak(rows, now)` — pure, no React/Supabase imports.
- [x] Streak counts from `created_at`, bucketed to **local** days; a code comment states why not `occurred_at`.
- [x] `current === 0` when nothing logged in the window; `isNewStreak` true only on `current === 1 && loggedToday`.
- [x] Streak is *at risk*, not dead, when nothing is logged yet today (counts back from yesterday).
- [x] `todayTotals` returns `{ spent, earned, count }` — both directions, not just spend.
- [x] `hooks/useStreak.js` depends on **both** `version` and `session?.user?.id`; returns data after auth resolves (not an empty pre-auth fetch).
- [x] Verified with a throwaway `node` script — **39 assertions across 10 scenarios, all passing**: empty / today-only (Day-0 origin) / unbroken 7-day run + milestone / at-risk (yesterday, not today) / broken gap / milestone-only-fires-when-logged-today / late-night local-day boundary / **backdated `occurred_at` does not inflate the streak** / string amounts (Postgres `numeric` arrives as string) / multiple same-day entries don't double-count.
- [x] **Also ran the suite under `TZ=America/New_York` (DST), `TZ=UTC`, and `TZ=Pacific/Chatham` (+12:45)** — all 39 pass in each. Confirms the day-stepping loop's fixed 86,400,000 ms decrements are DST-safe *because* `dayKey` normalises through `startOfDay` before comparing; that safety was assumed in the original design and is now actually verified, not just asserted.
- [x] `npx tsc --noEmit` passes; `npx expo export --platform android` bundles cleanly.

**→ Stop here. Show the result and wait for approval.**

### Implementation Notes

- **`lib/streak.js` needed no logic changes** — it was written before the
  Day-0 decision and its logic was already correct. Only its comment was
  updated, to record that `isNewStreak` is *displayed* as "Day 0" while
  `current` still counts it as `1` internally (so tomorrow reads 2, milestones
  stay plain integer comparisons, and `longest` stays a normal count). The
  relabeling lives in the copy layer (`lib/koban.js`, Phase 3), not in the
  computation.
- **`hooks/useStreak.js` follows `useBills`'s global-hook shape exactly** —
  depends on `session?.user?.id` (not `activeAccountId`), because a streak is a
  habit, not a ledger view: logging into *any* account is still showing up. This
  dependency is load-bearing, not stylistic — a global hook with no
  `activeAccountId` dep has nothing to force a refetch once auth resolves, so it
  would fetch pre-auth, get an empty result, and never revisit it. That exact bug
  has been fixed twice in this codebase already (`useCategories`,
  `useAllAccountSummaries` — the standing rule in `00-index.md`).
- **Spread-return shape** (`{ ...streak, loading, refetch }`) so callers read
  `streak.current` / `streak.loggedToday` directly rather than
  `streak.streak.current`.
- **Nothing imports it yet** — Phase 3 does. Genuinely isolated; this phase
  cannot have broken anything.
- **Verification note**: the DST/odd-offset timezone runs weren't in the plan's
  checklist — added because the day-stepping loop subtracts a *fixed* 24-hour
  millisecond value, which is exactly the shape of code that breaks across a DST
  boundary. It turned out to be safe (`startOfDay` normalises before every
  comparison), but that was worth proving rather than assuming, especially since
  the app may not stay India-only forever.

---

## Phase 3 — Koban's Voice (copy engine + rolling scheduler)

### Goal
The daily reminder becomes Koban. Copy varies day to day, escalates the longer
the user stays away, marks the first-ever transaction as "Day 0," and —
when they've already logged — switches to the silent Recap channel (already
built in Phase 1) carrying both spend and income. This is where the repeating
`DAILY` trigger dies and the rolling window is born, and where — in the user's
words — **"the notifications" are done**.

### Before Starting — Confirm Phases 1–2 Are Approved
1. Re-read `lib/notifications.js` in full — `rescheduleAll`, `useNotificationSync`,
   and above all the Expo Go `require()` guard. **Every new export must keep the
   `if (!Notifications) return` no-op pattern** or the app crashes at boot in
   Expo Go, on every route.
2. Confirm Phase 1's `CHANNELS` map (`flo.reminders.nudge` / `flo.reminders.recap`
   / `flo.bills.due`) is live and `ensureChannels()` exists — this phase writes
   onto those channel IDs directly; no migration needed since Phase 1 already did it.
3. Confirm `app/settings.js`'s daily-reminder toggle + time picker still write
   `{ enabled, hour, minute }` to `flo.notif.dailyReminder`. **No settings UI
   changes this phase** — the same toggle now yields much better notifications.
4. Re-read Phase 2's "Day 0" note above — do not reintroduce "Day 1" copy for
   the streak-start case.

### 3.1 Database
No database changes.

### 3.2 Data Layer

```
lib/koban.js           ← NEW. Copy pools + selectors. Pure.
lib/notifications.js   ← Rewrite rescheduleAll; add streak/version deps to useNotificationSync.
```

**`lib/koban.js`**

```js
pickNudge({ streak, daysSinceLastLog, dayIndex })          → { title, body }
pickRecap({ streak, isNewStreak, isMilestone, todayTotals }) → { title, body }
```

Random pick **within tier**, seeded by `dayIndex` so consecutive days inside one
scheduled window never repeat the same line back-to-back. ~5 lines per tier.

| State | Koban | Sample |
|---|---|---|
| **No streak** (`current === 0`) | Inviting | **"Start a streak"** — One entry today and Koban's paw goes up. |
| **Streak at risk** (`current > 0`, nothing today) | Smug | **"Day 6. Don't break it now."** — One entry keeps it alive. |
| 1 day silent | Curious | **"Anything happen today?"** — Koban's ledger has a suspicious blank spot where today should be. |
| 2–3 days | Paw drooping | **"2 days off the books"** — This is exactly how ₹2,000 disappears without a trace. |
| 4–6 days | Concerned | **"Your budgets are guessing"** — 5 days, zero entries. FLO is just decoration right now. |
| 7+ days | 😿 | **"The lucky cat is not feeling lucky"** — A week in the dark. Want to see the damage? |
| **Recap** — started today (`isNewStreak`) | Delighted | **"🐱 Day 0. Paw's up."** — ₹840 out, ₹0 in. You've started a streak. |
| **Recap** — ongoing | Content | **"🐱 Day 7 locked in"** — ₹840 out · ₹2,000 in, 3 entries. |
| **Recap** — milestone | Triumphant | **"30 days. Koban is impressed."** — ₹840 out · ₹2,000 in today. |

**"Day 0" is a display-only relabeling of `isNewStreak`** (see Phase 2) — the
underlying `current` value is still `1` internally; only this row's copy says
"Day 0" instead of "Day 1." Tomorrow, if the streak continues, `current === 2`
reads naturally as "Day 1" if a running "Day N-1" display convention is wanted
later — **not decided yet**, out of scope until the user's gamification ideas
land. For now, only the origin moment gets the special "Day 0" copy; every
other tier displays `current` as a literal day count (Day 6, Day 7, Day 30).

**The recap carries both sides — spend *and* income.** A spend-only summary reads
like a scolding; the pair reads like a ledger, which is what FLO is.

**Voice rules** (this app's existing copy is terse and has no exclamation marks —
Koban is warmer but must not become a different app): sentence case, at most one
emoji and only in the title, never more than ~12 words in a title, never shame
the user for *spending* — only for not *knowing*. Koban is a bookkeeper who
misses you, not a scold.

Money formats with the standard `₹${Math.round(n).toLocaleString('en-IN')}`
helper. It is currently duplicated across `lib/alerts.js`, `lib/notifications.js`
and `hooks/useAlerts.js` — **hoist it to one exported helper** while we're in
here rather than adding a fourth copy.

**`rescheduleAll({ bills, settings, streak })` rewrite.** Bill reminders:
unchanged (already on `flo.bills.due` since Phase 1). The daily reminder becomes:

- Loop `i = 0..29`, each day at the user's `{ hour, minute }` (default 20:00).
- Skip any fire time already in the past (matters only for `i === 0`).
- **`i === 0` and `streak.loggedToday`** → **Recap** content, `flo.reminders.recap`
  channel (or the HIGH nudge channel when `isMilestone` — a milestone earns the
  interrupt).
- **Otherwise** → **Nudge** content on `flo.reminders.nudge`, tier selected by
  the *projected* silence `daysSinceLastLog + i`, and the projected streak
  (which is `streak.current` today, and `0` for every `i >= 1` where they'd
  have broken it).
- All carry `data: { route: '/' }` — unchanged, and already verified correct
  (`/(tabs)` is a route *group*; its parens are stripped from the URL).

**`useNotificationSync`** — add `useStreak()` and `version` to the reschedule
effect's deps (Architecture D). Guard on `streak.loading` the same way the
existing code guards on `bills` `loading`, or the first schedule pass will run
against a zeroed streak and bake the wrong copy.

### 3.3 Components
No new components. No settings UI changes.

### 3.4 Navigation / Integration
None. Same `data.route` payloads, same tap-routing, untouched.

### 3.5 Impact on Existing Features
| Area | Change | Watch for |
|---|---|---|
| `lib/notifications.js` | `rescheduleAll` signature gains `streak`; daily block rewritten | Bill reminders must keep working — they share the cancel-all rebuild |
| `useNotificationSync` | Now also mounts `useStreak()` | It's mounted at app root; the extra query runs once per data change, not per render |
| Scheduled-notification count | 1 daily → up to 30 dated + N bills | Well within Android's limits; iOS's 64-pending cap would matter, but this app is Android-only in practice |
| `lib/alerts.js`, `hooks/useAlerts.js` | Import the hoisted money helper | Pure refactor — no behaviour change |

### 3.6 What This Phase Does NOT Include
- No channel changes — Phase 1 already built them.
- No notification icon (Phase 4, blocked on user art).
- No settings toggle for the recap lane. The Android per-channel mute (built
  Phase 1) is the escape hatch; revisit only if it proves insufficient.
- No in-app streak UI.
- No gamification beyond the basic escalation ladder — same deferral as Phase 2.

### 3.7 Phase 3 Checklist — Before Marking Complete
- [x] `lib/koban.js` exports `pickNudge` / `pickRecap`; 5 lines per tier; no tier can produce "don't break your streak" when `current === 0` — **and, caught during implementation, `never_started` (`daysSinceLastLog === Infinity`) is now its own tier, separate from `silent_7_plus`**, so a brand-new user never sees "the lucky cat is not feeling lucky" guilt-copy meant for someone who *stopped*, not someone who never began.
- [x] The `isNewStreak` recap says **"Day 0,"** not "Day 1" — verified.
- [x] `rescheduleAll` schedules a rolling 30-day window of `DATE` triggers onto Phase 1's channels; the repeating `DAILY` trigger is gone.
- [x] Logged today → today's slot is a **Recap** with both spend and income; not logged → a **Nudge**.
- [x] Copy escalates with projected silence across the window (day+1 ≠ day+7 tier) — verified.
- [x] Adding a transaction reschedules (the `version` dep, added explicitly to `useNotificationSync` rather than relied on indirectly — see Implementation Notes) and flips today's slot to Recap.
- [x] Bill reminders still schedule correctly alongside the window — unchanged code path.
- [x] Expo Go guard intact — no top-level `expo-notifications` import; new imports (`useAuth`, `useDataRefresh`, `fetchStreak`) are all pure-JS/React, no native side effects.
- [x] Money helper hoisted to `lib/money.js`; `lib/alerts.js`, `hooks/useAlerts.js`, `lib/notifications.js` all import it — no fourth copy added.
- [x] **Verified with a throwaway `node` script — 25 assertions across 11 scenarios, all passing.** Required extracting the projection logic into a pure `buildReminderPlan()` (see Implementation Notes) since the original design embedded it directly inside `rescheduleAll`, which depends on the native `Notifications` module and can't run in plain Node — the doc's own checklist item was unsatisfiable without this refactor.
- [x] `npx tsc --noEmit` passes; `npx expo export --platform android` bundles cleanly (3973 modules).
- [ ] Bundles cleanly natively — no Android SDK in this environment; needs your build, same boundary as every other native-adjacent phase.

**→ Stop here. Show the result and wait for approval.**

### Implementation Notes

- **A real design bug caught and fixed before it shipped — the projection
  model.** The original plan's rolling-window pseudocode said: *"the projected
  streak... is `streak.current` today, and `0` for every `i >= 1`."* Taken
  literally, this discards a real, strong streak's "at risk" messaging the very
  next day: someone on day 15 who logs today would have *tomorrow's*
  notification (`i=1`) immediately drop to generic "Day 1 silent, curious"
  copy, never mentioning the 15 days they'd actually be risking. Replaced with
  the **"first silent day"** model: only the single projected day immediately
  following a real logged day carries that streak's actual count; every day
  beyond that resets to 0, since the streak would already be broken by then.
  Verified directly by test 3 in the throwaway script (a 15-day streak's count
  correctly appears in tomorrow's slot, and is gone by the day after).
- **A second, related gap found while deriving the projection model**:
  empirically confirmed (`node` repro under `TZ=Asia/Kolkata`, see the
  finding) that `daysSinceLastLog === 1` *always* implies `current >= 1` —
  the streak-counting loop's very first check, when nothing is logged today,
  **is** yesterday, the same cell `daysSinceLastLog` measures from. This means
  the original copy table's "1 day silent" tier (implicitly `current === 0`)
  can never actually be reached for a same-day Nudge — whenever there's
  exactly one silent day, there is structurally always a streak (even a
  1-day one) at risk. `nudgeTier()` now checks `current > 0` **first**, ahead
  of any `daysSinceLastLog`-keyed tier, so "streak at risk" always wins where
  it should. The `silent_1` pool is kept (harmless, costs nothing) as a
  defensive fallback in case this invariant ever changes, documented as such
  in `lib/koban.js` rather than silently removed.
- **Extracted `buildReminderPlan()` into `lib/koban.js`**, pure, no
  Notifications/Supabase import — not in the original plan, but necessary: the
  projection logic was originally going to live directly inside
  `rescheduleAll`, which depends on the native `expo-notifications` module and
  therefore cannot run in a plain `node` script. The doc's own Phase 3
  checklist requires verifying "the tier ladder + lane swap" with a throwaway
  script — that was impossible without this extraction. `rescheduleAll` is
  also simpler as a result: it just iterates the plan and calls
  `scheduleNotificationAsync`, no branching logic of its own.
- **`rescheduleAll`'s signature changed again**, on top of the earlier
  stale-settings fix: it now takes `{ bills, userId }`, not `{ bills,
  settings, streak }` as the original (pre-stale-settings-bug) pseudocode in
  this doc specified. Settings are read from AsyncStorage internally
  (unchanged from the earlier fix); **streak is now fetched fresh internally
  too**, via a new `fetchStreak(userId)` extracted from `hooks/useStreak.js` —
  same reasoning as the settings fix: a scheduler that trusts a passed-in
  streak snapshot instead of reading live state will eventually schedule
  against data that's no longer true. `userId` is the one thing that
  genuinely must come from the caller (there's no "storage" for auth state to
  read); both call sites (`useNotificationSync`, `app/settings.js`'s `sync()`)
  already had `session` in scope.
- **`version` added explicitly to `useNotificationSync`'s effect deps**, per
  Architecture D, rather than relying on `useBills()`'s array reference
  changing on every refetch (which it does today, incidentally — but that's
  an implementation detail of `useBills`, not a contract, and a future
  memoization of that hook could silently break an implicit dependency on it).
  An explicit dependency on the actual signal is more robust than one that
  happens to work today.
- **`pickRecap` seeds its within-tier random pick from days-since-epoch**, not
  a caller-supplied `dayIndex` the way `pickNudge` does — a Recap only ever
  schedules for *today's* single slot (there's no "window position" to seed
  from), so a fixed seed would otherwise always pick the same line, defeating
  the point of having multiple lines at all.
- No other deviations from the plan.

---

## Phase 4 — In-App Streak Display

> **Added 2026-07-12, after Phase 2/3 shipped with no visible surface.** The
> user tested by creating an account and logging a transaction, expecting to
> *see* something, and found nothing — a legitimate gap: `useStreak()` was
> (and until this phase, remains) rendered nowhere in `app/` or `components/`.
> This phase is the "Animated Home streak UI" both `05-koban-engagement.md`'s
> and `FEATURE_PLAN.md`-adjacent docs previously listed as explicitly
> deferred (*"streaks actually need a lot of research"*) — now unblocked by
> the user's direct request, with Duolingo named as the reference point.

### Goal
Two pieces, both reading `useStreak()` — the data layer needed **zero**
changes for this, exactly as Phase 2 was designed to allow:

1. **A compact strip on Home**, near the top (below the balance hero card) —
   current streak number + a horizontally-scrollable 30-day history (filled
   cell = logged that day, empty = not), always visible, no interaction
   required to see it.
2. **A full-page celebration**, Duolingo-style — fires the moment the user's
   *first* transaction of the day is saved (whichever entry point: ⊕ tab,
   share-intent, auto-detect, `markBillPaid`), showing "Day 0 — you started a
   streak" / "Day N — streak continues" with an animated calendar reveal (the
   trailing up-to-7 days checking off in sequence), then dismisses back into
   the app.

### Before Starting — Confirm With Codebase
1. Re-read `components/DueBillsModal.js` in full — it's the closest existing
   pattern for "a root-mounted component that reactively watches a hook and
   shows itself at most once per day," including the exact AsyncStorage
   gating shape (`flo.dueBills.lastShown`, a `yyyy-MM-dd` string, shown only
   if stored date < today). This phase's celebration trigger copies that
   pattern under a new key, not a new mechanism.
2. Confirm `react-native-reanimated` (`~4.1.1`) is already a dependency — no
   new animation library needed. No Lottie, no new deps.
3. Re-read `lib/koban.js`'s `pickRecap` — the celebration reuses it for
   title/body text (same voice, same tier logic: `isNewStreak`/`isMilestone`/
   ongoing), rather than writing a second, parallel copy pool. The visual
   calendar-reveal is the new part; the words aren't.
4. Confirm `app/(tabs)/index.js`'s current top section (header → hero balance
   card → chart) — the strip inserts between the hero card and the chart.

### 4.1 Database
No database changes. Everything here reads `useStreak()`, already computed
from `transactions.created_at` — no new fields, no stored celebration state
beyond a single AsyncStorage "last celebrated" date (device-local, same class
as `flo.dueBills.lastShown` and the notification-settings keys — not
synced, not in Postgres).

### 4.2 Data Layer

```
lib/streak.js   ← EXTEND. computeStreak gains a `history` field.
```

`computeStreak`'s return gains:
```js
history: [{ date: 'yyyy-MM-dd', logged: boolean }]  // oldest → newest, last 30 calendar days including today
```
Built from the same `days` Set the function already computes internally — no
new query, no new hook. `hooks/useStreak.js` needs **no changes**; its spread
return (`{ ...streak, loading, refetch }`) already carries `history` through
once `computeStreak` returns it.

**Trigger logic for the celebration — reactive, not called from each
save site.** Watch `useStreak()`'s `loggedToday` at the app root, the same way
`DueBillsModal` watches `useBills()`. This is deliberate: `AddTransactionSheet`,
share-intent, auto-detect's `DetectedTransactionHandler`, and `markBillPaid`
are four different call sites that can create the day's first transaction —
duplicating "check and celebrate" logic into all four would be the wrong
place to put it. A single reactive watcher fires regardless of which path
created the transaction, and doesn't care that there are four.

### 4.3 Components

```
components/
  StreakCalendar.js     ← NEW. Compact Home strip.
  StreakCelebration.js  ← NEW. Root-mounted, full-page, reactive.
```

**`StreakCalendar`** — plain functional component, `useStreak()` internally,
no props. Current streak number/label at the top (reuses the existing
Card/Home visual language — no new styling system), then a horizontally
scrollable row of 30 small cells from `history`, today's cell visually
distinct (border or the brand lime fill) from past logged/unlogged cells.
Read-only — no tap interaction in v1 (a cell showing its date on tap is a
reasonable v2, not required now).

**`StreakCelebration`** — mirrors `DueBillsModal`'s shape exactly:
- `useAuth()` for `session` (guard: only act when signed in).
- `useStreak()` for `loggedToday`/`current`/`isNewStreak`/`isMilestone`/`todayTotals`.
- AsyncStorage key `flo.streak.lastCelebrated` (`yyyy-MM-dd`) — on `loggedToday`
  becoming `true`, check the stored date; if it's not today, show the
  celebration and write today's date. This is what stops it from re-firing on
  the 2nd, 3rd, ... transaction logged the same day, and from replaying every
  time the app reopens after already being shown once today.
- Full-screen `Modal` (not a centered card like `DueBillsModal` — this one
  should feel like an event, not a prompt). Content: title/body from
  `pickRecap()` (same function Phase 3's notification already calls — one
  voice, two surfaces), and an animated reveal of the trailing
  `Math.min(streak.current, 7)` days from `history`, each cell entrance
  staggered via `react-native-reanimated`'s built-in entrance animations
  (`FadeIn`/`ZoomIn` with per-index `.delay(i * N)` — no custom Lottie
  asset, no new dependency). A single dismiss button ("Nice!" / "Continue").

### 4.4 Navigation / Integration
- `app/_layout.js`: mount `<StreakCelebration />` as a sibling near
  `<DueBillsModal />` — same provider-nest placement reasoning (needs
  `useAddTransactionSheet`-adjacent context depth for consistency, though it
  doesn't itself open a sheet).
- `app/(tabs)/index.js`: insert `<StreakCalendar />` between the hero balance
  `Card` and the `IncomeExpenseChart` `Card`.

### 4.5 Impact on Existing Features
| Area | Change | Watch for |
|---|---|---|
| `lib/streak.js` | `computeStreak` return gains `history` | Pure addition — existing fields (`current`, `loggedToday`, etc.) unchanged, so nothing that already reads the old shape breaks |
| `app/(tabs)/index.js` | New section between hero and chart | Layout/spacing only — no existing section moves or changes behavior |
| `app/_layout.js` | One more root-mounted sibling | Must guard on `session`, same as `DueBillsModal` |

### 4.6 What This Phase Does NOT Include
- No tap-to-see-date on calendar cells (v2 if wanted).
- No celebration for the Nudge lane (not logged today) — celebrations are
  exclusively a `loggedToday`-side thing, matching the governing principle:
  reward the logging, not remind-and-celebrate in the same breath.
- No settings toggle to disable the celebration. Revisit only if it proves
  annoying in practice — the once-per-day gate already prevents the obvious
  annoyance (repeated pop-ups per transaction).
- No sound effects — Reanimated handles visual entrance only; no audio
  library is a dependency of this app.

### 4.7 Phase 4 Checklist — Before Marking Complete
- [x] `computeStreak` returns `history`; verified with a throwaway `node` script — 9 assertions: 30 entries, oldest→newest, today last, gaps correctly marked false, late-night local-day boundary handled, `occurred_at` doesn't leak into it (only 1 day marked despite a backdated claim of 20).
- [x] `StreakCalendar` renders on Home between the hero card and the chart; 30 cells (horizontally scrollable), today visually distinct (bordered).
- [x] `StreakCelebration` reactively watches `loggedToday` (not a one-shot mount check like `DueBillsModal` — see Implementation Notes for why), so it fires from **any** entry point that creates the day's first transaction, without needing to duplicate trigger logic at each call site.
- [x] AsyncStorage `flo.streak.lastCelebrated` gate — logging a 2nd/3rd transaction the same day does **not** re-trigger it; reopening later the same day does **not** replay it.
- [x] Copy sourced from `pickRecap` — Day 0 for a new streak, milestone copy at 7/30/100, ordinary otherwise. Same function Phase 3's notification already calls — one voice, two surfaces, not a second copy pool.
- [x] Guarded on `session` — signed-out state never triggers it.
- [x] `npx tsc --noEmit` passes; `npx expo export --platform android` bundles cleanly (3975 modules).
- [ ] **On-device** — no Android SDK in this environment; the animation timing, the full trigger-from-every-entry-point claim, and the visual result all need your device.

**→ Stop here. Show the result and wait for approval.**

### Implementation Notes

- **Deliberately more reactive than `DueBillsModal`'s pattern, despite
  copying its shape.** `DueBillsModal` gates its whole check behind a
  `checkedRef` that only ever runs once per mount — correct for bills, whose
  due-ness doesn't change *within* a session. Streak state does: logging the
  day's first transaction happens *while the app is open*, flipping
  `loggedToday` false→true mid-session. Using a one-shot ref here would mean
  the celebration only ever fires on a fresh cold start, never right after
  the triggering save. So the effect depends directly on `loggedToday`
  instead, and the AsyncStorage date check is what does the "don't repeat"
  job the ref was doing for `DueBillsModal`.
- **Content is snapshotted at trigger time** (`contentRef.current`), not
  re-read from `useStreak()` on every render while the modal is visible — if
  another transaction landed while the celebration was still animating in
  (unlikely but possible — auto-detect could theoretically queue a second
  save moments later), the modal should keep describing whatever actually
  triggered it, not silently mutate mid-animation.
- **Reused `pickRecap` as-is**, no new copy pool — the celebration and
  tonight's Recap notification (if the recap channel is what's showing rather
  than a milestone escaping to the loud channel) now say the *same thing*, by
  construction, not by keeping two pools in sync by hand.
- **`Flame` (lucide) used for the streak icon, not a cat/paw glyph or
  emoji.** No mascot artwork exists yet (Phase 5, blocked on user art), and
  the app's own convention is lucide-only icons in rendered UI (emoji is used
  in Koban's *notification* text only, a different surface with a different
  convention). Flame is also the universally-recognized streak symbol
  (Duolingo, Snapchat, etc.) — swapping it for a Koban-branded icon once
  Phase 5 art exists is a one-line change, not a redesign.
- **`react-native-reanimated`'s built-in entrance animations** (`ZoomIn`,
  `FadeInDown`, chained `.delay()`/`.duration()`) — already a dependency, no
  Lottie, no new library. The calendar cells stagger in via
  `ZoomIn.delay(400 + i * 120)`, giving the "checking off in sequence" effect
  the user asked for (Duolingo reference) without custom animation code.
- No other deviations from the plan.

---

## Phase 5 — Mascot (illustrated icon) — LAST, deprioritized

### Goal
The status bar wears Koban's actual face instead of a monochrome placeholder or
the default app icon. **Not scheduled** — the user is producing the illustration
work separately (*"i will come up with illustrations"*), and this phase doesn't
start until that art exists.

### What's needed, whenever art arrives
- `assets/notification-icon.png` — **96×96, all-white PNG with transparency**
  (Android masks the icon to a silhouette and discards all colour, so a
  coloured or photographic icon renders as a white blob — the same failure
  mode Phase 1 deliberately deferred rather than ship broken).
- One `app.json` change:
  ```jsonc
  ["expo-notifications", {
    "icon": "./assets/notification-icon.png",
    "color": "#BBDC12"
  }]
  ```
- One rebuild.

That's the entire phase. No other code changes — Phases 1–3 are built so this
slots in without touching scheduling, channels, or copy.

**Not possible, recorded so it isn't re-litigated later:** a full-screen
takeover (like an incoming call). Android 14 restricted `USE_FULL_SCREEN_INTENT`
to alarm and calling apps. The heads-up banner (already built, Phase 1) is the
ceiling — and it's what Instagram actually uses for the case the user
originally described.

### Phase 5 Checklist — Before Marking Complete
- [ ] `assets/notification-icon.png` present — 96×96, all-white, transparent.
- [ ] `app.json` plugin updated with `icon` + `color`.
- [ ] **On-device:** the status-bar icon is Koban's silhouette, not a white blob or the default app icon.
- [ ] Bundles cleanly.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 6 — Docs Wrap-Up

Once Phases 1–4 are built and approved:
- Update `00-index.md`: add this feature to the Feature Files table; add
  `useStreak`/`lib/streak.js`/`lib/koban.js` to Shared Infrastructure Notes;
  confirm the **`VIBRATE` un-block** (Phase 1) and the notification-channel
  immutability lesson are both recorded as standing rules.

---

## Data Model Summary (Final State After All Phases)

```
NO SCHEMA CHANGES. Zero database footprint.

transactions (unchanged)
  └─ created_at  ← the streak is computed from this, bucketed to LOCAL days
                   (never occurred_at — that's backdatable)

Computed / derived (nothing stored):
  streak + today's totals → useStreak() over the last 90 days of transactions
  notification copy       → lib/koban.js, chosen at schedule time
  scheduled notifications → device OS (rolling 30-day window) + AsyncStorage prefs
```

No new tables, columns, or views. A streak is a derived number; storing it would
violate the compute-don't-store rule and drift the moment a transaction is
deleted.

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| Daily reminder | Visibility fixed first (Phase 1); fully rewritten with varied, escalating, streak-aware, two-lane copy after (Phase 3) | Phase 1, then Phase 3 |
| Bill reminders | Behaviour unchanged; moves to a HIGH channel (now heads-up) | Phase 1 |
| `lib/alerts.js`, `hooks/useAlerts.js` | Import the hoisted money helper | Phase 3 (pure refactor) |
| `app.json` / native | Plugin/channel changes + `VIBRATE` (Phase 1); icon option (Phase 4, later) | Phase 1 — **needs a new EAS/adb build**; Phase 4 needs another, whenever art lands |
| `app/settings.js` | **None.** The same toggle now yields much better notifications | — |
| Security posture | `VIBRATE` deliberately un-blocked | Phase 5 — confirm it's recorded |
| `AGENTS.md` | v52 → v54 docs pointer fixed | Phase 1 |

---

## Out of Scope (All Phases)

- **Full gamification design** (streak freezes/repair, richer milestone
  tuning, leaderboards, a running "Day N-1" display convention beyond the
  single Day-0 origin case) — **explicitly deferred, the user's own call**:
  *"i will tell you my ideas for streaks and gamification once the
  notifications is done."* Phases 2–3 build the honest foundation only.
- ~~Animated Home streak UI~~ — **no longer deferred; built as Phase 4**,
  2026-07-12, after the user tested Phases 2–3 and found no visible surface at
  all. Needed **zero** data-layer change beyond one additive field
  (`history`) on `computeStreak` — exactly why Phase 2 was built the way it
  was.
- **An in-app "yesterday you spent ₹X" banner** — considered and **rejected**.
  Home already renders the balance hero, the income/expense chart, and recent
  transactions; a yesterday-specific card is a narrow slice of data already
  visible on the same screen, with no action attached — a thing to dismiss, not a
  thing to read. The end-of-day summary belongs in the Recap notification, where
  it reaches someone who *isn't* looking at the app. The in-app reinforcement slot
  should go to the streak display instead.
- **Bank-notification auto-detect** — built separately, already shipped
  (`06-transaction-auto-detect.md`, go/no-go passed). Not this doc.
- **A `streaks` table / stored counter** — violates compute-don't-store.
- **Custom notification sound** — system default is fine.
- **Remote push** — unchanged from `04-...md`: FLO has no server-side event source.
- **iOS** — the app is Android-only in practice (share-intent and auto-detect
  already are; this feature's notification/channel work is Android-specific too).
- **Streaks longer than 90 days** — the query window caps it. Acceptable v1 limit.
