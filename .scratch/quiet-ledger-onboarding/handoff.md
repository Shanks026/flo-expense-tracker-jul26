# Quiet Ledger Phase 3, Onboarding (spec 47): handoff

Last updated 2026-11-11: tickets 01 and 04 done; 05 next (its migration needs the person's yes), or 07/08.

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
| 02 Opener carousel | ready | |
| 03 Sign up and sign in on the kit | ready | |
| 04 Question shell and "Where does your money live?" | done | (this commit) |
| 05 Salary-day month | ready (migration needs the person's yes) | |
| 06 "When does your month start?" | blocked by 04, 05 | |
| 07 "Want a monthly spending limit?" | ready | |
| 08 "Pick your card" | ready | |
| 09 First expense and the reminder ask on the kit | ready | |
| 10 First Home coach mark and the full-flow check | blocked by 02–09 | |

Suggested order: **01**, then 04, 05, 06, 07, 08 (the questions, in flow
order), with 02, 03 and 09 whenever; 10 last.

## Decisions (2026-11-11, with the person, while writing spec 47)

- **"My salary day" is a real monthly cycle**: a new `reset_period` value
  `salary_day` plus `profiles.reset_month_day` (1–31; past a month's end
  means its last day). Settings gets the same option. The migration is in
  spec 47 §Database and is applied only with the person's yes (ticket 05).
- **The first bank or wallet picked renames the seeded "Personal" account**;
  more picks are added. Personal stays only when the question is skipped.
- **Testing keeps spec 46's two seams**: pure rules in `lib/` checked by
  `scripts/ledger-check.mjs` (151 cases at the start of this effort), and an
  emulator check per ticket. No new test runner.
- The tickets live in their own effort (this folder), not as quiet-ledger
  13–22.

## Test accounts

- Set-up answers write real rows (accounts, `reset_period`, a budget, the
  card), so onboarding checks use a **new test account per full run**
  (random email, link check skipped: the standing rule). Add each one's email
  to `.env.test.local`; never print a password.
- The shared test account (its email is already in `.env.test.local`) stays
  as it is: Appearance Light, card Dusk, Personal active. Ticket 05's
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
- The emulator is signed in as the ticket 04 skip account, mid-flow on
  question 1, with nothing written. Sign out to reuse the shared account.

## How the work is done

Same as `.scratch/quiet-ledger/handoff.md` "How the work is done", with this
effort's tracker ids: start a ticket with `mcp__flo-ticket-tracker__tickets`
start `quiet-ledger-onboarding/NN`.
