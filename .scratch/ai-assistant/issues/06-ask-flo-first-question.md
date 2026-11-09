# 06: Ask your first question

Spec: .claude/features/44-ai-assistant.md (Phase 3)

**What to build:** An "Ask FLO" row at the top of the More tab opens a chat screen. Asking "how much did I spend on food this month?" gets a short, correct answer in ₹ that says which period it used. The number comes from a spending-total tool that the function runs against the person's own data, counting only exact expense or income types, so transfers never count. The model only picks the tool and phrases the result. Conversations and messages are stored, and the function writes both sides. The screen has a message list and a text composer; the empty state uses Koban. The chat tables need the person's yes on the SQL, applied with the CLI.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] The chat tables exist with RLS; user A can't read B's conversations, or add a message to one of them (rolled-back check); the advisor shows no new WARN
- [ ] "How much on food this month?" matches the Insights screen exactly
- [ ] A transfer between accounts doesn't change the answer
- [ ] With the AI flag off, the More row is hidden
- [ ] The keyboard doesn't cover the composer (Pixel_API_36, light and dark)

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
