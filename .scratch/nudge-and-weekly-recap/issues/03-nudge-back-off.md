# 03: Nudge back-off

Spec: .claude/features/39-nudge-and-weekly-recap.md

**What to build:**
- **The nudge backs off when it's ignored.** An ignored nudge is a sent nudge followed by a day with no log and no no-spend mark. `send-push` counts consecutive ignored nudges from `reminder_sends` and the logging history:
  - 0–2 ignored: daily, as now;
  - 3–6 ignored: only on alternate days;
  - 7 or more: no nudge (the weekly recap, 06, still goes out).
- **Any log or no-spend mark** resets the count, so daily nudges come back the next evening.

**Blocked by:** 01 (One evening nudge)

**Status:** ready-for-agent

- [ ] 3 ignored nudges seeded: `send-push` skips the next day and sends the day after (MCP)
- [ ] 7 ignored nudges seeded: no nudge is claimed (MCP)
- [ ] A log after that: the next evening's nudge is claimed again (MCP)
- [ ] A no-spend mark resets the count the same way a log does (MCP)

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
