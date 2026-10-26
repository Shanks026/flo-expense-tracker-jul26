# 07: Simpler streak screen

Spec: .claude/features/34-streak-only.md

**What to build:** The streak screen shows progress at a glance:
- a calendar of covered days, each marked logged, no-spend or frozen;
- the freezes held (0–2);
- the current streak;
- the next milestone (7, 30, 100 or 365).

The badge grid, trophy links and the manual "use a freeze" action are removed.

**Blocked by:** 03 (Freezes are earned and spent automatically)

**Status:** ready-for-agent

- [ ] Seeded logged, no-spend and frozen days each look different on the calendar
- [ ] The freezes-held number matches the marks in Supabase
- [ ] The next milestone is correct (for example, day 12 shows 30)
- [ ] No badge grid, trophy link or freeze button on the screen

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
