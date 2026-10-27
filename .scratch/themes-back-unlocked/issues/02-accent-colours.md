# 02: Accent colours back

Spec: .claude/features/43-themes-back-unlocked.md

**What to build:** Picking an accent in Personalize and tapping Equip repaints the whole app. The accent is saved on the phone (so the first frame is right on a cold start) and to the profile (so it follows the account to another phone). Signing in to a different account starts on lime until that account's own accent loads. With the `themes` flag off, the accent stays fixed to lime as it is today.

**Blocked by:** 01 (Card themes back, all unlocked)

**Status:** ready-for-agent

- [ ] Equipping an accent repaints buttons, tabs and brand surfaces app-wide
- [ ] The accent survives a relaunch and a sign-out/sign-in of the same account
- [ ] A different account gets its own accent, not the previous one's
- [ ] Dark-only accents (Ash, Cream) stay locked in light mode
- [ ] Flag off: the accent is lime and the picker is unreachable

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

- 2026-10-27: Built.
  - **`ThemeContext`** holds the accent again (`flo.themeAccent`) and exposes `setAccent` and `accentPreference`. Lime is shown while `FLAGS.themes` is off, or while a dark-only accent meets light mode.
  - **`ThemeProfileSync`** resets the accent to lime on a user switch, then applies `profiles.theme_accent`, comparing it first.
  - **Personalize's Equip** writes the accent locally and to the profile, before the card's `notifyChanged()`. The code review caught a race where it was written after, and the old accent could come back.
  - **Checks:** the bundle builds. Phone check pending: equip an accent, relaunch, then sign out and back in. Expect contrast problems on some accents (spec 37); they're accepted for now.
