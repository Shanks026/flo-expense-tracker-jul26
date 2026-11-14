# 02: The short path (2a): the reminder ask finishes onboarding

Spec: .claude/features/archive/35-onboarding-v3.md

**What to build:** Subticket 2a of "the short path". After sign-in, a new user goes straight to the reminder ask, "Want a 9 pm nudge?". Its copy has to read right with or without a first expense before it, since that step only arrives in ticket 05.
- **Turn on:** asks for the OS notification permission, turns reminders on and registers the push token.
- **Not now:** leaves reminders off.

Either choice writes `onboarded_at`, and the user lands on Home.

The post-auth step list becomes just the reminder ask. The RootNavigator / OnboardingGate split stays as it is. A signed-in user without `onboarded_at` is sent to the start of the new list, including anyone stuck partway through the old flow. An onboarded user never sees it.

The old setup screens stay in the code but can no longer be reached; 2c deletes them. No welcome bundle is claimed.

**Blocked by:** 01 (Sign-up defaults on the server)

**Status:** ready-for-agent

- [ ] A fresh sign-up lands on the reminder ask, not the old account screen
- [ ] Turn on: the OS prompt appears; on grant, reminders are on and a push token is saved; then Home
- [ ] Permission denied or blocked: no crash, onboarding still finishes, Home
- [ ] Not now: reminders stay off; then Home
- [ ] Both choices set `profiles.onboarded_at`; relaunching goes straight to Home
- [ ] A test account stuck partway through the old flow lands on the reminder ask
- [ ] An already-onboarded user sees no onboarding on sign-in

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

- 2026-10-26: Built.
  - **Step list:** the post-auth list (`lib/onboarding.js`) is now just `reminders`. It exports `FIRST_STEP_ROUTE` and `isStepRoute`.
  - **Gate:** OnboardingGate sends a signed-in user without `onboarded_at` to that first step from anywhere that isn't a current step, so a screen from the old flow restarts there too. The tour-detour allowance is gone, since the tour can't be reached.
  - **The reminder ask** (`app/onboarding/reminders.js`, rewritten): "Want a 9 pm nudge?", with Turn on and Not now.
    - Turn on: the OS prompt. On a grant it sets the local notification flag, registers the push token and sets `reminders_enabled = true`.
    - A refusal or Not now: sets `reminders_enabled = false`.
    - Both run `finish()`, which writes `onboarded_at`; the gate then goes to Home.
  - **No welcome bundle:** `finish()` no longer calls `claimWelcomeBundle`.
- Code review:
  - Fixed: the subtitle no longer says "one reminder", because send-push still sends the 08:00 morning nudge to anyone with `reminders_enabled` until spec 39 removes it.
  - Fixed: Turn on stays busy until `finish()` completes, so a second tap can't start a second prompt.
  - Left: a failed `reminders_enabled` write is ignored (without a push token nothing is delivered anyway). The old step helpers are dead code until ticket 04.
- Open emulator checks (paused): every acceptance line. Only the parse checks were done.
