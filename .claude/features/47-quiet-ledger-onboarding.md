# Feature: Quiet Ledger redesign, Phase 3 (Onboarding)
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/47-quiet-ledger-onboarding.md`
**Status**: ready-for-agent
**Last Updated**: 2026-11-11
**Source of truth for the design**: `docs/redesign-plan.md` §4 "Onboarding" and §7 Phases. Where this spec and that document disagree on a visual detail, the document wins; where they disagree on scope, sequencing or data, this spec wins.

---

## Context

Spec 46 built Phases 1 and 2 of the Quiet Ledger redesign: the ledger kit (`components/ledger/`, `theme/ledger.js`) and the core loop (Home, the Add sheet, Activity, Transaction detail). All 12 of its tickets are done (handoff: `.scratch/quiet-ledger/handoff.md`). This spec is **Phase 3: Onboarding**. Phases 4–6 (money screens, moments and the rest, polish) stay in the plan until they're reached.

Onboarding today (spec 35, "4 screens to the first expense") is: a one-object opener → sign-in / sign-up → the first expense over Home → the reminder ask → Home. It is built on the old kit (`OnboardingScreen`, `components/Button`, Manrope tokens). Sign-up seeds one account called "Personal", INR, the default categories and the weekly report server-side (`handle_new_user`); nothing in onboarding sets anything up. `profiles.onboarded_at` is the one flag `OnboardingGate` routes on.

Decisions taken with the person while writing this spec (2026-11-11):
- **"My salary day" is a real monthly cycle**, not today's fixed `custom` start date (which never rolls over). It needs a small schema change (see Database) and Settings gets the same option.
- **The first bank or wallet picked renames the seeded "Personal" account**; further picks are added beside it. Personal stays only when the question is skipped.
- **Test seams are spec 46's:** pure rules checked by `scripts/ledger-check.mjs`, plus an emulator check per ticket. No new test runner.

## Phase Overview

One phase, Phase 3, in this order of screens:

**opener carousel → sign up → accounts → month start → monthly limit → card → first expense → reminders → Home**

with sign-in reachable from the opener for a returning user, and one coach mark (the +) on the first Home.

## Problem Statement

A new person installing FLO meets the old look for their first minute, then a calmer app once they reach Home: the first impression and the product disagree. Worse, the app they land in is generic. Everyone gets one account called "Personal", a calendar month, no budget and the default card, even though FLO already supports several accounts, a salary-day month, a spending limit and card designs. Most people never find those settings, so quick add can't say "paid 200 from HDFC", the month resets on the 1st when their salary lands on the 25th, and the card is the same as everyone else's.

## Solution

Rebuild onboarding on the ledger kit and bring back a short set-up step, where every question sets up something the app already has. Nothing is asked just to profile the person. A three-slide opener explains FLO, sign-up shows live password rules, and four skippable questions set up accounts, the month start, an optional monthly limit and the card. Then the person logs a first expense, picks a reminder time and lands on a Home that's already theirs.

## User Stories

### Opener (pre-auth)
1. As a new user, I want a three-slide opener ("Every rupee, in one quiet place", "Log in 3 taps, or just say it", "See where it went"), so that I know what FLO does before I sign up.
2. As a new user, I want one object per slide (coins, spark, receipt) instead of a mascot or a screenshot, so that the opener feels calm.
3. As a new user, I want page dots and a swipe between slides, so that I know how many there are and can move at my own pace.
4. As a new user, I want **Create account** (primary) and **I have an account** (secondary) pinned at the bottom of every slide, so that I can start whenever I'm ready.
5. As a returning user on a new phone, I want **I have an account** to take me straight to sign-in, so that I skip the pitch.
6. As a returning user on the same phone, I want to go straight to sign-in after signing out, without the opener again, so that I'm not pitched twice.
7. As a user, I want no analytics switch on the opener, so that nothing stands between me and sign-up (spec 33 revision).

### Sign up and sign in
8. As a new user, I want a left-aligned title and labelled email and password fields, so that the form reads like the rest of the app.
9. As a new user, I want the password rules shown live with a tick as each is met, so that I know my password is accepted before I submit.
10. As a new user, I want the create-account button to stay disabled until the email looks valid and the password passes every rule, so that I don't submit a form that will fail.
11. As a user, I want a show/hide control on the password, so that I can check what I typed.
12. As a new user, I want the terms line in small muted text above the button, so that it's there without shouting.
13. As a user, I want sign-in and sign-up to switch with one link at the bottom, so that I can change my mind.
14. As a user, I want a clear one-line error under the form when sign-in fails, so that I know what to fix.
15. As a user, I want sign-in to keep its fixed look while the session lands, so that the screen doesn't flash into my account's colours (spec 37 rule kept).

### Set-up questions (new)
16. As a new user, I want a thin progress bar and "1 of 4" at the top of each question, so that I know how long this takes.
17. As a new user, I want **Skip for now** and **Next** pinned on every question, so that nothing is forced.
18. As a new user, I want Back on each question after the first, keeping my earlier answers, so that I can fix a mistake.
19. As a new user, I want each answer saved when I tap Next, so that quitting halfway keeps what I did.
20. As a new user, I want to be asked "Where does your money live?" with chips for Cash, SBI, HDFC, ICICI, Axis, Kotak and UPI wallet, so that FLO has my real accounts from the start.
21. As a new user, I want a **+ Add** chip that takes a name, so that a bank that isn't listed still fits.
22. As a new user, I want to pick several chips, so that every place my money lives becomes an account.
23. As a new user, I want my first pick to become my active account and replace "Personal", so that I don't start with an empty account I never use.
24. As a new user who skips the accounts question, I want to keep the "Personal" account, so that the app still works.
25. As a new user, I want each new account to get its own colour, so that the switcher tells them apart.
26. As a new user, I want to be asked "When does your month start?" with "1st of the month" or "My salary day", so that my totals line up with my pay.
27. As a new user who chooses salary day, I want to pick the day of the month (1–31), so that my month starts when my money arrives.
28. As a user whose salary day is the 31st, I want short months to start on their last day, so that February still has a month.
29. As a new user, I want to be asked "Want a monthly spending limit?" with a large ₹ amount field, so that I can set a budget in one step.
30. As a new user, I want to skip the limit and create no budget, so that I'm not pushed into one.
31. As a new user, I want "Pick your card" as a two-column grid of card designs with a live preview on top, so that Home feels like mine from the first look.
32. As a new user, I want the card grid to show the same designs Personalize offers (Day first), so that what I pick here is what I'd find later.
33. As a new user, I want the last question to say "You can change these in Settings", so that I know none of this is final.

### First expense
34. As a new user, I want the Add sheet over an empty Home with my new accounts and card already showing, so that I see my set-up working.
35. As a new user, I want a title strip "Log your first expense: type it or hold to say it", so that I learn quick add and voice at once.
36. As a new user, I want **Not now** as a quiet button, so that I can skip without feeling I failed.
37. As a new user who saved a first expense, I want the reminder step to open with "Logged.", so that the save is acknowledged (kept from spec 35).

### Reminder ask
38. As a new user, I want a whistle object, two lines of copy and a reminder time picker set to 9 pm, so that I choose when FLO nudges me.
39. As a new user, I want the OS notification prompt only after I tap **Allow notifications**, so that the system dialog never ambushes me.
40. As a new user, I want **Maybe later** to finish onboarding with the nudge off, so that a refusal never strands me.
41. As a new user who allows notifications, I want my chosen time saved as the evening reminder, so that the first nudge comes when I said.
42. As a new user whose permission is refused or blocked, I want onboarding to finish anyway with the nudge off, so that the app never fights me.

### First Home
43. As a new user, I want one coach mark on the + button on my first Home, so that I know where adding lives.
44. As a new user, I want no streak-chip coach mark, so that the first Home isn't crowded.

### Settings (follow-on of the salary-day decision)
45. As a user, I want "Salary day" in Settings → Summary period with the same day picker, so that I can change it later.
46. As a user on salary day, I want Home's "in · out" line and the account totals to follow my salary-day month, so that every screen agrees.

### The developer
47. As the developer, I want each answer written through the same `lib/` mutation the app's own sheets use, so that onboarding can't create data the app doesn't understand.
48. As the developer, I want `OnboardingGate` to keep owning all `session` routing and `onboarded_at` set only at the end, so that the route-flash fixes stay intact.
49. As the developer, I want a user stuck partway through an older flow to land on the first new step, so that nobody is stranded by the upgrade.
50. As the developer, I want `onboarding_step_viewed` to count the new steps (`accounts`, `month_start`, `budget`, `card`), consent permitting, so that the funnel stays measurable.
51. As the developer, I want the old onboarding components left in place until nothing uses them, and removed in the Manrope cleanup ticket, so that this phase doesn't half-delete the old kit.
52. As the developer, I want each ticket verified on Pixel_API_36 in light and dark mode on a fresh test account, so that the shared test account's data isn't rewritten by set-up answers.

## Implementation Decisions

### Approach
- **Beside, not instead** (spec 46 rule). Onboarding screens move to the ledger kit (`ScreenHeader`, `PinnedFooter`, `Segmented`, `Chip`, `ProgressBar`, `Illustration`, `Button`, `AmountText`). `OnboardingScreen`, `OnboardingReveal`, `OnboardingArrowMotif` and the old `Button` stay until nothing uses them; the Manrope cleanup ticket removes them.
- **Routing ownership is unchanged.** `RootNavigator` owns every `!session` route (opener or sign-in, by the device's intro-seen flag); `OnboardingGate` owns every `session` route, keyed on `profiles.onboarded_at`. The post-auth step list in the onboarding module grows from two steps to six (`accounts`, `month_start`, `budget`, `card`, `first_expense`, `reminders`); `FIRST_STEP_ROUTE` becomes the accounts step, so a user stuck in an older flow lands there.
- **`finish()` is unchanged:** it writes `onboarded_at` and doesn't navigate; the gate moves the user once the profile refetch shows it.
- The onboarding stack keeps `gestureEnabled: false` and the cross-fade. Back on the questions is an explicit header button (the ledger `ScreenHeader`), not a swipe.

### Opener
- A horizontal pager of three slides, each an `Illustration` (`large`) and one line; page dots under them; a `PinnedFooter` with **Create account** (primary, to sign-up) and **I have an account** (secondary, to sign-in). Both set the intro-seen flag, as today.
- No analytics switch (spec 33: the opt-in left the opener). The opener's `onboarding_step_viewed` is still sent only with consent on, as today.
- Google stays parked; its slot is kept in sign-up, not shown.

### Sign up and sign in
- One screen with two modes, as today, rebuilt on the kit: a left-aligned large title, labelled fields, a show/hide control, the live password rules, the terms line above a pinned CTA, and the mode switch link.
- **Password rules** are a pure function in `lib/`: given the password, it returns each rule and whether it passes. The rules match what Supabase Auth enforces for this project, so the button is never enabled for a password the server rejects. Read the project's Auth password settings when building, don't assume them; at least "8 or more characters".
- **Email validity** is a pure function too (a lenient shape check; Supabase is the real judge).
- Sign-in keeps its fixed palette (pinned to the default accent, following the device mode) so it doesn't repaint when the session lands. Forgot password stays out until spec 42 ships.

### Set-up questions
- **One question layout**, shared by all four: `ScreenHeader` (Back from question 2 on), a `ProgressBar` at the top plus "N of 4", a left-aligned question title, the answer control, and a `PinnedFooter` with **Skip for now** (secondary) and **Next** (primary). Next is disabled while an answer is incomplete (a salary day not picked, an amount of ₹0). The last question's footer note: "You can change these in Settings".
- **Saving:** Next writes that step's answer, then moves on. A failed write shows a toast and stays on the step. Skip writes nothing (except where noted) and moves on.
- **Back keeps answers:** the four answers live in one onboarding draft held for the session (screen state shared across the question routes, e.g. a small context), seeded from what's already saved, so Back shows what was chosen. A re-submitted step updates rather than duplicates (see each question).
- **The pure set-up planner** (one `lib/` module, no React Native imports) turns answers into the writes, so the rules are checked under node:
  - accounts: picks and the existing accounts → which account to rename, which to create (name, colour), and which becomes active. The first pick renames "Personal" only while Personal is still the user's only account and still has its seeded name; otherwise picks are added. Names already present (case-insensitive) aren't created twice, so Back then Next doesn't duplicate. Colours come from the account palette in order, skipping colours already used.
  - month start: the answer → the profile patch (`reset_period` and the day).
  - monthly limit: the typed amount → a valid budget or none (the paise rule, ≥ ₹1).
  - progress: the step key → "N of 4" and the bar value.

#### 1. Where does your money live?
- Multi-select `Chip`s: Cash, SBI, HDFC, ICICI, Axis, Kotak, UPI wallet, and **+ Add**, which opens an inline name field (trimmed, 1–30 characters).
- Writes through the account mutations the Add Account sheet uses, moved into `lib/` (create, rename) so the sheet and onboarding share them. The first resulting account becomes active through `AccountContext`'s setter. Skip keeps "Personal" as it is.
- With billing flagged off, `hasPro` is true and the free account limit doesn't apply. If billing is on and the person isn't Pro, only the first pick is applied (rename), and the question says one account is included on Free. That's the existing create-time gate, not a new rule.

#### 2. When does your month start?
- `Segmented`: "1st of the month" | "My salary day". Salary day reveals a day-of-month picker (1–31).
- Writes `reset_period = 'monthly'`, or `reset_period = 'salary_day'` with the day (see Database), through the same profile update Settings uses.

#### 3. Want a monthly spending limit?
- A large ₹ amount field (the Add sheet's amount input, caret pinned to the end) and the muted note "FLO can suggest one from your spending later".
- Writes one overall budget on the active account (`period_type = 'calendar_month'`, `category_id` null, name "Monthly limit") through the Add Budget sheet's insert, moved into `lib/`. Re-submitting after Back updates that budget instead of adding a second. Skip creates none.
- A salary-day month doesn't change the budget's period (budgets keep their own `period_type`). Aligning budgets to salary day is out of scope.

#### 4. Pick your card
- A live preview of the card (`AccountCardCarousel`'s card, with the person's first account name) above a two-column grid of the card catalog (`lib/cardThemes.js`), Day first, with seasonal skins next when there are any. Tapping a tile updates the preview.
- Writes `profiles.equipped_card_theme` through the same path Personalize uses (`normalizeEquippedId`, so choosing Ink saves `ink-classic`). Skip leaves the default, which shows Day.
- Respects `FLAGS.themes`: with themes off, the step is left out and the counter reads "N of 3".

### First expense
- Unchanged flow (the Add sheet opens a beat after mount; saving or closing moves on, with `?logged=1` after a save). The screen behind is the ledger look, and the sheet shows a title strip "Log your first expense: type it or hold to say it". **Not now** is a quiet button.

### Reminder ask
- A `whistle` Illustration, two lines of copy, and a time row (default 21:00) opening the system time picker, then **Allow notifications** (primary) and **Maybe later** (secondary).
- Allow: requests the OS permission. On a grant, the nudge stays on, the chosen time is written to `profiles.evening_reminder_time`, and the push token is registered (as today). On a refusal or a block, the nudge is turned off. Either way `finish()` runs.
- Maybe later: the nudge is turned off and `finish()` runs. The chosen time isn't saved.
- Keeps the build-on-today's-date construction for the picker's value (the Madras-time bug documented in Settings).

### First Home coach mark
- Only the + coach mark (the existing `CoachMark` on the tab bar), restyled on the kit. The streak-chip coach mark is not shown.

### Salary-day month (new period)
- A new `reset_period` value, `salary_day`, with the day of the month stored on the profile (see Database).
- The period rule in `lib/periods.js` gains the case: the current period starts on the most recent salary day on or before today. A day past the month's end means the month's last day: 31 → 30 Apr, 28 or 29 Feb. The phrase reads "since 25 Oct".
- Settings → Summary period gains "Salary day" with the same day picker. Everything that already follows the summary period (Home's "in · out" line, the account totals) follows it with no further change. Only the client reads `reset_period` today: no SQL function, view or Edge Function does (checked 2026-11-11).

### Database
One migration, applied only with the person's yes (handoff rule):

```sql
-- 47-quiet-ledger-onboarding: the salary-day month
alter table public.profiles
  add column reset_month_day smallint
    constraint profiles_reset_month_day_check check (reset_month_day between 1 and 31);

