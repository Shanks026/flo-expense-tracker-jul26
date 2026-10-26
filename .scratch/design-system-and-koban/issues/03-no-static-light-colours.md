# 03: No static light-mode colours in screens

Spec: .claude/features/37-design-system-and-koban.md

**What to build:** Dark mode is right everywhere, because no screen or component paints with the fixed light palette any more.
- Every screen and component that imports the static light-mode colours (about 40 files) reads colours from the theme instead.
- The fixed palette stays available only to the theme itself and to surfaces that are dark on purpose in both modes (for example, celebration screens), each with a comment saying so.
- A mechanical sweep, done in batches of about 10 files, each batch left working.

**Blocked by:** 02 (Accessible colour tokens), so migrated files pick up the new tokens

**Status:** ready-for-agent

- [ ] No screen or component imports the static light palette, except the documented always-dark surfaces
- [ ] A dark-mode pass over every main screen and sheet shows no light-only colour (white cards, dark-on-dark text or icons)
- [ ] Light mode looks unchanged

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
