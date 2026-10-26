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

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built.
- **Onboarding now follows Appearance (System by default).** That was the person's call on 2026-10-26: people couldn't get dark mode, and it reverses the old "no dark background in onboarding" rule. `OnboardingScreen`'s `light` palette reads the theme; the lime `brand` screens stay lime with ink in both modes. The opener, the reminder and first-expense steps moved to `makeStyles(colors)`. The mascot placeholder reads the theme. Sign-in follows the active Appearance too, and its logo mark takes the theme ink.
- **Real dark-mode bugs fixed:** `StreakFlame` (the streak screen calendar and legend) painted pale light-mode no-spend and empty cells on dark; it now reads the theme, and only its `dark` (celebration) cells keep the static ones. `ProBadge`'s overlay ring now matches the theme background.
- **Everything else is deliberate and now says so.** Every remaining static import has a "Static palette (theme/tokens) …" note naming why: a permanently dark surface (`Card dark` / `emphasisBg` text, the Pro screen, celebrations), white on an always-dark button, the Switch thumb, lime fills, or danger/warn, which are mode-independent. All of ticket 02's 34 `mutedOnDark*` uses were confirmed to be on dark surfaces. Two unused static imports were removed (shop, plan history).
- Open (emulator checks paused): a dark-mode pass over every main screen, sheet and onboarding step, and light mode unchanged.
