# 09: First expense and the reminder ask on the kit

Spec: .claude/features/47-quiet-ledger-onboarding.md

**What to build:** The last two onboarding steps on the kit.

- **First expense:** the same flow (the Add sheet opens a beat after mount; save or close moves on, `?logged=1` after a save). The screen behind is the ledger look, the sheet shows a title strip "Log your first expense: type it or hold to say it", and **Not now** is a quiet button.
- **Reminder ask:** a `whistle` Illustration, two lines of copy ("Logged." first after a save), a time row (default 21:00) opening the system time picker (built on today's date, per the Settings Madras-time note), **Allow notifications** (primary) and **Maybe later** (secondary).
  - Allow requests the OS permission. On a grant, the nudge stays on, the time is written to `profiles.evening_reminder_time`, and the push token is registered. On a refusal, the nudge is turned off.
  - Maybe later turns the nudge off and doesn't save the time.
  - Either way `finish()` runs and the gate takes the person Home.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The first expense saves and the reminder step opens with "Logged."; Not now skips it
- [x] Allow with 8:30 pm and a grant saves 20:30 and reminders on (DB); the push token registers
- [x] Maybe later saves reminders off and leaves the time at its default
- [x] A refused permission still finishes onboarding
- [x] Emulator check in light and dark (Android 16 runtime notification permission)

## Tracer

- [x] Code implementation
- [x] Verified (emulator check)
- [x] Green signal

## Comments

- 2026-11-11: Both screens are on the ledger kit: `Illustration`, `PinnedFooter` (Not now is `quiet`) and a `ListRow` time row. The Add sheet takes an `intro` line, and the first expense opens it with the quick-add line on. With `FLAGS.ai` off, the intro drops "type it or hold to say it". The reminder times moved from Settings into `lib/reminderTime.js` (`timeOnToday` on today's date, `toTimeColumn`, `isEveningTime` and the defaults), with 9 new `reminder` cases (225 in total). Settings uses them too.
- Emulator, Pixel_API_36:
  - In dark, on the skip account, the sheet showed the intro and the quick-add line. Close led to "Want a nightly nudge?" without "Logged.". Picking 8:30 PM, then Maybe later, finished on Home with reminders off and the time left at 21:00.
  - Also in dark, Allow then "Don't allow" on the Android 16 prompt finished on Home with reminders off.
  - In light, on the ticket 04 account, "coffee 120" in quick add then Save led to "Logged. Want a nightly nudge?". Picking 8:30 PM and Allow, then granting, saved `reminders_enabled` true and `evening_reminder_time` 20:30:00. A push token row was added (there were none before). Settings showed Evening 8:30 PM.
  - After the review fixes, Maybe later again left the stored time alone, and Settings showed Morning 8:00 AM and Evening 8:30 PM.
- Decided: a first expense entered through quick add records `expense_logged` with source `quick_local`/`quick_ai`, not `onboarding`, and `transactions.source` `quick_add`/`voice`. This step exists to teach quick add, and the funnel views don't filter on source. A first expense typed into the fields still records `onboarding`.
- Not checked:
  - a first expense spoken by voice;
  - `FLAGS.ai` off on the emulator;
  - the step events, because consent is off.
- Seen, not changed:
  - A refused permission takes a few seconds to reach Home, which is the gate waiting for the profile refetch.
  - The sheet opens over this step's own screen, not over Home (story 34 asks for Home behind it).
  - The PM-only time rule is carried over from Settings.
