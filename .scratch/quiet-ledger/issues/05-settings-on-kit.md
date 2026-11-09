# 05: Settings on the new kit

Spec: .claude/features/46-quiet-ledger-foundations-and-core-loop.md

**What to build:** Settings becomes flat grouped rows on the canvas. This ticket builds the shared header, segmented control and callout as Settings needs them.

- New `ScreenHeader`: a 40 dp circle back button, an optional left-aligned large title that collapses on scroll, and up to two circle icon actions.
- New `Segmented`: a sunk track with a white thumb (`surface` in dark mode), 2–4 options, controlled, with a 48 dp target. Appearance uses it.
- New `Callout`: info, warn and danger tones, with an icon, one line and an optional action. The battery advice becomes a warn callout.
- `ListRow` gains a trailing slot for a chevron, switch, check or compact button.
- Rows are grouped under sentence-case `SectionHeader`s.
- Delete account is a danger row above Log out.
- Developer rows appear only in dev builds.
- Every existing setting and behaviour carries over, and `currencyPicker`, `billing` and `economy` behave as now.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Every Settings row from before is present and works: notifications, summary period, voice language, detection, consent, export all, delete account and log out (plus currency, only with its flag on)
- [ ] The segmented control switches Appearance between System, Light and Dark
- [ ] Back returns to the previous screen, and the title collapses on scroll
- [ ] No card groups and no uppercase captions
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
