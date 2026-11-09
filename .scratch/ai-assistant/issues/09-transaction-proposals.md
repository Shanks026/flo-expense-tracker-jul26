# 09: "Add 250 auto yesterday" from chat

Spec: .claude/features/44-ai-assistant.md (Phase 4)

**What to build:** When the person asks the chat to log something, it replies with a proposal card that describes the entry in plain words, with Review and Dismiss. Review opens the Add sheet pre-filled; Save writes it through the existing code, and the card then shows "Saved ✓". The function checks the proposal's ids, amount and date before showing it. An invalid proposal is dropped and the model is told why. Nothing is written without the Save tap.

**Blocked by:** 07, 08

**Status:** ready-for-agent

- [ ] The function writes to no table except its own usage and chat tables (read the code)
- [ ] Review opens the Add sheet fully filled; Save creates exactly one row; the card shows "Saved ✓"
- [ ] Dismiss leaves nothing behind
- [ ] Phone check

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
