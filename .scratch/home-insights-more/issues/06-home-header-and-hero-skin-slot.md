# 06: Home header and hero with skin slot

Spec: .claude/features/38-home-insights-more.md

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

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
