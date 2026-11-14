# 06: Weekly recap push

Spec: .claude/features/archive/39-nudge-and-weekly-recap.md

**What to build:**
- **A Monday-morning recap push.** `send-push` gets a `weekly_recap` trigger at 09:00 local on Mondays. It's a new trigger inside the existing function, not a new function.
- **Who gets it:** users with `weekly_recap_enabled` on who logged at least once in the previous week. It's claimed once per ISO week, so it never sends twice. It still goes out to users the nudge back-off has silenced (03).
- **The copy** comes from the same recap numbers as the screen: last week's total, how it compares, and the streak (from 04). Import the recap module from 05 if Edge Function deployment can bundle it; otherwise copy the logic, the way `reminderCopy.ts` does.
- **Tapping it** opens the recap screen for that week.

**Blocked by:** 02 (Settings: three toggles), 04 (The streak in the nudge copy), 05 (Recap data and the recap screen)

**Status:** ready-for-agent

- [ ] Invoking `send-push` at Monday 09:00 local claims `weekly_recap` once for the ISO week, and a second run claims nothing (MCP)
- [ ] No push with the recap toggle off, or with nothing logged last week (MCP)
- [ ] The push's numbers match the recap screen for the same week
- [ ] Tapping the push opens the recap screen, from a cold start and from a running app
- [ ] Deployed only after the person says yes

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
