# 05: Long-press + to speak

Spec: .claude/features/44-ai-assistant.md (Phase 2, Goal)

**What to build:** Long-pressing the + tab opens the Add sheet already listening. When the person stops speaking, the sheet fills in, and **the filled sheet is the preview**. The transcript stays in the quick-add line, so they can fix a word and parse it again, every field can be edited, and Save writes the entry. There's no separate preview card. A short tap on + works exactly as before.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Long-press + → speak → the sheet is filled, and Save writes one row
- [ ] Editing the transcript and parsing again updates the fields
- [ ] A short tap on + opens the sheet as before, with no listening
- [ ] Phone check, light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
