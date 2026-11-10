# 04: Question shell and "Where does your money live?"

Spec: .claude/features/47-quiet-ledger-onboarding.md

**What to build:** The first set-up question and the shell all four share.

- **Shell:** `ScreenHeader` (Back from question 2 on), a `ProgressBar` with "N of 4" at the top, a left-aligned question title, the answer control, and a `PinnedFooter` with **Skip for now** and **Next**. Next is disabled while an answer is incomplete; a failed write shows a toast and stays on the step.
- **Steps:** the onboarding step list becomes accounts → month start → budget → card → first expense → reminders. `FIRST_STEP_ROUTE` becomes the accounts step, so a new user, or one stuck in an older flow, lands there. `OnboardingGate` still owns routing; `finish()` is unchanged. Until tickets 06–08 exist, Next on accounts goes to the next built step.
- **Draft:** the answers are held for the session and seeded from what's saved, so Back shows what was chosen.
- **The question:** multi-select `Chip`s (Cash, SBI, HDFC, ICICI, Axis, Kotak, UPI wallet) and **+ Add** with an inline name field (trimmed, 1–30 characters).
- **The set-up planner** (pure, in `lib/`) turns picks plus the existing accounts into writes:
  - the first pick renames "Personal" only while it's the only account and still has its seeded name;
  - later picks are created;
  - names already there, in any case, are not created twice;
  - colours come from the palette in order, skipping used ones;
  - the first resulting account becomes active.
- Writes go through ticket 01's mutations. Skip keeps Personal. With billing on and no Pro, only the rename applies and the question says Free includes one account.
- `onboarding_step_viewed` sends `accounts` (consent permitting, no bank names).

**Blocked by:** 01

**Status:** resolved

- [x] The check script covers the planner: skip, one pick, three picks, an already-renamed Personal, a second account already there, duplicate names, colour order, a custom name
- [x] The check script covers progress: each step gives "N of 4" and its bar value, and themes off gives "N of 3"
- [x] On a fresh account, SBI + Cash gives two accounts: Personal renamed to SBI (active) and Cash; the database matches
- [x] Back then Next creates no duplicate
- [x] Skip leaves one Personal account
- [x] Emulator check in light and dark, on a new test account (the shared one keeps its data)

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-11: The planner is `lib/setupPlan.js` (`planAccounts`, `cleanAccountName`, `setupProgress`), with 30 new cases in `scripts/ledger-check.mjs` (181 in total). The shell is `components/onboarding/SetupQuestion.js`, the draft is `lib/OnboardingDraftContext.js` (provided in `app/onboarding/_layout.js`), and the screen is `app/onboarding/accounts.js`. The kit gained `ScreenHeader showBack={false}`, so question 1 has no Back, and `ProgressBar plain`, so 4 of 4 isn't drawn red. `hooks/useAndroidKeyboardHeight.js` holds the same keyboard rule as Ask FLO; `app/assistant.js` still has its own copy.
- Emulator, Pixel_API_36, on two new accounts (`FLO_ONB04_*` and `FLO_ONB04_SKIP_*` in `.env.test.local`):
  - SBI then Cash renamed Personal to SBI (same id, lime) and created Cash (forest). SBI was active on Home with two cards.
  - Force-stop and relaunch sent the account back to question 1 with SBI and Cash picked. Next in dark mode created nothing new (checked in the DB).
  - Skip left one Personal.
  - + Add with "Paytm" added a chip and deselecting it worked; the footer rides on the keyboard.
- Not checked:
  - the free-plan single pick and its note, because billing is off;
  - the `onboarding_step_viewed` row, because consent is off for new accounts;
  - Back from question 2, which doesn't exist until 06–08 (relaunch-and-Next stood in for it).
- Seen, not caused here: on a cold start Home shows for about 5 s before the gate redirects into onboarding.
