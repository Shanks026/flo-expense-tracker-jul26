# Feature: Koban — Mascot, Engaging Reminders & Streaks
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/05-koban-engagement.md`
**Status**: 📋 Planned — sequenced **after** `06-transaction-auto-detect.md`
**Last Updated**: July 2026

> **Sequencing note (2026-07-12)**: this doc was written first, but the user
> re-prioritised: *"the transaction-auto-detect is the important feature before
> gamification and mascot."* Correct call — auto-detect removes friction from the
> app's core loop, while Koban makes an existing loop more charming. Build
> `06-transaction-auto-detect.md` first.
>
> **Phase 1 (`lib/streak.js`) is already written** — it was built before the
> re-prioritisation. It's pure, self-contained, and imported by nothing.
> `hooks/useStreak.js` is not yet built. Pick up from there.

---

## Context

`04-notifications-and-recurring-bills.md` Phase 5 shipped a working daily
reminder. It is also completely forgettable — a single hardcoded string on a
repeating `DAILY` trigger (`lib/notifications.js:135-149`):

> **"Log today's spending?"** / *"Keep FLO up to date with today's transactions."*

Three defects, all confirmed by reading the code, all of which this feature fixes:

1. **It can never vary.** A repeating `DAILY` trigger bakes its content **once,
   at schedule time**, and repeats it verbatim forever. Varied copy, ₹ figures,
   or a streak count are impossible without changing the *scheduling
   architecture* — not just the strings. This is the single most important fact
   in this doc.
2. **It's invisible.** `lib/notifications.js:70-73` creates one channel at
   `AndroidImportance.DEFAULT`, which Android defines as *"makes a sound, but
   does not visually intrude."* A heads-up banner requires `HIGH`. This is the
   root cause of "it's buried under 100 other notifications."
3. **It nags people who already logged.** Interrupting someone with a reminder
   they've already acted on is the fastest way to train them to swipe FLO away
   unread.

The app has **no mascot, no emoji, and zero gamification** anywhere in source
(verified by grep — the only near-hits are `DeltaBadge` and Analytics' neutral
data labels). Existing copy is clean and terse; a notch warmer than a bank app,
but with no personality hook.

**Outcome**: a maneki-neko mascot named **Koban** (小判 — the gold coin the lucky
cat holds) whose mood tracks how long you've been away; reminders that actually
drop down over the screen; and a basic, honest streak that feeds the copy now and
an animated Home UI later.

This feature reuses: `rescheduleAll`'s cancel-and-rebuild philosophy, the
`useDataRefresh` version-counter, the standard read-hook shape, the Expo Go
`require()` guard (`lib/notifications.js:8-19`), the money helper
`₹${Math.round(n).toLocaleString('en-IN')}`, and `theme/tokens.js`'s brand lime
`#BBDC12`.

**Verified against the SDK 54 docs** (`https://docs.expo.dev/versions/v54.0.0/sdk/notifications/`)
before writing, per `AGENTS.md`:
- `channelId` **is** allowed on a `DATE` trigger input. ✅ (the whole rolling-window design depends on this)
- `AndroidImportance` = `MIN | LOW | DEFAULT | HIGH | MAX`.
- `NotificationContentInput.subtitle` is **iOS-only**. Android gets **title + body**, full stop.
- There is **no large-icon API**. The mascot lands as a monochrome small icon + emoji in the title.
- Plugin `icon` must be a **96×96 all-white PNG with transparency**; `color` tints it in the tray.

---

## Phase Overview

