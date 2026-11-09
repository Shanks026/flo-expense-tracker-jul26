# 11: Bill proposals

Spec: .claude/features/44-ai-assistant.md (Phase 4)

**What to build:** "Remind me about rent, 15,000, on the 1st every month" gives a bill proposal card. Review opens the Add Bill sheet filled in as a **new** bill, with the name, amount, cadence, next due date and category. Save creates it. Editing an existing bill is unchanged.

**Blocked by:** 09

**Status:** ready-for-agent

- [ ] Review opens a new, fully filled bill; Save creates one row
- [ ] The cadence and due date match what the sheet itself would write
- [ ] Editing an existing bill works as before
- [ ] Phone check

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
