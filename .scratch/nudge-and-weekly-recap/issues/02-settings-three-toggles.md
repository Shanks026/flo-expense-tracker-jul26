# 02: Settings: one Notifications section with three toggles

Spec: .claude/features/archive/39-nudge-and-weekly-recap.md

**What to build:**
- **Settings → Notifications** has exactly three controls:
  - **Daily nudge,** with a time (21:00 by default, any time of day allowed);
  - **Weekly recap;**
  - **Bill reminders,** with the days-before choice.
- **What goes:** the Morning time row and its AM/PM rule, plus the dev-only "Push notifications" row. The permission-blocked hint and the battery-settings hint stay.
- **New profile setting:** `weekly_recap_enabled`, default true. This is a migration; show the SQL and ask before applying it.
- **Bill reminders default to 1 day before,** in both the app and `send-push`.
- **Ignored, not dropped:** `morning_reminder_time` and the report cadence columns.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Settings shows exactly Daily nudge (with its time), Weekly recap and Bill reminders
- [ ] Changing the nudge time writes `evening_reminder_time`, and any time of day is accepted
- [ ] The Weekly recap toggle writes `weekly_recap_enabled` (check through MCP)
- [ ] A new account defaults to the recap on and bill reminders 1 day before
- [ ] The migration is applied and recorded in `00-index.md`'s schema notes
- [ ] Checked in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
