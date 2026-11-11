# Quiet Ledger Phase 3, Onboarding (spec 47): handoff

Last updated 2026-11-11: tickets 01–09 done; **10 next**.

Read this, then the ticket you're starting. The spec is
`.claude/features/47-quiet-ledger-onboarding.md`; the design source is
`docs/redesign-plan.md` §4 Onboarding. **Also read
`.scratch/quiet-ledger/handoff.md`** ("Decisions made during spec 46" and
"How the work is done"): the kit rules, the emulator recipe and the gotchas
there all apply here and aren't repeated.

## Where it stands

| Ticket | State | Commit |
|---|---|---|
| 01 Account and budget writes move into lib | done | 5fdefd5 |
| 02 Opener carousel | done | see git log |
| 03 Sign up and sign in on the kit | done | |
| 04 Question shell and "Where does your money live?" | done | 83a3497 |
| 05 Salary-day month | done (migration applied) | see git log |
| 06 "When does your month start?" | done | see git log |
| 07 "Want a monthly spending limit?" | done | 9ba37d1 |
| 08 "Pick your card" | done | 4c281c0 |
| 09 First expense and the reminder ask on the kit | done | a67ff15 |
| 10 First Home coach mark and the full-flow check | blocked by 02, 03, 05, 06 | |

Suggested order: 10. The one-off stuck sign-in from ticket 03 is fixed (useProfile retries a failed or empty read).

## Decisions (2026-11-11, with the person, while writing spec 47)

- **"My salary day" is a real monthly cycle**: a new `reset_period` value
  `salary_day` plus `profiles.reset_month_day` (1–31; past a month's end
  means its last day). Settings gets the same option. The migration is in
  spec 47 §Database and is applied only with the person's yes (ticket 05).
- **The first bank or wallet picked renames the seeded "Personal" account**;
  more picks are added. Personal stays only when the question is skipped.
- **Testing keeps spec 46's two seams**: pure rules in `lib/` checked by
  `scripts/ledger-check.mjs` (151 cases at the start of this effort, 262 after ticket 06), and an
  emulator check per ticket. No new test runner.
- The tickets live in their own effort (this folder), not as quiet-ledger
  13–22.

## Decisions made while building (2026-11-11)

- **The limit** is ₹1 up to what `numeric(12,2)` holds, rounded to paise
  (`cleanLimitAmount`). It's found again by name "Monthly limit", overall,
  `calendar_month`. A resubmit updates the row the draft saved
  (`draft.budgetSaved`), moving it if question 1 changed the active account.
- **Free-plan caps in onboarding show a toast, not the upsell sheet** (no
  sales pitch mid set-up; Skip is right there).
- **The card grid** is the themes Personalize lists, ordered Day, seasonal,
  then catalog order (`cardChoices`). The preview is Home's
  `AccountCardCarousel` with the active account. Skip after an earlier Next
  keeps the saved card.
- **"You can change these in Settings"** shows on whichever question is
  last (card, or budget with `FLAGS.themes` off), from the shell.
- **The first expense opens with quick add on.** A first expense entered
  through quick add records `expense_logged` with source
  `quick_local`/`quick_ai` and `transactions.source` `quick_add`/`voice`,
  not `onboarding`; the fields path still records `onboarding`. The funnel
  views don't filter on source.
- **The reminder ask keeps Settings' PM-only rule** for the evening time;
  only a granted Allow saves it. Reminder-time helpers live in
  `lib/reminderTime.js`, which Settings uses too.

## Test accounts

- Set-up answers write real rows (accounts, `reset_period`, a budget, the
  card), so onboarding checks use a **new test account per full run**
  (random email, link check skipped: the standing rule). Add each one's email
  to `.env.test.local`; never print a password.
- The shared test account (its email is already in `.env.test.local`) stays
  as it is: Appearance Light, Personal active. Its stored card is `day`,
  not Dusk as earlier notes said; left as found. Ticket 05's
  Settings check changes its summary period; put it back to Monthly.
- To see onboarding again on the same phone, sign out (or clear app data for
  the opener): `OnboardingGate` sends any account without `onboarded_at` to
  the first step.