alter table public.profiles drop constraint profiles_reset_period_check;
alter table public.profiles add constraint profiles_reset_period_check
  check (reset_period in ('monthly', 'quarterly', 'yearly', 'custom', 'salary_day'));
```

- `reset_month_day` is read only when `reset_period = 'salary_day'`; other periods leave it as it is. No backfill.
- RLS on `profiles` already covers the column (row ownership). No view reads it, so no view is recreated.
- Record the migration in `00-index.md`'s migrations table.

### Analytics
- `onboarding_step_viewed` gains the steps `accounts`, `month_start`, `budget` and `card`. `opener`, `auth`, `first_expense` and `reminder_ask` stay. All consent-gated, as today.
- No answer values are sent: only which step was viewed, never bank names or amounts.

## Testing Decisions

- **What a good check is:** it checks behaviour through a module's public function, never its internals. Given these answers and these existing accounts, which writes come out? Given this password, which rules pass? A refactor that keeps the behaviour must keep the check green.
- **Seam 1, pure rules, `scripts/ledger-check.mjs`** (prior art: spec 46's amount, date-group, week-change, activity and entry-detail groups):
  - password rules: each rule on its own, an empty password, a passing one;
  - email shape: valid, missing @, spaces, empty;
  - set-up planner, accounts: skip → nothing; one pick → rename Personal and set it active; three picks → rename plus two creates; Personal already renamed or a second account exists → no rename; duplicate names (any case) not created twice; colours unique and in palette order; a custom name trimmed and bounded;
  - set-up planner, month start: 1st → monthly; salary day 25 → the salary-day patch; no day → invalid;
  - set-up planner, limit: ₹0, blank and garbage → none; ₹5000 and ₹1,234.50 → the budget amount (paise rule);
  - progress: each step → "N of 4" and its bar value; themes off → "N of 3";
  - the salary-day period start: mid-month, on the day, the day before, day 31 in a 30-day month, day 30 or 31 in February (leap and non-leap), across a year boundary; the phrase.
- **Seam 2, the emulator** (Pixel_API_36, light and dark), per ticket, on a **fresh test account made for this phase** (random email, link check skipped, per the standing rule). The shared test account keeps its data; its email stays in `.env.test.local`, and the new one is added there.
  - the full flow, every question answered: accounts, month start, budget and card appear on Home, and the database shows them;
  - the full flow, every question skipped: one "Personal" account, monthly, no budget, Day card;
  - Back then Next on each question: no duplicate account or budget;
  - quitting mid-flow (force-stop) and reopening: the gate resumes on the first step, with saved answers kept;
  - salary day in Settings and on Home's "in · out" line;
  - notification Allow and Maybe later; the time saved only on Allow.
- No new test runner (AGENTS.md: verify by running the app).

## Out of Scope

- Google sign-in (parked 2026-10-27; its slot is kept).
- Forgot password (spec 42, a separate spec).
- The analytics opt-in moment (spec 33 keeps it out of onboarding).
- Aligning budgets, the streak or the weekly report to a salary-day month (budgets keep their own period).
- "Suggest a limit from my spending" (the note promises it for later; nothing computes it in this phase).
- Seasonal skin content (Diwali, Christmas…): the grid shows them when they exist; making them is spec 43's.
- Removing Manrope, the old tokens and the old onboarding components (the cleanup ticket after Phase 5).
- Any change to sign-up's server-side seeding (`handle_new_user`).
- Phases 4–6.

## Further Notes

- Flow length grows from 4 to about 8 screens, roughly 45–60 s (redesign plan §4). Every question can be skipped, so the floor is about the same as today.
- The old `profiles.onboarding_answers` column was never used and stays untouched.
- `.scratch/quiet-ledger/handoff.md`'s decisions all still hold here: the kit rules, the olive accent (graphics only), the disabled Button look, the amount caret, and the emulator gotchas (force-stop before relaunching; dismiss the bill pop-up).
- Tickets go in `.scratch/quiet-ledger/issues/` numbered from 13, or a new `.scratch/quiet-ledger-onboarding/` effort. Decide in `/to-tickets`.
