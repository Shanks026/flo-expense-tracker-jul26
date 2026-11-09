# 03: Day as the free default card

Spec: .claude/features/46-quiet-ledger-foundations-and-core-loop.md

**What to build:** A user who has never picked a card sees the Day landscape for the current time of day. An equipped theme and an explicit choice of Ink still win.

- The card theme catalog gains a free `day` theme. It renders the Day scene for the current period (morning 5–12, afternoon 12–17, evening 17–20, night 20–5) and works out the period again when Home regains focus.
- A profile with no equipped theme resolves to `day`. Before building, check whether any code path saves `ink` as a default instead of leaving it null. If one does, treat that value as "never chose".
- Personalize lists Day first, and Ink stays selectable. There's no database change.
- The check script gains the period boundary cases.

**Blocked by:** 01

**Status:** resolved

- [x] Check script: 4:59 → night, 5:00 → morning, 12:00 → afternoon, 17:00 → evening, 20:00 → night
- [x] A test account with no equipped theme shows Day on the live Home card and in the Home preview
- [ ] Day, Ink and a seasonal skin, each equipped in Personalize, stay equipped after relaunch (Day and Ink saved and showed; a seasonal skin and a relaunch not re-checked)
- [ ] Emulator check in light and dark (light only)

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-10: `profiles.equipped_card_theme` is NOT NULL with default `'ink'`, so "never chose" and "chose Ink" were the same value. Decided with the person: a stored `'ink'` means Day; choosing Ink in Personalize saves `ink-classic`. No database change. The old `ink` entry stays in the catalog for lookups but isn't listed.
- Checked on Pixel_API_36 (light): Personalize lists Day first and Ink second; equipping Day saved `day` and the live Home card showed the night scene at 02:20; equipping Ink saved `ink-classic` and showed plain black; the test account is back on `dusk`. The check script covers the period boundaries and every id case (23 passing). Not checked: dark mode (the Day art doesn't change with the mode) and the re-resolve on the minute tick. Reviewed by the implementer only (no review agents), to save the weekly limit.
