# 03: Day as the free default card

Spec: .claude/features/46-quiet-ledger-foundations-and-core-loop.md

**What to build:** A user who has never picked a card sees the Day landscape for the current time of day. An equipped theme and an explicit choice of Ink still win.

- The card theme catalog gains a free `day` theme. It renders the Day scene for the current period (morning 5–12, afternoon 12–17, evening 17–20, night 20–5) and works out the period again when Home regains focus.
- A profile with no equipped theme resolves to `day`. Before building, check whether any code path saves `ink` as a default instead of leaving it null. If one does, treat that value as "never chose".
- Personalize lists Day first, and Ink stays selectable. There's no database change.
- The check script gains the period boundary cases.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Check script: 4:59 → night, 5:00 → morning, 12:00 → afternoon, 17:00 → evening, 20:00 → night
- [ ] A test account with no equipped theme shows Day on the live Home card and in the Home preview
- [ ] Day, Ink and a seasonal skin, each equipped in Personalize, stay equipped after relaunch
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
