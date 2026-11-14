# Notifications: one evening nudge and the weekly recap

Spec: .claude/features/archive/39-nudge-and-weekly-recap.md

Decisions made while ticketing (2026-11-03):
- Settings (02) and the recap data and screen (05) don't depend on the server work, so they can start alongside 01.
- The recap module (05) stays free of React Native imports, so the recap push (06) can try importing it from `send-push`. If deployment can't bundle a file from outside the function folder, 06 copies the logic, the way `reminderCopy.ts` already does.
- The Home recap card and the Insights summary stay in spec 38 ticket 10. That ticket waits on 05 here.
- 07 builds nothing. It runs the on-device checks, including feature 17's 14 open ones.
