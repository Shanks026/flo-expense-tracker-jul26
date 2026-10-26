# 05: Native headers on pushed screens

Spec: .claude/features/37-design-system-and-koban.md

**What to build:** Pushed screens behave like any Android app: a standard header with a back button and the system back gesture.
- The root Stack shows native headers for pushed screens, themed for light and dark with the new type tokens. Tab screens and full-screen flows (onboarding, sign-in) keep no header.
- Settings and the streak screen drop their hand-built header and back button for the native one.
- The other hand-built headers move over as later specs touch their screens (spec 38 covers the main ones). Until then, a screen that still draws its own header must not get a second one.

**Blocked by:** 04 (Shared accessible components, with Settings as the first user)

**Status:** ready-for-agent

- [ ] Settings and the streak screen show the native header and go back with both the header button and the system gesture
- [ ] No screen shows two headers; tabs, onboarding and sign-in show none
- [ ] Headers look right in light and dark, and TalkBack announces the back button

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
