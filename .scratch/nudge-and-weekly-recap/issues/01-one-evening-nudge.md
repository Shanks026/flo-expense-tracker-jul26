# 01: One evening nudge, the morning and report pushes gone

Spec: .claude/features/39-nudge-and-weekly-recap.md

**What to build:**
- **At most one push a day.** `send-push` stops sending the morning nudge and the report-ready push. This replaces the "Your weekly report is ready" push that Settings can no longer switch off.
- **The evening nudge** still goes out at the profile's reminder time, local to `profiles.timezone`. It's skipped when today has a transaction, **or a no-spend mark** (spec 34's `streak_marks`).
- **Tapping a nudge** (the body or the "Log now" button) opens the Add sheet. Evening taps currently go to Home, for the TodayCard that no longer exists.
- **Leftover local notifications:** on upgrade, the app cancels any locally scheduled nudge, report or bill notification once.
- **Analytics:** a tap on a nudge records `nudge_opened {type}` through the consent-gated pipeline (spec 33).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] No `morning_nudge` or `report_ready` claims are written to `reminder_sends` (invoke `send-push` in cron mode, check through MCP)
- [ ] A no-spend mark for today means no evening nudge (MCP: seed the mark, invoke, no claim)
- [ ] Logging a transaction today still means no nudge
- [ ] Tapping the nudge opens the Add sheet, from a cold start and from a running app
- [ ] After upgrading, no local scheduled notifications remain
- [ ] `nudge_opened` rows land with consent on, and none with consent off
- [ ] The `send-push` header comment and feature 17's doc describe the new streams

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
