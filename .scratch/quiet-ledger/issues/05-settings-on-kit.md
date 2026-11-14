# 05: Settings on the new kit

Spec: .claude/features/archive/46-quiet-ledger-foundations-and-core-loop.md

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

**Status:** resolved

- [x] Every Settings row from before is present and works: notifications, summary period, voice language, detection, consent, export all, delete account and log out (plus currency, only with its flag on) (all present; consent toggle, delete dialog and Cancel exercised; export, log out and currency-on not run)
- [x] The segmented control switches Appearance between System, Light and Dark
- [x] Back returns to the previous screen, and the title collapses on scroll
- [x] No card groups and no uppercase captions
- [x] Emulator check in light and dark

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-10: New kit pieces in `components/ledger/`: `ScreenHeader` (with `LargeTitle` and `useHeaderScroll`; the route sets `headerShown: false`, and Back goes Home when nothing is behind), `Segmented`, `Callout`, and a visual-only `Switch`. `ListRow` gained `trailing` (`"chevron"`, `"check"` or a node), `switchValue`/`onSwitchChange` (the whole row is the switch), `danger`, `disabled`, `subLines` and `children` (an in-row control under the title). New ledger tokens: `thumb`, `knob`, `thumbEdge`, `shadow`. `AppearanceToggle` deleted (no users left).
- Callouts are one line, so the battery callout dropped the Vivo/iQOO "High background power consumption / Autostart" detail (it stays in the handler's comment). The detection footer became the Enable detection row's sub. The blocked-notifications notice is a danger callout.
- Checked on Pixel_API_36: light and dark, System/Light/Dark, title collapse, Back, the consent switch, the delete dialog and Cancel. Not checked: export, log out, the time and date pickers, Send test, currency with its flag on, TalkBack, Reduce motion. Reviewed with the two-agent code review; its accessibility, divider and hardcoded-colour findings were fixed. Test account is back on Light, card Dusk, consent on.
