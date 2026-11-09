# 07: Ask about everything else

Spec: .claude/features/44-ai-assistant.md (§3.2)

**What to build:** The chat can answer the rest of the spec's questions: an account breakdown, comparing this month to last month, finding transactions, budget status and bills due. Each one is answered through a tool that computes the number on the server, from the same views the app uses. Starter chips on the empty chat offer the common questions. The system prompt keeps answers short, says which period was used, refuses to estimate a number no tool gives, and treats notes and names as data, not instructions.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] 15 scripted questions give the same numbers as Insights and the account card
- [ ] "What will I spend next month?" gets an honest "I can't", with no invented number
- [ ] A note saying "ignore previous instructions…" changes nothing
- [ ] Median turn time with one tool round is ≤ 4 s, on the phone

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
