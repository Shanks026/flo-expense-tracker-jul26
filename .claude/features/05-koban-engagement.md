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

Phase 4 — Mascot (illustrated icon) — LAST, deprioritized
  Blocked on user-supplied artwork ("i will come up with illustrations").
  No code work until art exists; when it does, it's one app.json plugin
  option + a rebuild. Not scheduled until the user brings the asset.

Phase 5 — Docs wrap-up
  00-index.md rollup once Phases 1-3 are actually built.
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
- [ ] **On-device:** three separately-mutable channels ("Daily nudge", "Daily recap", "Bill reminders") appear under Android's app notification settings.
- [ ] Tapping still deep-links to Home.
- [ ] Bundles cleanly natively — no Android SDK in this environment (same boundary as `06-transaction-auto-detect.md`'s phases); needs your build.

**→ Stop here. Show the result and wait for approval.**

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
the day-0/day-N distinction below — not the full gamification layer (streak
freezes, richer milestone tuning, in-app display). The user is bringing their
own ideas for that once this and Phase 3 are done; building ahead of that would
mean re-doing it.

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
- [ ] `lib/koban.js` exports `pickNudge` / `pickRecap`; ≥5 lines per tier; no tier can produce "don't break your streak" when `current === 0`.
- [ ] The `isNewStreak` recap says **"Day 0,"** not "Day 1."
- [ ] `rescheduleAll` schedules a rolling 30-day window of `DATE` triggers onto Phase 1's channels; the repeating `DAILY` trigger is gone.
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

## Phase 4 — Mascot (illustrated icon) — LAST, deprioritized

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

### Phase 4 Checklist — Before Marking Complete
- [ ] `assets/notification-icon.png` present — 96×96, all-white, transparent.
- [ ] `app.json` plugin updated with `icon` + `color`.
- [ ] **On-device:** the status-bar icon is Koban's silhouette, not a white blob or the default app icon.
- [ ] Bundles cleanly.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 5 — Docs Wrap-Up

Once Phases 1–3 are built and approved:
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
- **Animated Home streak UI** — the user explicitly deferred it (*"streaks
  actually need a lot of research"*). Phase 2 is built so this needs **no**
  data-layer change when it lands: `useStreak()` already returns everything a UI
  would want.
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
