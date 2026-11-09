# 10: Budget proposals

Spec: .claude/features/44-ai-assistant.md (Phase 4)

**What to build:** "Set a ₹6,000 food budget for this month" gives a budget proposal card. Review opens the Add Budget sheet filled in as a **new** budget; until now that sheet could only open an existing one for editing. Save creates it, and the free-plan budget gate still runs at Save. A category the person doesn't have gets a question back ("which category did you mean?"), not a guess.

**Blocked by:** 09

**Status:** ready-for-agent

- [ ] Review opens a new, fully filled budget; Save creates one row
- [ ] Editing an existing budget works as before
- [ ] The gate code path still runs at Save (with billing flagged off, it passes)
- [ ] A missing category gets a question, not a guess

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