## Built so far (for the next question tickets)

- A question screen is `components/onboarding/SetupQuestion` with
  `stepKey`, `title`, `note`, `nextDisabled` and `onNext` (async, resolves
  true when saved). The shell handles progress, Back, Skip, the step event
  and moving on. Register the route in `STEPS` in `lib/onboarding.js` in
  flow order; `nextStep()` skips steps that aren't built yet.
- Answers go in `useOnboardingDraft()` (`draft[key]`, `setAnswer`); seed from
  the saved data the first time the screen opens, as accounts does.
- Pure rules go in `lib/setupPlan.js` with checks in `ledger-check.mjs`.
- A question that writes one row keeps the row Next saved in the draft
  (as budget does with `draft.budgetSaved`), so a resubmit after Back
  updates it even when question 1 changed the active account.
- `SetupQuestion` takes `pinned` (stays put above the scrolling answer, as
  the card preview does) and shows "You can change these in Settings" on
  whichever question is last. Month start (06) goes between accounts and
  budget in `STEPS`.
- Reminder times go through `lib/reminderTime.js` (Settings and the
  reminder ask).
- **Salary day (05):** `profiles.reset_month_day` exists now. The period
  rule is `lib/periods.js`: `resetPeriodStart(period, now)` and
  `resetPeriodPhrase(period, now)` take one `{ resetPeriod, customStart,
  monthDay }` object (`periodFromProfile(profile)`). Ticket 06 reuses
  `components/ledger/DayOfMonthPicker` (the 7-column 1–31 grid, in the kit gallery) and writes
  `{ reset_period: 'salary_day', reset_month_day }` together, as Settings
  does. Settings → Summary period is now a row opening
  `SummaryPeriodSheet` (five choices don't fit a Segmented).
- Month start (06) goes between accounts and budget in `STEPS`; its
  progress is already "2 of 4" in `setupProgress`.

## Gotchas

- A cold start shows Home for about 5 s before `OnboardingGate` redirects
  into onboarding (existed before this effort; ticket 10's full-flow check
  should look at it).
- After a refused permission or Maybe later, Home takes a few seconds: the
  gate waits for the profile refetch. Not a hang.
- The first-expense sheet opens over that step's own screen, not over Home
  (story 34 wants Home behind it; nobody has built that).
- In dark mode the Ink card is near-black on the near-black canvas, both in
  the card preview and on Home (Home's outline only applies when no card is
  chosen). A Home fix, not onboarding's.
- Taps at the top of Home (y≈600) open the account switcher; dismiss the
  coach mark by tapping lower or waiting.
- The analytics step events can't be checked on new accounts: consent is
  off for them. Set `profiles.analytics_consent` through SQL if a ticket
  needs the `events` rows.

## State left behind

- Two onboarding test accounts, in `.env.test.local` (passwords there,
  never printed):
  - `FLO_ONB04_*`: onboarded; SBI (active) and Cash, a ₹700 "Monthly
    limit", card Dusk, one ₹120 Food expense, daily reminders on at 20:30.
    The emulator is signed in as this one, on Settings.
  - `FLO_ONB04_SKIP_*`: onboarded; HDFC, a ₹6000 limit, the default card,
    reminders off, one push token.
- To run the flow again on either, set its `profiles.onboarded_at` to null;
  the gate sends it to question 1 with its saved answers seeded.
- To get the Android 16 notification prompt again: `adb shell pm revoke
  com.anonymous.flo android.permission.POST_NOTIFICATIONS`, then `adb shell
  pm clear-permission-flags com.anonymous.flo
  android.permission.POST_NOTIFICATIONS user-set user-fixed`. The app's
  permission is granted right now.
- Migration `quiet_ledger_onboarding_salary_day_month` applied 2026-11-11 (ticket 05). `FLO_ONB04_*` is back on Monthly with `reset_month_day` null. `day-themes/` and
  `design-inspirations/` are untracked on purpose.

## How the work is done

Same as `.scratch/quiet-ledger/handoff.md` "How the work is done", with this
effort's tracker ids: start a ticket with `mcp__flo-ticket-tracker__tickets`
start `quiet-ledger-onboarding/NN`.
