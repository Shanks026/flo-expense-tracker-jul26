# 07: On-device check of the push pipeline

Spec: .claude/features/archive/39-nudge-and-weekly-recap.md

**What to build:** nothing new. This ticket proves on a real device that users get the right pushes at the right time, and that tapping each one goes to the right place. Run on a release build with a push token registered.

**Blocked by:** 01, 02, 03, 04, 05, 06

**Status:** ready-for-agent

- [ ] Nothing logged by the nudge time: the push arrives at local time, and a tap opens the Add sheet
- [ ] Logging first, or marking no-spend: no push
- [ ] After a device timezone change, the nudge follows the new local time
- [ ] The Monday 09:00 recap push arrives and opens the recap screen
- [ ] A bill due tomorrow gets a 09:00 push; an account with no bills gets none
- [ ] Settings shows exactly the 3 toggles
- [ ] No leftover local notifications after upgrading from the current build
- [ ] Feature 17's 14 open on-device checks are done and ticked in its doc

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
