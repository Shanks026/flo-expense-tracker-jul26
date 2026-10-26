# 03: The short path (2b): new opener and Google-first sign-up

Spec: .claude/features/35-onboarding-v3.md

**What to build:** Subticket 2b of "the short path". The opener becomes the whole pre-auth intro. It shows:
- Koban (today's hello image; spec 37 swaps in the component);
- one line saying what FLO does;
- **Continue with Google** as the main action;
- **Other options / I have an account** below it;
- the analytics switch from spec 33, working as it does today.

What each action does:
- **Continue with Google** starts Google sign-in directly.
- **Other options** opens the sign-in screen in sign-up mode. Email sign-up there asks for email and password only, with no name from the old intro.
- **I have an account** opens the sign-in screen in sign-in mode.

The intro question screens are no longer reached. The 2a reminder ask follows sign-in, so the whole path is opener → Google → reminder ask → Home.

**Blocked by:** 02 (The short path (2a): the reminder ask finishes onboarding)

**Status:** ready-for-agent

- [ ] A fresh install opens on the new opener: Koban, one line of value, Continue with Google, Other options / I have an account, and the analytics switch, unticked
- [ ] Continue with Google signs up a new user and goes to the reminder ask
- [ ] Other options leads to email sign-up, which works without a name and goes to the reminder ask
- [ ] I have an account leads to sign-in; an onboarded user lands on Home
- [ ] No intro question screen appears on any path
- [ ] The analytics switch still copies to the new profile (spec 33's rules)
- [ ] The opener uses the pre-auth palette's tokens, with no hardcoded colours

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
