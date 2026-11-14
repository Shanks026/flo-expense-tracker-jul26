# 03: Sign up and sign in on the kit

Spec: .claude/features/archive/47-quiet-ledger-onboarding.md

**What to build:** The sign-in / sign-up screen is rebuilt on the kit: a left-aligned large title, labelled email and password fields, a show/hide control, the terms line in small muted text above a pinned CTA, and the link that switches modes.

- **Live password rules** (sign-up only): each rule shows with a tick as it's met. The rules match the project's Supabase Auth password settings; read them when building, don't assume (at least "8 or more characters").
- The CTA stays disabled (the flat disabled `Button`) until the email looks valid and every rule passes.
- Password rules and the email shape check are pure functions in `lib/`, checked in `scripts/ledger-check.mjs`.
- The screen keeps its fixed palette (default accent, following the device mode), so it doesn't repaint when the session lands. A failed sign-in shows one line under the form. Google stays parked and forgot password stays out (spec 42).

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The check script covers each password rule, an empty password and a passing one, plus email shapes (valid, missing @, spaces, empty)
- [x] Sign-up: the ticks follow typing, and the CTA enables only when everything is valid
- [x] A new account signs up and lands in onboarding; an existing account signs in and lands on Home
- [x] A wrong password shows the one-line error
- [x] Emulator check in light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-11: built and checked on Pixel_API_36, light and dark. Supabase Auth on this project was read from the server's own `weak_password` reply: it rejects under 6 characters and has no character-class rule (7 lowercase letters were accepted). The form asks for 8 or more characters (`lib/authRules.js`), stricter than the server, so Create account never enables for a password the server turns down. On the emulator: the tick and the button follow typing; an email without @ keeps the button off; a wrong password shows "That email and password don't match"; signing up with a taken email shows "That email already has an account. Sign in instead"; a new account (`FLO_ONB03_*` in `.env.test.local`) lands on "Where does your money live?"; ONB04 signs in to Home, including through the keyboard's Next and Go. The check script adds 24 cases (286 pass). Review (two agents): no hard violations; fixed the Google slot comment (kept, as the spec says), a ref guard against a double submit from Go, iOS keyboard avoidance, an unreachable weak-password line, and a reused rule check. Not checked: iOS. The terms line names no linked documents because none are published yet (`PRIVACY_POLICY_URL` is null). The mode can still change when an account whose saved Appearance differs from the device's signs in (the accent can't, since the ledger palette has none), as on the old screen. Seen once and not reproduced in four later tries: after clearing app data, the first sign-in stayed on sign-in with `useProfile` holding `profile: null, loading: false` (the first profile read came back empty and nothing re-read it); a reload went to Home. That's in `useProfile` and `OnboardingGate`, not this screen, and it's worth a look before ticket 10's full-flow check. A probe sign-up made while reading the Auth rules left one throwaway user, `flo_probe_2938115231@example.com`; deleting it was declined, so it's still in Auth.
- 2026-11-11 (follow-up): the stuck sign-in is fixed. Cause: `useProfile` treated one failed or empty read as final (`profile` null, `loading` false, nothing re-read it), and `OnboardingGate` waits on the profile, so one bad read right after sign-in left the person on sign-in for good. Reproduced by forcing every profile read in the first 3 s after sign-in to fail: it stayed on sign-in past 20 s. Fix: a read that fails or comes back empty for a signed-in user is retried after 1, 2, 4 and 8 s, reset on a user change. With the same forced failures (17 of them), sign-in reached Home within 10 s; a normal cold start still goes straight Home.
