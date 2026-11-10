# 09: First expense and the reminder ask on the kit

Spec: .claude/features/47-quiet-ledger-onboarding.md

**What to build:** The last two onboarding steps on the kit.

- **First expense:** the same flow (the Add sheet opens a beat after mount; save or close moves on, `?logged=1` after a save). The screen behind is the ledger look, the sheet shows a title strip "Log your first expense: type it or hold to say it", and **Not now** is a quiet button.
- **Reminder ask:** a `whistle` Illustration, two lines of copy ("Logged." first after a save), a time row (default 21:00) opening the system time picker (built on today's date, per the Settings Madras-time note), **Allow notifications** (primary) and **Maybe later** (secondary).
  - Allow requests the OS permission. On a grant, the nudge stays on, the time is written to `profiles.evening_reminder_time`, and the push token is registered. On a refusal, the nudge is turned off.
  - Maybe later turns the nudge off and doesn't save the time.
  - Either way `finish()` runs and the gate takes the person Home.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The first expense saves and the reminder step opens with "Logged."; Not now skips it
- [ ] Allow with 8:30 pm and a grant saves 20:30 and reminders on (DB); the push token registers
- [ ] Maybe later saves reminders off and leaves the time at its default
- [ ] A refused permission still finishes onboarding
- [ ] Emulator check in light and dark (Android 16 runtime notification permission)

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
