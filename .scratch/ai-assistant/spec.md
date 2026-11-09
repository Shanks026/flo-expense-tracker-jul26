# Feature: AI assistant (quick add + chat, via OpenRouter)

Spec: .claude/features/44-ai-assistant.md

Decisions made while ticketing (2026-11-09, after grilling; the tickets follow the to-tickets process as vertical slices):
- The AI feature is built **from scratch**. No code from the earlier attempts (spec 13, `ai-interpret`, `ai-report-summary`) is reused, and the app has none left.
- Ticket 01 is usable on the phone with no key: the local parser, the quick-add line and the test set. Ticket 02 adds the model, the usage table and the function.
- Phases run in order: chat (06) waits on voice (05). 07 and 08 can run side by side, and so can 10 and 11.
- SQL goes through the CLI (`npx supabase db query --remote=… -f`) after a yes, because the MCP declines writes.
- The Add sheet already has an analytics `source`; quick add sets it to `quick_local` or `quick_ai`.
- Phase 5 (launch hardening) is parked until launch and has no tickets.
