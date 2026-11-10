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

**Status:** ready-for-agent

- [ ] The check script covers the planner: skip, one pick, three picks, an already-renamed Personal, a second account already there, duplicate names, colour order, a custom name
- [ ] The check script covers progress: each step gives "N of 4" and its bar value, and themes off gives "N of 3"
- [ ] On a fresh account, SBI + Cash gives two accounts: Personal renamed to SBI (active) and Cash; the database matches
- [ ] Back then Next creates no duplicate
- [ ] Skip leaves one Personal account
- [ ] Emulator check in light and dark, on a new test account (the shared one keeps its data)

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
