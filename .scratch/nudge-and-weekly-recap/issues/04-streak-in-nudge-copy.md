# 04: The streak in the nudge copy

Spec: .claude/features/archive/39-nudge-and-weekly-recap.md

**What to build:**
- **`send-push` knows the user's streak.** It counts it server-side from transactions plus no-spend and freeze marks, with the same result the app's streak screen shows. The recap push (06) reuses this count.
- **Nudge copy names the streak from 2 days up,** e.g. "Keep your 6-day streak going", in the existing reminder-copy voice.
- **A milestone tier:** special copy when tonight's log would reach 7, 30, 100 or 365 days.
- **No push about a spent freeze.** That stays an in-app toast only.

**Blocked by:** 01 (One evening nudge)

**Status:** ready-for-agent

- [ ] For a seeded account, the server's streak count matches the app's streak screen, including frozen days (MCP plus the app)
- [ ] A streak of 0–1 gets the plain copy; 2 or more names the streak
- [ ] On the eve of a milestone, the milestone copy is used
- [ ] No push is sent when a freeze is spent

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
