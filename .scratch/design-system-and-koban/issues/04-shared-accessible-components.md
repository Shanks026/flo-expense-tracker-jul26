# 04: Shared accessible components, with Settings as the first user

Spec: .claude/features/37-design-system-and-koban.md

**What to build:** Accessibility comes built into the shared pieces, and Settings shows the new calm, grouped-list look.
- Scale tokens are added alongside the old ones (no app-wide sweep):
  - a type ramp of 12/14/16/20/28/40 in 3 Manrope weights, with body text at least 14;
  - radii of 8/12/16 plus full;
  - 32/48 section spacing;
  - shadow and motion tokens.
- **IconButton:** a 48dp target, a required accessibility label, a button role and a pressed state.
- **BackButton** built on IconButton.
- **Row:** a grouped-list row with a hairline divider, a pressed highlight, and a role and label.
- **Button:** primary is a lime fill; secondary is a text button. **Card** stays for hero and emphasis surfaces only.
- Settings is rebuilt as flat grouped lists using these components and the new tokens.

**Blocked by:** 01 (Appearance: System / Light / Dark), 02 (Accessible colour tokens). All three edit Settings.

**Status:** ready-for-agent

- [ ] TalkBack announces every control on Settings with a label and role
- [ ] Every tappable element on Settings has at least a 48dp target and visible pressed feedback
- [ ] Settings doesn't clip at the largest system font size
- [ ] Settings looks right in light and dark

## Tracer

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built.
- **Tokens** (`theme/tokens.js`, alongside the old ones): `type` (12/14/16/20/28/40), `radius` (8/12/16/full), `spacing.section`/`sectionLg` (32/48), `hitTarget` (48), `shadow` (sm/md), `motion` (150/250/400 ms).
- **New shared components:**
  - `IconButton`: a 48dp target, button role, pressed highlight; logs an error in dev if `accessibilityLabel` is missing.
  - `BackButton`: an `IconButton` labelled "Back".
  - `Row` + `RowGroup` (`components/Row.js`): a grouped section on one surface with hairline dividers drawn between rows (falsy rows skipped). A row is at least 56dp with an optional icon, title, hint, value, chevron or custom right element, and a pressed highlight. A switch row is one accessible switch: tapping anywhere toggles it, and TalkBack hears "<title>, switch, on/off". A `danger` tone exists for destructive rows.
  - `SegmentedChoice`: a radio group with a selected state, 48dp touch height, and wrapping at large font sizes.
- **`Button`:** a new text-only `secondary` variant; every variant now has a button role, label and disabled/busy state. Primary stays the lime fill.
- **Settings rebuilt** (1,300 → 1,018 lines): the dark profile card stays as the one emphasis surface; everything else is `RowGroup`s (General, Appearance, Notifications, Reports, Summary Period, Transaction Detection, Data & export, and Delete Account as a danger row). The four hand-rolled chip and segment pickers became `SegmentedChoice`; the day-of-month stepper uses labelled `IconButton`s; the header uses `BackButton`; the delete dialog buttons have roles. 39 now-unused styles were removed.
- Open (emulator checks paused): TalkBack over Settings, 48dp targets and pressed feedback, the largest font size, light and dark. The header is still hand-drawn until ticket 05.