```
Phase 1 — Streak foundation (pure, no UI)
  lib/streak.js + hooks/useStreak.js. Consecutive-days-logged, computed from
  created_at in local time, plus today's income/expense totals. Nothing stored.

Phase 2 — Koban's voice (copy engine + rolling scheduler)
  lib/koban.js tiered copy pools. Rewrite rescheduleAll from one repeating
  DAILY trigger into a rolling 30-day window of dated notifications, split
  into a Nudge lane and a Recap lane.

Phase 3 — Heads-up channels + Koban's icon (requires a rebuild)
  New HIGH/LOW channels (the old 'default' channel is immutable and must be
  replaced, not edited), notification icon, unblock VIBRATE.

Phase 4 — Docs
  00-index.md, and fix AGENTS.md's stale Expo v52 pointer.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Architecture — the three things that must change

### A. Scheduling: rolling window, not a repeating trigger
Replace the single `DAILY` trigger with a **rolling 30-day window of
individually-dated (`DATE`) notifications**, each pre-baked with the copy for the
tier it would land in. `rescheduleAll()` is already
`cancelAllScheduledNotificationsAsync()`-based, so the window refreshes on every
app open and every data change.

**Tradeoff, accepted:** if the app isn't opened for 30 days, reminders run out.
Fine — at 30 days silent, the notification is not the problem.

**Corollary:** anything scheduled *outside* `rescheduleAll` gets silently wiped
on the next rebuild. All new notification types go inside it.

### B. Two lanes, two channels

| Lane | When | Channel ID | Importance | Job |
|---|---|---|---|---|
| **Nudge** | Nothing logged today | `flo.reminders.nudge` | **HIGH** — heads-up, sound | Get them into the app |
| **Recap** | Already logged today | `flo.reminders.recap` | **LOW** — silent, no banner | Reinforce the streak, close the loop |
| **Bills** | Bill due soon | `flo.bills.due` | **HIGH** — heads-up, sound | Actionable |

Streak **milestones** (day 7 / 30 / 100) fire on the **HIGH** channel even when
already logged — a milestone earns the interrupt.

The Recap is deliberately silent. A notification that requires no action and
still interrupts you is how an app gets muted forever. Because it's a separate
channel, a user who doesn't want it can mute *just that one* from Android system
settings without losing the nudge — that's what channels are for, and it costs us
zero settings UI.

> ⚠️ **Android notification channels are immutable after creation.** The existing
> `'default'` channel is already on-device at `DEFAULT` importance. Calling
> `setNotificationChannelAsync('default', { importance: HIGH })` is **silently
> ignored by Android** — the fix *must* ship **new channel IDs**, and delete the
> old one. Getting this wrong produces a change that appears correct in code and
> does nothing on the device.

### C. Reschedule must react to transactions
`useNotificationSync`'s reschedule effect currently depends on
`[bills, loading, settings]` (`lib/notifications.js:173-176`) — **a new
transaction reschedules nothing.** Add the `useDataRefresh` `version` counter.
Every transaction insert already calls `notifyChanged()`, so logging at 2pm swaps
tonight's 8pm notification from Nudge to Recap.

This is airtight rather than best-effort: **there is no path to create a
transaction without the app being open** (⊕ tab, Plan Detail, share-intent, and
`markBillPaid` all run in-app).

---

## Phase 1 — Streak Foundation (pure, no UI)

### Goal
A correct, honest streak number exists and is queryable — consecutive calendar
days on which the user logged at least one transaction — along with today's
income/expense totals. Nothing renders yet; this is the data Phase 2's copy needs.
Delivered as a pure function plus a hook, so the animated Home UI later needs zero
data-layer change.

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

### 1.1 Database
**No database changes.** No `streaks` table, no counter column.

A streak is a derived number. Storing it would violate the app's core
compute-don't-store rule (`00-index.md`, `FEATURE_PLAN.md`) and would drift the
moment a transaction is deleted. It is computed on read from rows that already
exist.

### 1.2 Data Layer

```
lib/streak.js      ← NEW. Pure, no React, no Supabase.
hooks/useStreak.js ← NEW. Standard read-hook shape.
```

**`lib/streak.js`**

```js
computeStreak(rows, now) → {
  current,           // consecutive days logged, counting back from today (or
                     // yesterday if nothing yet today — at risk, not dead)
  longest,           // best run within the fetched window
  loggedToday,       // boolean — drives the Nudge/Recap lane split
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

**Day 0 / streak-start is a first-class state, not `current === 1`.** Two cases
the copy in Phase 2 must be able to tell apart:
- `current === 0` — no streak at all (brand-new user, or a broken one). The nudge
  must say *"Start a streak"*, **never** *"don't break your streak."* Getting this
  wrong is the kind of bug that makes an app feel stupid.
- `isNewStreak` — they started one **today**. Earns its own celebratory recap
  rather than the generic pool. The first day of a streak is the most fragile it
  will ever be; it's worth marking.

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

### 1.3 Components
None. No UI in this phase.

### 1.4 Navigation / Integration
None. Nothing imports `useStreak` yet — Phase 2 does.

### 1.5 Impact on Existing Features
| Area | Change | Watch for |
|---|---|---|
| Everything | None — two new files, nothing imports them yet | Genuinely isolated |

### 1.6 What This Phase Does NOT Include
- No UI anywhere. No Home streak display, no animation (explicitly deferred by
  the user — *"streaks actually need a lot of research"*).
- No notification changes (Phase 2).
- No `streaks` table, no stored counter, no longest-ever persistence beyond the
  90-day window.

### 1.7 Phase 1 Checklist — Before Marking Complete
- [ ] `lib/streak.js` exports `computeStreak(rows, now)` — pure, no React/Supabase imports.
- [ ] Streak counts from `created_at`, bucketed to **local** days; a code comment states why not `occurred_at`.
- [ ] `current === 0` when nothing logged in the window; `isNewStreak` true only on `current === 1 && loggedToday`.
- [ ] Streak is *at risk*, not dead, when nothing is logged yet today (counts back from yesterday).
- [ ] `todayTotals` returns `{ spent, earned, count }` — both directions, not just spend.
- [ ] `hooks/useStreak.js` depends on **both** `version` and `session?.user?.id`; returns data after auth resolves (not an empty pre-auth fetch).
- [ ] Verified with a throwaway `node` script: empty / today-only / unbroken run / gap / **04:00-IST boundary** / backdated `occurred_at` must not inflate the streak.
- [ ] `npx expo export --platform android` bundles cleanly.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 2 — Koban's Voice (copy engine + rolling scheduler)

### Goal
The daily reminder becomes Koban. Copy varies day to day, escalates the longer
the user stays away, congratulates a streak, and — when they've already logged —
switches to a silent end-of-day recap carrying both spend and income. This is
where the repeating `DAILY` trigger dies and the rolling window is born.

### Before Starting — Confirm Phase 1 is Approved
1. Re-read `lib/notifications.js` in full — `rescheduleAll` (`:105-150`),
   `useNotificationSync` (`:158-194`), and above all the Expo Go `require()`
   guard (`:8-19`). **Every new export must keep the `if (!Notifications) return`
   no-op pattern** or the app crashes at boot in Expo Go, on every route.
2. Confirm the bill-reminder block (`:112-133`) — it stays behaviourally
   unchanged this phase; only its `channelId` moves in Phase 3.
3. Confirm `app/settings.js`'s daily-reminder toggle + time picker still write
   `{ enabled, hour, minute }` to `flo.notif.dailyReminder`. **No settings UI
   changes this phase** — the same toggle now yields much better notifications.
4. Confirm `CHANNEL_ID = 'default'` is still the only channel — Phase 2 keeps
   using it so this phase stays JS-only and testable without a rebuild. Phase 3
   swaps it.

### 2.1 Database
No database changes.

### 2.2 Data Layer

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
| **Recap** — started today | Delighted | **"🐱 Day 1. Paw's up."** — ₹840 out, ₹0 in. Come back tomorrow and it's a streak. |
| **Recap** — ongoing | Content | **"🐱 Day 7 locked in"** — ₹840 out · ₹2,000 in, 3 entries. |
| **Recap** — milestone | Triumphant | **"30 days. Koban is impressed."** — ₹840 out · ₹2,000 in today. |

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
unchanged. The daily reminder becomes:

- Loop `i = 0..29`, each day at the user's `{ hour, minute }` (default 20:00).
- Skip any fire time already in the past (matters only for `i === 0`).
- **`i === 0` and `streak.loggedToday`** → **Recap** content, `flo.reminders.recap`
  channel (or the HIGH channel when `isMilestone`).
- **Otherwise** → **Nudge** content on the HIGH channel, tier selected by the
  *projected* silence `daysSinceLastLog + i`, and the projected streak (which is
  `streak.current` today, and `0` for every `i >= 1` where they'd have broken it).
- All carry `data: { route: '/' }` — unchanged, and already verified correct
  (`/(tabs)` is a route *group*; its parens are stripped from the URL).

**`useNotificationSync`** — add `useStreak()` and `version` to the reschedule
effect's deps (Architecture C). Guard on `streak.loading` the same way the
existing code guards on `bills` `loading`, or the first schedule pass will run
against a zeroed streak and bake the wrong copy.

### 2.3 Components
No new components. No settings UI changes.

### 2.4 Navigation / Integration
None. Same `data.route` payloads, same tap-routing (`:178-191`), untouched.

### 2.5 Impact on Existing Features
| Area | Change | Watch for |
|---|---|---|
| `lib/notifications.js` | `rescheduleAll` signature gains `streak`; daily block rewritten | Bill reminders must keep working — they share the cancel-all rebuild |
| `useNotificationSync` | Now also mounts `useStreak()` | It's mounted at app root; the extra query runs once per data change, not per render |
| Scheduled-notification count | 1 daily → up to 30 dated + N bills | Well within Android's limits; iOS's 64-pending cap would matter, but this app is Android-only |
| `lib/alerts.js`, `hooks/useAlerts.js` | Import the hoisted money helper | Pure refactor — no behaviour change |

### 2.6 What This Phase Does NOT Include
- No channel changes — still the single `'default'` channel, still **not** a
  heads-up. Copy gets good in this phase; visibility gets fixed in Phase 3. Kept
  separate deliberately so this phase stays JS-only.
- No notification icon (Phase 3), no `VIBRATE` (Phase 3).
- No settings toggle for the recap lane. The Android per-channel mute (Phase 3) is
  the escape hatch; revisit only if it proves insufficient.
- No in-app streak UI.

### 2.7 Phase 2 Checklist — Before Marking Complete
- [ ] `lib/koban.js` exports `pickNudge` / `pickRecap`; ≥5 lines per tier; no tier can produce "don't break your streak" when `current === 0`.
- [ ] `rescheduleAll` schedules a rolling 30-day window of `DATE` triggers; the repeating `DAILY` trigger is gone.
- [ ] Logged today → today's slot is a **Recap** with both spend and income; not logged → a **Nudge**.
- [ ] Copy escalates with projected silence across the window (day+1 ≠ day+7 tier).
- [ ] Adding a transaction reschedules (the `version` dep) and flips today's slot to Recap.
- [ ] Bill reminders still schedule correctly alongside the window.
- [ ] Expo Go guard intact — app still boots in Expo Go (no `expo-notifications` top-level import).
- [ ] Money helper hoisted; no fourth copy added.
- [ ] Verified with a throwaway `node` script asserting the tier ladder + lane swap.
- [ ] Bundles cleanly.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 3 — Heads-Up Channels + Koban's Icon (requires a rebuild)

### Goal
The nudge stops hiding. It drops down over whatever's on screen, with sound and
vibration, wearing Koban's face in the status bar. The recap stays quiet. The user
can mute either one independently from Android system settings.

### Before Starting — Confirm Phase 2 is Approved
1. Re-read the SDK 54 channel docs — **do not work from memory** on
   `AndroidImportance` or `NotificationChannelInput`.
2. Confirm `ensureChannel()` is still only called from `requestPermission()`
   (`:82`) — i.e. lazily. This phase must also call it from `rescheduleAll`, or a
   permission granted outside that path schedules against a channel that doesn't
   exist.
3. Confirm `app.json`'s `expo-notifications` plugin entry is still a bare string
   with no options (`:50`) and that `VIBRATE` is still in `blockedPermissions`
   (`:28`).
4. **Tell the user before starting: this phase requires a new EAS dev build.**
   `app.json` changes are native.

### 3.1 Database
No database changes.

### 3.2 Data Layer

`ensureChannels()` replaces `ensureChannel()`, called from **both**
`requestPermission()` and `rescheduleAll()`:

```js
const CHANNELS = {
  nudge: 'flo.reminders.nudge',   // AndroidImportance.HIGH, sound, lightColor #BBDC12, enableVibrate
  recap: 'flo.reminders.recap',   // AndroidImportance.LOW,  no sound
  bills: 'flo.bills.due',         // AndroidImportance.HIGH, sound, enableVibrate
};
await Notifications.deleteNotificationChannelAsync('default');  // the immutable old one
```

Also:
- `setNotificationHandler` → `shouldPlaySound: true` (`:37`).
- Nudge + bill content gains `priority: AndroidNotificationPriority.HIGH`,
  `sound: true`, `color: '#BBDC12'`. Recap content gets `sound: false`.
- Channel names are user-visible in Android settings: **"Daily nudge"**,
  **"Daily recap"**, **"Bill reminders"**.

### 3.3 Components
No new components.

### 3.4 Navigation / Integration

**`app.json`** — two changes, both native:

```jsonc
// plugins: replace the bare "expo-notifications" string
["expo-notifications", {
  "icon": "./assets/notification-icon.png",
  "color": "#BBDC12"
}]

// android.blockedPermissions: REMOVE "android.permission.VIBRATE"
```

`VIBRATE` was blocked during an earlier security pass as unused bloat
(`04-...md` Phase 5 notes). It is now genuinely used — a heads-up with no buzz
reads as broken. **Record the reversal in `00-index.md`** so a future security
audit doesn't strip it again.

> ⚠️ **`assets/notification-icon.png` is a blocking dependency that must be
> supplied by the user — it cannot be generated from here.** Per the SDK 54 docs:
> **96×96, all-white PNG with transparency.** Android masks the icon to a
> silhouette and discards all colour, so it must be a flat white Koban shape
> (cat head + raised paw reads best at status-bar size) on transparency, with
> generous padding. A coloured or photographic icon renders as a white blob —
> which is exactly the bug we're fixing.

**Not possible, recorded so it isn't re-litigated:** a full-screen takeover (like
an incoming call). Android 14 restricted `USE_FULL_SCREEN_INTENT` to alarm and
calling apps. The heads-up banner is the ceiling — and it is what Instagram
actually uses for the case the user described.

### 3.5 Impact on Existing Features
| Area | Change | Watch for |
|---|---|---|
| `app.json` / native | Plugin options + one permission unblocked | **Requires a new EAS build.** Won't appear via JS reload |
| Bill reminders | Move to the new `flo.bills.due` channel | They become heads-up too — an improvement, but call it out |
| Existing installs | The old `'default'` channel is deleted | Users who muted `'default'` get a clean slate on the new channels — acceptable, and unavoidable given channel immutability |
| Security posture (`00-index.md`) | `VIBRATE` un-blocked | Must be recorded, or a future audit re-strips it |

### 3.6 What This Phase Does NOT Include
- No custom notification sound (`sounds` plugin option) — system default.
- No notification action buttons (that's `06-transaction-auto-detect.md`).
- No in-app streak UI.

### 3.7 Phase 3 Checklist — Before Marking Complete
- [ ] Three channels created with the right importances; `'default'` deleted.
- [ ] `ensureChannels()` called from **both** `requestPermission()` and `rescheduleAll()`.
- [ ] `assets/notification-icon.png` present — 96×96, all-white, transparent.
- [ ] `app.json`: plugin has `icon` + `color`; `VIBRATE` removed from `blockedPermissions`.
- [ ] **On-device (needs a new EAS build):** the nudge **drops down over the screen**, with sound and vibration — not just into the shade.
- [ ] **On-device:** the recap appears silently in the shade with no banner.
- [ ] **On-device:** three separately-mutable channels appear under Android's app notification settings.
- [ ] **On-device:** the status-bar icon is Koban's silhouette, not a white blob.
- [ ] Tapping either still deep-links to Home.
- [ ] Bundles cleanly.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 4 — Docs

- Update `00-index.md`: add this feature to the Feature Files table; add
  `useStreak`/`lib/streak.js`/`lib/koban.js` to Shared Infrastructure Notes;
  record the **`VIBRATE` un-block** reversal; record the notification-channel
  immutability lesson as a standing rule.
- **Fix `AGENTS.md`** — it points at `https://docs.expo.dev/versions/v52.0.0/`
  but the project is on **SDK 54** (`expo@^54.0.35`, RN 0.81.5, New Architecture
  on). Every agent reading that file is being sent to the wrong API surface.

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
| Daily reminder | Fully rewritten — varied, escalating, streak-aware, two lanes | Phase 2 |
| Bill reminders | Behaviour unchanged; moves to a HIGH channel (now heads-up) | Phase 3 |
| `lib/alerts.js`, `hooks/useAlerts.js` | Import the hoisted money helper | Phase 2 (pure refactor) |
| `app.json` / native | Plugin options + `VIBRATE` | Phase 3 — **needs a new EAS build** |
| `app/settings.js` | **None.** The same toggle now yields much better notifications | — |
| Security posture | `VIBRATE` deliberately un-blocked | Phase 4 — record it |

---

## Out of Scope (All Phases)

- **Animated Home streak UI** — the user explicitly deferred it (*"streaks
  actually need a lot of research"*). Phase 1 is built so this needs **no**
  data-layer change when it lands: `useStreak()` already returns everything a UI
  would want.
- **An in-app "yesterday you spent ₹X" banner** — considered and **rejected**.
  Home already renders the balance hero, the income/expense chart, and recent
  transactions; a yesterday-specific card is a narrow slice of data already
  visible on the same screen, with no action attached — a thing to dismiss, not a
  thing to read. The end-of-day summary belongs in the Recap notification, where
  it reaches someone who *isn't* looking at the app. The in-app reinforcement slot
  should go to the streak display instead.
- **Bank-notification auto-detect** ("looks like a transaction happened — record
  it?") — feasible, Android-only, and a real native module
  (`NotificationListenerService`). Specced separately in
  `06-transaction-auto-detect.md`. No code here.
- **A `streaks` table / stored counter** — violates compute-don't-store.
- **Streak freezes, repair, or leaderboards** — the Duolingo playbook. Not now.
- **Custom notification sound** — system default is fine.
- **Remote push** — unchanged from `04-...md`: FLO has no server-side event source.
- **iOS** — the app is Android-only in practice (share-intent already is).
- **Streaks longer than 90 days** — the query window caps it. Acceptable v1 limit.
