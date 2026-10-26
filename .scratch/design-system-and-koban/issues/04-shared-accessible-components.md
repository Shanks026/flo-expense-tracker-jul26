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

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
