# 01: Card themes back, all unlocked

Spec: .claude/features/43-themes-back-unlocked.md

**What to build:** Settings → Personalize comes back behind a new `themes` flag, separate from the economy flag. It lists every card design, with nothing locked or priced and no link to the Shop. Equip saves the choice to the profile, and Home's account card paints the equipped design. A new `themeGating` flag, off, makes every design count as owned without reading the coin economy. Coins, XP, the Shop and trophies stay off.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Personalize is reachable from Settings and lists all ~50 card designs; no lock, price or Shop link
- [ ] Equipping a design shows it on Home's account card, and it survives an app relaunch
- [ ] The default Ink card looks as it does today in light and dark
- [ ] The Shop, trophies and the spin wheel still redirect to Home
- [ ] No economy table is read for ownership while gating is off

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

- 2026-10-27: Built.
  - **Flags:** `FLAGS.themes` (on) and `FLAGS.themeGating` (off). `useCardThemes` treats every theme as owned and reads only `profiles.equipped_card_theme`. `equipTheme` checks `themes`, not `economy`.
  - **Personalize** is back from Settings → Appearance. The Shop link shows only with the economy flag, and the Light/Dark toggle moved out (Settings owns System/Light/Dark).
  - **Home's account card** paints the equipped design. Ink keeps the plain emphasis surface, on Home and in the preview.
  - **Checks:** the bundle builds. Phone check pending: equip a design, see it on Home, relaunch. Also check that the money figure is readable on patterned and gradient cards.
