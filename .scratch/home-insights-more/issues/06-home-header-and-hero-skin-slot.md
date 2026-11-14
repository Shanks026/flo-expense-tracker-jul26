# 06: Home header and hero with skin slot

Spec: .claude/features/archive/38-home-insights-more.md

**What to build:**

The Home header shows:
- the account switcher with 2+ accounts, otherwise the month name;
- the streak chip, which opens the streak screen;
- the bell.

Coins, freezes, level, Trophy and Shop are gone.

The hero shows:
- **"Spent this month"** as the biggest thing on Home, on the emphasis surface;
- **"₹X left of budget"** only when a budget covers the period;
- no carousel chrome with 1 account.

The hero renders through a `skin` prop that defaults to the plain emphasis surface. Whatever the skin, the money figure sits on a fixed-contrast plate (≥4.5:1).

**Blocked by:** 03 (Five tabs and the More screen)

**Status:** ready-for-agent

- [ ] 1 account: month name, streak chip, bell; no carousel dots or switcher
- [ ] 2+ accounts: the switcher replaces the month name
- [ ] Tapping the streak chip opens the streak screen; the bell opens alerts
- [ ] "left of budget" shows with a budget and is absent without one
- [ ] The money figure keeps ≥4.5:1 contrast on its plate in light and dark

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built.
- **Header:**
  - with 2+ accounts, the active account's name and a chevron open the account switcher;
  - with one account, the month name;
  - then the streak chip (opens `/streak`) and the bell;
  - all are labelled, 48dp targets.
- **Removed from Home:**
  - the greeting row;
  - the coins/freezes/level chip, Trophy and Shop;
  - the pending login-reward burst;
  - the card-theme hookup.
  - `AccountHeroCarousel` and `AccountDots` had no other users and are deleted.
- **New `components/HomeHero.js`:**
  - shows the active account's spend for the reset period (`period_expense`), labelled from `profiles.reset_period` ("Spent this month" by default);
  - adds "₹X left of budget" (or "over budget") only when an overall, still-open budget exists, monthly first.
- **Skin slot:** `skin` prop resolved through `resolveHeroSkin`, with only `plain` today. The figure always sits on an `emphasisBg` plate with white text.
- Open (emulator checks paused): one vs two accounts, the budget line appearing and disappearing, light and dark.
