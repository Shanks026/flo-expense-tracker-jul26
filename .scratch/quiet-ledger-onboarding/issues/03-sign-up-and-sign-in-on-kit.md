# 03: Sign up and sign in on the kit

Spec: .claude/features/47-quiet-ledger-onboarding.md

**What to build:** The sign-in / sign-up screen is rebuilt on the kit: a left-aligned large title, labelled email and password fields, a show/hide control, the terms line in small muted text above a pinned CTA, and the link that switches modes.

- **Live password rules** (sign-up only): each rule shows with a tick as it's met. The rules match the project's Supabase Auth password settings; read them when building, don't assume (at least "8 or more characters").
- The CTA stays disabled (the flat disabled `Button`) until the email looks valid and every rule passes.
- Password rules and the email shape check are pure functions in `lib/`, checked in `scripts/ledger-check.mjs`.
- The screen keeps its fixed palette (default accent, following the device mode), so it doesn't repaint when the session lands. A failed sign-in shows one line under the form. Google stays parked and forgot password stays out (spec 42).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The check script covers each password rule, an empty password and a passing one, plus email shapes (valid, missing @, spaces, empty)
- [ ] Sign-up: the ticks follow typing, and the CTA enables only when everything is valid
- [ ] A new account signs up and lands in onboarding; an existing account signs in and lands on Home
- [ ] A wrong password shows the one-line error
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
