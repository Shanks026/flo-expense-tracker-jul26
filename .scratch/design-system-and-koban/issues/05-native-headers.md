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

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built.
- The root `Stack` in `app/_layout.js` keeps `headerShown: false` by default and now themes the native header for any screen that turns it on: the theme `bg` background, ink tint and back arrow, a Manrope extrabold `type.title` title, and no shadow. Because the default stays off, screens that still draw their own header can't get a second one, and tabs, onboarding and sign-in show none.
- `settings` and `streak` turn it on with `<Stack.Screen options={{ headerShown: true, title }}>`. Both dropped their hand-drawn header, back button and header styles, and `SafeAreaView` no longer pads the top (the native header handles the status-bar inset); a small `paddingTop` keeps a gap under the header.
- `BackButton` (ticket 04) is now only for screens that still draw their own header; later specs move those screens to the native header as they touch them.
- Open (emulator checks paused): the back arrow and the system gesture on both screens, no double headers anywhere, light and dark, and TalkBack on the back button ("Navigate up").
